# ERON API Contract & Integration Specifications

This document defines the live, authenticated REST endpoints and WebSocket events for the ERON backend.

## Base URL
- Local: `http://localhost:3000/api`
- Production: `/api`

## Authentication
All API endpoints (except `/auth/login` and `/hospitals`) require a JWT Bearer token in the `Authorization` header.
```http
Authorization: Bearer <your_jwt_token>
```

---

## REST Endpoints

### 1. Authentication
**`POST /api/auth/login`**
- **Description:** Mock login endpoint to issue JWTs for hospitals.
- **Payload:** `{ "hospitalName": "St. Jude", "hospitalCode": "HOSP-PASS" }`
- **Response:** `{ "token": "...", "hospitalId": "hosp-a", "hospitalName": "St. Jude", "role": "DOCTOR" }`

### 2. Capacity Management
**`GET /api/hospitals`**
- **Description:** Fetch all hospitals with live capacity (Public/Unauthenticated).
- **Response:** `Array<{ id, name, type, lat, lng, capabilities: [], resources: [] }>`

**`POST /api/hospitals/:id/capacity`**
- **Description:** Adjust resource capacity. Requires `DOCTOR` or `ADMIN` role.
- **Payload:** `{ "resourceType": "ICU_BED", "delta": -1, "staffId": "staff-1" }` OR `{ "resourceType": "ICU_BED", "exactCount": 10 }`

### 3. Referral Lifecycle
**`POST /api/referrals/match`**
- **Description:** Calculate ranked hospital candidates based on needs.
- **Payload:** `{ "requiredCapabilities": ["NEUROLOGY"], "requiredResources": ["ICU_BED"], "priority": "CRITICAL" }`
- **Response:** `Array<{ hospitalId, matchScore, distanceKm, estTravelTimeMin }>`

**`POST /api/referrals`**
- **Description:** Create a new referral and notify the target hospital.
- **Payload:** `{ "targetHospitalId": "hosp-b", "requirementSummary": "...", "requiredCapabilities": [], "requiredResources": [], "priority": "CRITICAL", "patientData": { ... } }`

**`POST /api/referrals/:id/accept`**
- **Description:** Target hospital accepts referral. *Will return 409 Conflict if beds are unavailable.*
- **Payload:** `{ "staffId": "dr-smith" }`

**`POST /api/referrals/:id/assign-ambulance`**
- **Description:** Control room/origin assigns an ambulance.
- **Payload:** `{ "ambulanceId": "amb-1" }`

**`POST /api/referrals/:id/handover`**
- **Description:** Complete the handoff at the destination.
- **Payload:** `{ "staffId": "dr-smith", "notes": "Patient stable" }`

**`GET /api/referrals/:id/packet`**
- **Description:** Fetch decrypted clinical packet. Only origin and target hospitals are authorized (RBAC check).

### 4. Special Triggers & Demo Features
**`POST /api/referrals/simulate-capacity-loss`**
- **Description:** Forces target hospital capacity to 0 and triggers the auto-reroute centerpiece.
- **Payload:** `{ "referralId": "ref-123" }` (Optional. Defaults to first active referral).

**`POST /api/demo/reset`**
- **Description:** Resets the in-memory DB back to the initial seed state.

---

## WebSocket Events (Socket.IO)

The backend broadcasts the following events. The frontend should listen and update state.

- `CAPACITY_UPDATED`: When beds are claimed or released.
- `REFERRAL_CREATED`: New inbound referral for a hospital.
- `REFERRAL_ACCEPTED`: Hospital confirms acceptance.
- `AMBULANCE_ASSIGNED`: Status changes to IN_TRANSIT.
- `REFERRAL_REROUTED`: System centerpiece auto-reroute trigger.
- `CHAT_MESSAGE_RECEIVED`: New message in a thread.
