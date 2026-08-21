/**
 * ReferralStatusDashboard.jsx
 *
 * Full-screen modal dashboard opened when Hospital A clicks "View Status" on an
 * accepted referral notification, or when a profile log entry is clicked.
 *
 * Shows:
 *   - Status strip (colour-coded, animated for active states)
 *   - Key live numbers: vitals from decrypted packet, ETA, patient key
 *   - Rejection info panel (if status === REJECTED)
 *   - Reroute panel with top hospital suggestions (for active/stuck referrals)
 *   - Timeline of events
 *
 * Props:
 *   referral      – referral object from WebSocketContext
 *   authSession   – { hospitalId, hospitalName }
 *   onClose       – () => void
 */

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/apiClient.js';
import { useWebSocket } from '../context/WebSocketContext';
import {
  X, AlertTriangle, CheckCircle2, Navigation, Clock, ShieldCheck,
  Activity, Heart, Wind, Thermometer, Brain, Fingerprint, Lock,
  RotateCcw, ChevronRight, Building2, Loader2, MapPin, Ambulance,
  AlertCircle, ArrowRight, RefreshCw, Shield
} from 'lucide-react';

// ── Status strip config ────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  REQUEST_SENT:       { label: 'Request Sent',         color: 'blue',   icon: Clock,         pulse: false },
  PENDING_MATCH:      { label: 'Matching Hospitals…',  color: 'purple', icon: Clock,         pulse: true  },
  ACCEPTED:           { label: 'Accepted',             color: 'emerald',icon: CheckCircle2,  pulse: false },
  HOSPITAL_CONFIRMED: { label: 'Hospital Confirmed',   color: 'emerald',icon: CheckCircle2,  pulse: false },
  IN_TRANSIT:         { label: 'Ambulance En Route',   color: 'indigo', icon: Navigation,    pulse: true  },
  RE_ROUTED:          { label: 'Auto-Rerouted',        color: 'amber',  icon: AlertTriangle, pulse: true  },
  COMPLETED:          { label: 'Completed & Closed',   color: 'gray',   icon: ShieldCheck,   pulse: false },
  REJECTED:           { label: 'Rejected',             color: 'red',    icon: AlertCircle,   pulse: false },
};

const STEPS = [
  { key: 'REQUEST_SENT',       label: '1. Request Sent' },
  { key: 'HOSPITAL_CONFIRMED', label: '2. Accepted' },
  { key: 'IN_TRANSIT',         label: '3. En Route' },
  { key: 'COMPLETED',          label: '4. Handover Done' },
];

const STEP_ORDER = { REQUEST_SENT: 0, PENDING_MATCH: 0, ACCEPTED: 1, HOSPITAL_CONFIRMED: 1, IN_TRANSIT: 2, COMPLETED: 3, RE_ROUTED: 2, REJECTED: -1 };

// ── Vital number card ─────────────────────────────────────────────────────────
function VitalCard({ label, value, unit, icon: Icon, alert = false }) {
  if (!value && value !== 0) return null;
  return (
    <div className={`rounded-xl p-3 border text-center space-y-1 ${alert ? 'bg-red-50 border-red-200' : 'bg-[#fafafa] border-[#e7e5e4]'}`}>
      <Icon className={`w-4 h-4 mx-auto ${alert ? 'text-red-500' : 'text-[#a8a29e]'}`} />
      <p className={`text-lg font-black font-mono ${alert ? 'text-red-700' : 'text-[#0c0a09]'}`}>{value}</p>
      <p className="text-[9px] text-[#777169] font-bold uppercase tracking-wide">{label}</p>
      {unit && <p className="text-[9px] text-[#a8a29e] font-mono">{unit}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ReferralStatusDashboard({ referral: initialReferral, authSession, onClose }) {
  const { referrals, hospitals } = useWebSocket();

  // Always use the latest version from WS context
  const referral = referrals.find(r => r.id === initialReferral?.id) || initialReferral;

  const [packet, setPacket]             = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);
  const [rerouteMatches, setRerouteMatches] = useState([]);
  const [loadingReroute, setLoadingReroute] = useState(false);
  const [rerouteOpen, setRerouteOpen]    = useState(false);
  const [rerouting, setRerouting]        = useState(null); // hospitalId being selected

  // ── Load decrypted packet ──────────────────────────────────────────────────
  const loadPacket = useCallback(async () => {
    if (!referral?.id) return;
    setLoadingPacket(true);
    try {
      const res = await apiClient(`/api/referrals/${referral.id}/packet`);
      if (res.ok) {
        const data = await res.json();
        setPacket(data.patientData || data.decryptedPayload || null);
      }
    } catch (e) { console.error('Packet load error:', e); }
    finally { setLoadingPacket(false); }
  }, [referral?.id]);

  useEffect(() => { loadPacket(); }, [loadPacket]);

  // ── Load reroute candidates ─────────────────────────────────────────────────
  const loadRerouteMatches = async () => {
    setLoadingReroute(true);
    setRerouteOpen(true);
    try {
      const res = await apiClient('/api/referrals/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requiredCapabilities: referral?.requiredCapabilities || [],
          requiredResources:    referral?.requiredResources    || [],
          originHospitalId:     referral?.originHospitalId,
          priority:             packet?.priority || 'URGENT'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRerouteMatches((data.matches || []).slice(0, 5));
      }
    } catch (e) { console.error('Reroute match error:', e); }
    finally { setLoadingReroute(false); }
  };

  // ── Trigger reroute to a new hospital ──────────────────────────────────────
  const handleReroute = async (hospitalId) => {
    if (!referral?.id) return;
    setRerouting(hospitalId);
    try {
      await apiClient('/api/referrals/simulate-capacity-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralId: referral.id })
      });
    } catch (e) { console.error('Reroute error:', e); }
    finally { setRerouting(null); setRerouteOpen(false); }
  };

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!referral) return null;

  const cfg          = STATUS_CONFIG[referral.status] || STATUS_CONFIG.REQUEST_SENT;
  const StatusIcon   = cfg.icon;
  const currentStep  = STEP_ORDER[referral.status] ?? 0;
  const isRejected   = referral.status === 'REJECTED';
  const isActive     = !['COMPLETED', 'REJECTED'].includes(referral.status);
  const vitals       = packet?.vitals;
  const patientName  = packet?.patientName || referral.patientData?.patientName || 'Patient';
  const diagnosis    = packet?.diagnosisSuspected || referral.patientData?.diagnosisSuspected || referral.requirementSummary || '—';

  return (
    <div
      className="fixed inset-0 z-[9995] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsd-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-4 flex flex-col max-h-[92vh]">

        {/* ── Header ── */}
        <div className={`bg-gradient-to-r ${
          isRejected ? 'from-red-800 to-red-700' :
          cfg.color === 'emerald' ? 'from-emerald-800 to-emerald-700' :
          cfg.color === 'indigo'  ? 'from-indigo-800 to-indigo-700' :
          cfg.color === 'amber'   ? 'from-amber-700 to-amber-600' :
          'from-[#1c1917] to-[#292524]'
        } px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
              <StatusIcon className={`w-5 h-5 text-white ${cfg.pulse ? 'animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <h2 id="rsd-title" className="text-sm font-extrabold text-white truncate">
                {patientName} — {cfg.label}
              </h2>
              <p className="text-[11px] text-white/70 mt-0.5 truncate">
                #{referral.patientRefCode} · {referral.originHospitalName} → {referral.targetHospitalName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── 1. STATUS STRIP ── */}
          {!isRejected && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono">Transfer Status</p>
              <div className="relative flex items-center gap-0">
                {STEPS.map((step, idx) => {
                  const done    = currentStep > idx;
                  const current = currentStep === idx;
                  const isLast  = idx === STEPS.length - 1;
                  return (
                    <React.Fragment key={step.key}>
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ minWidth: 72 }}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                          done    ? 'bg-emerald-600 border-emerald-600 text-white' :
                          current ? 'bg-white border-emerald-500 text-emerald-600 ring-4 ring-emerald-100' :
                                    'bg-white border-[#e7e5e4] text-[#a8a29e]'
                        } ${current && cfg.pulse ? 'animate-pulse' : ''}`}>
                          {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[11px] font-bold">{idx + 1}</span>}
                        </div>
                        <p className={`text-[9px] text-center font-bold leading-tight ${
                          current ? 'text-emerald-700' : done ? 'text-[#292524]' : 'text-[#a8a29e]'
                        }`}>{step.label}</p>
                      </div>
                      {!isLast && (
                        <div className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-[#e7e5e4]'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {referral.status === 'RE_ROUTED' && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span><strong>Auto-rerouted</strong> — Original destination lost capacity. Ambulance redirected to {referral.targetHospitalName}.</span>
                </div>
              )}
            </div>
          )}

          {/* ── 2. REJECTION PANEL ── */}
          {isRejected && (
            <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden">
              <div className="bg-red-600 px-5 py-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-100" />
                <span className="text-sm font-bold text-white">Referral Rejected</span>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-red-100 rounded-xl p-3">
                    <p className="text-[10px] text-red-500 font-mono uppercase mb-1">Rejected by</p>
                    <p className="font-bold text-[#0c0a09]">{referral.rejectedByName || referral.targetHospitalName || '—'}</p>
                  </div>
                  <div className="bg-white border border-red-100 rounded-xl p-3">
                    <p className="text-[10px] text-red-500 font-mono uppercase mb-1">Time</p>
                    <p className="font-bold font-mono text-[#0c0a09]">
                      {referral.createdAt ? new Date(referral.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </p>
                  </div>
                </div>
                <div className="bg-white border border-red-200 rounded-xl p-4">
                  <p className="text-[10px] text-red-500 font-mono uppercase mb-2">Reason given</p>
                  <p className="text-[#292524] leading-relaxed font-medium">
                    {referral.rejectionReason || 'No reason provided'}
                  </p>
                </div>
                <p className="text-[#777169] leading-relaxed">
                  You can reroute this patient to another available hospital using the reroute option below.
                </p>
              </div>
            </div>
          )}

          {/* ── 3. PATIENT & VITALS ── */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono">Patient Overview</p>

            {/* Patient identity row */}
            <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-[#0c0a09]">{patientName}</p>
                <p className="text-xs text-[#777169] mt-0.5">
                  {packet?.patientAge && `${packet.patientAge}y`}
                  {packet?.patientSex && ` · ${packet.patientSex}`}
                  {packet?.patientAge && ' · '}
                  <span className="text-blue-700 font-semibold">{diagnosis}</span>
                </p>
              </div>
              {referral.patientKey && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 shrink-0">
                  <Fingerprint className="w-3 h-3 text-emerald-600" />
                  <span className="font-mono text-[10px] text-emerald-800 font-bold">
                    {referral.patientKey.substring(0, 10)}…
                  </span>
                  <Lock className="w-2.5 h-2.5 text-emerald-500" />
                </div>
              )}
            </div>

            {/* Vitals grid */}
            {loadingPacket ? (
              <div className="flex items-center gap-2 text-xs text-[#777169] py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Decrypting clinical packet…
              </div>
            ) : vitals ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <VitalCard label="Blood Pressure" value={vitals.bp}   icon={Activity}    />
                <VitalCard label="Heart Rate"     value={vitals.hr}   unit="bpm" icon={Heart}     alert={vitals.hr > 120 || vitals.hr < 50} />
                <VitalCard label="SpO₂"           value={vitals.spo2 ? `${vitals.spo2}%` : null} icon={Wind} alert={vitals.spo2 < 90} />
                <VitalCard label="Resp Rate"      value={vitals.rr}   unit="/min" icon={Wind}     />
                <VitalCard label="GCS Score"      value={vitals.gcs ? `${vitals.gcs}/15` : null} icon={Brain} alert={vitals.gcs <= 8} />
              </div>
            ) : packet ? (
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl px-4 py-3 text-xs text-[#777169]">
                No vitals recorded in this referral packet.
              </div>
            ) : null}
          </div>

          {/* ── 4. ROUTE INFO ── */}
          <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-[10px] text-[#777169] font-mono uppercase mb-1">Origin Hospital</p>
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#a8a29e]" />
                <span className="font-bold text-[#0c0a09]">{referral.originHospitalName || '—'}</span>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-[#d6d3d1]" />
            </div>
            <div>
              <p className="text-[10px] text-[#777169] font-mono uppercase mb-1">
                {isRejected ? 'Rejected by' : 'Target Hospital'}
              </p>
              <div className="flex items-center gap-1.5">
                <Building2 className={`w-3.5 h-3.5 ${isRejected ? 'text-red-400' : 'text-[#a8a29e]'}`} />
                <span className={`font-bold ${isRejected ? 'text-red-700' : 'text-[#0c0a09]'}`}>
                  {referral.targetHospitalName || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* ── 5. REROUTE SECTION ── (for active + rejected) ── */}
          {(isActive || isRejected) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono">
                  {isRejected ? 'Reroute Patient' : 'Reroute Options'}
                </p>
                {!rerouteOpen && (
                  <button
                    onClick={loadRerouteMatches}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#292524] hover:bg-black text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isRejected ? 'Find Another Hospital' : 'Show Reroute Options'}</span>
                  </button>
                )}
              </div>

              {rerouteOpen && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  {loadingReroute ? (
                    <div className="flex items-center gap-2 text-xs text-[#777169] py-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> Finding best available hospitals…
                    </div>
                  ) : rerouteMatches.length === 0 ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      No hospitals with matching capacity found. Contact district authority.
                    </div>
                  ) : (
                    rerouteMatches.map((cand, idx) => (
                      <div
                        key={cand.hospitalId}
                        className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border text-xs transition-all ${
                          idx === 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-[#fafafa] border-[#e7e5e4]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                            idx === 0 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-[#777169] border-[#e7e5e4]'
                          }`}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#0c0a09] truncate">{cand.hospitalName}</p>
                            <p className="text-[#777169] font-mono tabular-nums">
                              {cand.distanceKm} km · ETA {cand.etaMinutes} mins · Score {(cand.score * 100).toFixed(0)}%
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleReroute(cand.hospitalId)}
                          disabled={!!rerouting}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold transition-all shrink-0 ${
                            idx === 0
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-white border border-[#e7e5e4] text-[#292524] hover:border-[#292524]'
                          } disabled:opacity-50`}
                        >
                          {rerouting === cand.hospitalId
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><RotateCcw className="w-3.5 h-3.5" /><span>Reroute</span></>
                          }
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => setRerouteOpen(false)}
                    className="text-[10px] text-[#777169] hover:text-[#0c0a09] transition-colors"
                  >
                    ↑ Collapse
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 6. REQUIRED RESOURCES ── */}
          {referral.requiredCapabilities?.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono">Required Resources</p>
              <div className="flex flex-wrap gap-1.5">
                {referral.requiredCapabilities.map((cap, i) => (
                  <span key={i} className="px-2.5 py-1 bg-[#292524] text-white font-mono text-[10px] font-bold rounded-lg">
                    {cap.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── 7. SECURITY INDICATORS ── */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[#f0efed]">
            {[
              { icon: Lock,    label: 'AES-256-GCM Encrypted',  color: 'emerald' },
              { icon: Shield,  label: 'Blockchain Audit Chain',  color: 'blue'    },
              { icon: Fingerprint, label: 'HMAC Patient Key',   color: 'purple'  },
            ].map(({ icon: Icon, label, color }) => (
              <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-mono text-${color}-700 bg-${color}-50 border border-${color}-200 px-2 py-1 rounded-lg font-bold`}>
                <Icon className="w-2.5 h-2.5" />{label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 bg-[#fafafa] border-t border-[#e7e5e4] flex items-center justify-between shrink-0">
          <p className="text-[10px] text-[#a8a29e] font-mono truncate">
            Ref: {referral.patientRefCode} · Created {referral.createdAt ? new Date(referral.createdAt).toLocaleString('en-IN') : '—'}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs hover:bg-[#f5f5f5] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
