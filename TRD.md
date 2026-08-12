# Emergency Referral Orchestration Network (ERON)
### Technical Requirements Document (TRD) — v1.0

**Companion to:** Final Consolidated PRD
**Stack:** Next.js (frontend) · Node.js/Express (backend) · PostgreSQL · Socket.io (real-time) · Redis (caching/pub-sub) · Twilio/MSG91 (SMS)
**Scope:** Production-grade design, buildable incrementally starting with MVP

---

## 1. System Overview

ERON is a real-time orchestration layer, not a hospital directory. Its technical core is three problems:

1. **State consistency** — bed/ICU/ventilator capacity must never be double-allocated (race conditions between simultaneous referrals).
2. **Real-time propagation** — a capacity change or referral status update must reach every relevant actor (staff, ambulance, control room) within seconds.
3. **Deterministic matching under uncertainty** — rank hospitals by capability + live capacity + ETA, and recompute instantly when a match becomes invalid mid-transfer.

Everything below is designed around solving these three problems cleanly, not around feature count.

---

## 2. High-Level Architecture

```
┌─────────────────┐        ┌──────────────────────┐        ┌─────────────────┐
│  Next.js Web App │◄──────►│   Express API Layer   │◄──────►│   PostgreSQL     │
│  (Staff/Hospital/│  HTTPS │  (REST + Auth + BL)   │  SQL   │  (source of      │
│  Control Room UI)│        │                       │        │   truth)         │
└─────────┬────────┘        └──────────┬────────────┘        └─────────────────┘
          │                            │
          │ WebSocket                  │ pub/sub
          ▼                            ▼
┌─────────────────┐        ┌──────────────────────┐        ┌─────────────────┐
│  Socket.io Layer │◄──────►│        Redis          │        │  SMS Gateway     │
│  (live events)   │        │ (cache + pub/sub +    │◄──────►│  (Twilio/MSG91)  │
│                   │        │  distributed locks)   │        │                 │
└─────────────────┘        └──────────────────────┘        └─────────────────┘
          │
          ▼
┌─────────────────┐
│  Maps/ETA Service │  (Google Maps Distance Matrix / OSRM self-hosted)
└─────────────────┘
```

**Why Redis matters here beyond caching:** bed-state races (Section 6) are solved with Redis distributed locks (`SETNX` / Redlock pattern) around the "HOLD" transition, before the Postgres transaction commits. This is the single most important infra decision in the system — without it, two referral desks can both get a "confirmed" response for the same bed.

---

## 3. Tech Stack (confirmed)

| Layer | Choice | Reasoning |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR for control-room dashboards, API routes for BFF pattern if needed |
| Backend | Node.js + Express | Matches team's stated stack; good WebSocket interop with Socket.io |
| Database | PostgreSQL 15+ | Relational integrity is critical here (referrals, bed states, audit log) — not a NoSQL problem |
| Real-time | Socket.io | Confirmed choice; room-based events per hospital and per referral |
| Cache/Locking | Redis | Distributed locks for bed-state races, pub/sub to fan out events across Node instances |
| Auth | JWT (access + refresh) + role-based access control (RBAC) | Multiple distinct roles per PRD Section 2 |
| SMS | Twilio (prototype) / MSG91 (India production) | Twilio for demo speed, MSG91 for real India short-code rollout |
| Maps/ETA | Google Maps Distance Matrix API (traffic-aware) | Needed for ETA-adjusted ranking and live re-routing |
| Hosting | Render/Railway for MVP → AWS (ECS Fargate) for production | Matches team's prior production blueprint pattern (AI PPT Judge) |
| Object storage | S3-compatible (for any attached reports/scans in the referral packet) | Encrypted at rest |

---

## 4. Data Model (PostgreSQL Schema)

### 4.1 Core tables

```sql
-- Hospitals
CREATE TABLE hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('district', 'peripheral', 'tertiary', 'private')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Departments/capabilities a hospital offers (static-ish, changes rarely)
CREATE TABLE hospital_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  capability TEXT NOT NULL, -- e.g. 'neurosurgery', 'cardiology', 'ventilator'
  specialist_on_call BOOLEAN DEFAULT FALSE,
  UNIQUE(hospital_id, capability)
);

-- Live capacity counters (the "hot" table — updated constantly)
CREATE TABLE bed_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL, -- 'icu', 'ventilator', 'general', 'nicu'
  total_count INT NOT NULL,
  available_count INT NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  last_updated_by UUID REFERENCES users(id),
  UNIQUE(hospital_id, resource_type)
);

-- Individual bed/resource units, for state-machine tracking at unit level
CREATE TABLE bed_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id),
  resource_type TEXT NOT NULL,
  status TEXT CHECK (status IN (
    'AVAILABLE', 'TEMPORARILY_HELD', 'HOSPITAL_CONFIRMED',
    'RESERVED', 'PATIENT_ARRIVED', 'OCCUPIED'
  )) DEFAULT 'AVAILABLE',
  held_for_referral_id UUID REFERENCES referrals(id),
  status_updated_at TIMESTAMPTZ DEFAULT now()
);

-- Users (staff, doctors, dispatchers, control room)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id),
  name TEXT NOT NULL,
  role TEXT CHECK (role IN (
    'duty_doctor', 'referral_desk', 'bed_admin',
    'ambulance_dispatcher', 'control_room'
  )),
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Referrals (the central entity)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_hospital_id UUID REFERENCES hospitals(id),
  destination_hospital_id UUID REFERENCES hospitals(id),
  patient_ref_code TEXT NOT NULL, -- no direct PII stored as identifier; internal code
  required_capabilities TEXT[] NOT NULL,
  required_resources TEXT[] NOT NULL, -- ['icu','ventilator']
  priority TEXT CHECK (priority IN ('critical','urgent','stable')) DEFAULT 'urgent',
  status TEXT CHECK (status IN (
    'PENDING_MATCH', 'REQUEST_SENT', 'ACCEPTED', 'REJECTED',
    'BED_RESERVED', 'AMBULANCE_ASSIGNED', 'IN_TRANSIT',
    'RE_ROUTING', 'ARRIVED', 'COMPLETED', 'CANCELLED'
  )) DEFAULT 'PENDING_MATCH',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Referral packet (encrypted clinical handoff — Section 7)
CREATE TABLE referral_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  encrypted_payload BYTEA NOT NULL, -- AES-256-GCM encrypted JSON blob
  encryption_iv BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Full audit/time log per referral (immutable, append-only)
CREATE TABLE referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created','sent','accepted','rejected','dispatched','rerouted','arrived','handed_over'
  actor_id UUID REFERENCES users(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ambulances
CREATE TABLE ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID REFERENCES hospitals(id),
  type TEXT CHECK (type IN ('BLS','ALS','VENTILATOR')),
  status TEXT CHECK (status IN ('idle','dispatched','in_transit','offline')) DEFAULT 'idle',
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  last_ping_at TIMESTAMPTZ
);

CREATE TABLE referral_ambulance (
  referral_id UUID REFERENCES referrals(id),
  ambulance_id UUID REFERENCES ambulances(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (referral_id, ambulance_id)
);
```

### 4.2 Indexing notes

- `bed_capacity(hospital_id, resource_type)` — already unique-indexed, this is the hot-path lookup for matching.
- `referrals(status)` partial index for active referrals (`WHERE status NOT IN ('COMPLETED','CANCELLED')`) — control-room dashboards query this constantly.
- `hospitals` needs a geospatial index (PostGIS `earthdistance`/`cube` extension, or PostGIS proper) for nearest-hospital pre-filtering before ranking.

---

## 5. Bed State Machine — Implementation

This is the correctness-critical part of the whole system (PRD Section 3).

**States:** `AVAILABLE → TEMPORARILY_HELD → HOSPITAL_CONFIRMED → RESERVED → PATIENT_ARRIVED → OCCUPIED`

**Transition rules (enforced server-side only, never client-driven):**

| From | To | Trigger | Guard |
|---|---|---|---|
| AVAILABLE | TEMPORARILY_HELD | Referral request sent to hospital | Redis lock acquired on `bed:{hospital_id}:{resource_type}` |
| TEMPORARILY_HELD | AVAILABLE | Hold timeout (default 5 min) or hospital rejects | Auto-expiry job (BullMQ) |
| TEMPORARILY_HELD | HOSPITAL_CONFIRMED | Receiving hospital accepts | Only the holder referral_id can transition it |
| HOSPITAL_CONFIRMED | RESERVED | Bed admin explicitly reserves unit | — |
| RESERVED | PATIENT_ARRIVED | Ambulance geofence-triggers arrival OR manual check-in | — |
| PATIENT_ARRIVED | OCCUPIED | Handover completed by receiving doctor | — |
| any active state | AVAILABLE | Referral cancelled/re-routed away | Releases hold, decrements nothing (bed was never actually consumed) |

**Concurrency control (critical implementation detail):**

```
1. Matching engine finds candidate hospital H for resource type R
2. Acquire Redis lock: SET lock:bed:{H}:{R} {referral_id} NX PX 5000
3. If lock acquired → Postgres transaction:
     UPDATE bed_units SET status='TEMPORARILY_HELD', held_for_referral_id=$1
     WHERE hospital_id=$H AND resource_type=$R AND status='AVAILABLE'
     LIMIT 1 RETURNING id;
   If 0 rows updated → release lock, treat as unavailable, try next candidate
4. Extend lock TTL on every state transition; release explicitly on terminal states
```

This guarantees no two referrals can simultaneously hold the same physical bed unit, even under concurrent requests hitting different Node instances.

---

## 6. Hospital Matching & Ranking Algorithm

**Input:** required_capabilities[], required_resources[], origin hospital location, priority

**Pipeline:**

```
1. FILTER: hospitals within radius (start 25km, expand in rings if 0 matches)
            AND has ALL required_capabilities (hospital_capabilities join)
            AND has available_count > 0 for ALL required_resources (bed_capacity)

2. SCORE each candidate:
   score = w1 * capability_match_score      (1.0 if exact, partial if subset)
         + w2 * capacity_headroom_score      (available/total ratio — prefer hospitals
                                                not already near-full, reduces future re-routes)
         + w3 * (1 - normalized_ETA)         (traffic-aware ETA from Maps API)
         + w4 * specialist_on_call_bonus

   Default weights (tunable, stored in config table):
   w1=0.4, w2=0.15, w3=0.35, w4=0.10

3. RANK descending by score → top 3 candidates

4. SEND referral request to rank #1 first (not broadcast to all 3 simultaneously,
   to avoid multiple hospitals holding the same patient in parallel — which
   creates a *worse* coordination problem than the one being solved).
   Fallback to #2 automatically if #1 doesn't respond within a timeout (2 min)
   or rejects.
```

**Why sequential, not broadcast:** broadcasting to all 3 candidates simultaneously would recreate exactly the chaos ERON exists to remove — multiple hospitals independently "confirming" a patient they can't all take. Sequential-with-timeout preserves single-source-of-truth acceptance while still being fast.

---

## 7. Automatic Re-Routing — Implementation

This is the PRD's core differentiator (Section 6), so it gets explicit engineering treatment.

**Trigger sources (any of these fires re-routing):**
1. Bed admin manually marks a `HOSPITAL_CONFIRMED` unit as unavailable (emergency, e.g., another critical patient took it — this is a real-world escape hatch that must exist).
2. `available_count` for the held resource type drops to 0 via the +/– counter, while a referral is actively `IN_TRANSIT` to that hospital.

**Flow:**

```
1. Redis pub/sub event fires: "capacity_lost" { hospital_id, resource_type }
2. Backend checks: any referral in status IN_TRANSIT with destination_hospital_id=H
   and required_resources includes R?
3. If yes → set referral.status = 'RE_ROUTING'
   → emit Socket.io event to: origin hospital desk, ambulance dispatcher, control room
     (immediate UI feedback: "Re-routing in progress" — never leave staff staring
     at a silently stale destination)
4. Re-run the matching pipeline (Section 6) EXCLUDING hospital H,
   using the ambulance's CURRENT live location (not the origin hospital) as the
   distance/ETA basis — this matters, re-routing from the ambulance's actual
   position gives a materially different ranking than from the origin
5. New candidate found → send acceptance request (same flow as initial match)
6. On acceptance → update referral.destination_hospital_id, log referral_event
   'rerouted', push new destination + ETA to ambulance dispatcher UI via Socket.io
7. If NO candidate found within radius → escalate: flag as 'RE_ROUTING' with alert
   to control room for manual intervention (never fail silently)
```

**Socket.io room design for this:**
- `referral:{referral_id}` — all parties involved in one referral join this room
- `hospital:{hospital_id}` — hospital-wide events (new requests, capacity alerts)
- `control_room:{district_id}` — aggregated view across all active referrals

---

## 8. API Design (REST, high-level)

```
POST   /api/auth/login
POST   /api/auth/refresh

POST   /api/referrals                        -- create (staff enters requirement)
GET    /api/referrals/:id
GET    /api/referrals/:id/candidates          -- ranked hospital matches
POST   /api/referrals/:id/send/:hospitalId    -- send request to specific candidate
POST   /api/referrals/:id/accept              -- receiving hospital accepts
POST   /api/referrals/:id/reject
POST   /api/referrals/:id/reserve-bed
POST   /api/referrals/:id/assign-ambulance
POST   /api/referrals/:id/handover-complete
GET    /api/referrals/:id/packet              -- fetch decrypted packet (role-checked)
GET    /api/referrals/:id/timeline            -- referral_events log

PATCH  /api/hospitals/:id/capacity            -- +/- counter update
GET    /api/hospitals/:id/capacity

GET    /api/dashboard/district/:districtId    -- control room aggregate view

POST   /api/sms/webhook                       -- inbound SMS gateway webhook
```

All mutating endpoints are RBAC-checked per the PRD's role table (Section 2) — e.g., only `bed_admin` role at the destination hospital can call `/accept`.

---

## 9. Real-Time Events (Socket.io contract)

| Event | Direction | Payload | Consumed by |
|---|---|---|---|
| `referral:new_request` | server→client | referral summary | receiving hospital desk |
| `referral:accepted` | server→client | referral_id, hospital | origin desk, ambulance dispatcher |
| `referral:status_changed` | server→client | referral_id, new status | all room members |
| `referral:rerouting` | server→client | referral_id, reason | origin desk, dispatcher, control room |
| `referral:rerouted` | server→client | new destination, new ETA | dispatcher, ambulance UI |
| `capacity:updated` | server→client | hospital_id, resource_type, counts | matching engine (internal), dashboards |
| `ambulance:location_update` | client→server | lat, lng | backend (throttled, e.g. every 10s) |
| `ambulance:location_broadcast` | server→client | lat, lng, eta | receiving hospital, control room |

---

## 10. Digital Referral Packet — Encryption Design

- Payload assembled server-side as JSON (fields per PRD Section 5), then encrypted with **AES-256-GCM** before storage — key management via a KMS (AWS KMS or equivalent) rather than an app-level static key.
- Per-referral data encryption key (DEK), itself encrypted by a master key (envelope encryption) — standard pattern, avoids single-key blast radius.
- Access control: decryption only happens server-side, after RBAC check confirms the requesting user belongs to `origin_hospital_id` or `destination_hospital_id` for that specific referral — never a blanket "any staff" permission.
- No raw patient identity fields beyond an internal `patient_ref_code` are used as lookup keys, reducing PII surface area in logs/indexes.
- This mirrors ABDM-style consent-scoped access without attempting to integrate ABDM itself in MVP (explicitly out of scope, per PRD).

---

## 11. SMS Short-Code Fallback — Implementation

```
1. Inbound SMS → SMS gateway (Twilio/MSG91) → webhook POST /api/sms/webhook
2. Parse structured format: "{KEYWORD} {LOCATION_CODE} {PRIORITY}"
   e.g. "CT 500 URGENT" → capability=CT, location_code=500, priority=URGENT
3. Run abbreviated matching pipeline (Section 6, capability-filter only —
   no live bed-hold, since SMS can't do multi-step confirmation)
4. Reply within SMS char limit (160 chars):
   "CT: HospB(8km) HospD(15km). Call to confirm."
5. Log as a lightweight referral_event even though no full referral record
   is created — for adoption-tracking analytics in low-connectivity areas
```

Noted per PRD as simulated in MVP demo (webhook + parser fully built; actual short-code telecom registration is a production/Phase 2 dependency, not a technical blocker for the build itself).

---

## 12. Non-Functional Requirements

| Requirement | Target |
|---|---|
| Referral match latency (request → ranked candidates returned) | < 2 seconds |
| Capacity update → dependent UI refresh (Socket.io propagation) | < 1 second |
| Auto re-routing detection → new candidate sent | < 5 seconds |
| Bed-hold race condition rate | 0% (hard requirement, enforced by Redis lock design) |
| System uptime (control room / active referral paths) | 99.9% target for production phase |
| Concurrent hospitals supported (MVP) | 50–100 (single-region deployment) |
| Data retention for referral_events (audit log) | Indefinite, append-only, immutable |

---

## 13. Build Phasing (maps to PRD Section 9 MVP scope)

**Phase 0 — Foundation (Week 1)**
- Postgres schema + migrations, auth/RBAC, hospital + capability seed data

**Phase 1 — Core Referral Flow (Weeks 2–3)**
- Create referral → matching pipeline → sequential send/accept → bed state machine → Socket.io wiring

**Phase 2 — Ambulance + Live Tracking (Week 4)**
- Ambulance assignment, location ping endpoint, live map view, ETA integration

**Phase 3 — Auto Re-Routing (Week 5)**
- Capacity-loss detection, re-matching from live ambulance position, dispatcher UI updates
- **This is the demo centerpiece — build and stress-test this path first if time is constrained, not last.**

**Phase 4 — Packet Encryption + Control Room Dashboard (Week 6)**
- Envelope encryption, role-scoped packet access, district-level aggregate analytics view

**Phase 5 — SMS Fallback (stretch, if time allows)**
- Webhook + parser + abbreviated matching reply

---

## 14. Suggested Repo Structure

```
/eron
  /apps
    /web            -- Next.js app (staff UI, control room, hospital desk)
    /api            -- Express backend
  /packages
    /shared-types   -- shared TS types for referral/hospital/bed entities
    /matching-engine -- ranking + re-routing logic, isolated + unit-testable
  /infra
    /migrations     -- SQL migrations
    /docker
  /docs
    prd.md
    TRD.md
```

Isolating `matching-engine` as its own package matters: the ranking + re-routing algorithm (Sections 6–7) is the part most likely to need tuning/testing independent of the API layer, and keeping it framework-agnostic makes it portable if the stack changes later.
