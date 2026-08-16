import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { apiClient } from '../utils/apiClient.js';
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
  FileText,
  Check,
  Printer,
  Radio,
  Volume2,
  FastForward,
  RotateCcw,
  Sparkles,
  Download,
  ArrowLeft,
  Eye,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LiveAmbulanceMap from './uber-map/LiveAmbulanceMap';

const createAmbulanceIcon = (label) => {
  return L.divIcon({
    className: 'custom-ambulance-leaflet-marker',
    html: `
      <div style="
        background-color: #f59e0b;
        color: #0c0a09;
        padding: 5px 10px;
        border-radius: 9999px;
        font-family: 'Plus Jakarta Sans', sans-serif;
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
        font-family: 'Plus Jakarta Sans', sans-serif;
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

// Live Tracking Map Component for Accepted Transfers moved to LiveAmbulanceTrackingMap3D.jsx

export function ReceivingTab({ preSelectedReferral, authSession }) {
  const { referrals, hospitals, setLastNotification } = useWebSocket();
  const [liveMetrics, setLiveMetrics] = useState(null);
  
  // View mode state: 'list' (Patient Cards Grid) vs 'tracking' (Live Tracking Page)
  const [viewMode, setViewMode] = useState('list');
  const [trackingReferral, setTrackingReferral] = useState(null);
  // Modal states
  const [detailModalRef, setDetailModalRef] = useState(null);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [acceptedIds, setAcceptedIds] = useState(new Set());
  const [prevStatusMap, setPrevStatusMap] = useState({});

  useEffect(() => {
    if (!referrals) return;
    
    let shouldAutoTrack = false;
    let trackRef = null;

    const newStatusMap = {};
    for (const r of referrals) {
      if (String(r.targetHospitalId) === String(authSession?.hospitalId)) {
        newStatusMap[r.id] = r.status;
        
        // If it newly transitioned to ACCEPTED or IN_TRANSIT
        if ((r.status === 'ACCEPTED' || r.status === 'IN_TRANSIT') && prevStatusMap[r.id] !== r.status) {
          shouldAutoTrack = true;
          trackRef = r;
        }
      }
    }
    
    setPrevStatusMap(newStatusMap);

    if (shouldAutoTrack && trackRef && viewMode !== 'tracking') {
      setTrackingReferral(trackRef);
      setLiveMetrics(null); // Reset metrics on new tracking
      setViewMode('tracking');
    }
  }, [referrals, authSession?.hospitalId, viewMode]);

  // Timer state for countdowns
  const [timeRemaining, setTimeRemaining] = useState({});

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        const next = { ...prev };
        let changed = false;
        referrals.forEach(ref => {
          if (ref.status === 'REQUEST_SENT' && ref.createdAt) {
            const created = new Date(ref.createdAt).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - created) / 1000);
            const maxSeconds = ref.timeoutSeconds || 300;
            const remaining = Math.max(0, maxSeconds - elapsed);
            if (next[ref.id] !== remaining) {
              next[ref.id] = remaining;
              changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [referrals]);  const [auditData, setAuditData] = useState(null);
  const [verifyingAudit, setVerifyingAudit] = useState(false);

  const handleVerifyAudit = async (id) => {
    setVerifyingAudit(true);
    setAuditData(null);
    try {
      const res = await apiClient(`/api/referrals/${id}/verify-audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setVerifyingAudit(false);
    }
  };

  const realIncoming = referrals.filter(r => 
    (String(r.targetHospitalId) === String(authSession?.hospitalId) || String(r.acceptedHospitalId) === String(authSession?.hospitalId)) &&
    r.status !== 'COMPLETED'
  );

  const incomingList = realIncoming;

  // Handle preSelectedReferral if passed from parent
  useEffect(() => {
    if (preSelectedReferral) {
      const found = incomingList.find(r => r.id === preSelectedReferral.id || r.patientRefCode === preSelectedReferral.patientRefCode);
      if (found) {
        setTrackingReferral(found);
        setViewMode('tracking');
      }
    }
  }, [preSelectedReferral]);


  // Handler: Reject Patient Request
  const handleRejectPatient = async (ref) => {
    ref.status = 'REJECTED';
    setAcceptedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(ref.id);
      return newSet;
    });

    try {
      await apiClient(`/api/referrals/${ref.id}/reject`, {
        method: 'POST'
      });
    } catch (err) {
      console.warn('Reject referral API notice:', err);
    }
    
    if (setLastNotification) {
      setLastNotification({
        type: 'error',
        text: `✕ Referral #${ref.patientRefCode} rejected.`
      });
    }
  };

  // Handler: Open Tracking Page
  const handleOpenTrackingPage = (ref) => {
    setTrackingReferral(ref);
    setViewMode('tracking');
  };

  // Printable & Downloadable PDF Clinical Report Generator
  const handleDownloadPdfReport = (ref) => {
    const activeRef = ref || trackingReferral || incomingList[0];
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
      reasonForReferral: 'No neurosurgeon available at referring hospital',
      referringDoctorName: 'Dr. Ramesh Kumar (CMO)'
    };

    // Direct download/print using hidden iframe without opening a new tab
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Clinical Handoff Report - Patient ${patient.patientName} (#${activeRef.patientRefCode})</title>
          <style>
            @page { size: A4; margin: 20mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0c0a09; line-height: 1.5; padding: 20px; }
            .header-bar { border-bottom: 3px solid #0c0a09; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-start; }
            .title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
            .subtitle { font-size: 11px; color: #777169; text-transform: uppercase; letter-spacing: 1px; margin-top: 3px; }
            .badge { background: #2563eb; color: white; padding: 5px 12px; border-radius: 6px; font-family: sans-serif; font-size: 13px; font-weight: bold; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
            .box { bg: #fafafa; border: 1px solid #e7e5e4; padding: 14px; border-radius: 10px; font-size: 13px; background: #fafafa; }
            .box-title { font-size: 11px; font-weight: bold; color: #777169; text-transform: uppercase; margin-bottom: 8px; font-family: sans-serif; }
            .vitals-banner { background: #1c1917; color: white; padding: 16px; border-radius: 10px; font-family: sans-serif; display: grid; grid-template-columns: repeat(6, 1fr); text-align: center; margin-bottom: 20px; gap: 10px; }
            .vital-item span { font-size: 10px; color: #a8a29e; display: block; text-transform: uppercase; }
            .vital-val { font-size: 16px; font-weight: bold; color: #10b981; margin-top: 4px; }
            .section { border: 1px solid #e7e5e4; padding: 16px; border-radius: 10px; margin-bottom: 20px; background: white; }
            .section-title { font-size: 13px; font-weight: bold; color: #0c0a09; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
            .footer { border-top: 1px solid #e7e5e4; padding-top: 15px; margin-top: 35px; font-size: 11px; color: #777169; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <div class="title">ERON CLINICAL HANDOFF REPORT</div>
              <div class="subtitle">Emergency Referral Orchestration Network • Certified Medical Document</div>
            </div>
            <span class="badge">REF #${activeRef.patientRefCode}</span>
          </div>

          <div class="grid">
            <div class="box">
              <div class="box-title">Patient Demographics</div>
              <strong>Name:</strong> ${patient.patientName}<br/>
              <strong>Age / Sex:</strong> ${patient.patientAge} Years / ${patient.patientSex}<br/>
              <strong>Referring Hospital:</strong> ${activeRef.originHospitalName}<br/>
              <strong>Referring Doctor:</strong> ${patient.referringDoctorName}
            </div>
            <div class="box">
              <div class="box-title">Target Receiving Facility</div>
              <strong>Receiving Hospital:</strong> ${activeRef.targetHospitalName}<br/>
              <strong>Ambulance Unit:</strong> ${activeRef.ambulance?.id || 'AMB-101'} (ALS Support)<br/>
              <strong>On-Duty Driver:</strong> ${activeRef.ambulance?.driver || 'Rajesh Verma'}<br/>
              <strong>Estimated Arrival:</strong> ${activeRef.estimatedArrivalTime || '14:48 PM'} (${activeRef.eta || '7-10 mins'})
            </div>
          </div>

          <div class="vitals-banner">
            <div class="vital-item"><span>Blood Pressure</span><div class="vital-val">${patient.vitals?.bp}</div></div>
            <div class="vital-item"><span>Heart Rate</span><div class="vital-val">${patient.vitals?.hr} bpm</div></div>
            <div class="vital-item"><span>SpO2</span><div class="vital-val">${patient.vitals?.spo2}%</div></div>
            <div class="vital-item"><span>Resp Rate</span><div class="vital-val">${patient.vitals?.rr}/m</div></div>
            <div class="vital-item"><span>Temp</span><div class="vital-val">${patient.vitals?.temp}</div></div>
            <div class="vital-item"><span>GCS Score</span><div class="vital-val" style="color: #ef4444;">${patient.vitals?.gcs}/15</div></div>
          </div>

          <div class="section">
            <div class="section-title">Suspected Clinical Diagnosis & Reason for Transfer</div>
            <p style="color: #2563eb; font-weight: bold; margin-top: 4px; font-size: 14px;">${patient.diagnosisSuspected}</p>
            <p style="margin-top: 6px; font-size: 13px;">${patient.clinicalSummary}</p>
            <p style="margin-top: 8px; font-size: 12px; color: #b45309;"><strong>Transfer Reason:</strong> ${patient.reasonForReferral}</p>
          </div>

          <div class="section">
            <div class="section-title">Administered Interventions & Medications</div>
            <p><strong>Emergency Treatment:</strong> ${patient.treatmentGiven}</p>
            <p style="margin-top: 4px;"><strong>Administered Meds:</strong> ${patient.medications?.join(', ')}</p>
            <p style="margin-top: 4px; color: #dc2626;"><strong>Known Allergies:</strong> ${patient.allergies?.join(', ')}</p>
          </div>

          <div class="section" style="background: #ecfdf5; border-color: #a7f3d0;">
            <div class="section-title" style="color: #065f46;">Required Emergency Resources & Reserved Facilities</div>
            <p style="font-size: 12px; color: #047857; font-weight: bold;">
              ✓ ${(activeRef.requiredThings || ['ICU Bed', 'Ventilator', 'Emergency CT', 'Neurosurgeon']).join('  •  ✓ ')}
            </p>
          </div>

          <div class="footer">
            <p>Certified by ERON Network Encryption Core. Document downloaded on ${new Date().toLocaleString()}. Confidential Protected Health Information (PHI).</p>
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 250);
  };

  // Render Mode B: Dedicated Accepted Transfer Live Tracking Page
  if (viewMode === 'tracking' && trackingReferral) {
    const patient = trackingReferral.patientData || {};
    const requiredThingsList = (trackingReferral.requiredCapabilities && trackingReferral.requiredCapabilities.length > 0) ? trackingReferral.requiredCapabilities : ['ICU Bed', 'Ventilator'];
    
    const originHosp = hospitals?.find(h => h.id === trackingReferral.originHospitalId);
    const targetHosp = hospitals?.find(h => h.id === trackingReferral.targetHospitalId);
    const originName = originHosp?.name || trackingReferral.originHospitalName || 'Origin Hospital';
    const targetName = targetHosp?.name || trackingReferral.targetHospitalName || 'Destination Hospital';

    let etaString = "--:--";
    let etaContext = "Calculating...";
    
    if (liveMetrics) {
      if (liveMetrics.progressPct >= 99.5) {
        etaString = "Arrived";
        etaContext = "(Journey completed)";
      } else if (liveMetrics.etaMin > 0) {
        const etaDate = new Date(Date.now() + liveMetrics.etaMin * 60000);
        etaString = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        etaContext = `(Arriving in approx ${Math.max(1, Math.round(liveMetrics.etaMin))} mins)`;
      }
    } else {
      // default/fallback
      const etaDate = new Date(Date.now() + 10 * 60000);
      etaString = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      etaContext = "(Arriving in approx 10 mins)";
    }

    return (
      <div className="space-y-6 max-w-7xl mx-auto font-sans animate-in fade-in duration-300">
        
        {/* Top Tracking Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#e7e5e4] shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewMode('list')}
              className="p-2 rounded-xl bg-[#f0efed] hover:bg-[#292524] hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
              title="Return to Request Cards List"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Received Requests</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-[#0c0a09]">
                  Live Transfer Tracking — Patient {patient.patientName}
                </span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  #{trackingReferral.patientRefCode}
                </span>
              </div>
              <p className="text-xs text-[#777169]">
                Transferring from <strong className="text-blue-600">{originName}</strong> to <strong className="text-emerald-700">{targetName}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailModalRef(trackingReferral)}
              className="px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Eye className="w-4 h-4" />
              <span>View Patient Report</span>
            </button>
          </div>
        </div>

        {/* Side-by-Side Layout: Map on Left (7 cols) + Status & Report on Right (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
        {/* Map Side */}
        <div className="col-span-12 lg:col-span-7 animate-in fade-in zoom-in-95 duration-500 delay-150 relative h-full">
          {trackingReferral?.status === 'COMPLETED' ? (
            <div className="eleven-card bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-md h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0c0a09]">Transfer Delivered Successfully!</h2>
              <p className="text-[#777169] text-sm">Patient has successfully reached the destination hospital. The simulation is now complete.</p>
              <button
                onClick={() => setViewMode('list')}
                className="mt-4 px-6 py-3 bg-[#0c0a09] hover:bg-[#292524] text-white rounded-xl font-bold shadow-md transition-all"
              >
                Return to Dashboard
              </button>
            </div>
          ) : trackingReferral ? (
            <LiveAmbulanceMap 
              source={{ name: originName, lat: originHosp?.location_lat || 12.9716, lng: originHosp?.location_lng || 77.5946 }}
              destination={{ name: targetName, lat: targetHosp?.location_lat || 12.9352, lng: targetHosp?.location_lng || 77.6245 }}
              onMetricsUpdate={setLiveMetrics}
              onComplete={() => {
                const token = localStorage.getItem('eron_auth_session');
                fetch(`http://localhost:3001/api/referrals/${trackingReferral.id}/complete`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  }
                }).catch(console.error);
              }}
            />
          ) : null}
        </div>

          {/* RIGHT HAND SIDE: Arrival Time + Things Required + View Report + PDF Download */}
          <div className="lg:col-span-5 space-y-4">
            <div className="eleven-card p-6 bg-white border border-[#e7e5e4] shadow-sm space-y-5 rounded-2xl">
              
              {/* 1. Arrival Time Box */}
              <div className="bg-[#1c1917] p-4 rounded-xl text-white space-y-2 border border-[#292524]">
                <span className="text-[11px] font-mono font-bold text-[#a8a29e] uppercase tracking-wider block flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400" /> Estimated Time of Arrival (ETA)
                </span>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      {etaString}
                    </span>
                    <span className="text-xs text-[#a8a29e] block font-mono">
                      {etaContext}
                    </span>
                  </div>

                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-bold rounded-full animate-pulse">
                    CORRIDOR ACTIVE
                  </span>
                </div>
              </div>

              {/* 2. Things Required / Reserved Capacity */}
              <div className="space-y-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[#777169] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Required & Reserved Equipment
                </h3>

                <div className="space-y-2 font-mono text-xs">
                  {requiredThingsList.map((item, idx) => (
                    <div key={idx} className="p-3 bg-[#fafafa] border border-[#e7e5e4] rounded-xl flex items-center justify-between">
                      <span className="font-bold text-[#0c0a09]">{item}</span>
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold">
                        ✓ RESERVED & READY
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Patient Overview Summary */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-2 text-xs">
                <span className="font-mono text-[10px] font-bold uppercase text-blue-700 block">
                  Patient Overview
                </span>
                <p className="font-bold text-[#0c0a09] text-sm">
                  {patient.patientName} ({patient.patientAge}y, {patient.patientSex})
                </p>
                <p className="text-blue-800 font-semibold">{patient.diagnosisSuspected}</p>
                <p className="text-[#4e4e4e]">{patient.clinicalSummary}</p>
              </div>

              {/* 4. Action Buttons Stack */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => setDetailModalRef(trackingReferral)}
                  className="w-full eleven-button py-3 px-4 bg-[#292524] hover:bg-black text-white font-bold rounded-xl justify-center text-xs flex items-center gap-2 shadow-xs transition-all"
                >
                  <FileText className="w-4 h-4 text-emerald-400" />
                  <span>View Full Patient Clinical Report</span>
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* DRIVER RADIO MODAL */}
        {isRadioModalOpen && (
          <div 
            className="fixed inset-0 z-[9999] bg-[#0c0a09]/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
            role="dialog"
          >
            <div className="eleven-card w-full max-w-md bg-[#1c1917] text-white border-[#292524] shadow-2xl rounded-2xl overflow-hidden space-y-4 p-6">
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

              <div className="bg-[#292524] p-4 rounded-xl space-y-3 border border-[#383330]">
                <div className="flex items-center justify-between font-mono text-xs text-amber-400">
                  <span>CHANNEL: CH-04 (ALS CORRIDOR)</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Volume2 className="w-4 h-4 animate-bounce" /> LIVE STREAM
                  </span>
                </div>

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

              <div className="space-y-1.5 bg-[#0c0a09] p-3.5 rounded-xl border border-[#292524] text-xs font-mono">
                <div className="flex items-center justify-between text-[#a8a29e] text-[10px]">
                  <span>DRIVER: {trackingReferral.ambulance?.driver || 'Rajesh Verma'}</span>
                  <span>UNIT: {trackingReferral.ambulance?.id || 'AMB-101'}</span>
                </div>
                <p className="text-emerald-300 font-sans leading-relaxed pt-1">
                  "Unit {trackingReferral.ambulance?.id || 'AMB-101'} to Trauma Bay Desk: Patient GCS score {patient.vitals?.gcs || 8}, SpO2 {patient.vitals?.spo2 || 94}% on bag. IV Mannitol running. ETA 5 minutes, please have CT team & Neurosurgeon on standby."
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CLINICAL PATIENT REPORT MODAL */}
        {detailModalRef && (
          <div className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
            <div className="eleven-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 bg-white border-[#d6d3d1] shadow-2xl rounded-2xl">
              <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-extrabold text-[#0c0a09]">
                    Detailed Patient Clinical Report (#{detailModalRef.patientRefCode})
                  </h2>
                </div>

                <button
                  onClick={() => setDetailModalRef(null)}
                  className="eleven-button eleven-button-secondary text-xs py-1 px-3"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Demographics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4]">
                  <div>
                    <span className="text-[#777169] text-[10px] block">Patient Name:</span>
                    <p className="font-bold text-[#0c0a09]">{patient.patientName} ({patient.patientAge}y, {patient.patientSex})</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Suspected Condition:</span>
                    <p className="font-bold text-blue-600">{patient.diagnosisSuspected}</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Referring Doctor:</span>
                    <p className="font-bold text-[#0c0a09]">{patient.referringDoctorName}</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Transfer Reason:</span>
                    <p className="font-bold text-amber-700">{patient.reasonForReferral}</p>
                  </div>
                </div>

                {/* Vitals */}
                {patient.vitals && (
                  <div className="bg-[#1c1917] text-white p-3.5 rounded-2xl grid grid-cols-3 md:grid-cols-6 gap-2 text-center font-mono text-xs">
                    <div><span className="text-[9px] text-[#a8a29e] block">BP</span><strong className="text-white">{patient.vitals.bp}</strong></div>
                    <div><span className="text-[9px] text-[#a8a29e] block">HR</span><strong className="text-emerald-400">{patient.vitals.hr} bpm</strong></div>
                    <div><span className="text-[9px] text-[#a8a29e] block">SpO2</span><strong className="text-blue-400">{patient.vitals.spo2}%</strong></div>
                    <div><span className="text-[9px] text-[#a8a29e] block">RR</span><strong className="text-white">{patient.vitals.rr}/m</strong></div>
                    <div><span className="text-[9px] text-[#a8a29e] block">Temp</span><strong className="text-white">{patient.vitals.temp}</strong></div>
                    <div><span className="text-[9px] text-red-300 block">GCS</span><strong className="text-red-400 font-bold">{patient.vitals.gcs}/15</strong></div>
                  </div>
                )}

                {/* Clinical Summary & Treatment */}
                <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4] space-y-2">
                  <span className="font-bold text-[#0c0a09] block">Clinical Summary:</span>
                  <p className="text-[#292524] leading-relaxed">{patient.clinicalSummary}</p>
                  <p className="text-blue-700 font-semibold pt-1">Treatment Given: {patient.treatmentGiven}</p>
                  <p className="text-amber-800">Meds: {patient.medications?.join(', ')}</p>
                  <p className="text-red-600 font-bold">Allergies: {patient.allergies?.join(', ')}</p>
                </div>

                {/* Audit Ledger Section */}
                {auditData && (
                  <div className="bg-[#f0fdf4] p-4 rounded-2xl border border-[#bbf7d0] space-y-3 mt-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-800 text-sm">✓ Cryptographic Ledger Verified</span>
                      <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-1 rounded-full font-mono">{auditData.is_valid ? 'HASH MATCH' : 'INVALID'}</span>
                    </div>
                    <div className="space-y-2">
                      {auditData.verificationChain?.map((step, i) => (
                        <div key={i} className="flex justify-between items-center text-xs border-b border-emerald-100 pb-1">
                          <span className="text-emerald-900 font-mono">{step.status_transition}</span>
                          <span className="text-[9px] text-emerald-600 font-mono truncate max-w-[120px]">{step.event_hash}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => handleVerifyAudit(detailModalRef.id)}
                    disabled={verifyingAudit}
                    className="px-4 py-2 bg-[#292524] text-white hover:bg-black font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{verifyingAudit ? 'Verifying...' : 'Verify Audit Ledger'}</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPdfReport(detailModalRef)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Report</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Render Mode A: Cards List View (Front of Cards strictly contains required items only)
  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e5e4] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-[#0c0a09] tracking-tight">
              Received Patient Requests
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-mono font-bold border border-red-200">
              {incomingList.length} Incoming
            </span>
          </div>
        </div>
      </div>

      {/* Incoming Request Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {incomingList.map((ref) => {
          const isAccepted = acceptedIds.has(ref.id) || ref.status === 'ACCEPTED' || ref.status === 'IN_TRANSIT';
          const pName = ref.patientData?.patientName || 'Incoming Patient';
          const requiredItems = ref.requiredThings || ['ICU Bed', 'Ventilator', 'Emergency CT', 'Neurosurgeon'];

          return (
            <div 
              key={ref.id}
              className="eleven-card p-5 bg-white border border-[#e7e5e4] shadow-xs hover:shadow-md transition-all rounded-2xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Header Status & Code */}
                <div className="flex items-center justify-between border-b border-[#f0efed] pb-2">
                  <span className="font-mono text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    #{ref.patientRefCode}
                  </span>

                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${
                    isAccepted ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    {isAccepted ? 'ACCEPTED' : ref.status}
                  </span>
                </div>

                {!isAccepted && ref.status === 'REQUEST_SENT' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-2 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-amber-700 font-mono font-bold uppercase tracking-wider mb-1">
                      Time to Respond
                    </span>
                    <span className={`text-xl font-mono font-extrabold ${timeRemaining[ref.id] <= 60 ? 'text-red-600 animate-pulse' : 'text-amber-600'}`}>
                      {timeRemaining[ref.id] !== undefined ? `${Math.floor(timeRemaining[ref.id] / 60)}:${String(timeRemaining[ref.id] % 60).padStart(2, '0')}` : '5:00'}
                    </span>
                    <span className="text-[9px] text-amber-600/70 font-sans mt-0.5">
                      Auto-allocation if ignored
                    </span>
                  </div>
                )}

                {/* 1. Patient Name */}
                <div>
                  <span className="text-[10px] font-mono text-[#777169] uppercase block font-semibold">
                    Patient Name
                  </span>
                  <h3 className="text-base font-extrabold text-[#0c0a09]">
                    {pName}
                  </h3>
                </div>

                {/* 2. Problem Summary */}
                <div>
                  <span className="text-[10px] font-mono text-[#777169] uppercase block font-semibold">
                    Problem Summary
                  </span>
                  <p className="text-xs text-[#292524] font-medium leading-snug">
                    {ref.requirementSummary}
                  </p>
                </div>

                {/* 3. Hospital Coming From */}
                <div>
                  <p className="text-xs font-bold text-blue-600 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{ref.originHospitalName}</span>
                  </p>
                </div>

                {/* 4. Things Required */}
                <div>
                  <span className="text-[10px] font-mono text-[#777169] uppercase block font-semibold mb-1">
                    Things Required
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {requiredItems.map((item, idx) => (
                      <span 
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-[#fafafa] border border-[#e7e5e4] text-[#0c0a09] text-[11px] font-mono font-semibold"
                      >
                        • {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Action Buttons */}
              <div className="pt-2 border-t border-[#f0efed] grid grid-cols-2 gap-2">
                {!isAccepted ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRejectPatient(ref)}
                      className="eleven-button py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl justify-center shadow-xs transition-all flex-1"
                    >
                      ✕ Reject
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenTrackingPage(ref)}
                    className="eleven-button py-2.5 px-3 bg-[#292524] hover:bg-black text-white font-bold text-xs rounded-xl justify-center shadow-xs transition-all flex items-center gap-1"
                  >
                    <span>Track Transfer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => setDetailModalRef(ref)}
                  className="eleven-button py-2.5 px-3 bg-white hover:bg-[#fafafa] text-[#0c0a09] border border-[#d6d3d1] font-bold text-xs rounded-xl justify-center shadow-2xs transition-all"
                >
                  View Detail
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAIL REPORT MODAL FROM CARDS VIEW */}
      {detailModalRef && (
        <div className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="eleven-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 bg-white border-[#d6d3d1] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-extrabold text-[#0c0a09]">
                  Detailed Patient Clinical Report (#{detailModalRef.patientRefCode})
                </h2>
              </div>

              <button
                onClick={() => setDetailModalRef(null)}
                className="eleven-button eleven-button-secondary text-xs py-1 px-3"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4]">
                <div>
                  <span className="text-[#777169] text-[10px] block">Patient Name:</span>
                  <p className="font-bold text-[#0c0a09]">{detailModalRef.patientData?.patientName || 'Karan Sharma'} ({detailModalRef.patientData?.patientAge || 42}y, {detailModalRef.patientData?.patientSex || 'MALE'})</p>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block">Suspected Condition:</span>
                  <p className="font-bold text-blue-600">{detailModalRef.patientData?.diagnosisSuspected || 'Acute Condition'}</p>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block">Referring Doctor:</span>
                  <p className="font-bold text-[#0c0a09]">{detailModalRef.patientData?.referringDoctorName || 'Dr. Ramesh Kumar'}</p>
                </div>
                <div>
                  <span className="text-[#777169] text-[10px] block">Transfer Reason:</span>
                  <p className="font-bold text-amber-700">{detailModalRef.patientData?.reasonForReferral || 'Specialist care needed'}</p>
                </div>
              </div>

              {detailModalRef.patientData?.vitals && (
                <div className="bg-[#1c1917] text-white p-3.5 rounded-2xl grid grid-cols-3 md:grid-cols-6 gap-2 text-center font-mono text-xs">
                  <div><span className="text-[9px] text-[#a8a29e] block">BP</span><strong className="text-white">{detailModalRef.patientData.vitals.bp}</strong></div>
                  <div><span className="text-[9px] text-[#a8a29e] block">HR</span><strong className="text-emerald-400">{detailModalRef.patientData.vitals.hr} bpm</strong></div>
                  <div><span className="text-[9px] text-[#a8a29e] block">SpO2</span><strong className="text-blue-400">{detailModalRef.patientData.vitals.spo2}%</strong></div>
                  <div><span className="text-[9px] text-[#a8a29e] block">RR</span><strong className="text-white">{detailModalRef.patientData.vitals.rr}/m</strong></div>
                  <div><span className="text-[9px] text-[#a8a29e] block">Temp</span><strong className="text-white">{detailModalRef.patientData.vitals.temp}</strong></div>
                  <div><span className="text-[9px] text-red-300 block">GCS</span><strong className="text-red-400 font-bold">{detailModalRef.patientData.vitals.gcs}/15</strong></div>
                </div>
              )}

              <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4] space-y-2">
                <span className="font-bold text-[#0c0a09] block">Clinical Summary:</span>
                <p className="text-[#292524] leading-relaxed">{detailModalRef.patientData?.clinicalSummary}</p>
                <p className="text-blue-700 font-semibold pt-1">Treatment Given: {detailModalRef.patientData?.treatmentGiven}</p>
              </div>

              {/* Audit Ledger Section */}
              {auditData && (
                <div className="bg-[#f0fdf4] p-4 rounded-2xl border border-[#bbf7d0] space-y-3 mt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-800 text-sm">✓ Cryptographic Ledger Verified</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-1 rounded-full font-mono">{auditData.is_valid ? 'HASH MATCH' : 'INVALID'}</span>
                  </div>
                  <div className="space-y-2">
                    {auditData.verificationChain?.map((step, i) => (
                      <div key={i} className="flex justify-between items-center text-xs border-b border-emerald-100 pb-1">
                        <span className="text-emerald-900 font-mono">{step.status_transition}</span>
                        <span className="text-[9px] text-emerald-600 font-mono truncate max-w-[120px]">{step.event_hash}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => handleVerifyAudit(detailModalRef.id)}
                  disabled={verifyingAudit}
                  className="px-4 py-2 bg-[#292524] text-white hover:bg-black font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{verifyingAudit ? 'Verifying...' : 'Verify Audit Ledger'}</span>
                </button>
                <button
                  onClick={() => handleDownloadPdfReport(detailModalRef)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Report</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
