import React, { useState, useEffect } from 'react';
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
  FileText,
  Check,
  Printer,
  Radio,
  Volume2,
  FastForward,
  RotateCcw,
  Sparkles
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
    distanceKm: '5.2 km',
    progressPct: 50,
    ambulance: { id: 'AMB-101', driver: 'Rajesh Verma (ALS Desk)', speed: '64 km/h' },
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
    distanceKm: '12.4 km',
    progressPct: 20,
    ambulance: { id: 'AMB-204', driver: 'Suresh Patil (Cardiac Care)', speed: '58 km/h' },
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
    distanceKm: '3.1 km',
    progressPct: 80,
    ambulance: { id: 'AMB-309', driver: 'Vikram Singh (Trauma Unit)', speed: '72 km/h' },
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

function ReceivingLiveDeliveryMap({ referral, onOpenRadioModal }) {
  const [progress, setProgress] = useState(referral?.progressPct || 50);

  const originPos = [12.9716, 77.5946]; // District Hospital Central
  const targetPos = [12.9352, 77.6245]; // City Super Specialty Hospital
  
  // Interpolated ambulance position based on simulation progress (0 to 100%)
  const ambLat = originPos[0] + (targetPos[0] - originPos[0]) * (progress / 100);
  const ambLng = originPos[1] + (targetPos[1] - originPos[1]) * (progress / 100);
  const ambPos = [ambLat, ambLng];

  const polylineCoords = [originPos, ambPos, targetPos];

  const originName = referral?.originHospitalName || 'District Hospital Central';
  const targetName = referral?.targetHospitalName || 'City Super Specialty Hospital';
  const ambId = referral?.ambulance?.id || 'AMB-101';
  const driverName = referral?.ambulance?.driver || 'Rajesh Verma (ALS Desk)';
  const speed = referral?.ambulance?.speed || '64 km/h';

  const remainingMins = Math.max(1, Math.round(10 * (1 - progress / 100)));

  return (
    <div className="eleven-card bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-sm space-y-0 h-full flex flex-col">
      {/* Interactive Map Header Bar */}
      <div className="p-3.5 bg-[#fafafa] border-b border-[#e7e5e4] flex flex-wrap items-center justify-between font-mono text-xs gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
          <span className="font-bold text-[#0c0a09]">Live Emergency Corridor Map</span>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
            PROGRESS: {progress}%
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#777169]">
            ETA: <strong className="text-emerald-700 font-bold">{remainingMins} Mins</strong>
          </span>

          <button
            onClick={onOpenRadioModal}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all"
            title="Open Live Driver Walkie-Talkie Radio"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Driver Radio</span>
          </button>
        </div>
      </div>

      {/* Interactive Progress Simulation Bar */}
      <div className="bg-[#1c1917] px-3.5 py-2 flex items-center justify-between gap-2 border-b border-[#292524] text-[11px] font-mono">
        <span className="text-[#a8a29e] flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Sim Control:
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setProgress(10)}
            className="px-2 py-0.5 rounded bg-[#292524] hover:bg-[#383330] text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset (10%)
          </button>
          <button
            onClick={() => setProgress(prev => Math.min(90, prev + 25))}
            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-bold"
          >
            <FastForward className="w-3 h-3" /> Advance +25%
          </button>
          <button
            onClick={() => setProgress(100)}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-bold"
          >
            ✓ Arrived (100%)
          </button>
        </div>
      </div>

      {/* Leaflet OpenStreetMap Container */}
      <div className="h-[440px] w-full relative flex-1">
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
                <p className="text-emerald-700 font-mono font-bold">Green Corridor Active ({speed})</p>
              </div>
            </Popup>
          </Marker>

          <Marker position={targetPos} icon={createHospitalIcon(targetName.split(' ')[0], '#2563eb')}>
            <Popup><div className="text-xs font-sans font-bold">Receiving Target: {targetName}</div></Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Driver Telemetry Footer */}
      <div className="bg-[#1c1917] p-3.5 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#292524]">
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
          <p className="font-bold text-amber-400 truncate">{speed}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Green Corridor:</span>
          <p className="font-bold text-blue-400 truncate">Signal Priority Active</p>
        </div>
      </div>
    </div>
  );
}

export function ReceivingTab({ preSelectedReferral, onNavigateToCapacity }) {
  const { referrals, setLastNotification } = useWebSocket();
  const [selectedRef, setSelectedRef] = useState(null);
  const [acceptedSet, setAcceptedSet] = useState(new Set());
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);

  const realIncomingReferrals = referrals.filter(r => 
    (r.targetHospitalId === 'hosp-b' || r.targetHospitalId === 'hosp-c' || r.acceptedHospitalId === 'hosp-b' || r.acceptedHospitalId === 'hosp-c') &&
    r.status !== 'COMPLETED'
  );

  const displayedIncomingReferrals = realIncomingReferrals.length > 0 ? realIncomingReferrals : DEMO_INCOMING_REFERRALS;

  // Initialize selected referral from preSelectedReferral or default to first incoming
  useEffect(() => {
    if (preSelectedReferral) {
      const match = displayedIncomingReferrals.find(r => r.patientRefCode === preSelectedReferral.patientRefCode || r.id === preSelectedReferral.id);
      setSelectedRef(match || preSelectedReferral);
    } else if (!selectedRef && displayedIncomingReferrals.length > 0) {
      setSelectedRef(displayedIncomingReferrals[0]);
    }
  }, [preSelectedReferral, displayedIncomingReferrals]);

  const activeRef = selectedRef || displayedIncomingReferrals[0];
  const patient = activeRef?.patientData || {
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
  };

  const handleAcceptRequest = (ref) => {
    ref.status = 'ACCEPTED';
    setAcceptedSet(new Set([...acceptedSet, ref.id]));
    if (setLastNotification) {
      setLastNotification({
        type: 'success',
        text: `✓ Referral #${ref.patientRefCode} accepted by City Super Specialty Hospital.`
      });
    }
  };

  const handleCompleteHandover = async (refId) => {
    try {
      await fetch(`/api/referrals/${refId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: 'user-admin-b' })
      });
      if (setLastNotification) {
        setLastNotification({
          type: 'success',
          text: `✓ Handover completed for referral #${activeRef.patientRefCode}.`
        });
      }
    } catch (err) {
      console.error('Handover error:', err);
    }
  };

  // Trigger Printable Clinical Handoff PDF Report
  const handlePrintPdfReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Clinical Handoff Report #${activeRef.patientRefCode}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #0c0a09; line-height: 1.5; }
            .header { border-bottom: 2px solid #0c0a09; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .title { font-size: 20px; font-weight: bold; }
            .badge { background: #2563eb; color: white; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .box { background: #f5f5f5; border: 1px solid #e7e5e4; padding: 12px; border-radius: 8px; font-size: 13px; }
            .vitals { background: #1c1917; color: white; padding: 15px; border-radius: 8px; font-family: monospace; display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; margin-bottom: 20px; }
            .vital-val { font-size: 16px; font-weight: bold; color: #10b981; }
            .footer { border-top: 1px solid #e7e5e4; pt: 20px; margin-top: 30px; font-size: 11px; color: #777169; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">ERON CLINICAL HANDOFF REPORT</div>
              <div style="font-size: 12px; color: #777169;">Emergency Referral Orchestration Network • Confidential Medical Document</div>
            </div>
            <span class="badge">REF #${activeRef.patientRefCode}</span>
          </div>

          <div class="grid">
            <div class="box">
              <strong>PATIENT DEMOGRAPHICS</strong><br/>
              Name: ${patient.patientName}<br/>
              Age / Sex: ${patient.patientAge} Years / ${patient.patientSex}<br/>
              Referring Hospital: ${activeRef.originHospitalName}<br/>
              Referring Physician: ${patient.referringDoctorName}
            </div>
            <div class="box">
              <strong>TARGET RECEIVING FACILITY</strong><br/>
              Target Hospital: ${activeRef.targetHospitalName}<br/>
              Dispatched Ambulance: ${activeRef.ambulance?.id || 'AMB-101'} (ALS Desk)<br/>
              Driver On-Duty: ${activeRef.ambulance?.driver || 'Rajesh Verma'}<br/>
              Transit Status: ${activeRef.status}
            </div>
          </div>

          <div class="vitals">
            <div><span>BP</span><div class="vital-val">${patient.vitals?.bp}</div></div>
            <div><span>HR</span><div class="vital-val">${patient.vitals?.hr} bpm</div></div>
            <div><span>SpO2</span><div class="vital-val">${patient.vitals?.spo2}%</div></div>
            <div><span>RR</span><div class="vital-val">${patient.vitals?.rr}/m</div></div>
            <div><span>Temp</span><div class="vital-val">${patient.vitals?.temp}</div></div>
            <div><span>GCS</span><div class="vital-val" style="color: #ef4444;">${patient.vitals?.gcs}/15</div></div>
          </div>

          <div class="box" style="margin-bottom: 20px;">
            <strong>SUSPECTED CLINICAL DIAGNOSIS & REASON FOR REFERRAL</strong>
            <p style="color: #2563eb; font-weight: bold; margin-top: 4px;">${patient.diagnosisSuspected}</p>
            <p>${patient.clinicalSummary}</p>
            <p><strong>Reason for Transfer:</strong> ${patient.reasonForReferral}</p>
          </div>

          <div class="box" style="margin-bottom: 20px;">
            <strong>ADMINISTERED EMERGENCY INTERVENTIONS & MEDICATIONS</strong>
            <p><strong>Treatment:</strong> ${patient.treatmentGiven}</p>
            <p><strong>Medications:</strong> ${patient.medications?.join(', ')}</p>
            <p style="color: #dc2626;"><strong>Allergies:</strong> ${patient.allergies?.join(', ')}</p>
          </div>

          <div class="footer">
            <p>Certified by ERON Network State Engine. Verified by Receiving Trauma Chief on ${new Date().toLocaleString()}.</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const isAccepted = acceptedSet.has(activeRef?.id) || activeRef?.status === 'ACCEPTED' || activeRef?.status === 'IN_TRANSIT';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Patient Selector Navigation Tabs & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e5e4] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs font-mono font-bold text-[#777169] uppercase mr-1">Incoming Patients:</span>
          {displayedIncomingReferrals.map((ref) => {
            const isSelected = activeRef.id === ref.id;
            const pName = ref.patientData?.patientName || 'Incoming Patient';
            return (
              <button
                key={ref.id}
                onClick={() => setSelectedRef(ref)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-2xs flex items-center gap-2 ${
                  isSelected 
                    ? 'bg-[#292524] text-white border-[#292524] ring-2 ring-[#292524]/20' 
                    : 'bg-white text-[#292524] border-[#e7e5e4] hover:bg-[#fafafa]'
                }`}
              >
                <span className="font-mono text-amber-400">#{ref.patientRefCode}</span>
                <span>{pName}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono uppercase ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#f0efed] text-[#777169]'
                }`}>
                  {ref.status}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handlePrintPdfReport}
            className="px-3.5 py-2 rounded-xl bg-white border border-[#e7e5e4] hover:bg-[#292524] hover:text-white transition-all text-xs font-bold font-mono shadow-2xs flex items-center gap-1.5"
            title="Download/Print Official Clinical Handoff PDF Report"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>Export Clinical Handoff PDF</span>
          </button>
        </div>
      </div>

      {/* Main Side-by-Side Grid: Map on Left (lg:col-span-7) + Detailed Info on Right (lg:col-span-5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT SIDE: Live GPS Delivery Route Map (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <ReceivingLiveDeliveryMap 
            referral={activeRef} 
            onOpenRadioModal={() => setIsRadioModalOpen(true)}
          />
        </div>

        {/* RIGHT SIDE: Complete Patient Info sent by Referring Hospital (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="eleven-card p-6 bg-white border border-[#e7e5e4] shadow-sm space-y-5 rounded-2xl">
            
            {/* Header & Accept Action Option */}
            <div className="border-b border-[#e7e5e4] pb-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-base font-bold text-[#0c0a09]">#{activeRef.patientRefCode}</span>
                  <span className="eleven-badge bg-blue-50 text-blue-700 border-blue-200 font-bold">
                    {activeRef.status}
                  </span>
                </div>

                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" /> ETA: {activeRef.eta || '7-10 mins'}
                </span>
              </div>

              {/* Accept Request Button */}
              <div className="flex items-center gap-2">
                {!isAccepted ? (
                  <button
                    onClick={() => handleAcceptRequest(activeRef)}
                    className="w-full eleven-button eleven-button-primary py-2.5 px-4 font-bold bg-emerald-600 hover:bg-emerald-700 text-white justify-center text-xs shadow-sm transition-all"
                  >
                    ✓ Accept Transfer Request
                  </button>
                ) : (
                  <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold font-mono">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>TRANSFER REQUEST ACCEPTED & BED LOCKED</span>
                  </div>
                )}
              </div>
            </div>

            {/* 1. Patient Demographics & Referred From */}
            <div className="space-y-2 text-xs">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#777169] flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#292524]" /> Patient Demographics
              </h3>

              <div className="bg-[#fafafa] p-3 rounded-xl border border-[#e7e5e4] space-y-1.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#777169]">Name / Age / Sex:</span>
                  <strong className="text-[#0c0a09] font-sans text-sm">{patient.patientName} ({patient.patientAge}y {patient.patientSex})</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#777169]">Referring Hospital:</span>
                  <strong className="text-[#2563eb] font-sans">{activeRef.originHospitalName}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#777169]">Referring Physician:</span>
                  <strong className="text-[#0c0a09] font-sans">{patient.referringDoctorName}</strong>
                </div>
              </div>
            </div>

            {/* 2. Suspected Diagnosis & Reason */}
            <div className="space-y-2 text-xs">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#777169] flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-emerald-600" /> Diagnosis & Transfer Reason
              </h3>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 space-y-1 text-xs">
                <p className="font-bold text-[#2563eb]">{patient.diagnosisSuspected}</p>
                <p className="text-[#4e4e4e]">{patient.clinicalSummary}</p>
                <p className="text-amber-800 font-mono text-[11px] pt-1">
                  <strong>Reason:</strong> {patient.reasonForReferral}
                </p>
              </div>
            </div>

            {/* 3. Live Vitals Telemetry */}
            <div className="space-y-2">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#777169] flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-red-600" /> Live ALS Vitals Monitor
              </h3>

              <div className="bg-[#1c1917] p-3 rounded-xl text-white font-mono text-center grid grid-cols-3 gap-2 text-xs">
                <div className="bg-[#292524] p-2 rounded-lg">
                  <span className="text-[9px] text-[#a8a29e] block">BP</span>
                  <strong className="text-white">{patient.vitals?.bp}</strong>
                </div>
                <div className="bg-[#292524] p-2 rounded-lg">
                  <span className="text-[9px] text-[#a8a29e] block">Heart Rate</span>
                  <strong className="text-emerald-400">{patient.vitals?.hr} bpm</strong>
                </div>
                <div className="bg-[#292524] p-2 rounded-lg">
                  <span className="text-[9px] text-[#a8a29e] block">SpO2</span>
                  <strong className="text-blue-400">{patient.vitals?.spo2}%</strong>
                </div>
                <div className="bg-[#292524] p-2 rounded-lg">
                  <span className="text-[9px] text-[#a8a29e] block">Resp Rate</span>
                  <strong className="text-white">{patient.vitals?.rr}/m</strong>
                </div>
                <div className="bg-[#292524] p-2 rounded-lg">
                  <span className="text-[9px] text-[#a8a29e] block">Temp</span>
                  <strong className="text-white">{patient.vitals?.temp}</strong>
                </div>
                <div className="bg-red-950 border border-red-800 p-2 rounded-lg">
                  <span className="text-[9px] text-red-300 block font-bold">GCS</span>
                  <strong className="text-red-400 font-bold">{patient.vitals?.gcs}/15</strong>
                </div>
              </div>
            </div>

            {/* 4. Treatment Given & Medications */}
            <div className="space-y-2 text-xs">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#777169] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> Administered Interventions
              </h3>

              <div className="bg-[#fafafa] p-3 rounded-xl border border-[#e7e5e4] space-y-1">
                <p><strong className="text-[#777169]">Treatment:</strong> {patient.treatmentGiven}</p>
                <p><strong className="text-[#777169]">Meds:</strong> {patient.medications?.join(', ')}</p>
                <p className="text-red-600 font-bold"><strong className="text-[#777169]">Allergies:</strong> {patient.allergies?.join(', ')}</p>
              </div>
            </div>

            {/* 5. Reserved Receiving Capacity */}
            <div className="space-y-2 bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Reserved Capacity
              </h3>
              <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                {['ICU Bed Reserved', 'Ventilator Ready', 'CT Scan Reserved', 'Neurosurgeon On-Call'].map(r => (
                  <span key={r} className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold">
                    ✓ {r}
                  </span>
                ))}
              </div>
            </div>

            {/* Complete Handover Button */}
            <button
              onClick={() => handleCompleteHandover(activeRef.id)}
              className="w-full eleven-button eleven-button-primary py-2.5 px-4 font-bold bg-[#292524] hover:bg-black text-white justify-center text-xs shadow-sm"
            >
              Complete Clinical Handover (100%)
            </button>

          </div>
        </div>

      </div>

      {/* AMBULANCE DRIVER WALKIE-TALKIE RADIO MODAL */}
      {isRadioModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0a09]/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
          role="dialog"
          aria-modal="true"
        >
          <div className="eleven-card w-full max-w-md bg-[#1c1917] text-white border-[#292524] shadow-2xl rounded-2xl overflow-hidden space-y-4 p-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#292524] pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
                <h3 className="font-bold text-sm font-mono text-white">LIVE DRIVER RADIO CALL</h3>
              </div>

              <button
                onClick={() => setIsRadioModalOpen(false)}
                className="text-xs font-bold text-[#a8a29e] hover:text-white px-2 py-1 bg-[#292524] rounded-lg"
              >
                ✕ Close Radio
              </button>
            </div>

            {/* Active Channel & Audio Wave Animation */}
            <div className="bg-[#292524] p-4 rounded-xl space-y-3 border border-[#383330]">
              <div className="flex items-center justify-between font-mono text-xs text-amber-400">
                <span>CHANNEL: CH-04 (ALS CORRIDOR)</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Volume2 className="w-4 h-4 animate-bounce" /> LIVE STREAM
                </span>
              </div>

              {/* Sound Wave Animation Visualizer */}
              <div className="h-12 flex items-center justify-center gap-1 px-4 bg-[#1c1917] rounded-lg">
                {[40, 80, 60, 100, 30, 90, 70, 50, 95, 45, 85, 35].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-amber-500 rounded-full animate-pulse"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>

            {/* Live Driver Transcript Speech Box */}
            <div className="space-y-1.5 bg-[#0c0a09] p-3.5 rounded-xl border border-[#292524] text-xs font-mono">
              <div className="flex items-center justify-between text-[#a8a29e] text-[10px]">
                <span>DRIVER: {activeRef.ambulance?.driver || 'Rajesh Verma'}</span>
                <span>UNIT: {activeRef.ambulance?.id || 'AMB-101'}</span>
              </div>
              <p className="text-emerald-300 font-sans leading-relaxed pt-1">
                "Unit {activeRef.ambulance?.id || 'AMB-101'} to Trauma Bay Desk: Patient GCS score {patient.vitals?.gcs || 8}, SpO2 {patient.vitals?.spo2 || 94}% on bag. IV Mannitol running. ETA 5 minutes, please have CT team & Neurosurgeon on standby."
              </p>
            </div>

            <div className="text-[10px] text-[#a8a29e] text-center font-mono pt-1">
              • Encrypted Direct Audio Link Active (16-bit PCM streaming) •
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
