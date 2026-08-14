# ERON (Emergency Referral & Operations Network) — Complete Project Reference

> **VitalityHub ERON Network Core System**  
> *A real-time, zero-delay inter-hospital emergency referral, capacity matching, live ambulance tracking, and encrypted clinical handoff platform.*

---

## 📋 Executive Summary

**ERON (Emergency Referral & Operations Network)** is a state-of-the-art medical transfer platform designed to eliminate fatal delays during emergency inter-hospital patient transfers. By integrating real-time hospital resource capacity tracking, automated shortest-distance matching, live Leaflet-powered ambulance tracking, end-to-end encrypted PHI (Protected Health Information) handoffs, and WebSocket corridor alerts, ERON ensures critical emergency patients receive time-sensitive care without friction.

---

## 🎯 Core Features & User Workflows

### 1. Receiving Tab (Primary Emergency Desk View)
- **First Tab Priority & Notification Badge**: Set as the default view upon login. Displays a pulsing red notification dot in the main navigation header whenever active incoming referral requests exist.
- **Incoming Request Cards**:
  - Front of card displays strictly essential information: Patient Name, Suspected Diagnosis / Problem, Transferring Hospital Badge, Required Equipment Checklist, `Accept Patient` button, and `View Detail` button.
  - **Stateful Acceptance**: Clicking **Accept Patient** converts the card status to `ACCEPTED` and transforms the action button into **`Track Transfer →`**.
- **Dedicated Accepted Transfer Tracking Screen**:
  - Clicking **`Track Transfer →`** opens a full-screen side-by-side tracking interface:
    - **Left Column**: Interactive Leaflet OpenStreetMap live-tracking map showing the ambulance position moving along the route from the transferring hospital to the receiving hospital. Includes emergency radio frequency broadcast modal.
    - **Right Column**:
      - **Estimated Time of Arrival (ETA)** box (e.g. `14:48 PM`, `Arriving in 7 mins`, `CORRIDOR ACTIVE`).
      - **Required & Reserved Equipment Checklist** (e.g., ICU Bed, Ventilator, Emergency CT, Neurosurgeon) marked as `✓ RESERVED & READY`.
      - **Patient Overview Card**: Quick diagnostic summary and vitals.
      - **View Patient Report Modal**: Opens a `z-[9999]` elevated modal with full vitals (`BP`, `HR`, `SpO2`, `RR`, `Temp`, `GCS/15`), referring doctor info, treatment given, and clinical notes.
      - **Direct In-Browser PDF Download**: Triggers a clean, direct print/download window using an in-memory frame without opening blank tabs.

---

### 2. Transfer Tab (Request Creation & Shortest-Distance Matching)
- **Patient Transfer Entry Creation**:
  - Header feature button **`+ Create Patient Entry`** opens a modal to record Patient Name, Age, Sex, Suspected Diagnosis, Transfer Priority (`CRITICAL`, `URGENT`, `STANDARD`), and required equipment.
  - Submitting auto-populates search filters and ranks destination hospitals instantly.
- **Prominent Multi-Select Search Bar**:
  - High z-index (`z-[9999]`) floating search bar with auto-suggestions dropdown.
  - Multi-select tag system (`[ICU]`, `[Ventilator]`, `[Neurosurgeon]`, `[CT Scan]`) with quick resource chips for instant filtering.
- **Side-by-Side Map & Cards Layout**:
  - **Left Column (7 cols)**: OpenStreetMap Leaflet container (`h-[520px]`) displaying Google-style custom hospital markers, real GPS device location detection (`📍 Detect My GPS`), fit-all bounds, and scroll zoom toggles.
  - **Right Column (5 cols)**: Displays **Top 3 Shortest Distance Hospitals** matching the query:
    - Auto-sorted strictly by distance ascending (`#1 NEAREST`, `#2 NEAREST`, `#3 NEAREST`).
    - Displays distance in km, driving ETA in minutes, direct phone, and available equipment counts.
    - **`Send Transfer Alert` Button**: Dispatches an immediate emergency transfer alert to the receiving desk via real-time WebSocket communication and displays toast confirmation.

---

### 3. Network Capacity Panel
- Real-time grid of inter-hospital bed and specialist capacity across all connected facilities.
- Allows duty nurses and administrators to adjust ICU, ventilator, and specialty counts with immediate WebSocket broadcast updates (`CAPACITY_UPDATED`).

---

### 4. Messaging & Communication Center (Encrypted Handoff)
- Multi-perspective role switcher for testing (`Duty Nurse Anjali Verma`, `Target Hospital Desk`, `Ambulance Paramedic`).
- Real-time inter-hospital chat threads with typing indicators and unread counters.
- **RBAC Encrypted Packet Integration**: Decrypts secure patient payloads (`pkt-1`) using AES-256-GCM encryption with strict Role-Based Access Control authorization.

---

### 5. Control Room Analytics & Telemetry
- Inter-hospital transfer volume charts, average transfer acceptance response times, bottleneck identification, and corridor activity monitoring.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite 5 |
| **Styling & UI** | Vanilla CSS, TailwindCSS, Google Fonts (`Outfit`, `Plus Jakarta Sans`) |
| **Icons & Visuals** | Lucide React Icons |
| **Maps & Tracking** | Leaflet 1.9, React-Leaflet, OpenStreetMap Tile API, Overpass API (Real GPS Node Query) |
| **Backend Runtime** | Node.js, Express.js |
| **Real-time Engine** | WebSockets (`ws` library) |
| **Security & Crypto** | AES-256-GCM RBAC Payload Encryption, Sentry Error Tracking (`@sentry/node`, `@sentry/react`) |
| **E2E Automation** | PowerShell E2E Script (`test-e2e.ps1`) |

---

## 📁 Repository Structure & Key Files

```
ih/
├── index.html                  # HTML entry point (Outfit & Plus Jakarta Sans typography)
├── package.json                # Project dependencies & npm scripts
├── tailwind.config.js          # Tailwind CSS theme configuration & fonts
├── vite.config.js              # Vite dev server configuration (proxying /api & /ws to 3001)
├── test-e2e.ps1                # PowerShell automated End-to-End integration test script
│
├── server/
│   └── index.js                # Express API server & WebSocket real-time broadcast engine (Port 3001)
│
├── src/
│   ├── main.jsx                # Application React root entry
│   ├── App.jsx                 # Main layout shell, active tab router, role switcher & toast banners
│   ├── index.css               # Global styles, Leaflet z-index overrides, custom scrollbars
│   │
│   ├── components/
│   │   ├── Header.jsx          # Top navbar, receiving tab badge dot, tab switches & logout
│   │   ├── ReceivingTab.jsx    # Primary Receiving view, referral cards, live tracking & direct PDF export
│   │   ├── TransferTab.jsx     # Patient entry creation, search bar, map & Top 3 Shortest Distance cards
│   │   ├── CapacityPanel.jsx   # Real-time resource capacity management grid
│   │   ├── ControlRoomAnalytics.jsx # Operational metrics & transfer flow telemetry
│   │   ├── MessagingCenter.jsx # Real-time chat & encrypted packet decryption modal
│   │   ├── FlowTester.jsx      # E2E referral workflow step-by-step simulator
│   │   ├── RoleSwitcher.jsx    # Perspective switching bar for multi-hospital testing
│   │   ├── AuthPage.jsx        # User login & hospital authentication interface
│   │   └── SMSModal.jsx        # Green corridor SMS alert notification overlay
│   │
│   ├── context/
│   │   └── WebSocketContext.jsx # Global WebSocket provider & state synchronization
│   │
│   └── utils/
│       └── apiClient.js        # Central API fetch wrapper with JWT header injection
```

---

## ⚙️ Development & Testing Guide

### 1. Starting Local Development Servers
To run the full stack locally:

```powershell
# Terminal 1: Backend Server (API & WebSockets)
npm run server

# Terminal 2: Frontend Vite Dev Server
npm run dev
```

- **Frontend Access**: `http://localhost:5173`
- **Backend API & WS**: `http://localhost:3001`

---

### 2. Building for Production
To validate production build compilation:

```powershell
npm run build
```

---

### 3. Automated End-to-End System Testing
Run the comprehensive E2E test suite:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-e2e.ps1
```

The script verifies:
1. Origin & Target Hospital JWT Authentication.
2. Inter-hospital shortest-distance resource matching.
3. Referral creation, acceptance, and ambulance assignment.
4. RBAC encrypted packet payload authorization.
5. Mid-transit hospital capacity rerouting triggers.

---

## 🔒 Security & Data Compliance
- **PHI Encryption**: Patient clinical details are encrypted using AES-256-GCM before transport.
- **Role-Based Access Control (RBAC)**: Only authorized hospital credentials with matching JWT signatures can decrypt sensitive patient records.
- **Direct PDF Export**: Clinical reports are formatted and rendered directly in-memory, avoiding temporary cloud storage or unencrypted third-party print servers.

---

*Document updated on August 14, 2026. Certified by ERON Engineering Team.*
