# Emergency Referral Orchestration Network — System Architecture

**Version:** 3.1 (Final — merged from v2 + v3)
**Scope:** MVP architecture for real-time hospital referral coordination with blockchain-grade patient identity and audit integrity
**Audience:** Engineering, hackathon evaluators (SIH), technical reviewers

---

## 1. Architecture Philosophy

This system is **not a hospital directory** — it is a real-time coordination layer over one thing that changes every minute: **capacity**. The core design decision:

> **There is no accept/reject step. Matching is a live read of real-time, hospital-reported capacity. The receiving hospital is notified, not asked.**

Three principles guide every design choice:

1. **Speed without guessing.** Matching reads live-cache data; the "decision" happens the moment a hospital's capacity says `available`. No human confirmation gate in the dispatch path.
2. **Trust must be provable, not just claimed.** Every referral action — capacity read, dispatch, reroute, packet access — is recorded in a SHA-256 hash-chained audit log that is independently verifiable after the fact.
3. **Patient identity is sovereign and portable.** Each patient is issued a unique, cryptographically-derived key (from their phone number) at registration. This key travels with every referral, enabling cross-hospital data lookup without ever exposing raw PII.

---

## 2. High-Level System Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (App/Web)                          │
│                                                                           │
│  Screen 1           Screen 2           Screen 3        Screen 4          │
│  Main Dashboard     Critical Find      Receiving Tab   Capacity Panel    │
│  (Sending +         (Tier 1 fast        (Incoming        (Manual +/-      │
│   Receiving log,     dispatch +          patient view,    bed + staff      │
│   audit trail,       Tier 2 enrich,      patient key      counter)         │
│   patient key)       phone capture)      lookup)                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────────────────┐
│                          API GATEWAY                                      │
│               (Auth, rate-limit, hospital-role routing)                   │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
 ┌──────────┬────────────┬───┴───────┬───────────────┬─────────────┬──────────────┬───────────┐
 ▼          ▼            ▼           ▼               ▼             ▼              ▼            ▼
┌────────┐┌──────────┐┌──────────┐┌───────────────┐┌─────────────┐┌──────────┐┌──────────┐┌───────────┐
│Referral││ Capacity ││ Matching ││  Ambulance /   ││ Notification ││   NLP    ││  Patient ││   Audit   │
│Service ││ Service  ││ &        ││  Tracking      ││ Service      ││Structuring│ Identity ││  Chain    │
│(notify-││(bed+staff││ Ranking  ││  Service       ││ (push/SMS/   ││ Service   ││  Service ││  Service  │
│ based) ││ state    ││ Engine   ││  (GPS + ETA)   ││  in-app)     ││(LLM parse,││(key gen, ││(hash-link │
│        ││ machine) ││          ││                ││              ││confirm-   ││lookup,   ││ every     │
│        ││          ││          ││                ││              ││ gated)    ││HMAC-SHA  ││ event)    │
└───┬────┘└────┬─────┘└────┬─────┘└───────┬────────┘└──────┬───────┘└────┬─────┘└────┬─────┘└────┬─────┘
    │          │           │              │                │             │           │           │
    └──────────┴─────┬─────┴──────────────┴────────────────┴─────────────┴───────────┴───────────┘
                      ▼
             ┌──────────────────┐
             │   Event Bus       │  (pub/sub: capacity_changed, referral_created,
             │  (Kafka/Redis     │   ambulance_dispatched, packet_enriched,
             │   Streams)        │   audit_event_appended, patient_key_issued etc.)
             └────────┬─────────┘
                      ▼
             ┌──────────────────────────────────┐
             │   Data Layer                      │
             │  - PostgreSQL                     │  (referrals, hospitals, users, patient keys)
             │  - Redis                          │  (live capacity cache, geo index)
             │  - AES-256-GCM Object Store       │  (clinical packets — authenticated encryption,
             │                                    │   ABDM-aligned, per-record salt)
             │  - Append-only Audit Log Store    │  (hash-chained ReferralEvents — all event types)
             └──────────────────────────────────┘
```

---

## 3. Patient Identity & the Patient Key

### 3.1 Design Problem

Every referral system eventually faces this: *the same patient is referred from Hospital A to Hospital B to Hospital C, and each hospital creates a new record for them.* No single identifier links them. The receiving hospital cannot know if they treated this patient before, cannot see prior notes from a previous referral, and cannot detect if the same referral is accidentally duplicated.

### 3.2 Solution — Cryptographic Patient Key

At patient registration (referral creation), the staff member captures:
- **Patient phone number** (their own, or a guardian's if the patient cannot provide one)
- A label indicating whose number it is: **patient** or **guardian**

The system derives a **patient key** from this:

```
patient_key = HMAC-SHA256(
  key   = PATIENT_KEY_SECRET  (env var, separate from JWT secret),
  data  = normalize(phone_number)  // +91XXXXXXXXXX format, digits only
)
→ stored as a 64-char hex string on the referral and in the clinical packet
```

**Properties:**
- **Deterministic** — the same phone number always produces the same key
- **Non-reversible** — you cannot recover the phone number from the key alone (HMAC, not plain hash)
- **Cross-hospital portable** — Hospital B can look up `GET /api/patients/:key` to see prior referral history without Hospital A ever sending raw PII
- **Collision-resistant** — two different phone numbers never produce the same key
- **PII-isolated** — the raw phone number is encrypted inside the clinical packet (AES-256-GCM); the key that travels outside is always the HMAC, never the plaintext

### 3.3 What the Key Is NOT

- Not a replacement for a national health ID (ABHA) — it's a within-system correlation handle
- Not public — it's a system-internal identifier; it never appears on UI surfaces that the patient themselves sees
- Not a substitute for consent — collecting the phone number requires the same consent process as any other PII; the system doesn't change that requirement

---

## 4. The Four Screens (Client Architecture)

### 4.1 Screen 1 — Main Dashboard (Control Tower)

Single source of truth for everything this hospital is sending or receiving — live via WebSocket.

**v3.1 additions:**
- Each referral card shows the **patient key** (truncated to first 12 chars + "…") as a copy-able identifier
- The Referral Detail view shows a **blockchain audit trail panel** — each logged event shows its hash fragment and a "chain intact ✓" indicator, computed against the Audit Chain Service
- Patient key lookup: clicking the key opens a cross-hospital history view (if this patient has prior referrals in the system)

### 4.2 Screen 2 — Critical Find (Tiered Referral Creation)

**Tier 1 — Fast Dispatch (~20 seconds, fires the referral)**

The form now includes the **phone capture section**:

```
┌──────────────────────────────────────────────┐
│  Patient Name       [ Deepak Sharma        ]  │
│  Age / Sex          [ 52 / M              ]   │
│  Phone Number       [ +91 98765 43210     ]   │
│  Number belongs to  [● Patient  ○ Guardian]   │
│  Chief complaint    [ "resp distress"     ]   │
│  Priority           [ CRITICAL           ]   │
│  Required Resources [ ICU ] [ Ventilator ]    │
└──────────────────────────────────────────────┘
                    ↓ Confirm & Match
┌──────────────────────────────────────────────┐
│  🔑 Patient Key Generated                     │
│  a3f8c2e1d9b7... (HMAC-SHA256 • encrypted)    │
│  [Copy Key]                                   │
└──────────────────────────────────────────────┘
```

- Phone number is **validated** (10-digit Indian mobile, with optional +91 prefix)
- Guardian-phone flow: if guardian's number is provided, the label `guardian_phone` is stored in the encrypted packet; the key is still derived from the same number since it's the correlation handle
- After form submission, the patient key is displayed to staff with a copy button for manual hand-off (e.g., to communicate to the receiving hospital via phone before the WebSocket notification arrives)

**Tier 2 — Enrichment** (optional, during transit, never blocks dispatch)

- Dictate or type clinical notes → NLP structuring draft → coordinator confirms before packet write
- Every AI-extracted field is visibly labelled; the confirming staff member's identity is attached

### 4.3 Screen 3 — Receiving Tab

No accept/reject; informational notification. The patient key is shown on the incoming referral notification so the receiving desk can:
1. Verify the key matches if the ambulance crew reads it over radio
2. Look up prior referral history for this patient before arrival

### 4.4 Screen 4 — Capacity Panel

Unchanged bed/resource +/- interface, extended with 3-state specialist availability (`AVAILABLE / ENGAGED / OFF_DUTY`). Specialist staleness window is shorter (10 minutes vs. 20+ for beds).

---

## 5. Core State Machines

### 5.1 Bed / Resource Capacity

```
AVAILABLE ⇄ (manual +/- updates, real time)
     ↓ (referral created)
SOFT-HELD (atomic Redis SETNX, ~seconds)
     ↓ (ambulance dispatched)
RESERVED
     ↓ (patient arrives)
OCCUPIED
```

### 5.2 Referral Lifecycle

```
CREATED (Tier 1 only) → NOTIFIED → DISPATCHED → IN_TRANSIT → ARRIVED → CLOSED
                                         ↑
             PACKET_ENRICHED (Tier 2 — non-blocking, any time before ARRIVED)
     ↘ RE_ROUTED → back to NOTIFIED (new target)
     ↘ ESCALATED (repeated reroute failure → district authority)
```

### 5.3 Auto-Reroute Safety Mechanism

Any drop in the target hospital's live capacity **before ARRIVED** triggers rematching using the ambulance's current GPS location. Both cases share one code path:
- **Case A** — data was stale at referral time (walk-in took the bed)
- **Case B** — capacity genuinely lost mid-transit

If reroute fails N times (configurable), escalate to district control room with full referral context.

### 5.4 Specialist Availability

```
AVAILABLE ⇄ ENGAGED ⇄ OFF_DUTY   (manual tap by ward/duty desk)
```
Shorter staleness nudge (10 min) than beds. Feeds the same auto-reroute path.

---

## 6. Encryption Architecture

### 6.1 Clinical Packet Encryption — AES-256-GCM

```
patientData (JSON) + patientPhone (plaintext inside packet)
        ↓
per_record_salt  = crypto.randomBytes(16)   // unique per packet
encryption_key   = HKDF(
  secret  = PACKET_ENCRYPTION_SECRET,       // separate from JWT_SECRET
  salt    = per_record_salt,
  info    = 'eron-clinical-packet-v1',
  length  = 32
)
iv = crypto.randomBytes(12)                 // 96-bit for GCM
        ↓
{ ciphertext, auth_tag } = AES-256-GCM(key, iv, patientData)
        ↓
stored: { iv_hex, salt_hex, auth_tag_hex, ciphertext_hex }
```

**Why GCM over CBC (v2 → v3.1 upgrade):**
- GCM is authenticated encryption — the `auth_tag` proves the ciphertext was not tampered with after encryption. CBC has no such guarantee; a modified ciphertext would decrypt to garbage with no error.
- Per-record salt via HKDF means each packet uses a different derived key, even if the master secret is the same. Compromising one packet's key does not compromise others.
- The existing `packets` table (from phase 1 migration) already has `iv`, `auth_tag`, and `encrypted_data` columns — this is the correct table to use.

### 6.2 Patient Key Encryption

The raw phone number is:
1. Encrypted inside the clinical packet (never stored in plaintext in any DB column)
2. HMAC-hashed → `patient_key` column on the `referrals` table (for lookup, not recovery)

The `patient_key` column is safe to index and query because the HMAC is a one-way function — having the key does not let you recover the phone number.

---

## 7. Hash-Chained Audit Trail (Blockchain-Style)

### 7.1 Design

```
Every event (referral created, dispatched, rerouted, packet accessed,
capacity read at match time, AI extraction confirmed...)
        ↓
event_hash = SHA-256(
  JSON.stringify({ referralId, action, actor, payload, prevHash, timestamp })
)
        ↓
Appended to referral_events (append-only)
        ↓
Any break in the chain (hash mismatch) proves log alteration
```

### 7.2 Coverage (v3.1 expansion from v2)

| Event Type | v2 | v3.1 |
|---|---|---|
| Status transitions | ✅ `referral_status_log` | ✅ also `referral_events` |
| Referral creation | ✅ | ✅ |
| Packet access (decrypt) | ❌ | ✅ |
| AI extraction confirmed | ❌ | ✅ |
| Capacity read at match time | ❌ | ✅ |
| Patient key issued | ❌ | ✅ |
| Reroute triggers | ✅ | ✅ |

### 7.3 Verification

`GET /api/referrals/:id/verify-audit` walks the `referral_events` chain in insertion order, recomputes each hash from the stored payload, and returns `{ is_valid: boolean, chain: [...] }`. A `false` result means the log was altered — surfaced to authorized reviewers only.

### 7.4 What This Proves (and What It Doesn't)

- ✅ Proves: the log was not altered after the fact
- ✅ Proves: the sequence of events is exactly as recorded
- ❌ Does NOT prove: that a hospital's manual capacity entry was truthful
- ❌ Does NOT require: a distributed network or consensus — a single append-only store with hash chaining is sufficient for the trust property needed here

---

## 8. Data Model (v3.1 Final)

| Entity | Key Fields | Notes |
|---|---|---|
| `Hospital` | id, name, geo, capabilities[], capacity_summary | Redis-denormalized for ranking |
| `CapacityUnit` | hospital_id, type (ICU/VENTILATOR/SPECIALIST), total, available, state, last_updated_at | SPECIALIST type uses 3-state |
| `Referral` | id, patient_ref_id, **patient_key VARCHAR(64)**, sending_hospital_id, receiving_hospital_id, required_capabilities, status, timeout_seconds, patient_data JSONB, created_at | `patient_key` is HMAC; `patient_data` holds everything else unencrypted-on-row (only safe fields like name, age) |
| `ReferralEvent` | referral_id, action, actor, payload JSONB, **event_hash**, **prev_hash**, created_at | Append-only; covers all event types |
| `referral_status_log` | referral_id, from_status, to_status, actor_id, prev_hash, event_hash | Kept for backward compat; `referral_events` is now primary |
| `packets` | referral_id, encrypted_data, iv VARCHAR(24), auth_tag VARCHAR(32), salt VARCHAR(32), created_at | AES-256-GCM; replaces `clinical_packets` |
| `clinical_packets` | referral_id, encrypted_payload | Kept for backward compat (AES-CBC, v2 packets) |
| `AmbulanceAssignment` | referral_id, ambulance_id, type, live_location, eta | Destination changes on reroute |
| `User` | id, role, hospital_id, name, phone | Roles: DOCTOR, control_room_admin, referral_staff |

---

## 9. NLP-Assisted Clinical Structuring (Tier 2)

**What it does NOT touch:** `Requirement` and `Priority` — these drive the Matching Engine and stay deterministic tap-select.

**Flow:**
```
Staff dictates or types one short clinical note
        ↓
NLP Structuring Service (Gemini API → regex fallback)
        ↓
Draft: { diagnosis, allergies, treatment_given }
        ↓
Rendered as editable review screen — nothing saved yet
        ↓
Staff taps Confirm (or edits first)
        ↓
Written to packets, event logged (AI_EXTRACTION_CONFIRMED)
```

Hard rule: no auto-submit path. Every AI-extracted field is labelled with the confirming staff member's name. Tier 2 is enrichment, never a dispatch gate.

---

## 10. Non-Functional Requirements

| Concern | Approach |
|---|---|
| **Latency** | Capacity ranking <500ms — Redis cache, not DB |
| **Data integrity** | Soft-hold via atomic Redis SETNX; GCM auth_tag on every packet |
| **Freshness** | Staleness nudges + reroute-on-change |
| **Security** | AES-256-GCM with per-record salt + HKDF; role-based referral-scoped access |
| **Patient identity** | HMAC-SHA256 patient key; phone stored only in encrypted packet |
| **AI safety** | LLM structuring confirm-gated; never in dispatch path |
| **Offline resilience** | SMS fallback (informational only) |
| **Auditability** | Hash-chained referral_events for all event types |
| **Scalability** | Event bus decouples all services |

---

## 11. Tech Stack

- **Client:** React (web control-room), React Native / Flutter (app)
- **API Gateway:** Node.js/Express, JWT + role-based auth
- **Services:** Node.js/Go microservices
- **Patient Identity:** HMAC-SHA256 key derivation (Node `crypto.createHmac`)
- **Encryption:** AES-256-GCM via Node `crypto`, HKDF for per-record key derivation
- **Audit Chain:** SHA-256 hash-chaining, append-only `referral_events` table
- **NLP Service:** Gemini 1.5 Flash (structured JSON output) → regex fallback
- **Event Bus:** Kafka or Redis Streams
- **Databases:** PostgreSQL (pg-mem in dev), Redis
- **Maps/ETA:** OpenStreetMap + Leaflet, Haversine distance
- **Notifications:** FCM/APNs (push), Twilio/MSG91 (SMS)

---

## 12. Known Limitations

- System is only as reliable as the manual capacity number. Staleness nudges and reroute exist to contain this risk.
- Specialist-availability reroutes may find no reachable alternative — surfaced to district authorities, not hidden.
- HMAC-SHA256 patient key correlates patients across referrals but is NOT a national health identifier (ABHA). Cross-facility lookup is internal only.
- LLM structuring can misparse — entirely mitigated by mandatory human-confirm gate.
- Hash-chaining proves the log wasn't altered; it does not prove a hospital's initial capacity entry was truthful.
- Phone number collection requires patient/guardian consent; the system doesn't automate consent.

---

## 13. Demo Plan (2–3 min, live)

1. **Problem** (10s) — "10 phone calls, unknown if the 3rd hospital actually has a bed"
2. **Patient Registration** (15s) — fill form, enter phone, system shows generated patient key with encryption indicator
3. **Critical Find** (15s) — map opens, color-coded, referral fires, soft-hold placed
4. **Live Reroute** (25s) — zero out target hospital's capacity on Capacity Panel, system catches it, redirects ambulance — centerpiece
5. **Audit Trail** (10s) — tap referral audit trail, show hash chain with "chain intact ✓" on every event
6. **Cross-hospital lookup** (10s) — paste patient key, show prior referral history
7. **Close** (5s):
   > "We don't ask hospitals to confirm — we trust their live data, prove every action with a tamper-evident chain, and tie every patient to a portable cryptographic key. Faster than a phone call, safer than a guess, provable after the fact."
