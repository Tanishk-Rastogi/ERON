import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Compass, 
  Clock, 
  ShieldAlert, 
  Send,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react';

export function CriticalFind({ onReferralCreated }) {
  const { refreshAll } = useWebSocket();
  const [selectedCapabilities, setSelectedCapabilities] = useState(['NEUROSURGERY', 'CT_SCAN']);
  const [selectedResources, setSelectedResources] = useState(['ICU_BED', 'VENTILATOR']);
  const [priority, setPriority] = useState('CRITICAL');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [patientSummary, setPatientSummary] = useState('Acute Traumatic Brain Injury — Requires ICU + Neurosurgeon + Ventilator + CT');
  const [creating, setCreating] = useState(false);

  const capabilityOptions = [
    { id: 'NEUROSURGERY', label: 'Neurosurgery' },
    { id: 'CT_SCAN', label: 'CT Scan' },
    { id: 'ICU', label: 'ICU Unit' },
    { id: 'VENTILATOR', label: 'Ventilator Support' },
    { id: 'CARDIOLOGY', label: 'Cardiology' },
    { id: 'TRAUMA_OT', label: 'Trauma OT' }
  ];

  const resourceOptions = [
    { id: 'ICU_BED', label: 'ICU Bed' },
    { id: 'VENTILATOR', label: 'Ventilator' },
    { id: 'CT_SCAN', label: 'CT Scanner' },
    { id: 'GENERAL_BED', label: 'General Bed' }
  ];

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/referrals/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requiredCapabilities: selectedCapabilities,
          requiredResources: selectedResources,
          originHospitalId: 'hosp-a',
          priority
        })
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

  useEffect(() => {
    fetchMatches();
  }, [selectedCapabilities, selectedResources, priority]);

  const toggleCapability = (capId) => {
    setSelectedCapabilities(prev => 
      prev.includes(capId) ? prev.filter(c => c !== capId) : [...prev, capId]
    );
  };

  const toggleResource = (resId) => {
    setSelectedResources(prev => 
      prev.includes(resId) ? prev.filter(r => r !== resId) : [...prev, resId]
    );
  };

  const handleSendReferral = async () => {
    if (!selectedCandidate) return;
    setCreating(true);

    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originHospitalId: 'hosp-a',
          targetHospitalId: selectedCandidate.hospitalId,
          requirementSummary: patientSummary,
          requiredCapabilities: selectedCapabilities,
          requiredResources: selectedResources,
          priority,
          createdByStaffId: 'user-staff-1',
          patientData: {
            patientName: 'Karan Sharma',
            patientAge: 42,
            patientSex: 'MALE',
            clinicalSummary: patientSummary,
            vitals: { bp: '140/90', hr: 110, spo2: 94, rr: 24, temp: '98.6 F', gcs: 8 },
            diagnosisSuspected: 'Acute Subdural Hematoma with Midline Shift',
            treatmentGiven: 'IV Mannitol, Intubated on manual bag',
            medications: ['Mannitol', 'Inj. Ceftriaxone 1g'],
            allergies: ['Penicillin'],
            reasonForReferral: 'No neurosurgeon available at District Hospital A',
            referringDoctorName: 'Dr. Ramesh Kumar (CMO)'
          }
        })
      });

      if (res.ok) {
        setSelectedCandidate(null);
        refreshAll();
        if (onReferralCreated) onReferralCreated();
      }
    } catch (err) {
      console.error('Create referral error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#292524] text-white flex items-center justify-center flex-shrink-0">
            <Compass className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-light text-[#0c0a09]">Critical Find (Fast Match)</h1>
            <p className="text-xs text-[#777169] font-light">
              Multi-factor candidate ranking: Capabilities + Live Capacity + Traffic-adjusted ETA.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requirement Sidebar */}
        <div className="eleven-card p-6 space-y-5 lg:col-span-1 bg-white">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[#777169] font-mono flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#292524]" aria-hidden="true" />
            <span>Select Requirements</span>
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Priority Tier:</label>
            <div className="grid grid-cols-3 gap-2">
              {['CRITICAL', 'URGENT', 'STABLE'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  aria-label={`Set priority tier to ${p}`}
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

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Clinical Capabilities:</label>
            <div className="flex flex-wrap gap-1.5">
              {capabilityOptions.map(c => {
                const active = selectedCapabilities.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleCapability(c.id)}
                    aria-label={`Toggle capability ${c.label}`}
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

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[#4e4e4e]">Resource Units:</label>
            <div className="flex flex-wrap gap-1.5">
              {resourceOptions.map(r => {
                const active = selectedResources.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleResource(r.id)}
                    aria-label={`Toggle resource ${r.label}`}
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

          <div className="space-y-2">
            <label htmlFor="patient-summary" className="text-xs font-semibold text-[#4e4e4e]">Clinical Case Summary:</label>
            <textarea
              id="patient-summary"
              name="patientSummary"
              value={patientSummary}
              onChange={(e) => setPatientSummary(e.target.value)}
              rows={3}
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-3 text-xs text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] focus:bg-white"
            />
          </div>
        </div>

        {/* Candidate List */}
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
              <p className="max-w-md mx-auto">
                No active hospital currently satisfies all selected clinical requirements with available capacity.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((cand, idx) => (
                <div
                  key={cand.hospitalId}
                  className="eleven-card p-6 space-y-3 bg-white hover:border-[#292524]"
                >
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
                            <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] flex-shrink-0">
                              TOP MATCH
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-[#777169] font-light truncate">{cand.address}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-[#0c0a09] font-mono tabular-nums">
                        {(cand.score * 100).toFixed(0)}% <span className="text-xs font-normal text-[#777169]">match score</span>
                      </div>
                      <span className="text-xs text-[#16a34a] font-semibold flex items-center justify-end gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-[#16a34a]" aria-hidden="true" /> ETA: {cand.etaMinutes} mins ({cand.distanceKm} km)
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
                      onClick={() => setSelectedCandidate(cand)}
                      aria-label={`Select hospital ${cand.hospitalName} for referral`}
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

      {/* Confirmation Modal */}
      {selectedCandidate && (
        <div 
          className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div className="eleven-card w-full max-w-xl p-6 space-y-5 bg-white border-[#d6d3d1]">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div>
                <h3 id="confirm-modal-title" className="text-base font-bold text-[#0c0a09]">Confirm Referral Request</h3>
                <p className="text-xs text-[#777169]">Places soft-hold on bed unit & notifies receiving hospital desk.</p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                aria-label="Close modal"
                className="eleven-button eleven-button-secondary py-1 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                ✕
              </button>
            </div>

            <div className="eleven-card p-4 space-y-2 bg-[#fafafa] text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#777169]">Target Hospital:</span>
                <strong className="text-[#0c0a09] text-sm">{selectedCandidate.hospitalName}</strong>
              </div>
              <div className="flex items-center justify-between font-mono tabular-nums">
                <span className="text-[#777169] font-sans">Travel ETA:</span>
                <strong className="text-[#16a34a]">{selectedCandidate.etaMinutes} mins ({selectedCandidate.distanceKm} km)</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777169]">Reserved Units:</span>
                <strong className="text-[#292524]">{selectedResources.join(', ')}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedCandidate(null)}
                aria-label="Cancel confirmation"
                className="eleven-button eleven-button-secondary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                Cancel
              </button>

              <button
                onClick={handleSendReferral}
                disabled={creating}
                aria-label="Confirm and send referral request"
                className="eleven-button eleven-button-primary text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{creating ? 'Sending…' : 'Send Referral (Soft-Hold)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
