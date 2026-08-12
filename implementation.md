# Emergency Referral Orchestration Network
### Implementation Plan

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | FastAPI (Python) | async, matches your existing ambulance-routing backend |
| DB | PostgreSQL | relational integrity needed for resource holds / state machines |
| Cache / locks | Redis | atomic hold/release on resource units, pub-sub for live updates |
| Realtime | WebSockets (FastAPI native) | ambulance location, referral status push to dashboard |
| Frontend | React + Vite | staff console, control-room dashboard |
| Maps/ETA | OSRM or Google Distance Matrix API | traffic-adjusted ETA |
| SMS gateway | Twilio / MSG91 (stub in MVP) | short-code fallback |
| Auth | JWT, role-based (staff.role from schema) | doctor has no login, per PRD |
| Encryption | AES-256 at rest for ReferralPacket fields, TLS in transit | |
| Deployment | Docker Compose (dev) → single VM or small K8s (demo) | keep it boring for a hackathon timeline |

---

## 2. Repo Structure

```
backend/
  app/
    main.py
    core/
      config.py
      security.py          # JWT, role guards
      redis_client.py
    models/                # SQLAlchemy models, 1:1 with schema.md
      hospital.py
      department.py
      resource.py
      staff.py
      ambulance.py
      referral.py
      referral_event.py
      referral_packet.py
      ambulance_assignment.py
    schemas/                # Pydantic request/response
    api/
      v1/
        hospitals.py
        resources.py
        referrals.py
        ambulances.py
        packets.py
        sms.py
        analytics.py
    services/
      matching_service.py   # capability + capacity + ETA ranking
      hold_service.py       # atomic resource hold/release (Redis lock)
      reroute_service.py    # detects capacity loss, triggers rematch
      eta_service.py        # wraps OSRM/Distance Matrix
      packet_service.py     # encrypt/decrypt, access checks
      notification_service.py
    workers/
      capacity_watcher.py   # background task: detects mid-transfer capacity loss
      staleness_reminder.py # nudges hospitals to update counters
    ws/
      referral_socket.py
      ambulance_socket.py
    db/
      session.py
      migrations/           # Alembic

frontend/
  src/
    pages/
      StaffConsole/          # requirement entry, referral tracking
      BedAdmissionDesk/      # accept/reject, +/- counter UI
      DispatcherView/        # ambulance assignment + live map
      ControlRoomDashboard/  # analytics, district-level view
    components/
      ReferralStatusTimeline.jsx
      ResourceCounter.jsx
      LiveMap.jsx
      RerouteAlertBanner.jsx
    hooks/
      useReferralSocket.js
      useAmbulanceSocket.js
    api/
      client.js
```

---

## 3. Build Order (maps to MVP scope in PRD §9)

**Phase A — Foundations**
1. DB schema + Alembic migrations from `schema.md`
2. Auth + role-based access (Staff roles)
3. Hospital / Department / Resource CRUD + the "+/–" counter endpoint

**Phase B — Core referral flow**
4. `POST /referrals` — staff creates requirement
5. `matching_service` — filter by capability (Department) + `available_count` > 0, rank by capacity + ETA
6. `POST /referrals/{id}/request` — send to top-N candidate hospitals, sets Resource unit → `TEMPORARILY_HELD` with `hold_expires_at`
7. `POST /referrals/{id}/accept` / `/reject` — target hospital confirms → `HOSPITAL_CONFIRMED` → `RESERVED`
8. `hold_service` — Redis-backed lock so two referrals can never hold the same unit (this is the concurrency invariant from schema.md §13)

**Phase C — Ambulance + tracking**
9. Ambulance matching by required equipment (BLS/ALS/Ventilator)
10. WebSocket channel for live lat/lng + ETA updates
11. `ReferralEvent` writes on every transition (audit trail)

**Phase D — The centerpiece: auto re-routing**
12. `capacity_watcher` background task polls/subscribes to Resource state changes on the `accepted_hospital_id` while referral is `IN_TRANSIT`
13. On capacity loss: `reroute_service` re-runs matching, sends new request, updates `Referral.status = REROUTING → IN_TRANSIT`, logs `REROUTED` event, pushes WS update to ambulance + both hospitals' dashboards

**Phase E — Digital handoff packet**
14. `ReferralPacket` create/read endpoints, encrypted fields, access check against `origin_hospital_id` / `accepted_hospital_id`
15. Receiving doctor view (read-only, no login required — access via referral-scoped link + hospital staff auth, per PRD's "doctor doesn't operate the software")

**Phase F — Dashboard + demo polish**
16. Control-room analytics endpoints (from schema.md §12)
17. Seed script with 2–3 hospitals, fake capacity data, one ambulance — enough to run the live demo script from PRD §10
18. Scripted "force capacity loss" demo trigger (a button/endpoint that flips accepted hospital's ICU count to 0 mid-transfer) — this is what makes the re-routing demo reliable and repeatable instead of relying on real timing

**Phase G — Stubbed/future (build only if time allows)**
19. SMS short-code endpoint — parse fixed-format text, return matches (no real telecom integration, just simulate the gateway call)
20. HIMS API sync stub (Phase 2 per PRD §4) — not needed for MVP demo

---

## 4. Key API Endpoints

```
POST   /hospitals/{id}/resources/{resource_id}/adjust   # +/- counter
POST   /referrals                                        # staff creates requirement
GET    /referrals/{id}/matches                           # ranked candidates
POST   /referrals/{id}/request                           # send to candidates, holds unit
POST   /referrals/{id}/accept                             # target hospital confirms
POST   /referrals/{id}/reject
POST   /referrals/{id}/dispatch                          # assign ambulance
PATCH  /ambulances/{id}/location                         # live location ping
POST   /referrals/{id}/force-capacity-loss                # DEMO ONLY: triggers reroute
GET    /referrals/{id}/packet                             # encrypted handoff, access-checked
GET    /analytics/district/{code}/gaps
WS     /ws/referrals/{id}
WS     /ws/ambulances/{id}
```

---

## 5. Reroute Logic (core differentiator — needs to be bulletproof for demo)

```
1. capacity_watcher detects: accepted_hospital's held/reserved unit
   flips to unavailable (or a competing emergency consumes it)
2. reroute_service:
   a. mark current Referral.status = REROUTING
   b. release any stale hold on old hospital
   c. re-run matching_service excluding the failed hospital
   d. auto-send request to next-best candidate
   e. on accept: update Referral.target_hospital_id,
      AmbulanceAssignment.reassigned = true,
      recalc eta_service for new destination
   f. push WS event to ambulance app + both hospitals + control room
   g. write ReferralEvent(REROUTED, metadata={from, to, reason})
3. Referral.status = IN_TRANSIT (new destination)
```

For the demo, step 1 should be triggerable manually via the `force-capacity-loss` endpoint rather than relying on a real race condition — this keeps the "wow moment" deterministic.

---

## 6. Suggested Timeline (hackathon-style, adjust to your actual runway)

| Days | Focus |
|---|---|
| 1–2 | DB schema, migrations, auth, Hospital/Resource CRUD |
| 3–4 | Referral create → match → request → accept flow |
| 5 | Ambulance assignment + live tracking (WS) |
| 6 | Reroute logic + demo trigger endpoint |
| 7 | Referral packet (encrypted) + receiving-doctor view |
| 8 | Control-room dashboard + analytics |
| 9 | Seed data, demo script rehearsal, polish UI |
| 10 | Buffer / bug fixing |

---

## 7. Open Implementation Risks

- **Hold expiry tuning** — too short and hospitals can't confirm in time under real workflow friction; too long and beds sit locked. Needs a configurable timeout (start ~5 min for demo).
- **Concurrent writes to `available_count`** — use Redis atomic INCR/DECR or DB row-level locking, not read-then-write from the API layer.
- **ETA service dependency** — if using a live traffic API, have a fallback static ETA calc (haversine distance / avg speed) so the demo doesn't break on API rate limits or no network.
- **Encryption key management** — even for a prototype, don't hardcode the AES key in source; use env var / secrets file so it's not a red flag in evaluation.
