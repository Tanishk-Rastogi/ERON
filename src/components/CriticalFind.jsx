import React, { useState, useEffect } from 'react';
import { apiClient } from '../utils/apiClient.js';
import { useWebSocket } from '../context/WebSocketContext';
import {
  Clock, ShieldAlert, Send, SlidersHorizontal, ChevronRight,
  User, KeyRound, Fingerprint, Copy, Check, ShieldCheck, Lock,
  AlertCircle, Loader2, Sparkles
} from 'lucide-react';
import { PatientRegistrationModal } from './PatientRegistrationModal.jsx';

// ─── Small inline patient key chip shown after successful dispatch ─────────────
function PatientKeyChip({ patientKey }) {
  const [copied, setCopied] = useState(false);
  if (!patientKey) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(patientKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
      <Fingerprint className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-emerald-600 font-mono uppercase tracking-wider font-bold">Patient Key (HMAC-SHA256)</p>
        <p className="text-[11px] font-mono text-emerald-800 font-bold truncate">
          {patientKey.substring(0, 12)}...{patientKey.substring(56)}
        </p>
      </div>
      <button
        onClick={handleCopy}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border shrink-0 ${
          copied
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'
        }`}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Patient summary banner shown after registration ──────────────────────────
function ActivePatientBanner({ patient, onEdit }) {
  if (!patient) return null;
  return (
    <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] rounded-2xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{patient.patientName}</span>
            <span className="text-[10px] text-[#a8a29e]">{patient.patientAge}y · {patient.patientSex}</span>
            <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
              patient.priority === 'CRITICAL' ? 'bg-red-500 animate-pulse' :
              patient.priority === 'URGENT'   ? 'bg-amber-500' : 'bg-blue-600'
            }`}>{patient.priority}</span>
          </div>
          <p className="text-[11px] text-emerald-300 mt-0.5">{patient.diagnosisSuspected}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/40 px-2.5 py-1.5 rounded-xl">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-300 font-mono">AES-256-GCM</span>
        </div>
        <button
          onClick={onEdit}
          className="text-[10px] font-bold text-[#a8a29e] hover:text-white px-2.5 py-1.5 rounded-xl border border-white/10 hover:border-white/30 transition-all"
        >
          Edit Patient
        </button>
      </div>
    </div>
  );
}

export function CriticalFind({ onReferralCreated }) {
  const { refreshAll } = useWebSocket();

  // ── Requirements state (drives hospital matching) ──────────────────────────
  const [selectedCapabilities, setSelectedCapabilities] = useState(['NEUROSURGERY', 'CT_SCAN']);
  const [selectedResources, setSelectedResources]       = useState(['ICU_BED', 'VENTILATOR']);
  const [priority, setPriority]                         = useState('CRITICAL');
  const [patientSummary, setPatientSummary]              = useState('Acute Traumatic Brain Injury — Requires ICU + Neurosurgeon + Ventilator + CT');

  // ── Patient registration state ─────────────────────────────────────────────
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registeredPatient, setRegisteredPatient]     = useState(null); // filled after PatientRegistrationModal

  // ── Matching state ─────────────────────────────────────────────────────────
  const [matches, setMatches]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  // ── Dispatch state ─────────────────────────────────────────────────────────
  const [creating, setCreating]       = useState(false);
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatchedKey, setDispatchedKey] = useState(null); // patientKey from server after dispatch

  // ── AI extract state ───────────────────────────────────────────────────────
  const [extracting, setExtracting] = useState(false);

  const capabilityOptions = [
    { id: 'NEUROSURGERY', label: 'Neurosurgery' },
    { id: 'CT_SCAN',      label: 'CT Scan' },
    { id: 'ICU',          label: 'ICU Unit' },
    { id: 'VENTILATOR',   label: 'Ventilator Support' },
    { id: 'CARDIOLOGY',   label: 'Cardiology' },
    { id: 'TRAUMA_OT',    label: 'Trauma OT' }
  ];

  const resourceOptions = [
    { id: 'ICU_BED',     label: 'ICU Bed' },
    { id: 'VENTILATOR',  label: 'Ventilator' },
    { id: 'CT_SCAN',     label: 'CT Scanner' },
    { id: 'GENERAL_BED', label: 'General Bed' }
  ];

  // ── Sync priority from registered patient ─────────────────────────────────
  useEffect(() => {
    if (registeredPatient?.priority) setPriority(registeredPatient.priority);
    if (registeredPatient?.requiredEquipment?.length) {
      // Map equipment names to resource/capability IDs where possible
      const eqUpper = registeredPatient.requiredEquipment.map(e => e.toUpperCase().replace(/ /g, '_'));
      const newCaps = eqUpper.filter(e => capabilityOptions.some(c => c.id === e));
      const newRes  = eqUpper.filter(e => resourceOptions.some(r => r.id === e || r.id === e + '_BED'));
      if (newCaps.length) setSelectedCapabilities(newCaps);
      if (newRes.length)  setSelectedResources(newRes);
    }
  }, [registeredPatient]);

  const handleExtract = async () => {
    if (!patientSummary.trim()) return;
    setExtracting(true);
    try {
      const res = await apiClient('/api/referrals/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: patientSummary })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requiredCapabilities) setSelectedCapabilities(data.requiredCapabilities);
        if (data.requiredResources)    setSelectedResources(data.requiredResources);
        if (data.priority)             setPriority(data.priority);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await apiClient('/api/referrals/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredCapabilities: selectedCapabilities, requiredResources: selectedResources, priority })
      });
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
      }
    } catch (err) {
      console.error('Match error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, [selectedCapabilities, selectedResources, priority]);

  const toggleCapability = (id) =>
    setSelectedCapabilities(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  const toggleResource = (id) =>
    setSelectedResources(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);

  // ── Called when user clicks "Select Hospital" on a candidate ──────────────
  const handleSelectCandidate = (cand) => {
    if (!registeredPatient) {
      // Force patient registration first
      setIsRegisterModalOpen(true);
      // Store pending candidate to select after registration
      setPendingCandidate(cand);
    } else {
      setSelectedCandidate(cand);
    }
  };

  const [pendingCandidate, setPendingCandidate] = useState(null);

  // Called by PatientRegistrationModal
  const handlePatientRegistered = async (formData) => {
    setRegisteredPatient(formData);
    // If there was a pending candidate, auto-select it
    if (pendingCandidate) {
      setSelectedCandidate(pendingCandidate);
      setPendingCandidate(null);
    }
    return { patientKey: null }; // real key comes from server on dispatch
  };

  // ── Final dispatch to /api/referrals ──────────────────────────────────────
  const handleSendReferral = async () => {
    if (!selectedCandidate) return;
    if (!registeredPatient) { setIsRegisterModalOpen(true); return; }

    setCreating(true);
    setDispatchError(null);

    try {
      const res = await apiClient('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHospitalId:    selectedCandidate.hospitalId,
          requirementSummary:  patientSummary,
          requiredCapabilities: selectedCapabilities,
          requiredResources:   selectedResources,
          priority,
          timeoutMinutes:      registeredPatient.timeoutMinutes || 5,
          patientData: {
            patientName:         registeredPatient.patientName,
            patientAge:          registeredPatient.patientAge,
            patientSex:          registeredPatient.patientSex,
            diagnosisSuspected:  registeredPatient.diagnosisSuspected,
            clinicalSummary:     patientSummary,
            patientPhone:        registeredPatient.patientPhone,
            phoneOwner:          registeredPatient.phoneOwner,
            vitals:              registeredPatient.vitals || { bp: '—', hr: null, spo2: null, rr: null, gcs: null },
            referringDoctorName: registeredPatient.referringDoctorName || 'Duty Doctor',
            reasonForReferral:   `No matching specialist/facility available at origin hospital`,
            treatmentGiven:      '—',
            allergies:           [],
            medications:         []
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Capture patient key returned by server
        if (data?.patientKey) setDispatchedKey(data.patientKey);
        setSelectedCandidate(null);
        refreshAll();
        if (onReferralCreated) onReferralCreated();
      } else {
        const err = await res.json().catch(() => ({}));
        setDispatchError(err.error || 'Failed to create referral. Please try again.');
      }
    } catch (err) {
      console.error('Create referral error:', err);
      setDispatchError('Network error. Please check connection and retry.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* ── Active patient banner (shows after registration) ── */}
      {registeredPatient ? (
        <ActivePatientBanner
          patient={registeredPatient}
          onEdit={() => setIsRegisterModalOpen(true)}
        />
      ) : (
        <div className="bg-white border-2 border-dashed border-[#d6d3d1] rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fafafa] border border-[#e7e5e4] flex items-center justify-center">
              <User className="w-5 h-5 text-[#a8a29e]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#0c0a09]">No patient registered yet</p>
              <p className="text-xs text-[#777169] mt-0.5">Register the patient first to generate their encrypted key, then select a hospital to dispatch.</p>
            </div>
          </div>
          <button
            onClick={() => setIsRegisterModalOpen(true)}
            className="px-4 py-2.5 bg-[#292524] text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-black transition-colors shrink-0"
          >
            <User className="w-3.5 h-3.5" />
            Register Patient
          </button>
        </div>
      )}

      {/* ── Dispatched key display ── */}
      {dispatchedKey && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono">Referral Dispatched · Patient Key</p>
          <PatientKeyChip patientKey={dispatchedKey} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Requirements sidebar ── */}
        <div className="eleven-card p-6 space-y-5 lg:col-span-1 bg-white">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#777169] font-mono flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#292524]" aria-hidden="true" />
            <span>Select Requirements</span>
          </h2>

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Priority Tier:</label>
            <div className="grid grid-cols-3 gap-2">
              {['CRITICAL', 'URGENT', 'STABLE'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  aria-pressed={priority === p}
                  className={`py-2 px-2 text-xs font-semibold rounded-full transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                    priority === p
                      ? p === 'CRITICAL' ? 'bg-[#dc2626] text-white border-[#dc2626]' : 'bg-[#d97706] text-white border-[#d97706]'
                      : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Capabilities */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Clinical Capabilities:</label>
            <div className="flex flex-wrap gap-1.5">
              {capabilityOptions.map(c => {
                const active = selectedCapabilities.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCapability(c.id)}
                    aria-pressed={active}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                      active
                        ? 'bg-[#292524] text-white border-[#292524]'
                        : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resources */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Resource Units:</label>
            <div className="flex flex-wrap gap-1.5">
              {resourceOptions.map(r => {
                const active = selectedResources.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleResource(r.id)}
                    aria-pressed={active}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                      active
                        ? 'bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] font-bold'
                        : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clinical summary + AI extract */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="patient-summary" className="text-xs font-semibold text-[#4e4e4e]">Clinical Case Summary:</label>
              <button
                onClick={handleExtract}
                disabled={extracting}
                className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1"
              >
                {extracting
                  ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Extracting…</>
                  : <><Sparkles className="w-2.5 h-2.5" /> Auto-Extract (AI)</>
                }
              </button>
            </div>
            <textarea
              id="patient-summary"
              value={patientSummary}
              onChange={(e) => setPatientSummary(e.target.value)}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-xs text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] focus:bg-white resize-none"
            />
          </div>

          {/* Register patient CTA if not done */}
          {!registeredPatient && (
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Register Patient & Generate Key
            </button>
          )}
        </div>

        {/* ── Candidate list ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#777169] uppercase tracking-widest font-mono">
              Ranked Candidate Hospitals (<span className="tabular-nums">{matches.length}</span>)
            </h2>
            <span className="text-xs text-[#777169]">
              Sorted by: <strong className="text-[#0c0a09]">Telemetry Score</strong>
            </span>
          </div>

          {loading ? (
            <div className="eleven-card p-12 text-center text-xs text-[#777169]" role="status" aria-live="polite">
              Calculating candidate scores…
            </div>
          ) : matches.length === 0 ? (
            <div className="eleven-card p-12 text-center text-xs text-[#777169] space-y-2">
              <ShieldAlert className="w-10 h-10 text-[#dc2626] mx-auto" aria-hidden="true" />
              <h3 className="font-semibold text-[#0c0a09]">No Candidate Matches</h3>
              <p className="max-w-md mx-auto">No active hospital satisfies all selected clinical requirements with available capacity.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((cand, idx) => (
                <div key={cand.hospitalId} className="eleven-card p-6 space-y-3 bg-white hover:border-[#292524]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full font-mono tabular-nums font-bold text-xs flex items-center justify-center border flex-shrink-0 ${
                        idx === 0 ? 'bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3]' : 'bg-[#f5f5f5] text-[#777169] border-[#e7e5e4]'
                      }`}>
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[#0c0a09] flex items-center gap-2 truncate">
                          <span className="truncate">{cand.hospitalName}</span>
                          {idx === 0 && (
                            <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] flex-shrink-0">TOP MATCH</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-[#0c0a09] font-mono tabular-nums">
                        {(cand.score * 100).toFixed(0)}%{' '}
                        <span className="text-xs font-normal text-[#777169]">match</span>
                      </div>
                      <span className="text-xs text-[#16a34a] font-semibold flex items-center justify-end gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-[#16a34a]" aria-hidden="true" />
                        ETA: {cand.etaMinutes} mins ({cand.distanceKm} km)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#f0efed] gap-2 text-xs">
                    <div className="flex flex-wrap gap-2 font-mono tabular-nums">
                      {cand.availableResources.map((res, rIdx) => (
                        <span key={rIdx} className="eleven-pill bg-[#f5f5f5] text-[#292524]">
                          {res.type}: <strong className="text-[#16a34a]">{res.available} free</strong> / {res.total}
                        </span>
                      ))}
                      {cand.hasSpecialistOnCall && (
                        <span className="eleven-pill bg-[#a8c8e8]/30 text-[#0c0a09] border-[#a8c8e8] font-sans">
                          ✓ Specialist On-Call
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleSelectCandidate(cand)}
                      className="eleven-button eleven-button-primary text-xs py-1.5 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
                    >
                      <span>Select Hospital</span>
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Patient Registration Modal ── */}
      <PatientRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => { setIsRegisterModalOpen(false); setPendingCandidate(null); }}
        onSubmit={handlePatientRegistered}
        initialValues={registeredPatient || {}}
      />

      {/* ── Confirmation / Dispatch Modal ── */}
      {selectedCandidate && (
        <div
          className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div className="eleven-card w-full max-w-xl p-6 space-y-5 bg-white border-[#d6d3d1]">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div>
                <h3 id="confirm-modal-title" className="text-base font-bold text-[#0c0a09]">Confirm Referral Dispatch</h3>
                <p className="text-xs text-[#777169] mt-0.5">
                  Places soft-hold on bed · notifies receiving desk · writes to blockchain audit chain
                </p>
              </div>
              <button
                onClick={() => { setSelectedCandidate(null); setDispatchError(null); }}
                aria-label="Close modal"
                className="eleven-button eleven-button-secondary py-1 px-2 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Patient + hospital summary */}
            <div className="space-y-2">
              {/* Patient row */}
              {registeredPatient && (
                <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#777169]" />
                    <div>
                      <p className="font-bold text-[#0c0a09]">{registeredPatient.patientName}</p>
                      <p className="text-[#777169]">{registeredPatient.patientAge}y · {registeredPatient.patientSex} · {registeredPatient.diagnosisSuspected}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold ${
                    registeredPatient.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                    registeredPatient.priority === 'URGENT'   ? 'bg-amber-100 text-amber-700' :
                                                                 'bg-blue-100 text-blue-700'
                  }`}>{registeredPatient.priority}</span>
                </div>
              )}

              {/* Hospital + details */}
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#777169]">Target Hospital:</span>
                  <strong className="text-[#0c0a09]">{selectedCandidate.hospitalName}</strong>
                </div>
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <span className="text-[#777169] font-sans">Travel ETA:</span>
                  <strong className="text-[#16a34a]">{selectedCandidate.etaMinutes} mins ({selectedCandidate.distanceKm} km)</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#777169]">Soft-Hold Resources:</span>
                  <strong className="text-[#292524] font-mono">{selectedResources.join(', ')}</strong>
                </div>
              </div>
            </div>

            {/* Encryption / security indicators */}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { icon: Lock,         color: 'emerald', label: 'Encryption',   value: 'AES-256-GCM' },
                { icon: KeyRound,     color: 'blue',    label: 'Patient Key',  value: 'HMAC-SHA256' },
                { icon: ShieldCheck,  color: 'purple',  label: 'Audit Chain',  value: 'Blockchain ✓' },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-2.5`}>
                  <Icon className={`w-3.5 h-3.5 text-${color}-600 mx-auto mb-0.5`} />
                  <p className={`text-[9px] font-bold text-${color}-700 uppercase tracking-wide`}>{label}</p>
                  <p className={`text-[10px] font-mono font-bold text-${color}-800`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Error message */}
            {dispatchError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {dispatchError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#e7e5e4]">
              <button
                onClick={() => { setSelectedCandidate(null); setDispatchError(null); }}
                className="eleven-button eleven-button-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendReferral}
                disabled={creating}
                className="eleven-button eleven-button-primary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] disabled:opacity-60"
              >
                {creating
                  ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Dispatching…</>
                  : <><Send className="w-4 h-4" aria-hidden="true" /> Dispatch Referral (Soft-Hold)</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
