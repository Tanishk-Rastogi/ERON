# Emergency Referral Orchestration Network (ERON)
### UI/UX Flow Document — v1.0

**Companion to:** System Architecture v2.0
**Design principle carried over from architecture:** *Notify, don't gate.* Every flow below is built around zero blocking confirmation steps — the UI's job is to keep every actor informed in real time, not to ask permission.

---

## 1. Personas & Entry Points

| Persona | Primary Screen | Mental state when using this app |
|---|---|---|
| **Referring Desk Staff** (origin hospital) | Critical Find → Main Dashboard | Under time pressure, patient waiting, needs speed over detail |
| **Receiving Desk Staff** (destination hospital) | Receiving Tab | Needs to prep a bed/team before a patient they didn't "approve" arrives |
| **Bed Admin** (any hospital) | Capacity Panel | Does this dozens of times a shift — must be near-zero-friction or they'll stop updating it |
| **Ambulance Dispatcher** | Main Dashboard (live tracking view) | Needs destination changes pushed to them instantly, not discovered late |
| **District/State Control Room** | Analytics Dashboard (Screen 5, new) | Passive monitoring most of the time, active only during escalations |

Design consequence: this is **not one app with one flow** — it's one shell with role-gated views. On login, role determines the landing screen (Section 2).

---

## 2. Navigation Map

```
                          ┌───────────────┐
                          │    Login       │
                          │ (phone + OTP)  │
                          └───────┬───────┘
                                  │ role-based redirect
       ┌──────────────┬──────────┼──────────┬───────────────────┐
       ▼              ▼          ▼          ▼                    ▼
┌─────────────┐ ┌───────────┐ ┌────────┐ ┌──────────────┐ ┌──────────────┐
│Main Dashboard│ │Critical    │ │Receiving│ │Capacity Panel│ │Control Room  │
│  (default)   │ │Find (FAB)  │ │Tab      │ │  (tab)       │ │Dashboard     │
└──────┬───────┘ └─────┬─────┘ └────┬───┘ └──────────────┘ └──────────────┘
       │               │             │
       └───────┬───────┴─────────────┘
               ▼
      ┌─────────────────────┐
      │ Referral Detail /    │  ← reached from any card, any list
      │ Audit Log (shared)    │
      └─────────────────────┘
```

- **Bottom nav (staff app):** Dashboard · Critical Find (center, prominent FAB-style) · Capacity · Alerts
- **Receiving Tab** is not a separate nav item — it surfaces as a full-screen takeover triggered by a push notification, and also lives inside the Dashboard's "Receiving" section for anytime access.
- **Control Room Dashboard** is a separate web-only surface (desktop), not part of the mobile staff app.

---

## 3. Flow 1 — Referring Staff: Create & Track a Referral

This is the highest-frequency, highest-stakes flow. Every step is designed to remove taps, not add confirmation.

```
[Dashboard] 
    │ tap Critical Find FAB
    ▼
[Critical Find — Requirement Input]
    │ type/select requirement (autocomplete, controlled taxonomy)
    │ (optional) set priority: Critical / Urgent / Stable
    ▼
[Critical Find — Map Results]  ← auto-navigates on Enter, no "Search" tap needed
    │ color-coded pins render as results stream in
    │ tap a green or yellow hospital pin
    ▼
[Confirm Sheet — bottom sheet, NOT a modal blocking the map]
    │ "Refer to Hospital B — 8km, ICU available"
    │ [ Send Referral ]  ← single tap, no second confirmation screen
    ▼
[Referral Created — auto-redirect]
    │ soft-hold placed (invisible), notification fires to Hospital B
    ▼
[Referral Detail / Live Tracking view]
    │ status badge updates live: Notified → Dispatched → In Transit → Arrived → Closed
    │ if reroute fires: banner appears inline — "Redirected to Hospital C" — 
    │   no popup/interrupt, stays on same screen
    ▼
[Closed] → auto-returns to Dashboard, referral moves to history log
```

**Key UX decisions:**
- **No "are you sure?" dialog on Send Referral.** The PRD/architecture explicitly removed accept/reject on the receiving side; the sending side shouldn't reintroduce friction the design just eliminated.
- **Bottom sheet, not full-screen modal**, for the confirm step — keeps the map/context visible, reduces the feeling of a "form."
- **Reroute is a non-blocking banner**, not an alert dialog — staff should see it without their current task being interrupted, since they're often mid-conversation with the ambulance crew or the patient's family when it happens.

---

## 4. Flow 2 — Receiving Staff: Incoming Referral

```
[Push notification] "🚨 Incoming Referral — CT required — ETA 9 min"
    │ tap notification (or tap Receiving card on Dashboard)
    ▼
[Receiving Tab — Step 1: Notification Card]
    │ shown even before full detail loads — patient requirement, ETA, distance
    ▼
[Receiving Tab — Step 2: Full Detail]  ← opens directly, no confirm gate
    │ Patient details (decrypted) · Vitals · Diagnosis · Treatment given
    │ Live map with ambulance ETA
    ▼
    ├── Path A: Hospital genuinely can take the patient
    │       → staff simply prepares (no action required in-app)
    │       → status auto-progresses as ambulance moves (Dispatched → In Transit → Arrived)
    │
    └── Path B: Hospital actually cannot take the patient (stale data)
            │ staff navigates to Capacity Panel
            │ decrements the resource to 0
            ▼
        [capacity_changed event fires] → triggers reroute (Flow 3)
        → Receiving Tab for THIS hospital shows "Referral reassigned to Hospital C"
          and quietly closes out of their active list
```

**Key UX decision:** there is deliberately **no button on this screen that says "Reject" or "Decline."** The only lever a receiving hospital has is the same one every hospital uses for every other reason — the capacity counter on Screen 4. This keeps the interaction model consistent instead of giving receiving staff a special "opt-out" affordance that would undermine the notify-don't-gate design.

---

## 5. Flow 3 — Auto-Reroute (System-Driven, User-Observed)

This flow has no single "screen" — it's how three different screens behave in sync when capacity is lost. UX treatment across each surface matters more than any one screen here.

```
Trigger: capacity_changed(HospitalB, ICU, 0) while a referral targets Hospital B
    │
    ├─→ [Referring Staff's Referral Detail]
    │       inline banner, non-blocking: "Rerouting… finding next option"
    │       → updates to "Redirected to Hospital C" within seconds, no re-navigation needed
    │
    ├─→ [Ambulance Dispatcher's Live Tracking view]
    │       destination pin animates/moves on the map (not a jump-cut) — 
    │       driver-facing view gets a push notification with new address, 
    │       since they may not have the app open on the dash mount
    │
    ├─→ [Hospital B's Receiving Tab]
    │       card fades from their active list with "Reassigned — stand down" label
    │       (kept visible in history, not silently deleted — audit trail matters)
    │
    └─→ [Hospital C's Receiving Tab]
            new incoming notification fires exactly as in Flow 4, no distinction
            from a "normal" first-time referral
```

**Escalation sub-flow (no candidate found):**
```
Reroute attempt fails (2nd consecutive failure)
    ↓
[Referring Staff's Referral Detail] banner changes tone: 
   "No hospital available — escalated to Control Room" (amber/red, not silent)
    ↓
[Control Room Dashboard] new alert card appears in a dedicated 
   "Needs Manual Intervention" section — cannot be missed in normal monitoring view
```

---

## 6. Flow 4 — Capacity Panel: The Screen Everything Depends On

Since this screen's UX directly determines system-wide data trust, it gets the most deliberate friction-removal of anything in the product.

```
[Capacity Panel]
┌─────────────────────────────────────────────┐
│  ICU Beds        [ – ]   3 / 15   [ + ]      │
│  Ventilators     [ – ]   1 / 6    [ + ]      │
│  CT Scan         [ – ]   1 / 1    [ + ]      │
│  General Beds    [ – ]   22 / 40  [ + ]      │
│                                               │
│  Last updated: 2 min ago                     │
└─────────────────────────────────────────────┘
```

- **Every tap on `+`/`–` fires immediately** — no "Save" button. Saving is the anti-pattern here; the whole point is the system reflects reality within a second of the physical bed changing state.
- **Optimistic UI update:** the counter visibly changes the instant it's tapped, before the network round-trip confirms — bed-admin staff are tapping this between other tasks and need immediate visual feedback, not a spinner.
- **Staleness nudge** (not a blocking alert): a soft amber highlight + small badge appears on a resource row once its configured freshness window expires — e.g., "ICU — 22 min since update." Tapping the row is enough to dismiss it (implicitly confirms the number is still accurate) without forcing a re-entry of the same number.
- **Zeroing a resource that has active holds:** if a `–` tap would bring a resource to 0 while referrals are `SOFT-HELD`/`RESERVED` against it, no dialog blocks the tap — it fires reroute (Flow 3) immediately after. Speed here matters more than warning the staff member about a consequence they already intended (they just found out the bed is actually gone).

---

## 7. Flow 5 — Ambulance Dispatch & Live Tracking

```
[Referral Detail — after Send Referral]
    │ tap "Assign Ambulance"
    ▼
[Ambulance Picker — bottom sheet]
    │ filtered list: only ambulances matching required type (BLS/ALS/Ventilator-equipped)
    │ shows idle ambulances sorted by proximity to origin hospital
    ▼
[Assigned] → referral status moves to Dispatched
    ▼
[Live Tracking View]
    │ map with ambulance marker moving in real time (GPS ping every ~10s)
    │ ETA recalculates on traffic changes, not just distance
    │ if reroute fires mid-transit: destination pin moves, route redraws,
    │   ETA recalculates from CURRENT ambulance position (not origin hospital)
    ▼
[Arrived] → geofence trigger or manual "Mark Arrived" fallback button
    ▼
[Handover Complete] → receiving doctor taps this after physical handoff
    → referral status: Closed, moves to both hospitals' history
```

**Fallback affordance:** GPS/geofence auto-detection is the primary path, but a manual "Mark Arrived" button always remains visible and tappable — connectivity in transit can't be assumed reliable, and the flow must never leave a referral stuck in `In Transit` with no way to close it out.

---

## 8. Flow 6 — SMS Fallback (No App/No Connectivity)

```
Staff sends SMS: "CT 500 URGENT"
    ↓
Auto-reply within seconds:
"CT: HospB(8km)-Avail HospD(15km)-Avail. Open app to refer, or call."
    ↓
Staff either:
  (a) opens app once connectivity returns → Critical Find pre-fills last SMS query
  (b) calls the hospital directly (fallback to the original manual process — 
      by design, this channel never pretends to complete the loop it can't complete)
```

**UX note:** this flow explicitly does **not** try to replicate full in-app tracking over SMS — the auto-reply is deliberately informational-only, matching the architecture's "notify, don't gate" philosophy applied honestly to a channel that can't support live state.

---

## 9. Screen States (applies across all screens)

Every screen in this product needs four defined states — listed once here rather than repeated per screen:

| State | Design treatment |
|---|---|
| **Loading** | Skeleton cards matching final layout shape (not a generic spinner) — Critical Find results should skeleton-load as pins, not blank-map-then-pop-in |
| **Empty** | Dashboard with zero active referrals shows a calm "No active referrals" state, not an error-styled empty state — this is the *normal* good case, should feel neutral/positive |
| **Error (network)** | Inline retry affordance on the specific failed element (e.g., one capacity row failed to sync) — never a full-screen error blocking the rest of a working app |
| **Stale/degraded** | Amber, not red — reserved for "needs attention soon," while red is reserved for active emergencies/escalations. Color vocabulary must stay consistent system-wide or staff will start ignoring it under stress |

---

## 10. Color & Status Vocabulary (system-wide consistency)

Because this app is used under time pressure, color meaning must never be overloaded or screen-dependent:

| Color | Meaning | Used for |
|---|---|---|
| 🟢 Green | Available / healthy / on-track | Capacity available, referral progressing normally |
| 🟡 Amber | Needs attention, not urgent-critical | Stale data nudge, limited/queued capacity |
| 🔴 Red | Unavailable / escalation / blocked | Zero capacity, escalated-to-control-room alerts |
| 🔵 Blue | Informational / in-progress system action | "Rerouting…" banner, active ambulance tracking |

No other colors carry status meaning anywhere in the product — this is a hard constraint for whoever builds the design system, not a style suggestion.

---

## 11. Control Room Dashboard (Screen 5 — Web, District/State Authority)

Not part of the mobile staff flows above, but included since it's a distinct persona's entire experience:

```
┌───────────────────────────────────────────────────────────┐
│  District Overview                                          │
│  Active Referrals: 14   Rerouted (today): 3   Escalated: 1  │
│                                                               │
│  🔴 NEEDS MANUAL INTERVENTION                                 │
│  └── Referral #1042 — no candidate found, ICU+Ventilator      │
│                                                               │
│  📊 Pattern Insight                                            │
│  "42% of District X referrals fail due to ICU shortage"      │
│                                                               │
│  [ Map view: all hospitals, live capacity heat overlay ]     │
└───────────────────────────────────────────────────────────┘
```

- Passive-monitoring-first layout: escalations surface at the top unprompted, everything else is pull-to-inspect (map, per-hospital drill-down, historical trends) rather than pushed at the viewer.
- This is the one surface in the product where information density is appropriate — the persona using it is not mid-emergency, they're doing oversight.

---

## 12. Accessibility & Field-Use Considerations

- **Large tap targets on Capacity Panel `+`/`–`** — this screen gets used one-handed, often while a staff member is also holding a phone/chart in the other hand.
- **High contrast mode as default, not opt-in** — hospital corridors and ambulance interiors are inconsistently lit.
- **No reliance on color alone for status** — every colored badge also carries a text label (`Available`, `Rerouting…`, `Escalated`) so the system doesn't fail for colorblind users or in bad lighting.
- **Offline-tolerant UI on Live Tracking** — if GPS ping fails, show "Last known location, Xm ago" rather than a frozen or blank map, so dispatchers aren't misled into thinking tracking has silently stopped.

---

## 13. Flow-to-Screen-to-Service Traceability

For build handoff — ties every flow above back to the architecture doc's service map:

| Flow | Screens touched | Backend services (from architecture.md §12) |
|---|---|---|
| Create & Track Referral | Critical Find → Referral Detail | Matching Engine, Referral Service, Capacity Service |
| Incoming Referral | Receiving Tab | Notification Service, Referral Service, ClinicalPacket grant |
| Auto-Reroute | Referral Detail, Live Tracking, Receiving Tab (both hospitals) | Matching Engine, Event Bus, Tracking Service, Notification Service |
| Capacity Update | Capacity Panel | Capacity Service (write) → Event Bus |
| Ambulance Dispatch & Tracking | Referral Detail, Live Tracking | Tracking Service, Referral Service |
| SMS Fallback | (external channel) | Matching Engine (read-only query), SMS Gateway |
| Control Room | Control Room Dashboard | Referral Service (aggregate read), Analytics/Event Bus |
