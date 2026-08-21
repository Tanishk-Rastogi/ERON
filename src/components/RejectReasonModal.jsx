/**
 * RejectReasonModal.jsx
 *
 * Displayed when staff click Reject on an incoming referral.
 * Staff pick one or more predefined reasons, or type a custom reason.
 * The reject API call only fires after confirming here.
 *
 * Props:
 *   referral    – the referral object being rejected
 *   onConfirm   – async (referralId, reason: string) => void  – called on confirm
 *   onCancel    – () => void
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Check, ChevronRight, Loader2 } from 'lucide-react';

const PREDEFINED_REASONS = [
  { id: 'no_icu',         label: 'ICU beds at full capacity',              category: 'Capacity' },
  { id: 'no_ventilator',  label: 'No ventilators available',               category: 'Capacity' },
  { id: 'no_ot',          label: 'All operation theatres occupied',         category: 'Capacity' },
  { id: 'no_specialist',  label: 'Required specialist not on duty',         category: 'Staff' },
  { id: 'no_blood',       label: 'Required blood type not in stock',        category: 'Resources' },
  { id: 'outside_scope',  label: 'Outside facility scope',                  category: 'Clinical' },
  { id: 'infection_risk', label: 'Active infection control protocol',       category: 'Clinical' },
  { id: 'power_outage',   label: 'Facility under maintenance / downtime',   category: 'Operational' },
  { id: 'data_error',     label: 'Referral data incomplete or incorrect',   category: 'Administrative' },
];

const CATEGORY_COLORS = {
  'Capacity':      'bg-red-50 border-red-200 text-red-700',
  'Staff':         'bg-amber-50 border-amber-200 text-amber-700',
  'Resources':     'bg-orange-50 border-orange-200 text-orange-700',
  'Clinical':      'bg-blue-50 border-blue-200 text-blue-700',
  'Operational':   'bg-purple-50 border-purple-200 text-purple-700',
  'Administrative':'bg-[#fafafa] border-[#e7e5e4] text-[#292524]',
};

export function RejectReasonModal({ referral, onConfirm, onCancel }) {
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [customReason, setCustomReason]       = useState('');
  const [showCustom, setShowCustom]           = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [error, setError]                     = useState('');
  const textareaRef = useRef(null);

  // Focus textarea when custom opens
  useEffect(() => {
    if (showCustom) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [showCustom]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);

  const toggleReason = (id) => {
    setSelectedReasons(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
    setError('');
  };

  const buildFinalReason = () => {
    const parts = selectedReasons.map(id => PREDEFINED_REASONS.find(r => r.id === id)?.label).filter(Boolean);
    if (customReason.trim()) parts.push(customReason.trim());
    return parts.join(' · ');
  };

  const hasSelection = selectedReasons.length > 0 || customReason.trim().length > 0;

  const handleConfirm = async () => {
    if (!hasSelection) { setError('Please select at least one reason or type a custom reason.'); return; }
    setSubmitting(true);
    try {
      await onConfirm(referral.id, buildFinalReason());
    } catch (e) {
      setError('Failed to reject referral. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-4">

        {/* Header */}
        <div className="bg-gradient-to-r from-red-700 to-red-600 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-900/30 border border-red-400/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-200" />
            </div>
            <div>
              <h2 id="reject-modal-title" className="text-sm font-extrabold text-white">Reject Referral</h2>
              <p className="text-[11px] text-red-200 mt-0.5">#{referral?.patientRefCode} · {referral?.originHospitalName || 'Referring Hospital'}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-red-200 hover:text-white p-1.5 rounded-lg hover:bg-red-900/30 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 max-h-[65vh] overflow-y-auto">

          {/* Patient context strip */}
          {referral?.patientData?.patientName && (
            <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl px-4 py-3 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-[#0c0a09]">{referral.patientData.patientName}</p>
                <p className="text-[#777169] mt-0.5">{referral.patientData.diagnosisSuspected}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold ${
                referral.patientData?.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                referral.patientData?.priority === 'URGENT'   ? 'bg-amber-100 text-amber-700' :
                                                                 'bg-blue-100 text-blue-700'
              }`}>{referral.patientData?.priority || referral.status}</span>
            </div>
          )}

          {/* Instruction */}
          <p className="text-xs text-[#777169] leading-relaxed">
            Select one or more reasons for rejection. This will be logged to the audit trail and communicated to the referring hospital.
          </p>

          {/* Predefined reasons grid */}
          <div className="space-y-1.5">
            {PREDEFINED_REASONS.map((reason) => {
              const active = selectedReasons.includes(reason.id);
              const colorClass = CATEGORY_COLORS[reason.category] || CATEGORY_COLORS['Administrative'];
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => toggleReason(reason.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium transition-all text-left ${
                    active
                      ? 'bg-red-50 border-red-400 text-red-800 font-bold'
                      : `${colorClass} hover:brightness-95`
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      active ? 'bg-red-600 border-red-600' : 'bg-white border-[#d6d3d1]'
                    }`}>
                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span>{reason.label}</span>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${
                    active ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white/60 text-[#a8a29e] border-[#e7e5e4]'
                  }`}>
                    {reason.category}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom reason toggle */}
          <button
            type="button"
            onClick={() => setShowCustom(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-bold transition-all ${
              showCustom
                ? 'bg-[#292524] text-white border-[#292524]'
                : 'bg-white text-[#292524] border-[#e7e5e4] hover:border-[#292524]'
            }`}
          >
            <span>Other — type a custom reason</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showCustom ? 'rotate-90' : ''}`} />
          </button>

          {showCustom && (
            <div className="animate-in slide-in-from-top-2 duration-150">
              <textarea
                ref={textareaRef}
                value={customReason}
                onChange={(e) => { setCustomReason(e.target.value); setError(''); }}
                rows={3}
                maxLength={280}
                placeholder="Describe the specific reason for rejection (e.g. patient requires hepatology specialist not available at our facility)…"
                className="w-full p-3 bg-[#fafafa] border border-[#d6d3d1] rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#292524] resize-none"
              />
              <p className="text-[10px] text-[#a8a29e] mt-1 text-right font-mono">{customReason.length}/280</p>
            </div>
          )}

          {/* Preview of selected reasons */}
          {hasSelection && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide font-mono">Rejection reason preview:</p>
              <p className="text-xs text-red-800 leading-relaxed font-medium">{buildFinalReason()}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#e7e5e4] bg-[#fafafa] flex items-center justify-between gap-3">
          <p className="text-[10px] text-[#a8a29e] leading-relaxed">
            Rejection is irreversible. The sending hospital will be notified immediately.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs hover:bg-[#f5f5f5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || !hasSelection}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm"
            >
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rejecting…</>
                : <>Confirm Rejection</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
