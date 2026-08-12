# Emergency Referral Orchestration Network
### Data Schema

---

## 1. Entities Overview

```
Hospital ──< Department ──< Resource (Bed/ICU/Ventilator pool)
Hospital ──< Staff (User)
Hospital ──< Ambulance
Referral ──1:1── ReferralPacket
Referral ──< ReferralEvent (audit/time log)
Referral ──1:1── AmbulanceAssignment
Referral belongs to originHospital, targetHospital (nullable until matched)
```

---

## 2. Hospital

| Field | Type | Notes |
|---|---|---|
| hospital_id | UUID (PK) | |
| name | string | |
| type | enum | DISTRICT, PERIPHERAL, TERTIARY, PRIVATE |
| lat, lng | float | for ETA/distance calc |
| address | string | |
| district_code | string | for authority-level rollup |
| contact_number | string | fallback manual confirm |
| data_source_tier | enum | MANUAL, HIMS_API, GOV_PIPELINE (Phase 1/2/3) |
| last_capacity_update_at | timestamp | drives staleness reminders |
| active | boolean | |

## 3. Department

| Field | Type | Notes |
|---|---|---|
| department_id | UUID (PK) | |
| hospital_id | UUID (FK) | |
| type | enum | NEUROSURGERY, CARDIOLOGY, ICU, ORTHO, ... |
| specialist_on_call | boolean | changes hour to hour |
| specialist_name | string | optional |

## 4. Resource (capacity pool)

Bed/ICU/ventilator counters — the "+/–" live counter from Phase 1.

| Field | Type | Notes |
|---|---|---|
| resource_id | UUID (PK) | |
| hospital_id | UUID (FK) | |
| resource_type | enum | ICU_BED, GENERAL_BED, VENTILATOR, CT, OT |
| total_capacity | int | |
| available_count | int | derived from state machine below |
| updated_by_staff_id | UUID (FK) | |
| updated_at | timestamp | |

### Resource unit state machine
Each individual unit (not just the counter) should be trackable if the referral concurrency problem is to be solved properly:

```
AVAILABLE → TEMPORARILY_HELD → HOSPITAL_CONFIRMED → RESERVED → PATIENT_ARRIVED → OCCUPIED
```

| Field | Type | Notes |
|---|---|---|
| resource_unit_id | UUID (PK) | one row per physical bed/ventilator, or a "held count" if unit-level tracking is too heavy for MVP |
| resource_id | UUID (FK) | |
| state | enum | as above |
| held_for_referral_id | UUID (FK, nullable) | prevents double-allocation |
| hold_expires_at | timestamp (nullable) | auto-release if hospital doesn't confirm in time |

---

## 5. Staff (User)

| Field | Type | Notes |
|---|---|---|
| staff_id | UUID (PK) | |
| hospital_id | UUID (FK) | |
| role | enum | DUTY_DOCTOR, REFERRAL_DESK, BED_ADMISSION_DESK, AMBULANCE_DISPATCHER, AUTHORITY_ADMIN |
| name | string | |
| phone | string | |
| auth_id | string | maps to auth provider |

Note: doctor role exists for attribution/audit only — doctors don't operate matching logic, per PRD section 2.

---

## 6. Ambulance

| Field | Type | Notes |
|---|---|---|
| ambulance_id | UUID (PK) | |
| hospital_id / control_room_id | UUID (FK) | |
| type | enum | BLS, ALS, VENTILATOR_EQUIPPED |
| current_lat, current_lng | float | live tracking |
| status | enum | IDLE, EN_ROUTE_TO_PICKUP, EN_ROUTE_TO_HOSPITAL, OFFLINE |
| driver_name | string | |
| driver_phone | string | |

---

## 7. Referral

The core object tying everything together.

| Field | Type | Notes |
|---|---|---|
| referral_id | UUID (PK) | |
| origin_hospital_id | UUID (FK) | |
| target_hospital_id | UUID (FK, nullable) | set once matched |
| created_by_staff_id | UUID (FK) | |
| requirement_summary | string | e.g. "ICU + Neurosurgeon + Ventilator + CT" |
| required_resources | array<enum> | maps to Resource.resource_type |
| priority | enum | CRITICAL, URGENT, ROUTINE |
| status | enum | see referral state machine below |
| matched_hospital_ids | array<UUID> | ranked candidates before acceptance |
| accepted_hospital_id | UUID (FK, nullable) | |
| ambulance_id | UUID (FK, nullable) | |
| rerouted_count | int | increments on auto re-route |
| created_at | timestamp | |
| closed_at | timestamp (nullable) | |

### Referral state machine

```
CREATED → MATCHING → REQUEST_SENT → HOSPITAL_CONFIRMED → AMBULANCE_ASSIGNED
   → IN_TRANSIT → (REROUTING → IN_TRANSIT)* → ARRIVED → HANDED_OVER → CLOSED
   
Alternate paths: REQUEST_SENT → REJECTED → MATCHING (retry)
                 any state → CANCELLED
```

---

## 8. ReferralEvent (audit / time log)

Satisfies the "Time log of every action" requirement in the digital packet.

| Field | Type | Notes |
|---|---|---|
| event_id | UUID (PK) | |
| referral_id | UUID (FK) | |
| event_type | enum | CREATED, MATCHED, REQUEST_SENT, ACCEPTED, REJECTED, RESERVED, DISPATCHED, REROUTED, ARRIVED, HANDED_OVER, CLOSED |
| actor_staff_id | UUID (FK, nullable) | null for system-generated events (e.g. auto-reroute) |
| metadata | JSON | e.g. {from_hospital, to_hospital, reason} for reroute events |
| timestamp | timestamp | |

---

## 9. ReferralPacket (encrypted clinical handoff)

1:1 with Referral. Encrypted at rest; access scoped to origin + target hospital staff only.

| Field | Type | Notes |
|---|---|---|
| packet_id | UUID (PK) | |
| referral_id | UUID (FK, unique) | |
| patient_name | string (encrypted) | |
| patient_age | int | |
| patient_sex | enum | |
| clinical_summary | text (encrypted) | |
| vitals | JSON | {bp, hr, spo2, rr, temp, gcs, ...} |
| diagnosis_suspected | text | |
| treatment_given | text | |
| medications | array<string> | |
| allergies | array<string> | |
| investigations | array<{type, result, file_url}> | |
| reason_for_referral | text | |
| referring_doctor_name | string | attribution only, doctor has no login |
| access_grants | array<{hospital_id, granted_at}> | role-based encrypted access |

---

## 10. AmbulanceAssignment

| Field | Type | Notes |
|---|---|---|
| assignment_id | UUID (PK) | |
| referral_id | UUID (FK) | |
| ambulance_id | UUID (FK) | |
| matched_reason | string | e.g. "ventilator-equipped, nearest ETA" |
| eta_minutes | int | traffic-adjusted, recalculated periodically |
| assigned_at | timestamp | |
| reassigned | boolean | true if changed due to reroute |

---

## 11. Notification / SMS Fallback (Phase 2 feature, schema stub)

| Field | Type | Notes |
|---|---|---|
| sms_request_id | UUID (PK) | |
| from_phone | string | |
| raw_text | string | e.g. "CT 500 URGENT" |
| parsed_requirement | string | |
| parsed_location_code | string | |
| parsed_priority | enum | |
| reply_text | string | truncated to SMS char limit |
| referral_id | UUID (FK, nullable) | linked if converted to a full referral |
| created_at | timestamp | |

---

## 12. Aggregate / Analytics (control-room dashboard)

Derived/materialized, not a primary write table — computed from Referral + ReferralEvent.

| Metric | Source |
|---|---|
| % referrals failed due to resource type X | Referral.status = REJECTED grouped by required_resources |
| Avg time CREATED → HOSPITAL_CONFIRMED | ReferralEvent timestamps diff |
| Reroute rate | Referral.rerouted_count > 0 / total |
| District-level capacity gap (e.g. neurosurgery) | Referral.required_resources grouped by origin district over time |

---

## 13. Key Constraints / Invariants

- A `Resource unit` can be `held_for_referral_id` by **at most one** active referral at a time — this is what prevents the double-booking problem the PRD calls out.
- `hold_expires_at` must auto-release back to `AVAILABLE` if the target hospital doesn't confirm in time (prevents phantom holds from stalling other referrals).
- `Referral.status = REROUTING` must always be accompanied by a `ReferralEvent` with `event_type = REROUTED` and metadata capturing `from_hospital` / `to_hospital` for audit purposes.
- `ReferralPacket` access is enforced at the query layer — only staff whose `hospital_id` matches `origin_hospital_id` or `target_hospital_id`/`accepted_hospital_id` on the parent Referral may read it.
