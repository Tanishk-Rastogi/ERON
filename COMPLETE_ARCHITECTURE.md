# ERON — Emergency Referral & Operations Network
## Complete Architecture Document (v3.1 — Final)

---

## 1. Problem Statement

### 1.1 The Core Problem

When a patient arrives at a district or peripheral hospital with a condition requiring specialized care (neurosurgery, ICU, ventilator support) that the hospital cannot provide, the emergency staff must find a facility that can accept the patient. Today this happens through **manual phone calls to multiple hospitals**, one at a time, to check:

- Does the hospital have the required specialist/department?
- Does it currently have bed/ICU/ventilator capacity available *right now*?
- Can it confirm acceptance of this specific patient?
- Is a suitable ambulance available for the transfer?

This process is slow, uncoordinated, and entirely dependent on individual staff effort, causing **critical delays in time-sensitive emergencies**.

### 1.2 The Real Gap

It is **not a discovery problem** — hospital staff already know which hospitals exist. The actual gap is:

> **Static knowledge of "what a hospital offers" does not tell you "what a hospital can accept right now."**

Capacity (ICU beds, ventilators, specialist on-call status) changes hour to hour. Confirming *current* availability and getting a *committed acceptance* is what requires repeated phone calls.

### 1.3 Impact

- **Average 10–15 phone calls** per emergency transfer
- **30–60 minutes lost** in coordination before ambulance dispatch
- **Bed unavailability discovered only on arrival** — patient must be rerouted again
- **No audit trail** — no way to prove what happened, who did what, or verify data integrity

---

## 2. Solution Overview

### 2.1 What ERON Does

ERON replaces manual phone calls with a **real-time coordination platform** that performs:

```
Find → Confirm → Allocate → Dispatch → Track → Handover
```

### 2.2 Step-by-Step Flow

```
Patient arrives at Hospital A
        ↓
Doctor identifies requirement (ICU + Neurosurgeon + Ventilator + CT)
        ↓
Staff enters requirement into system (~20 seconds)
        ↓
System matches nearby hospitals by capability + real-time capacity
        ↓
Candidates ranked by: Capability Match (40%) + Distance/ETA (35%) + Capacity Headroom (15%) + Specialist Status (10%)
        ↓
Referral request sent to best-matching hospital(s)
        ↓
Receiving hospital accepts/rejects → bed/resource soft-held
        ↓
Ambulance matched based on patient requirement (BLS/ALS/Ventilator)
        ↓
Live tracking of transfer + real-time ETA (OSRM road routing)
        ↓
AES-256-GCM encrypted clinical handoff packet shared with receiving doctor
        ↓
Patient arrives → handover completed → referral closed
        ↓
Every action logged to SHA-256 hash-chained audit trail
```

### 2.3 Three Design Principles

1. **Speed without guessing.** Matching reads live-capacity data; the "decision" happens the moment a hospital's capacity says `available`. No human confirmation gate in the dispatch path.
2. **Trust must be provable.** Every referral action is recorded in a SHA-256 hash-chained audit log that is independently verifiable.
3. **Patient identity is sovereign.** Each patient is issued a cryptographic key (HMAC-SHA256 from phone number) that travels with every referral, enabling cross-hospital lookup without exposing PII.

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (React 18 + Vite)                    │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Receiving │ │ Transfer │ │ Capacity │ │ Control  │ │ Messaging│  │
│  │   Tab     │ │   Tab    │ │  Panel   │ │   Room   │ │  Center  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ REST API + WebSocket (ws)
┌────────────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY (Express 5)                           │
│        JWT Auth + Role-Based Access Control + CORS                   │
└────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┘
     │       │       │       │       │       │       │       │
     ▼       ▼       ▼       ▼       ▼       ▼       ▼       ▼
┌────────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│  Auth  ││Refer-││Hospi-││Ambul-││  SMS ││Analy-││Messa-││ Demo │
│ Service││rials ││tals  ││ances ││Gate- ││tics  ││ges   ││      │
│        ││      ││      ││      ││way   ││      ││      ││      │
└───┬────┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
    └────────┴───────┴───────┴───────┴───────┴───────┴───────┘
                             │
                    ┌────────▼────────┐
                    │   Data Layer     │
                    │  PostgreSQL      │
                    │  (pg-mem in dev) │
                    └─────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3 | SPA with hot reload |
| **UI Icons** | Lucide React | Consistent iconography |
| **Maps** | Leaflet 1.9, React-Leaflet, CARTO tiles | Hospital markers, live tracking |
| **Routing** | OSRM (free public API) | Real road routes for ambulance tracking |
| **Backend** | Node.js, Express 5 | REST API server |
| **Real-time** | WebSocket (`ws` library) | Live updates, capacity broadcasts |
| **Database** | PostgreSQL 15 (pg-mem in dev) | Persistent data storage |
| **Auth** | JWT (jsonwebtoken) | Hospital authentication |
| **Encryption** | Node.js `crypto` (AES-256-GCM) | Clinical packet encryption |
| **Patient Key** | HMAC-SHA256 | Cross-hospital patient identity |
| **SMS** | Twilio API | SMS fallback for low-connectivity areas |
| **NLP** | Gemini 1.5 Flash (optional) | Clinical note structuring |
| **Error Tracking** | Sentry | Production error monitoring |

### 3.3 Development Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite Dev) | 3000 | http://localhost:3000 |
| Backend (Express) | 3001 | http://localhost:3001 |
| PostgreSQL (Docker) | 5433 | localhost:5433 |

---

## 4. Database Schema

### 4.1 Entity-Relationship Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   hospitals  │────<│     users    │     │  ambulances  │
│──────────────│     │──────────────│     │──────────────│
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ name         │     │ hospital_id  │     │ hospital_id  │
│ location_lat │     │ role         │     │ type         │
│ location_lng │     │ name         │     │ status       │
│ capabilities │     │ phone        │     │ current_lat  │
│ contact_info │     │ password_hash│     │ current_lng  │
│ tier         │     └──────────────┘     └──────────────┘
└──────┬───────┘
       │
       │ 1:N
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│beds_capacity │     │  referrals   │────<│referral_events│
│──────────────│     │──────────────│     │──────────────│
│ id (PK)      │     │ id (PK)      │     │ id (PK)      │
│ hospital_id  │     │ patient_ref_id│    │ referral_id  │
│ bed_type     │     │ patient_key  │     │ action       │
│ total        │     │ sending_hosp │     │ actor        │
│ available    │     │ receiving_hosp│    │ payload      │
│ last_updated │     │ required_caps│     │ event_hash   │
└──────────────┘     │ status       │     │ prev_hash    │
                     │ timeout_secs │     │ created_at   │
                     │ patient_data │     └──────────────┘
                     │ rejection_reason│
                     └──────┬───────┘
                            │ 1:N
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │    packets   │ │referral_stat.│ │referral_rank.│
    │──────────────│ │    _log      │ │    _log      │
    │ referral_id  │ │──────────────│ │──────────────│
    │ encrypted_dat│ │ referral_id  │ │ referral_id  │
    │ iv           │ │ from_status  │ │ hospital_id  │
    │ auth_tag     │ │ to_status    │ │ match_score  │
    │ salt         │ │ event_hash   │ │ was_accepted │
    └──────────────┘ │ prev_hash    │ │ was_rejected │
                     └──────────────┘ └──────────────┘
```

### 4.2 Table Definitions

#### `hospitals`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique hospital identifier |
| `name` | VARCHAR(255) | Hospital name |
| `location_lat` | DOUBLE PRECISION | GPS latitude |
| `location_lng` | DOUBLE PRECISION | GPS longitude |
| `capabilities` | TEXT[] | Array of capabilities (ICU, NEUROSURGERY, etc.) |
| `contact_info` | VARCHAR(255) | Phone number |
| `tier` | INTEGER | Hospital tier (1-3) |

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique user identifier |
| `hospital_id` | INTEGER FK | Associated hospital |
| `role` | VARCHAR(50) | DOCTOR, control_room_admin, referral_staff, receiving_hospital_desk |
| `name` | VARCHAR(255) | Full name |
| `phone` | VARCHAR(50) | Unique phone number |
| `password_hash` | VARCHAR(255) | Bcrypt-hashed password |

#### `beds_capacity`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique record identifier |
| `hospital_id` | INTEGER FK | Associated hospital |
| `bed_type` | VARCHAR(50) | ICU_BED, VENTILATOR, CT_SCAN, TRAUMA_OT, etc. |
| `total` | INTEGER | Total capacity |
| `available` | INTEGER | Currently available |
| `last_updated_at` | TIMESTAMP | Last manual update time |
| `last_updated_by` | INTEGER FK | User who last updated |

#### `referrals`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique referral identifier |
| `patient_ref_id` | VARCHAR(255) | Human-readable ref code (PAT-2026-XXXX) |
| `patient_key` | VARCHAR(64) | HMAC-SHA256 of phone number (for cross-hospital lookup) |
| `sending_hospital_id` | INTEGER FK | Origin hospital |
| `receiving_hospital_id` | INTEGER FK | Target hospital (null if pending match) |
| `required_capabilities` | TEXT[] | Required capabilities array |
| `status` | VARCHAR(50) | Current lifecycle status |
| `timeout_seconds` | INTEGER | Response window (default 300s) |
| `patient_data` | JSONB | Patient info (name, age, vitals, diagnosis) |
| `rejection_reason` | TEXT | Reason if rejected |
| `created_at` | TIMESTAMP | Creation time |

#### `packets` (AES-256-GCM encrypted clinical data)
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique packet identifier |
| `referral_id` | INTEGER FK | Associated referral |
| `encrypted_data` | TEXT | Ciphertext (hex) |
| `iv` | VARCHAR(32) | Initialization vector (hex) |
| `auth_tag` | VARCHAR(32) | GCM authentication tag (hex) |
| `salt` | VARCHAR(32) | Per-record salt for HKDF (hex) |

#### `referral_events` (blockchain-style audit chain)
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique event identifier |
| `referral_id` | INTEGER FK | Associated referral |
| `action` | VARCHAR(100) | Event type (REFERRAL_CREATED, STATUS_TRANSITION, etc.) |
| `actor` | VARCHAR(255) | User ID or SYSTEM |
| `payload` | JSONB | Event-specific data |
| `event_hash` | VARCHAR(64) | SHA-256 hash of this event |
| `prev_hash` | VARCHAR(64) | Hash of previous event (chain link) |
| `created_at` | TIMESTAMP | Event timestamp |

#### `sms_fallback_log`
| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL PK | Unique log identifier |
| `raw_sms` | TEXT | Raw SMS content |
| `parsed_requirement` | TEXT | Parsed requirement keyword |
| `response_sent` | TEXT | Response text sent back |

---

## 5. Security Architecture

### 5.1 Authentication

- **JWT Tokens**: Hospitals authenticate via `/api/auth/login` with hospital name
- **Token Contents**: `{ id, hospital_id, name, role }`
- **Token Expiry**: 8 hours
- **Dev Mode**: If no token provided, middleware injects a mock control room admin user

### 5.2 Patient Key (HMAC-SHA256)

```
patient_key = HMAC-SHA256(
  key   = PATIENT_KEY_SECRET (env var),
  data  = normalize(phone_number)  // digits only, strip +91 prefix
)
→ 64-character hex string
```

**Properties:**
- Deterministic: same phone → same key
- Non-reversible: cannot recover phone from key
- Cross-hospital portable: Hospital B can look up `GET /api/patients/:key`
- PII-isolated: phone is never stored in plaintext

### 5.3 Clinical Packet Encryption (AES-256-GCM)

```
patientData (JSON) + patientPhone
        ↓
per_record_salt = crypto.randomBytes(16)
encryption_key  = scryptSync(PACKET_ENCRYPTION_SECRET, salt, 32)
iv              = crypto.randomBytes(12)  // 96-bit for GCM
        ↓
{ ciphertext, auth_tag } = AES-256-GCM(key, iv, patientData)
        ↓
stored: { iv_hex, salt_hex, auth_tag_hex, ciphertext_hex }
```

**Why GCM over CBC:**
- GCM is authenticated encryption — `auth_tag` proves ciphertext wasn't tampered with
- Per-record salt means each packet uses a unique derived key
- Compromising one packet's key does not compromise others

### 5.4 Blockchain Audit Chain (SHA-256 Hash Chaining)

```
Every event → event_hash = SHA-256(JSON({ referralId, action, actor, payload, prevHash, timestamp }))
           → appended to referral_events (append-only)
           → any hash mismatch proves log alteration
```

**Genesis block**: `SHA-256("ERON-GENESIS-BLOCK-v1")`

**Verification**: `GET /api/referrals/:id/verify-audit` walks the chain, recomputes hashes, returns `{ is_valid: boolean, chain: [...] }`

**What it proves:**
- ✅ Log was not altered after the fact
- ✅ Sequence of events is exactly as recorded
- ❌ Does NOT prove hospital's manual capacity entry was truthful
- ❌ Does NOT require distributed consensus

---

## 6. Referral Lifecycle State Machine

### 6.1 Status Transitions

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REFERRAL LIFECYCLE                            │
│                                                                       │
│  CREATED ──→ PENDING_MATCH ──→ REQUEST_SENT ──→ ACCEPTED            │
│     │              │                │                │                │
│     │              │                │                ▼                │
│     │              │                │         HOSPITAL_CONFIRMED     │
│     │              │                │                │                │
│     │              │                │                ▼                │
│     │              │                │           IN_TRANSIT           │
│     │              │                │                │                │
│     │              │                │                ▼                │
│     │              │                │           COMPLETED            │
│     │              │                │                                │
│     │              │                ▼                                │
│     │              │           REJECTED ◄── (manual or auto-timeout)│
│     │              │                │                                │
│     │              │                ▼                                │
│     │              │           RE_ROUTED ──→ (new target hospital)  │
│     │              │                                                │
│     │              └──→ (auto-match finds best hospital)            │
│     │                                                                │
│     └──→ (direct creation with target)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Bed Capacity State Machine

```
AVAILABLE ⇄ (manual +/- updates, real-time WebSocket broadcast)
     ↓ (referral created, soft-hold placed)
TEMPORARILY_HELD
     ↓ (ambulance dispatched)
RESERVED
     ↓ (patient arrives)
OCCUPIED
     ↓ (patient discharged)
AVAILABLE
```

### 6.3 Auto-Reroute Engine

When a referral is in `REQUEST_SENT` or `IN_TRANSIT` status and the target hospital's capacity drops to zero:

1. System detects capacity loss (via manual update or timed check)
2. Re-runs matching algorithm from ambulance's current GPS position
3. Finds next-best hospital with available capacity
4. Updates `receiving_hospital_id` to new target
5. Sets status to `RE_ROUTED`
6. Broadcasts `REFERRAL_REROUTED` via WebSocket
7. Logs `AUTO_REROUTE` event to audit chain

**Auto-accept/reject on timeout**: If no manual action within `timeout_seconds`:
- If `AUTO_ACCEPT_ON_TIMEOUT !== 'false'`: auto-accepts the referral
- Otherwise: auto-rejects and releases soft-held beds

---

## 7. Frontend Architecture

### 7.1 Component Tree

```
App.jsx
├── WebSocketProvider (context/WebSocketContext.jsx)
│   └── AppContent
│       ├── AuthPage (login/register)
│       ├── Header (navigation tabs)
│       ├── HospitalProfilePanel (slide-in)
│       ├── ReferralStatusDashboard (full-screen modal)
│       ├── Acceptance/Rejection CTA Toasts
│       ├── Live Notification Banner
│       │
│       ├── ReceivingTab
│       │   ├── Incoming Referral Cards
│       │   ├── Accept/Reject Buttons
│       │   └── Live Ambulance Tracking Map
│       │
│       ├── TransferTab
│       │   ├── PatientRegistrationModal
│       │   ├── Multi-Select Search Bar
│       │   ├── Leaflet Map (hospital markers)
│       │   ├── Top Results Cards (sorted by proximity)
│       │   ├── Send Transfer Alert Modal
│       │   ├── Hospital Detail Modal
│       │   └── SMSModal
│       │
│       ├── CapacityPanel
│       │   └── Resource Grid (+/- counters)
│       │
│       ├── ControlRoomAnalytics
│       │   ├── District Stats
│       │   ├── Bottleneck Charts
│       │   └── Hospital Capacity Table
│       │
│       └── MessagingTab
│           ├── FlowTester (7-step E2E pipeline)
│           ├── RoleSwitcher
│           └── MessagingCenter (chat + templates)
│
├── uber-map/
│   ├── LiveAmbulanceMap.tsx (Leaflet + OSRM routing)
│   ├── mockLocationFeed.ts (simulated GPS pings)
│   ├── useAmbulanceAnimation.ts (smooth interpolation)
│   └── styles.css (CSS-only animations)
```

### 7.2 State Management

**WebSocketContext** provides global state:
- `hospitals[]` — all hospitals with live capacity
- `referrals[]` — all referrals for current hospital
- `threads[]` — chat threads
- `messages[]` — chat messages
- `typingUsers{}` — real-time typing indicators
- `lastNotification` — toast notification
- `lastAcceptedReferral` / `lastRejectedReferral` — CTA toast triggers

**Key state tracking**:
- `originalTargetHospitalId` — preserved across auto-reroutes so rejection attribution is never lost
- Hospital resource mapping: `r.type` (ICU_BED) → display name (ICU Bed) with fuzzy matching for filters

### 7.3 Real-Time Communication

**WebSocket Events (Server → Client)**:
| Event | Payload | Purpose |
|-------|---------|---------|
| `CAPACITY_UPDATED` | hospitalId, resourceType, availableCount | Live capacity sync |
| `REFERRAL_CREATED` | referral object | New incoming referral |
| `REFERRAL_ACCEPTED` | referral, acceptedByName | Hospital confirmed |
| `REFERRAL_REJECTED` | referral, rejectionReason | Hospital declined |
| `REFERRAL_REROUTED` | referral, oldHospitalId, newHospitalId | Auto-reroute triggered |
| `AMBULANCE_DISPATCHED` | referral, ambulance | Ambulance assigned |
| `CHAT_MESSAGE_RECEIVED` | message, threadId | New chat message |
| `TYPING_INDICATOR` | threadId, isTyping, userName | Real-time typing |
| `MESSAGES_READ` | threadId, readByUserId | Read receipts |

**Scoped Broadcasting**: Server only sends referral events to hospitals involved in that referral (checked via `originHospitalId`, `targetHospitalId`, `acceptedHospitalId`).

---

## 8. API Endpoints

### 8.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Register/login hospital (auto-creates if new) |

### 8.2 Hospitals
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hospitals` | List all hospitals with capacity |
| GET | `/api/hospitals/:id` | Get hospital details |
| POST | `/api/hospitals/:id/capacity` | Update bed/resource count (delta or exact) |

### 8.3 Referrals
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/referrals` | Create new referral (with patient key, encryption, audit) |
| GET | `/api/referrals` | List referrals for current hospital |
| GET | `/api/referrals/:id` | Get referral details |
| POST | `/api/referrals/:id/accept` | Accept referral |
| POST | `/api/referrals/:id/reject` | Reject with reason |
| GET | `/api/referrals/:id/packet` | Decrypt clinical packet |
| POST | `/api/referrals/:id/assign-ambulance` | Assign ambulance |
| POST | `/api/referrals/extract` | NLP extraction from text (Gemini → regex fallback) |
| POST | `/api/referrals/match` | Find matching hospitals |
| POST | `/api/referrals/simulate-capacity-loss` | Demo: trigger auto-reroute |
| GET | `/api/referrals/:id/verify-audit` | Verify blockchain audit chain |
| GET | `/api/patients/:key` | Cross-hospital patient lookup by HMAC key |

### 8.4 SMS
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sms/webhook` | Parse inbound SMS, find matching hospitals |
| POST | `/api/sms/send` | Send SMS via Twilio (with mock fallback) |
| POST | `/api/sms/send-referral` | Send referral SMS to hospital + patient/guardian |

### 8.5 Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/district` | District-level stats, bottlenecks, hospital summary |
| GET | `/api/analytics/ranking-model` | ML model performance metrics |

### 8.6 Demo
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/demo/simulate-capacity-loss/:referralId` | Trigger mid-transit capacity loss |

---

## 9. Hospital Matching Algorithm

### 9.1 Scoring Formula

```
finalScore = (0.40 × capabilityScore) + (0.35 × normalizedEtaScore) + (0.15 × capacityHeadroomScore) + (0.10 × specialistScore)
```

| Factor | Weight | Calculation |
|--------|--------|-------------|
| **Capability Match** | 40% | Binary: 1.0 if hospital has all required capabilities, 0.0 otherwise |
| **Distance/ETA** | 35% | `max(0, 1 - distanceKm / 40)` — closer = higher score |
| **Capacity Headroom** | 15% | Average `available / total` across required resources |
| **Specialist Status** | 10% | Currently hardcoded to 0 (future: on-call status) |

### 9.2 Haversine Distance

```javascript
function getHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)² + Math.cos(lat1) × Math.cos(lat2) × Math.sin(dLon/2)²;
  return R × 2 × atan2(√a, √(1-a));
}
```

### 9.3 ETA Estimation

```javascript
function estimateEtaMinutes(distanceKm, priority) {
  const speedKmH = priority === 'CRITICAL' ? 42 : 35;
  return max(3, round((distanceKm / speedKmH) × 60) + 2);
}
```

---

## 10. Live Ambulance Tracking

### 10.1 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Mock GPS Feed   │────▶│ Animation Hook    │────▶│  Leaflet Map    │
│  (2.5s interval) │     │ (requestAnimFrame)│     │  (Marker + Poly)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                         │                        │
        │  LocationPoint          │  AnimatedPosition      │  Visual
        │  {lat,lng,bearing,      │  {lat,lng,bearing,     │  - SVG ambulance
        │   timestamp,speedKmph}  │   speedKmph}           │  - Route polyline
        │                         │                        │  - Progress bar
        └─────────────────────────┴────────────────────────┘
```

### 10.2 Key Components

| Component | Purpose |
|-----------|---------|
| `LiveAmbulanceMap.tsx` | Main map with Leaflet, OSRM route fetching, camera follow |
| `useAmbulanceAnimation.ts` | Smooth interpolation between GPS points using `requestAnimationFrame` |
| `mockLocationFeed.ts` | Simulates GPS pings along real OSRM road route |
| `styles.css` | CSS animations for ambulance icon (bounce, beacon, tilt, shadow) |

### 10.3 Data Flow

1. **Route Fetch**: On mount, fetches real road route from OSRM API (`router.project-osrm.org`)
2. **Mock Feed**: Emits GPS points every 2.5s along the route with random speed jitter (42-60 km/h)
3. **Animation Hook**: Interpolates between points using easeInOut curve for smooth movement
4. **Camera Follower**: Auto-pans map to follow ambulance, zooms in near destination
5. **Progress Metrics**: Calculates `progressPct`, `etaMin`, `remainingKm`, `speedKmph` in real-time

### 10.4 Production Swap

To use real GPS data instead of mock:
```typescript
// Replace startMockFeed() with:
const socket = io(SOCKET_URL);
socket.on('ambulance:location', (point: LocationPoint) => handleIncomingPoint(point));
```

No changes needed to animation hook or rendering layer.

---

## 11. SMS Integration (Twilio)

### 11.1 Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Staff SMS   │────▶│  ERON API   │────▶│   Twilio    │
│  "ICU 500"   │     │  /sms/webhook│    │   Gateway   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Auto-Reply  │
                    │  "HospB(8km) │
                    │  HospD(15km)"│
                    └─────────────┘
```

### 11.2 Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/sms/webhook` | Parse inbound SMS (keyword matching: CT, ICU, VENT, NEURO) |
| `POST /api/sms/send` | Send SMS via Twilio with mock fallback for trial accounts |
| `POST /api/sms/send-referral` | Compose and send referral details to hospital + patient/guardian |

### 11.3 SMS Message Format

**To Hospital:**
```
🔴 ERON URGENT REFERRAL #PAT-2026-1234
Patient: Deepak Sharma
Diagnosis: Acute Subdural Hematoma
Target: AIIMS Delhi
Please prepare required resources. Call 1923 for control room.
```

**To Patient/Guardian:**
```
🟡 ERON Update for Deepak Sharma
Referral #PAT-2026-1234 is being processed.
Target: AIIMS Delhi
Dial 1923 for emergencies.
```

---

## 12. UI Design System ("Eleven")

### 12.1 Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `canvas` | #f5f5f5 | Page background |
| `ink` | #0c0a09 | Primary text, display headings |
| `primary` | #292524 | CTA buttons, active states |
| `body` | #4e4e4e | Running text |
| `muted` | #777169 | Subtitles, captions |
| `hairline` | #e7e5e4 | Borders, dividers |
| `card` | #ffffff | Card backgrounds |
| `mint` | #a7e5d3 | Success accents |
| `peach` | #f4c5a8 | Warning accents |
| `lavender` | #c8b8e0 | Info accents |
| `sky` | #a8c8e8 | Active states |
| `rose` | #e8b8c4 | Error accents |

### 12.2 Typography

| Style | Font | Weight | Size |
|-------|------|--------|------|
| Display | Plus Jakarta Sans | 300 (light) | 24-64px |
| Body | Plus Jakarta Sans | 400-500 | 14-16px |
| Mono/Data | Outfit | 400-700 | 10-14px |

### 12.3 Component Classes

```css
.eleven-card      /* White card with border, rounded-2xl, hover shadow */
.eleven-panel     /* Frosted glass panel with backdrop-blur */
.eleven-pill      /* Rounded-full badge with background */
.eleven-badge     /* Uppercase mono text badge */
.eleven-button    /* Rounded-full CTA with shadow */
.eleven-button-primary   /* Dark ink button */
.eleven-button-secondary /* White outline button */
.eleven-button-danger    /* Red destructive button */
```

### 12.4 Rejection Visual System

| Element | Style |
|---------|-------|
| **Map marker (rejected)** | Red (#dc2626), ✕ icon, "⛔ ALREADY REJECTED" label, pulse animation |
| **Map marker (normal)** | Hospital color, ✚ icon, name label |
| **Map marker (Top 3)** | Star ⭐ badge, larger size |
| **Hospital card (rejected)** | Red left border (border-l-4), red-tinted background |
| **Send button (rejected)** | Amber "Re-send Despite Rejection" instead of green "Send Transfer Alert" |
| **Detail modal (rejected)** | Full rejection panel with reason, who rejected, referral code |

---

## 13. Deployment

### 13.1 Vercel Configuration

```json
{
  "version": 2,
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.js" },
    { "source": "/health", "destination": "/api/index.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 13.2 Docker (PostgreSQL)

```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: eron
      POSTGRES_PASSWORD: password
      POSTGRES_DB: eron
    ports: ["5433:5432"]
```

### 13.3 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `JWT_SECRET` | JWT signing secret | Yes |
| `PACKET_ENCRYPTION_SECRET` | AES-256-GCM master key | Yes |
| `PATIENT_KEY_SECRET` | HMAC-SHA256 master key | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | For SMS |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | For SMS |
| `TWILIO_PHONE_NUMBER` | Twilio sender number | For SMS |
| `GEMINI_API_KEY` | Google Gemini API key | For NLP (optional) |
| `SENTRY_DSN` | Sentry error tracking DSN | For monitoring (optional) |

---

## 14. Known Limitations & Future Work

### 14.1 Current Limitations

- **Manual capacity data**: System is only as reliable as the manual capacity number entered by hospital staff
- **In-memory database**: pg-mem loses data on restart (production would use real PostgreSQL)
- **No distributed consensus**: Audit chain proves log integrity but not data truthfulness
- **Phone consent**: Collecting phone numbers requires patient/guardian consent (not automated)
- **Trial Twilio account**: SMS limited to predefined templates

### 14.2 Future Roadmap

| Phase | Feature |
|-------|---------|
| **Phase 2** | HIMS integration for automatic capacity sync |
| **Phase 2** | Multi-language voice input for rural staff |
| **Phase 2** | Family notification via SMS/link |
| **Phase 2** | Predictive capacity (AI/ML based on historical patterns) |
| **Phase 3** | Mass-casualty priority triage |
| **Phase 3** | Government reporting pipeline integration |
| **Phase 3** | ABDM (Ayushman Bharat Digital Mission) alignment |

---

## 15. Demo Flow (2–3 minutes)

1. **Problem** (10s) — "10 phone calls, unknown if the 3rd hospital actually has a bed"
2. **Patient Registration** (15s) — Fill form, enter phone, system shows generated patient key with encryption indicator
3. **Hospital Matching** (15s) — Map opens with color-coded markers, Top Results sorted by proximity
4. **Transfer Dispatch** (15s) — Send alert, hospital receives WebSocket notification
5. **Live Reroute** (25s) — Zero out target hospital's capacity, system catches it, redirects ambulance — **centerpiece moment**
6. **Rejection Handling** (15s) — Hospital rejects with reason, red marker appears on map, "Re-send Despite Rejection" button
7. **Audit Trail** (10s) — Tap referral audit trail, show hash chain with "chain intact ✓" on every event
8. **SMS Fallback** (10s) — Send SMS from low-connectivity area, get auto-reply with hospital options

---

*Document generated: August 22, 2026*
*ERON v3.1 — Emergency Referral & Operations Network*
*Repository: https://github.com/krisshh0hub/ERON*
