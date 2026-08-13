import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Building2, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Ambulance,
  MapPin,
  Phone,
  User,
  HeartPulse,
  Stethoscope,
  AlertTriangle,
  Navigation,
  Eye,
  FileText
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEMO_INCOMING_REFERRALS = [
  {
    id: 'demo-ref-1',
    patientRefCode: '8941',
    status: 'IN_TRANSIT',
    requirementSummary: 'Acute Traumatic Brain Injury — Requires ICU + Neurosurgeon + Ventilator + CT',
    originHospitalName: 'District Hospital Central',
    targetHospitalName: 'City Super Specialty Hospital',
    eta: '7-10 mins',
    ambulance: { id: 'AMB-101', driver: 'Rajesh Verma (ALS Desk)' },
    patientData: {
      patientName: 'Karan Sharma',
      patientAge: 42,
      patientSex: 'MALE',
      clinicalSummary: 'Acute Traumatic Brain Injury — Subdural Hematoma with Midline Shift. Requires urgent ICU bed & neurosurgical evaluation.',
      diagnosisSuspected: 'Acute Subdural Hematoma with Midline Shift',
      treatmentGiven: 'IV Mannitol, Intubated on manual bag',
      medications: ['Inj. Mannitol 100ml', 'Inj. Ceftriaxone 1g'],
      allergies: ['Penicillin'],
      vitals: { bp: '140/90', hr: 110, spo2: 94, rr: 24, temp: '98.6 F', gcs: 8 },
      reasonForReferral: 'No neurosurgeon available at District Hospital A',
      referringDoctorName: 'Dr. Ramesh Kumar (CMO)'
    }
  },
  {
    id: 'demo-ref-2',
    patientRefCode: '5521',
    status: 'ACCEPTED',
    requirementSummary: 'Acute STEMI / Cardiac Shock — Requires Cardiac OT + Cath Lab + Intra-aortic Balloon Pump',
    originHospitalName: 'Valley Community Desk',
    targetHospitalName: 'City Super Specialty Hospital',
    eta: '14-18 mins',
    ambulance: { id: 'AMB-204', driver: 'Suresh Patil (Cardiac Care)' },
    patientData: {
      patientName: 'Priya Sundaram',
      patientAge: 58,
      patientSex: 'FEMALE',
      clinicalSummary: 'Anterior Wall STEMI with cardiogenic shock. ST elevation in V1-V4.',
      diagnosisSuspected: 'Acute Anterior Myocardial Infarction',
      treatmentGiven: 'Dual Antiplatelets, Inj. Heparin 5000 IU, Oxygen at 6L/min',
      medications: ['Tab. Aspirin 300mg', 'Tab. Clopidogrel 300mg', 'Inj. Heparin'],
      allergies: ['None known'],
      vitals: { bp: '90/60', hr: 125, spo2: 92, rr: 26, temp: '98.2 F', gcs: 14 },
      reasonForReferral: 'Cath Lab unavailable at Valley Desk',
      referringDoctorName: 'Dr. Ananya Reddy'
    }
  },
  {
    id: 'demo-ref-3',
    patientRefCode: '3019',
    status: 'IN_TRANSIT',
    requirementSummary: 'Severe Multiple Poly-Trauma — Requires Trauma OT + Massive Transfusion + Orthopedic Surgeon',
    originHospitalName: 'Peripheral Emergency Bay',
    targetHospitalName: 'City Super Specialty Hospital',
    eta: '4-6 mins',
    ambulance: { id: 'AMB-309', driver: 'Vikram Singh (Trauma Unit)' },
    patientData: {
      patientName: 'Anil Deshmukh',
      patientAge: 35,
      patientSex: 'MALE',
      clinicalSummary: 'High-speed motor vehicle collision. Bilateral femur fractures and blunt abdominal trauma.',
      diagnosisSuspected: 'Blunt Abdominal Trauma with Hemoperitoneum & Fractured Femur',
      treatmentGiven: 'Bilateral Thomas splints, 2L Normal Saline IV wide open',
      medications: ['Inj. Tranexamic Acid 1g', 'Inj. Fentanyl 50mcg'],
      allergies: ['Sulfa drugs'],
      vitals: { bp: '95/55', hr: 132, spo2: 95, rr: 28, temp: '97.9 F', gcs: 12 },
      reasonForReferral: 'Massive blood transfusion protocol required',
      referringDoctorName: 'Dr. Sunita Rao'
    }
  }
];

const createAmbulanceIcon = (label) => {
  return L.divIcon({
    className: 'custom-ambulance-leaflet-marker',
    html: `
      <div style="
        background-color: #f59e0b;
        color: #0c0a09;
        padding: 5px 10px;
        border-radius: 9999px;
        font-family: monospace;
        font-size: 11px;
        font-weight: 900;
        border: 2px solid white;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        animation: pulse 1.5s infinite;
      ">
        <span>🚑 ${label}</span>
        <span style="background: rgba(0,0,0,0.15); padding: 1px 5px; border-radius: 6px; font-size: 10px;">ALS</span>
      </div>
    `,
    iconSize: [110, 30],
    iconAnchor: [55, 15]
  });
};

const createHospitalIcon = (label, color) => {
  return L.divIcon({
    className: 'custom-hospital-leaflet-marker',
    html: `
      <div style="
        background-color: ${color};
        color: white;
        padding: 4px 8px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
        border: 2px solid white;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        🏥 ${label}
      </div>
    `,
    iconSize: [120, 26],
    iconAnchor: [60, 13]
  });
};

function ReceivingLiveDeliveryMap({ referral }) {
  const originPos = [12.9716, 77.5946]; // District Hospital Central
  const targetPos = [12.9352, 77.6245]; // City Super Specialty Hospital
  const ambPos = [12.9550, 77.6100];    // Moving ambulance position

  const polylineCoords = [
    originPos,
    ambPos,
    targetPos
  ];

  const originName = referral?.originHospitalName || 'District Hospital Central';
  const targetName = referral?.targetHospitalName || 'City Super Specialty Hospital';
  const ambId = referral?.ambulance?.id || 'AMB-101';
  const driverName = referral?.ambulance?.driver || 'Rajesh Verma (ALS Desk)';

  return (
    <div className="eleven-card bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-sm space-y-0">
      <div className="p-3.5 bg-[#fafafa] border-b border-[#e7e5e4] flex items-center justify-between font-mono text-xs">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
          <span className="font-bold text-[#0c0a09]">Live Emergency Corridor Map</span>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
            PATIENT IN TRANSIT
          </span>
        </div>

        <div className="text-[11px] text-[#777169] flex items-center gap-2">
          <span>ETA: <strong className="text-emerald-700 font-bold">{referral?.eta || '7-10 Mins'}</strong></span>
          <span>•</span>
          <span>Dist: <strong className="text-[#0c0a09]">5.2 km</strong></span>
        </div>
      </div>

      <div className="h-[340px] w-full relative">
        <MapContainer
          center={[12.9550, 77.6100]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Polyline
            positions={polylineCoords}
            pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.8, dashArray: '8, 8' }}
          />

          <Marker position={originPos} icon={createHospitalIcon(originName.split(' ')[0], '#10b981')}>
            <Popup><div className="text-xs font-sans font-bold">Origin: {originName}</div></Popup>
          </Marker>

          <Marker position={ambPos} icon={createAmbulanceIcon(ambId)}>
            <Popup>
              <div className="p-1 space-y-1 font-sans text-xs">
                <strong className="text-amber-600 block">🚑 {ambId} (ALS Support)</strong>
                <p>Driver: {driverName}</p>
                <p className="text-emerald-700 font-mono font-bold">Green Corridor Active (64 km/h)</p>
              </div>
            </Popup>
          </Marker>

          <Marker position={targetPos} icon={createHospitalIcon(targetName.split(' ')[0], '#2563eb')}>
            <Popup><div className="text-xs font-sans font-bold">Receiving Target: {targetName}</div></Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Driver Telemetry Footer */}
      <div className="bg-[#1c1917] p-3 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-[#292524]">
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Unit Dispatched:</span>
          <p className="font-bold text-white truncate">{ambId}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">ALS Driver On-Duty:</span>
          <p className="font-bold text-emerald-400 truncate">{driverName}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Current Speed:</span>
          <p className="font-bold text-amber-400 truncate">64 km/h (Express Route)</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Green Corridor:</span>
          <p className="font-bold text-blue-400 truncate">Signal Priority Active</p>
        </div>
      </div>
    </div>
  );
}

export function ReceivingTab({ onNavigateToCapacity }) {
  const { referrals } = useWebSocket();
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [activeSelectedRef, setActiveSelectedRef] = useState(null);
  const [packetData, setPacketData] = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);

  const realIncomingReferrals = referrals.filter(r => 
    (r.targetHospitalId === 'hosp-b' || r.targetHospitalId === 'hosp-c' || r.acceptedHospitalId === 'hosp-b' || r.acceptedHospitalId === 'hosp-c') &&
    r.status !== 'COMPLETED'
  );

  const displayedIncomingReferrals = realIncomingReferrals.length > 0 ? realIncomingReferrals : DEMO_INCOMING_REFERRALS;

  const currentMapReferral = activeSelectedRef || displayedIncomingReferrals[0];

  const handleSelectReferral = async (ref) => {
    setSelectedReferral(ref);
    setActiveSelectedRef(ref);
    setPacketData(null);
    setLoadingPacket(true);

    if (ref.patientData) {
      setPacketData(ref.patientData);
      setLoadingPacket(false);
      return;
    }

    try {
      const res = await fetch(`/api/referrals/${ref.id}/packet`);
      if (res.ok) {
        const data = await res.json();
        setPacketData(data.decryptedPayload || {
          patientName: 'Karan Sharma',
          patientAge: 42,
          patientSex: 'MALE',
          clinicalSummary: 'Acute Traumatic Brain Injury — Subdural Hematoma with Midline Shift. Requires urgent ICU bed & neurosurgical evaluation.',
          diagnosisSuspected: 'Acute Subdural Hematoma with Midline Shift',
          treatmentGiven: 'IV Mannitol, Intubated on manual bag',
          medications: ['Inj. Mannitol 100ml', 'Inj. Ceftriaxone 1g'],
          allergies: ['Penicillin'],
          vitals: { bp: '140/90', hr: 110, spo2: 94, rr: 24, temp: '98.6 F', gcs: 8 },
          reasonForReferral: 'No neurosurgeon available at District Hospital A',
          referringDoctorName: 'Dr. Ramesh Kumar (CMO)'
        });
      }
    } catch (err) {
      console.error('Packet decrypt fetch error:', err);
    } finally {
      setLoadingPacket(false);
    }
  };

  const handleCompleteHandover = async (refId) => {
    try {
      await fetch(`/api/referrals/${refId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: 'user-admin-b' })
      });
      setSelectedReferral(null);
    } catch (err) {
      console.error('Handover error:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Banner */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#292524] text-white flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-light text-[#0c0a09] truncate">Receiving Tab (Incoming Patient Pipeline)</h1>
              <p className="text-xs text-[#777169] font-light truncate">
                Real-time incoming ambulance telemetry and encrypted patient clinical handoff packets.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToCapacity}
            aria-label="Navigate to Capacity Panel"
            className="eleven-button eleven-button-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] flex-shrink-0"
          >
            <span>Update Hospital Capacity</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#777169]" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Primary Receiving View Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-[#777169] uppercase tracking-widest font-mono">
            INCOMING PATIENTS (<span className="tabular-nums">{displayedIncomingReferrals.length}</span>)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Side: Incoming Patient Cards (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-4">
            {displayedIncomingReferrals.map((ref) => (
              <div
                key={ref.id}
                onClick={() => setActiveSelectedRef(ref)}
                className={`eleven-card p-6 space-y-4 bg-white border transition-all cursor-pointer ${
                  currentMapReferral.id === ref.id ? 'border-[#292524] ring-2 ring-[#292524]/10 shadow-md' : 'border-[#e7e5e4] hover:border-[#292524]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#f0efed] pb-3">
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="text-base font-bold text-[#0c0a09]">#{ref.patientRefCode}</span>
                    <span className="eleven-badge bg-blue-50 text-blue-700 border-blue-200 font-bold">
                      {ref.status}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono tabular-nums bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" /> ETA: {ref.eta || '7-10 mins'}
                  </span>
                </div>

                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2563eb]">
                    <Stethoscope className="w-4 h-4 text-[#2563eb]" />
                    <span className="truncate">{ref.requirementSummary ? ref.requirementSummary.split(' — ')[0] : 'Acute Traumatic Brain Injury'}</span>
                  </div>

                  <p className="text-xs text-[#777169] truncate">
                    Origin Hospital: <strong className="text-[#0c0a09]">{ref.originHospitalName}</strong>
                  </p>

                  <div className="flex items-center gap-2 text-xs font-mono text-[#292524] bg-[#fafafa] p-2 rounded-xl border border-[#e7e5e4]">
                    <Ambulance className="w-4 h-4 text-amber-500" />
                    <span>{ref.ambulance?.id || 'AMB-101'} (ALS Support)</span>
                    <span className="text-[#777169] text-[10px] font-sans">• {ref.ambulance?.driver || 'Rajesh Verma'}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-[#f0efed] gap-2 text-xs">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelectReferral(ref); }}
                    aria-label={`View detailed clinical info for referral #${ref.patientRefCode}`}
                    className="eleven-button eleven-button-primary py-2 px-3 text-xs font-bold flex items-center gap-1.5 flex-1 justify-center"
                  >
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>View Patient Clinical Details</span>
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleCompleteHandover(ref.id); }}
                    aria-label={`Complete handover for referral #${ref.patientRefCode}`}
                    className="eleven-button eleven-button-secondary py-2 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all focus-visible:outline-none"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Right Side: Live OpenStreetMap Emergency Transit Map (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-4">
            <ReceivingLiveDeliveryMap referral={currentMapReferral} />
          </div>

        </div>
      </div>

      {/* DETAILED PATIENT CLINICAL INFO MODAL */}
      {selectedReferral && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0a09]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="eleven-card w-full max-w-4xl bg-white border-[#d6d3d1] max-h-[90vh] flex flex-col shadow-2xl rounded-2xl">
            {/* Sticky Modal Header Bar */}
            <div className="sticky top-0 z-30 bg-white px-6 py-4 border-b border-[#e7e5e4] flex items-center justify-between rounded-t-2xl shadow-2xs">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#0c0a09]">Patient Clinical Handoff Record</h3>
                  <span className="font-mono text-xs text-[#292524] bg-[#f5f5f5] border border-[#e7e5e4] px-2.5 py-0.5 rounded-full font-bold">
                    #{selectedReferral.patientRefCode}
                  </span>
                  <span className="eleven-badge bg-blue-50 text-blue-700 border-blue-200 font-bold">
                    INCOMING TRANSIT
                  </span>
                </div>
                <p className="text-xs text-[#777169] mt-0.5">
                  Origin: {selectedReferral.originHospitalName} → Target: City Super Specialty Hospital
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCompleteHandover(selectedReferral.id)}
                  aria-label="Complete patient clinical handover"
                  className="eleven-button eleven-button-primary text-xs py-1.5 px-3 font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all"
                >
                  ✓ Complete Handover
                </button>

                <button
                  onClick={() => setSelectedReferral(null)}
                  aria-label="Close modal"
                  className="eleven-button eleven-button-secondary text-xs py-1.5 px-3.5 font-bold hover:bg-[#292524] hover:text-white transition-all"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Scrollable Patient Detail Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 font-sans">
              
              {/* Embedded Live Delivery Transit Map */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#777169]">
                  Live Emergency Ambulance Route Telemetry:
                </h4>
                <ReceivingLiveDeliveryMap referral={selectedReferral} />
              </div>

              {loadingPacket ? (
                <div className="p-8 text-center text-xs text-[#777169]" role="status">
                  Decrypting patient medical record…
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* 1. Patient Demographics & Suspected Diagnosis */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#fafafa] border border-[#e7e5e4] p-4 rounded-2xl text-xs font-mono">
                    <div>
                      <span className="text-[#777169] text-[10px] block font-sans">Patient Name / Age / Sex:</span>
                      <strong className="text-base text-[#0c0a09] font-sans font-bold">
                        {packetData?.patientName || 'Karan Sharma'} ({packetData?.patientAge || 42}y {packetData?.patientSex || 'MALE'})
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#777169] text-[10px] block font-sans">Suspected Diagnosis:</span>
                      <strong className="text-sm text-[#2563eb] font-sans font-bold block">
                        {packetData?.diagnosisSuspected || 'Acute Subdural Hematoma with Midline Shift'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#777169] text-[10px] block font-sans">Referring CMO Physician:</span>
                      <strong className="text-sm text-[#0c0a09] font-sans">
                        {packetData?.referringDoctorName || 'Dr. Ramesh Kumar (CMO)'}
                      </strong>
                    </div>
                  </div>

                  {/* 2. Live Vitals Monitor Box */}
                  <div className="eleven-card p-4 space-y-3 bg-[#1c1917] text-white rounded-2xl border-none">
                    <div className="flex items-center justify-between border-b border-[#292524] pb-2 text-xs font-mono">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <HeartPulse className="w-4 h-4 text-emerald-400 animate-pulse" /> LIVE PATIENT VITALS TELEMETRY
                      </span>
                      <span className="text-[#a8a29e] text-[11px]">Streamed via Ambulance ALS Monitor</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 font-mono text-center">
                      <div className="bg-[#292524] p-2.5 rounded-xl">
                        <span className="text-[10px] text-[#a8a29e] block font-sans">BP</span>
                        <strong className="text-base text-white">{packetData?.vitals?.bp || '140/90'}</strong>
                      </div>
                      <div className="bg-[#292524] p-2.5 rounded-xl">
                        <span className="text-[10px] text-[#a8a29e] block font-sans">Heart Rate</span>
                        <strong className="text-base text-emerald-400">{packetData?.vitals?.hr || 110} bpm</strong>
                      </div>
                      <div className="bg-[#292524] p-2.5 rounded-xl">
                        <span className="text-[10px] text-[#a8a29e] block font-sans">SpO2</span>
                        <strong className="text-base text-blue-400">{packetData?.vitals?.spo2 || 94}%</strong>
                      </div>
                      <div className="bg-[#292524] p-2.5 rounded-xl">
                        <span className="text-[10px] text-[#a8a29e] block font-sans">Resp Rate</span>
                        <strong className="text-base text-white">{packetData?.vitals?.rr || 24}/m</strong>
                      </div>
                      <div className="bg-[#292524] p-2.5 rounded-xl">
                        <span className="text-[10px] text-[#a8a29e] block font-sans">Temp</span>
                        <strong className="text-base text-white">{packetData?.vitals?.temp || '98.6 F'}</strong>
                      </div>
                      <div className="bg-red-950/80 border border-red-800 p-2.5 rounded-xl">
                        <span className="text-[10px] text-red-300 block font-sans font-bold">GCS Score</span>
                        <strong className="text-base text-red-400 font-bold">{packetData?.vitals?.gcs || 8}/15</strong>
                      </div>
                    </div>
                  </div>

                  {/* 3. Treatment Given & Medications */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="eleven-card p-4 space-y-2 bg-[#fafafa]">
                      <h4 className="font-bold text-[#0c0a09] flex items-center gap-1.5 font-mono uppercase text-[11px]">
                        <Stethoscope className="w-4 h-4 text-emerald-600" /> Emergency Interventions Given:
                      </h4>
                      <p className="text-[#292524] bg-white p-2.5 rounded-xl border border-[#e7e5e4]">
                        {packetData?.treatmentGiven || 'IV Mannitol, Intubated on manual bag'}
                      </p>
                    </div>

                    <div className="eleven-card p-4 space-y-2 bg-[#fafafa]">
                      <h4 className="font-bold text-[#0c0a09] flex items-center gap-1.5 font-mono uppercase text-[11px]">
                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Medications & Allergies:
                      </h4>
                      <div className="bg-white p-2.5 rounded-xl border border-[#e7e5e4] space-y-1">
                        <p><strong className="text-[#777169]">Administered:</strong> {packetData?.medications?.join(', ') || 'Inj. Mannitol 100ml, Inj. Ceftriaxone 1g'}</p>
                        <p className="text-red-600 font-bold"><strong className="text-[#777169]">Allergies:</strong> {packetData?.allergies?.join(', ') || 'Penicillin'}</p>
                      </div>
                    </div>
                  </div>

                  {/* 4. Reserved Hospital Resources */}
                  <div className="space-y-2 bg-blue-50/60 border border-blue-200 p-4 rounded-2xl">
                    <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Reserved Receiving Hospital Capacity & Specialist On-Call</span>
                    </h4>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                      {['ICU Bed Reserved', 'Ventilator Ready', 'CT Scan Reserved', 'Neurosurgeon On-Call'].map(res => (
                        <span key={res} className="px-3 py-1.5 rounded-xl bg-white border border-blue-300 text-blue-900 font-bold shadow-2xs">
                          ✓ {res}
                        </span>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
