# Emergency Referral Orchestration Network — System Architecture

**Version:** 2.0
**Scope:** MVP architecture for real-time hospital referral coordination
**Audience:** Engineering, hackathon evaluators (SIH), technical reviewers

---

## 1. Architecture Philosophy

This system is **not a hospital directory** — it is a real-time coordination layer over one thing that changes every minute: **capacity**. The core design decision behind this version of the architecture is:

> **There is no accept/reject step. Matching is a live read of real-time, hospital-reported capacity. The receiving hospital is notified, not asked.**

This removes the biggest source of delay in the phone-call model — waiting for a human on the other end to decide — while staying safe, because:

1. Matching only ever targets hospitals whose *current* data says a resource is free.
2. A lightweight, invisible **soft-hold** stops two referrals from racing for the same last bed.
3. If the data was stale (hospital's real count was lower than shown), the same **auto-reroute** mechanism that handles mid-transit capacity loss also handles this case — the system self-corrects instead of asking a human to gate every decision upfront.

The trade-off this design accepts: the whole system is now only as good as how current the manual capacity numbers are. Section 4 and Section 5 are built specifically to keep that number fresh and to make failures self-correcting rather than silent.

---

## 2. High-Level System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (App/Web)                      │
│                                                                       │
│  Screen 1        Screen 2          Screen 3        Screen 4          │
│  Main Dashboard   Critical Find    Receiving Tab    Capacity Panel   │
│  (Sending +       (Fast referral   (Incoming        (Manual +/-      │
│   Receiving log)   creation)        patient view)    bed counter)    │
└───────────────────────────┬───────────────────────────────────────┘
                            │ REST + WebSocket
┌───────────────────────────▼───────────────────────────────────────┐
│                          API GATEWAY                                │
│              (Auth, rate-limit, hospital-role routing)              │
└───────────────────────────┬───────────────────────────────────────┘
                            │
   ┌────────────┬───────────┼───────────────┬─────────────────┐
   ▼            ▼           ▼               ▼                 ▼
┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐ ┌─────────────┐
│Referral│ │ Capacity │ │ Matching │ │  Ambulance /   │ │ Notification │
│Service │ │ Service  │ │ &        │ │  Tracking      │ │ Service      │
│(notify-│ │(bed state│ │ Ranking  │ │  Service       │ │ (push/SMS/   │
│ based) │ │ machine) │ │ Engine   │ │  (GPS + ETA)   │ │  in-app)     │
└───┬────┘ └────┬─────┘ └────┬─────┘ └───────┬────────┘ └──────┬──────┘
    │           │            │               │                 │
    └───────────┴─────┬──────┴───────────────┴─────────────────┘
                       ▼
              ┌──────────────────┐
              │   Event Bus       │  (pub/sub: capacity_changed,
              │  (Kafka/Redis     │   referral_created,
              │   Streams)        │   ambulance_dispatched, etc.)
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │   Data Layer      │
              │  - PostgreSQL     │  (referrals, hospitals, users)
              │  - Redis          │  (live capacity cache, geo index)
              │  - Encrypted      │  (clinical packets — field-level
              │    Object Store   │   encryption, ABDM-aligned)
              └──────────────────┘
```

**Why event-driven:** Auto-reroute — the mechanism that makes the no-confirmation model safe — only works if every active referral is subscribed to its target hospital's capacity channel and reacts the instant that number changes. Polling would reintroduce the delay this system exists to remove.

---

## 3. The Four Screens (Client Architecture)

### 3.1 Screen 1 — Main Dashboard (Control Tower)

**Purpose:** Single source of truth for everything this hospital is sending or receiving — live and historical.

```
┌───────────────────────────────────────────────────┐
│  🔴 SENDING (Referrals initiated by us)            │
│  ├── Patient #101 → Hospital B   [In Transit]      │
│  ├── Patient #102 → Hospital C   [Notified]        │
│                                                     │
│  🟢 RECEIVING (Referrals coming to us)             │
│  ├── Patient #201 ← Hospital A   [Incoming]        │
│  ├── Patient #202 ← Hospital D   [Arrived]         │
└───────────────────────────────────────────────────┘
```

- Every card is live via WebSocket — status moves through `Notified → Dispatched → In Transit → Arrived → Closed` automatically, no accept/reject step in between.
- Tapping a card opens the **Referral Detail / Audit Log**: full timestamped action log, the clinical packet, and live ambulance ETA if in transit.
- This is also the compliance/audit trail — every state change is immutable and timestamped, feeding the district-level analytics in Section 10.

**Data source:** `GET /referrals?scope=sent|received&status=active|closed`, upgraded to a WebSocket subscription per open card.

---

### 3.2 Screen 2 — Critical Find (Fast Referral Creation)

**Purpose:** Turn a 10-phone-call process into one search and one tap.

```
┌─────────────────────────────────────────┐
│  🔍 What is required?  [ CT Scan     ]   │
└─────────────────────────────────────────┘
                    ↓ Enter
┌─────────────────────────────────────────┐
│              📍 MAP VIEW                 │
│                                           │
│    🟢 Hospital B (8km)  — Available      │
│    🟡 Hospital C (12km) — Limited/Queue  │
│    🔴 Hospital D (5km)  — Unavailable    │
└─────────────────────────────────────────┘
```

**Flow:**
1. Staff types a requirement — mapped via autocomplete to a controlled taxonomy (`CT`, `ICU`, `VENTILATOR`, `NEUROSURGEON`...) so matching stays deterministic.
2. The **Matching & Ranking Engine** reads the live capacity cache (Redis) and ranks candidates by capability match → current availability → traffic-adjusted ETA.
3. Results render as color-coded pins — a glance, not a read.
4. Tapping a green/yellow hospital:
   - Places a **soft-hold** on one unit of that resource at the target hospital (system-internal, invisible to staff — this is what stops a second referral from targeting the same last bed a second later).
   - Creates the referral and fires a **notification** — not a request awaiting approval — to the receiving hospital.
   - Redirects the sender straight into that referral's live tracking view.

**Why this is fast:** the ranking query reads the live cache, and there's no round-trip wait for a human decision on the other end — the "decision" already happened the moment the receiving hospital's capacity number said `available`.

---

### 3.3 Screen 3 — Receiving Tab (Incoming Referral View)

**Purpose:** Let the receiving hospital see and prepare for an incoming patient — informational, not gated.

**Step 1 — Notification**
```
┌───────────────────────────────────┐
│  🚨 Incoming Referral               │
│  CT Scan required — Hospital A      │
│  ETA: 9 min                         │
│  [ View Details ]                   │
└───────────────────────────────────┘
```

**Step 2 — Full detail view (opens directly, no confirm step)**
```
┌───────────────────────────────────┐
│  Patient Details (decrypted)        │
│  Vitals | Diagnosis | Treatment     │
│                                      │
│  📍 Live Map — Ambulance ETA: 9m    │
└───────────────────────────────────┘
```

**Design rationale:**
- There is no Accept/Reject button. The referral was only sent because the Matching Engine already saw this hospital's capacity as available — the "decision" is the capacity number the hospital itself maintains.
- The clinical packet still decrypts only on delivery to an authenticated, referral-scoped session — this is an access-control boundary (Section 6), not a confirmation gate. It exists for data protection, not for letting the hospital opt out.
- **The hospital's real lever is Screen 4** — if they genuinely cannot take the patient (last bed just got occupied by a walk-in, staff data was stale), they correct their own capacity counter to 0. That single action is what the system reacts to — see Section 4.3.

---

### 3.4 Screen 4 — Capacity Panel (Manual Update)

**Purpose:** Keep the number that the entire system trusts as close to real-time truth as possible, with near-zero effort.

```
┌───────────────────────────────────────────┐
│  Update Your Hospital's Live Capacity       │
│                                              │
│  ICU Beds        [ – ]   3 / 15   [ + ]     │
│  Ventilators     [ – ]   1 / 6    [ + ]     │
│  CT Scan         [ – ]   1 / 1    [ + ]     │
│  General Beds    [ – ]   22 / 40  [ + ]     │
│                                              │
│  Last updated: 2 min ago                    │
└───────────────────────────────────────────┘
```

- One-tap `+ / –` per resource type — no forms, no dropdowns. This is the interface every other screen depends on.
- Every change publishes `capacity_changed` on the event bus **immediately** — this is what powers Critical Find's live colors and what triggers auto-reroute for any referral already pointed at this hospital.
- **Staleness nudges:** if a resource hasn't been touched in a configurable window (e.g., 20 minutes for ICU/Ventilator, longer for general beds), the app pushes a gentle reminder to the bed-management desk. This directly protects the integrity of the no-confirmation model — the system's safety depends on this number being current.
- This screen is also where a hospital can proactively zero out a resource the moment it fills up from a walk-in or internal transfer, *before* the Matching Engine ever considers referring a patient there.

---

## 4. Core State Machines

### 4.1 Bed / Resource Capacity State

```
AVAILABLE ⇄ (manual +/- updates, real time)
     ↓ (referral created against this unit)
SOFT-HELD (system-internal, ~seconds, prevents double-targeting)
     ↓ (ambulance dispatched)
RESERVED
     ↓ (patient physically arrives)
OCCUPIED
```
- `SOFT-HELD` exists purely to stop two Critical Find searches, happening seconds apart, from both targeting the same last free bed. It is not a request the hospital approves — it resolves automatically once the referral is created (moves to `RESERVED`).
- The hospital's own manual counter (Screen 4) can override this at any point — if staff decrement a resource to 0 for any reason, any `SOFT-HELD`/`RESERVED` unit tied to an active referral triggers reroute (4.3), not a silent conflict.

### 4.2 Referral Lifecycle State

```
CREATED → NOTIFIED → DISPATCHED → IN_TRANSIT → ARRIVED → CLOSED
                 ↘ RE_ROUTED (target hospital's capacity dropped) → back to NOTIFIED (new target)
```
No `PENDING`, no `CONFIRMED`, no `REJECTED` — matching already did the confirmation work by reading live data.

### 4.3 Auto-Reroute — the Safety Mechanism (Core Feature)

This is what makes removing accept/reject safe rather than reckless. It now handles **two** cases, not one:

```
Case A — Stale data at time of referral:
Hospital B shown as AVAILABLE → referral created, soft-held
        ↓
Hospital B staff realize their real count was actually 0
(e.g., a walk-in just took the bed)
        ↓
Staff correct it on Screen 4 → capacity_changed(HospitalB, ICU, 0)
        ↓
Referral Service (subscribed to Hospital B's channel for this referral)
        ↓
Immediately re-invokes Matching Engine, same requirement + ambulance's current location
        ↓
Hospital C found (next best) → NOTIFIED
        ↓
Ambulance Tracking Service updates destination + recalculates ETA
        ↓
Push notification to ambulance crew + Hospital A + Hospital B (stand-down) + Hospital C
```

```
Case B — Capacity genuinely lost mid-transit:
Hospital B confirmed target, ambulance en route
        ↓
Hospital B's ICU capacity drops to 0 (another emergency arrives)
        ↓
Same reroute flow as Case A
```

Both cases share one code path: **any drop in the target hospital's live capacity, at any point before Arrived, triggers automatic rematching.** This is the single mechanism that replaces the entire accept/reject/timer flow from the earlier version of this design.

---

## 5. What Happens If Auto-Reroute Also Fails

If capacity data is stale *everywhere* (regional shortage, mass-casualty event) and the Matching Engine can't find a next candidate, the referral does not sit silently retrying. After a configurable number of failed reroute attempts (e.g., 2), the system escalates to the **District/State Health Authority control room** as a manual-intervention alert, with the referral's full context attached. This keeps the system honest about its own limits rather than presenting infinite automated retries as a solved problem.

---

## 6. Digital Referral Packet (Encrypted Clinical Handoff)

```
Patient details · Clinical summary · Vitals · Diagnosis
Treatment already given · Medications & Allergies
Investigations / Reports · Reason for referral
Referring doctor & hospital · Time log of every action
```
- Field-level AES-256 encryption; decryption grant issued only to an authenticated session scoped to that specific `referral_id`.
- Not a full EHR — scoped strictly to this referral, aligned with ABDM data-protection expectations.

---

## 7. Data Model (Core Entities)

| Entity | Key Fields | Notes |
|---|---|---|
| `Hospital` | id, name, geo, departments[], capacity_summary | Denormalized into Redis for fast ranking |
| `CapacityUnit` | hospital_id, type (ICU/Ventilator/OT/CT...), total, available, state, last_updated_at | Directly driven by Screen 4; state = `AVAILABLE/SOFT-HELD/RESERVED/OCCUPIED` |
| `Referral` | id, patient_ref, from_hospital, to_hospital, requirement, state, created_at | Central orchestration object; state has no `PENDING/REJECTED` |
| `ReferralEvent` | referral_id, action, actor, timestamp | Immutable audit trail — powers Screen 1 detail log and reroute history |
| `ClinicalPacket` | referral_id, encrypted_payload, access_grants[] | Field-level encryption; grant issued on referral creation, scoped to `referral_id` |
| `AmbulanceAssignment` | referral_id, ambulance_id, type (BLS/ALS/Ventilator), live_location, eta | Updated via GPS stream; destination can change on reroute |
| `User` | id, role, hospital_id | Roles: referring staff, receiving staff, ambulance dispatcher, authority |

---

## 8. Non-Functional Requirements

| Concern | Approach |
|---|---|
| **Latency** | Capacity ranking reads resolve in <500ms — served from Redis, not primary DB |
| **Data integrity** | Soft-hold uses an atomic Redis operation (`SETNX`/Lua script) so two simultaneous Critical Find selections can't both claim the same last unit |
| **Freshness** | Staleness nudges (Screen 4) + reroute-on-change design mean the system tolerates stale data rather than assuming perfect freshness |
| **Security** | Field-level encryption on clinical packets; role-based, referral-scoped access only |
| **Offline resilience** | SMS fallback (Section 9) for connectivity gaps |
| **Auditability** | Every state transition, including reroutes, is an immutable, timestamped event |
| **Scalability** | Event bus decouples Matching, Tracking, and Notification so each scales independently |

---

## 9. SMS Fallback (Low-Connectivity Areas) — Informational Only

The SMS path is deliberately **read-only** — it gives the referring hospital ranked options; it does not create or confirm a referral by itself.

```
Staff SMS → "CT 500 URGENT"  (requirement, location code, priority)
        ↓
SMS Gateway (Twilio/MSG91) → parses into a Matching Engine query
        ↓
Auto-reply (informational, no action taken):
"CT: HospB(8km)-Avail HospD(15km)-Avail. Open app to refer, or call."
```
- No accept/reject implied on this channel either — it mirrors the app's "notify, don't gate" philosophy, just without live tracking or the digital handoff packet.
- Production requires telecom short-code registration; simulated via gateway sandbox for MVP/demo.
- Not authenticated by default in MVP — Phase 2 requirement is restricting this to pre-registered hospital staff numbers, to prevent misuse of an emergency-priority channel.

---

## 10. Data Sourcing Strategy (Phased, Honest)

| Phase | Source | Notes |
|---|---|---|
| **Phase 1 (MVP)** | Manual `+/–` counter (Screen 4) | The system's actual source of truth; staleness reminders are load-bearing, not cosmetic |
| **Phase 2** | Direct API sync with existing Hospital Management Systems (HIMS) | Removes manual entry for larger hospitals; capacity_changed events fire from HIMS instead of a human tap |
| **Phase 3** | Government reporting pipelines | Mirrors COVID-era oxygen/ICU dashboards |

---

## 11. Tech Stack (Reference Implementation)

- **Client:** React Native / Flutter (app), React (web control-room)
- **API Gateway:** Node.js/Express or Go, JWT + role-based auth
- **Services:** Node.js/Go microservices (Referral, Capacity, Matching, Tracking, Notification)
- **Event Bus:** Kafka or Redis Streams
- **Databases:** PostgreSQL (source of truth), Redis (live capacity cache + geo queries via `GEOADD`/`GEOSEARCH`)
- **Maps/ETA:** Google Maps Directions API or OSRM (traffic-adjusted ETA)
- **Encryption:** AES-256 field-level, KMS-managed keys
- **Notifications:** FCM/APNs (push), Twilio/MSG91 (SMS)

---

## 12. Screen ↔ Service Mapping

| Screen | Primary Services Called |
|---|---|
| Main Dashboard | Referral Service (list + WebSocket subscribe), Notification Service |
| Critical Find | Matching & Ranking Engine, Capacity Service (cache read + soft-hold write), Referral Service (create) |
| Receiving Tab | Notification Service, Referral Service (read), ClinicalPacket decryption grant, Ambulance Tracking Service |
| Capacity Panel | Capacity Service (write) → publishes `capacity_changed` on Event Bus |

---

## 13. Known Limitations (Stated Deliberately, Not Hidden)

- **System is only as reliable as the manual capacity number.** This is a deliberate trade-off for speed; Screen 4's staleness nudges and the reroute mechanism exist specifically to contain the risk, not eliminate it.
- **No severity-based arbitration between two simultaneous referrals for the same scarce resource type across different hospitals** (not the same bed — that's handled by soft-hold). Currently first-valid-request-wins; true mass-casualty triage logic is explicitly out of MVP scope.
- **SMS channel is unauthenticated in MVP** — acceptable for demo, flagged as a Phase 2 production requirement.
- **No override path for a hospital to proactively decline a specific patient** even if capacity is technically available (e.g., a case genuinely outside their expertise despite the right equipment existing). Worth a conscious call on whether this is in scope later — currently the design assumes capability + capacity data fully captures suitability.

---

## 14. Long-Term Value

Every referral and reroute is already structured, timestamped event data (Section 7). Aggregated across a district, this same stream — with zero extra instrumentation — surfaces patterns like *"42% of District X referrals fail due to ICU shortage"* or *"Hospital B's capacity data goes stale every evening shift change,"* turning the coordination tool into an infrastructure and operations-planning input for health authorities.

---

## 15. Demo Plan (2–3 min, live)

1. Problem framing (10s) — the "10 phone calls" scenario
2. Staff enters requirement on Critical Find (15s) — map opens, color-coded
3. Select green hospital → instant notification fires, no waiting (15s)
4. **Live reroute** — manually zero out the target hospital's capacity on Screen 4 mid-demo, show the system catch it and redirect the ambulance automatically (30s) — **centerpiece moment**
5. Receiving Tab shows the reroute happening on the new hospital's side (15s)
6. Control-room analytics — "42% of District X referrals fail due to ICU shortage" (10s)
7. Close with one-line pitch:
   > "We don't ask hospitals to confirm — we trust their live data and react the instant it changes. That's what makes this faster than a phone call and safer than a guess."
