import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  ShieldCheck, 
  Navigation, 
  AlertTriangle, 
  CheckCircle2, 
  Ambulance, 
  MapPin, 
  RefreshCw, 
  Eye, 
  ChevronRight, 
  Building2, 
  Plus 
} from 'lucide-react';

function DeliveryLiveMap({ referral }) {
  const origin = referral?.originHospitalName || 'District Hospital Central';
  const target = referral?.targetHospitalName || 'City Super Specialty Hospital';
  const ambId = referral?.ambulance?.id || 'AMB-101';
  const driverName = referral?.ambulance?.driverName || 'Suresh Kumar';

  return (
    <div className="eleven-card overflow-hidden border-[#e7e5e4] shadow-sm font-sans space-y-0 bg-[#0c0a09] text-white rounded-2xl">
      {/* Live Status Overlay Banner */}
      <div className="bg-[#1c1917] px-4 py-3 border-b border-[#292524] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
            Live Delivery-Style GPS Map
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
            ETA: 8 mins (4.2 km)
          </span>
          <span className="bg-[#292524] text-[#a8a29e] px-2.5 py-0.5 rounded-full font-semibold">
            Speed: 52 km/h
          </span>
        </div>
      </div>

      {/* SVG Interactive Delivery Map Visualizer */}
      <div className="relative h-60 w-full bg-[#0c0a09] overflow-hidden flex items-center justify-center p-4">
        {/* Map Street Grid Background Pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="delivery-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#delivery-map-grid)" />
        </svg>

        {/* Route Line SVG */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          {/* Background Route Glow */}
          <path
            d="M 80 150 C 220 50, 360 210, 560 90"
            fill="none"
            stroke="#10b981"
            strokeWidth="6"
            strokeOpacity="0.25"
          />
          {/* Animated Dashed Emergency Corridor Line */}
          <path
            d="M 80 150 C 220 50, 360 220, 560 90"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="animate-pulse"
          />
        </svg>

        {/* Pin 1: Origin Hospital */}
        <div className="absolute left-[8%] bottom-[22%] flex flex-col items-center group z-10">
          <div className="bg-emerald-600 text-white p-2 rounded-full shadow-lg border-2 border-white ring-4 ring-emerald-950">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="mt-1 bg-[#1c1917]/90 backdrop-blur-xs border border-[#292524] px-2 py-0.5 rounded-lg text-[10px] font-bold text-[#e7e5e4] font-mono shadow-md whitespace-nowrap">
            FROM: {origin}
          </div>
        </div>

        {/* Pin 2: Moving Ambulance Unit (Delivery Vehicle) */}
        <div className="absolute left-[50%] top-[35%] flex flex-col items-center animate-bounce z-20">
          <div className="bg-amber-500 text-[#0c0a09] p-2.5 rounded-full shadow-xl border-2 border-white ring-4 ring-amber-500/30">
            <Ambulance className="w-5 h-5" />
          </div>
          <div className="mt-1 bg-amber-500 text-[#0c0a09] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono shadow-lg flex items-center gap-1">
            <span>{ambId}</span>
            <span className="text-[9px] opacity-80">(ALS)</span>
          </div>
        </div>

        {/* Pin 3: Destination Hospital */}
        <div className="absolute right-[10%] top-[18%] flex flex-col items-center group z-10">
          <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white ring-4 ring-blue-950">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="mt-1 bg-[#1c1917]/90 backdrop-blur-xs border border-[#292524] px-2 py-0.5 rounded-lg text-[10px] font-bold text-white font-mono shadow-md whitespace-nowrap">
            TO: {target}
          </div>
        </div>
      </div>

      {/* Delivery App Driver & Unit Telemetry Footer Bar */}
      <div className="bg-[#1c1917] p-3 border-t border-[#292524] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Dispatched Unit:</span>
          <p className="font-bold text-white truncate">{ambId}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Driver On-Duty:</span>
          <p className="font-bold text-emerald-400 truncate">{driverName}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Emergency Lane:</span>
          <p className="font-bold text-amber-400 truncate">Green Corridor Active</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Reserved ICU Ward:</span>
          <p className="font-bold text-white truncate">Bed #ICU-04</p>
        </div>
      </div>
    </div>
  );
}

export function MainDashboard({ onNavigateToCriticalFind }) {
  const { referrals, isConnected, refreshAll, setLastNotification } = useWebSocket();
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('sending');
  const [decryptedPacket, setDecryptedPacket] = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sendingReferrals = referrals.filter(r => r.originHospitalId === 'hosp-a' || r.originHospitalId === 'hosp-d');
  const receivingReferrals = referrals.filter(r => r.targetHospitalId === 'hosp-b' || r.targetHospitalId === 'hosp-c');

  const displayedReferrals = activeSubTab === 'sending' ? sendingReferrals : receivingReferrals;

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshAll();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleOpenDetail = async (ref) => {
    setSelectedReferral(ref);
    setDecryptedPacket(null);

    setLoadingPacket(true);
    try {
      const res = await fetch(`/api/referrals/${ref.id}/packet`);
      if (res.ok) {
        const data = await res.json();
        setDecryptedPacket(data.decryptedPayload);
      }
    } catch (err) {
      console.error('Fetch packet error:', err);
    } finally {
      setLoadingPacket(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_TRANSIT':
        return <span className="eleven-badge bg-[#a8c8e8]/30 text-[#0c0a09] border-[#a8c8e8] flex items-center gap-1 font-mono tabular-nums"><Navigation className="w-3 h-3 text-[#2563eb]" aria-hidden="true" /> IN TRANSIT</span>;
      case 'RE_ROUTING':
        return <span className="eleven-badge bg-[#f4c5a8]/40 text-[#0c0a09] border-[#f4c5a8] flex items-center gap-1 animate-pulse font-mono tabular-nums"><AlertTriangle className="w-3 h-3 text-[#d97706]" aria-hidden="true" /> AUTO RE-ROUTING</span>;
      case 'RE_ROUTING_ESCALATED':
        return <span className="eleven-badge bg-[#e8b8c4]/40 text-[#dc2626] border-[#e8b8c4] flex items-center gap-1 font-mono tabular-nums"><AlertTriangle className="w-3 h-3 text-[#dc2626]" aria-hidden="true" /> ESCALATED TO CONTROL ROOM</span>;
      case 'ACCEPTED':
      case 'HOSPITAL_CONFIRMED':
        return <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] flex items-center gap-1 font-mono tabular-nums"><CheckCircle2 className="w-3 h-3 text-[#16a34a]" aria-hidden="true" /> HOSPITAL CONFIRMED</span>;
      case 'COMPLETED':
        return <span className="eleven-badge bg-[#f0efed] text-[#777169] border-[#e7e5e4] flex items-center gap-1 font-mono tabular-nums"><ShieldCheck className="w-3 h-3 text-[#16a34a]" aria-hidden="true" /> CLOSED & HANDED OVER</span>;
      default:
        return <span className="eleven-badge bg-[#c8b8e0]/30 text-[#0c0a09] border-[#c8b8e0] flex items-center gap-1 font-mono tabular-nums"><Clock className="w-3 h-3 text-[#292524]" aria-hidden="true" /> REQUEST SENT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Card */}
      {/* Combined Sub-tabs & Action Buttons Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e7e5e4] pb-3">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('sending')}
            aria-label={`View sending queue (${sendingReferrals.length} referrals)`}
            aria-current={activeSubTab === 'sending' ? 'true' : undefined}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
              activeSubTab === 'sending'
                ? 'bg-[#292524] text-white border-[#292524]'
                : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            <span>SENDING (<strong className="font-mono tabular-nums">{sendingReferrals.length}</strong>)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('receiving')}
            aria-label={`View receiving queue (${receivingReferrals.length} referrals)`}
            aria-current={activeSubTab === 'receiving' ? 'true' : undefined}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
              activeSubTab === 'receiving'
                ? 'bg-[#292524] text-white border-[#292524]'
                : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
            <span>RECEIVING (<strong className="font-mono tabular-nums">{receivingReferrals.length}</strong>)</span>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleRefresh}
            aria-label="Refresh referral queue data"
            className="eleven-button eleven-button-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Referral List with Smooth Tab Switching Animation */}
      <div 
        key={activeSubTab} 
        className="grid grid-cols-1 gap-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
      >
        {displayedReferrals.length === 0 ? (
          <div className="eleven-card p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#a8a29e] mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[#292524]">No Active Referrals in Queue</h3>
            <p className="text-xs text-[#777169] max-w-sm mx-auto">
              All patient transfers are completed or no referrals have been initiated.
            </p>
          </div>
        ) : (
          displayedReferrals.map((ref) => {
            const isRerouting = ref.status === 'RE_ROUTING';
            // Strip out " — Requires ..." suffix to leave pure clinical diagnosis
            const cleanDiagnosis = ref.requirementSummary
              ? ref.requirementSummary.split(' — ')[0].split(' - Requires')[0]
              : ref.requirementSummary;

            return (
              <div
                key={ref.id}
                className={`eleven-card p-6 space-y-4 bg-white border transition-all ${
                  isRerouting ? 'border-amber-400 bg-amber-50/20' : 'border-[#e7e5e4]'
                }`}
              >
                {/* 1. Header Row: Patient Code + Ambulance Unit */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0efed] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-xs font-bold text-[#0c0a09]">#{ref.patientRefCode}</span>
                  </div>

                  {ref.ambulance && (
                    <div className="flex items-center gap-1.5 text-xs text-[#292524] font-mono font-bold">
                      <Ambulance className="w-3.5 h-3.5 text-[#292524]" aria-hidden="true" />
                      <span>{ref.ambulance.id} ({ref.ambulance.type})</span>
                    </div>
                  )}
                </div>

                {/* 2. Patient Diagnosis / Condition */}
                <h3 className="text-base font-bold text-[#0c0a09] leading-snug">
                  {cleanDiagnosis}
                </h3>

                {/* 3. Required Resources Chips (Uniform color) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono font-bold text-[#777169] uppercase tracking-wider block">
                    Required Resources:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(ref.requiredResources || ['ICU_BED', 'VENTILATOR']).map((r, i) => (
                      <span key={`res-${i}`} className="px-2.5 py-1 rounded-xl bg-[#292524] text-white font-mono text-xs font-bold shadow-2xs">
                        [{r.replace('_BED', '').replace('_', ' ')}]
                      </span>
                    ))}
                    {(ref.requiredCapabilities || ['NEUROSURGERY', 'CT_SCAN']).map((c, i) => (
                      <span key={`cap-${i}`} className="px-2.5 py-1 rounded-xl bg-[#292524] text-white font-mono text-xs font-bold shadow-2xs">
                        [{c.replace('_', ' ')}]
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. Primary Problem Alert (If Destination Hospital lost capacity) */}
                {isRerouting && (
                  <div className="bg-[#f4c5a8]/30 border border-[#f4c5a8] p-3 rounded-2xl flex items-center justify-between text-xs text-[#0c0a09]">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#d97706] flex-shrink-0 animate-bounce" aria-hidden="true" />
                      <span>
                        <strong>⚠ Destination hospital ({ref.targetHospitalName}) lost capacity:</strong> [ICU / Ventilator Unavailable]
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-[#f4c5a8] text-[#0c0a09] font-bold px-2 py-0.5 rounded-full">
                      Auto-Rerouting
                    </span>
                  </div>
                )}

                {/* 5. Transfer Route & Doctor Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#f0efed]">
                  <div className="flex items-center gap-2 text-xs text-[#777169]">
                    <span className="font-mono font-bold text-[#4e4e4e]">Transfer:</span>
                    <span className="font-semibold text-[#292524]">{ref.originHospitalName}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#d6d3d1]" aria-hidden="true" />
                    <span className="font-extrabold text-[#0c0a09]">{ref.targetHospitalName}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isRerouting && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenDetail(ref); }}
                        className="eleven-button eleven-button-primary text-xs py-1.5 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
                      >
                        <span>Approve Redirect</span>
                      </button>
                    )}

                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDetail(ref); }}
                      aria-label={`View detail for referral #${ref.patientRefCode}`}
                      className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>View Details</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      {selectedReferral && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="eleven-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 space-y-6 bg-white border-[#d6d3d1]">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="modal-title" className="text-lg font-light text-[#0c0a09]">Referral Details</h2>
                  <span className="font-mono tabular-nums text-xs text-[#292524] bg-[#f5f5f5] border border-[#e7e5e4] px-2 py-0.5 rounded-full">
                    #{selectedReferral.patientRefCode}
                  </span>
                </div>
                <p className="text-xs text-[#777169] mt-0.5">
                  {selectedReferral.requirementSummary ? selectedReferral.requirementSummary.split(' — ')[0].split(' - Requires')[0] : ''}
                </p>
              </div>

              <button
                onClick={() => setSelectedReferral(null)}
                aria-label="Close modal"
                className="eleven-button eleven-button-secondary text-xs py-1 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                ✕ Close
              </button>
            </div>

            {selectedReferral.status === 'RE_ROUTING' && (
              <div className="bg-[#f4c5a8]/30 border border-[#f4c5a8] p-4 rounded-2xl flex items-center gap-3 text-[#0c0a09] text-xs" role="status" aria-live="polite">
                <AlertTriangle className="w-5 h-5 text-[#d97706] flex-shrink-0 animate-bounce" aria-hidden="true" />
                <div>
                  <h4 className="font-bold">AUTO RE-ROUTING IN PROGRESS</h4>
                  <p className="text-[#4e4e4e]">Capacity lost at destination. Recalculating candidate route from live ambulance GPS coordinates…</p>
                </div>
              </div>
            )}

            {/* Ambulance & Driver Telemetry */}
            {selectedReferral.ambulance && (
              <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Ambulance className="w-5 h-5 text-[#292524]" />
                  <div>
                    <span className="text-[#777169] text-[10px] block">Assigned Transport Unit:</span>
                    <p className="font-bold text-[#0c0a09]">{selectedReferral.ambulance.id} ({selectedReferral.ambulance.type})</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[#777169] text-[10px] block">Dispatched Driver:</span>
                  <p className="font-bold text-[#292524]">{selectedReferral.ambulance.driverName} ({selectedReferral.ambulance.driverPhone || '+91-99887-11223'})</p>
                </div>
              </div>
            )}

            {/* Delivery-App Live GPS Map */}
            <DeliveryLiveMap referral={selectedReferral} />

            {/* Decrypted Clinical Packet */}
            <div className="space-y-3">

              {loadingPacket ? (
                <div className="eleven-card p-6 text-center text-xs text-[#777169]" role="status" aria-live="polite">
                  Decrypting payload…
                </div>
              ) : decryptedPacket ? (
                <div className="eleven-card p-5 space-y-3 bg-[#fafafa] border-[#e7e5e4] text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-b border-[#e7e5e4] pb-3">
                    <div>
                      <span className="text-[#777169]">Patient:</span>
                      <p className="font-bold text-[#0c0a09]">{decryptedPacket.patientName} ({decryptedPacket.patientAge}y, {decryptedPacket.patientSex})</p>
                    </div>
                    <div>
                      <span className="text-[#777169]">Suspected Condition:</span>
                      <p className="font-bold text-[#2563eb]">{decryptedPacket.diagnosisSuspected}</p>
                    </div>
                    <div>
                      <span className="text-[#777169]">Referring Doctor:</span>
                      <p className="font-bold text-[#0c0a09]">{decryptedPacket.referringDoctorName}</p>
                    </div>
                    <div>
                      <span className="text-[#777169]">Reason for Transfer:</span>
                      <p className="font-bold text-[#d97706]">{decryptedPacket.reasonForReferral}</p>
                    </div>
                  </div>

                  {decryptedPacket.vitals && (
                    <div className="flex flex-wrap gap-2 text-[11px] font-mono tabular-nums">
                      <span className="font-bold text-[#777169]">Vitals:</span>
                      <span className="bg-white border border-[#e7e5e4] px-2 py-0.5 rounded-full text-[#292524]">BP: {decryptedPacket.vitals.bp}</span>
                      <span className="bg-white border border-[#e7e5e4] px-2 py-0.5 rounded-full text-[#292524]">HR: {decryptedPacket.vitals.hr} bpm</span>
                      <span className="bg-white border border-[#e7e5e4] px-2 py-0.5 rounded-full text-[#292524]">SpO2: {decryptedPacket.vitals.spo2}%</span>
                      <span className="bg-[#a7e5d3]/40 text-[#0c0a09] border border-[#a7e5d3] px-2 py-0.5 rounded-full font-bold">GCS: {decryptedPacket.vitals.gcs}/15</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[#777169] font-semibold">Clinical Summary:</span>
                    <p className="text-[#292524] mt-0.5 leading-relaxed">{decryptedPacket.clinicalSummary}</p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Delivery App Style Live Referral Progress Tracker */}
            <div className="space-y-4 pt-4 border-t border-[#e7e5e4]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="text-xs font-bold text-[#0c0a09] uppercase tracking-wider font-mono flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#292524]" aria-hidden="true" />
                    <span>Live Transfer Progress Tracker</span>
                  </h3>
                </div>

                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                  {selectedReferral.status === 'COMPLETED' ? '100% COMPLETE' : 'IN TRANSIT (80% COMPLETE)'}
                </span>
              </div>

              {/* Step-by-Step Delivery App Timeline */}
              <div className="relative pl-7 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-300">
                {(selectedReferral.events || []).map((evt, idx) => {
                  const total = selectedReferral.events.length;
                  const isLatest = idx === total - 1;

                  // Helper logic for human readable titles & descriptions
                  const type = evt.eventType;
                  const meta = evt.metadata || {};
                  let title = type.replace(/_/g, ' ');
                  let description = meta.note || meta.reason || 'Step logged on live network stream.';

                  if (type === 'CREATED') {
                    title = 'Referral Request Logged';
                    description = meta.note || 'Emergency Nurse Coordinator created initial transfer request and clinical requirements.';
                  } else if (type === 'MATCHED') {
                    const topScore = meta.topMatchScore ? ` (${Math.round(meta.topMatchScore * 100)}% match score)` : '';
                    title = 'Optimal Hospital Matched';
                    description = `Matched with candidate receiving facility${topScore} based on real-time bed capacity.`;
                  } else if (type === 'REQUEST_SENT') {
                    title = 'Bed Hold Request Dispatched';
                    description = `Transfer hold request dispatched to ${meta.targetHospital || 'City Super Specialty Hospital'} for ${meta.heldResource || 'ICU Bed'}.`;
                  } else if (type === 'ACCEPTED' || type === 'CONFIRMED') {
                    const officer = meta.confirmedBy ? ` (${meta.confirmedBy})` : '';
                    title = 'Bed Reserved & Confirmed';
                    description = `Receiving hospital bed desk officer${officer} confirmed bed availability and locked hold.`;
                  } else if (type === 'DISPATCHED' || type === 'AMBULANCE_ASSIGNED') {
                    const amb = meta.ambulanceId ? ` (${meta.ambulanceId.toUpperCase()})` : '';
                    const drv = meta.driver ? ` with Driver ${meta.driver}` : '';
                    title = 'Ambulance En-Route';
                    description = `Advanced Life Support Unit${amb} dispatched${drv}. Live GPS tracking active.`;
                  } else if (type === 'RE_ROUTING') {
                    title = 'Auto-Rerouting Triggered';
                    description = meta.reason || 'Target hospital capacity altered mid-transit. Recalculating candidate destination.';
                  } else if (type === 'COMPLETED') {
                    title = 'Patient Handover Complete';
                    description = 'Patient safely received and admitted to receiving ICU facility.';
                  }

                  return (
                    <div key={evt.id || idx} className="relative flex items-start gap-3">
                      {/* Step Status Node Indicator */}
                      <div className={`absolute -left-7 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                        isLatest
                          ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100 animate-pulse'
                          : 'bg-emerald-500 text-white border-emerald-500'
                      }`}>
                        ✓
                      </div>

                      {/* Event Detail Card */}
                      <div className={`eleven-card p-3.5 w-full transition-all border ${
                        isLatest ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs' : 'bg-[#fafafa] border-[#e7e5e4]'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#0c0a09] flex items-center gap-1.5">
                            {title}
                            {isLatest && (
                              <span className="text-[9px] bg-emerald-600 text-white font-mono font-bold px-1.5 py-0.2 rounded-full uppercase">
                                Active Step
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-[11px] text-[#777169] tabular-nums">
                            {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-[#4e4e4e] mt-1 leading-relaxed">{description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
