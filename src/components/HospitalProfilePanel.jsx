/**
 * HospitalProfilePanel.jsx
 * Slide-in panel from the right when staff click the hospital name in the Header.
 * Shows: facility info, live capacity, session stats, recent referral history log.
 */

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { apiClient } from '../utils/apiClient.js';
import { ReferralStatusDashboard } from './ReferralStatusDashboard.jsx';
import {
  X, Building2, MapPin, Bed, Lock, ShieldCheck, Fingerprint,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, ArrowUpRight,
  ArrowDownLeft, Navigation, Loader2, Activity, User
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const map = {
    REQUEST_SENT:       'bg-blue-50 text-blue-700 border-blue-200',
    ACCEPTED:           'bg-emerald-50 text-emerald-700 border-emerald-200',
    HOSPITAL_CONFIRMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    IN_TRANSIT:         'bg-indigo-50 text-indigo-700 border-indigo-200',
    COMPLETED:          'bg-[#f0efed] text-[#777169] border-[#e7e5e4]',
    REJECTED:           'bg-red-50 text-red-700 border-red-200',
    RE_ROUTED:          'bg-amber-50 text-amber-700 border-amber-200',
    PENDING_MATCH:      'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${map[status] || 'bg-[#fafafa] text-[#777169] border-[#e7e5e4]'}`}>
      {(status || '—').replace(/_/g, ' ')}
    </span>
  );
}

function CapBar({ label, available, total }) {
  const pct   = total > 0 ? Math.round((available / total) * 100) : 0;
  const color = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-amber-500' : 'bg-red-500';
  const text  = pct > 50 ? 'text-emerald-700' : pct > 20 ? 'text-amber-700' : 'text-red-600';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-[#292524] truncate pr-2">
          {label.replace(/_/g, ' ')}
        </span>
        <span className={`font-mono font-bold shrink-0 ${text}`}>{available}/{total}</span>
      </div>
      <div className="h-1.5 bg-[#f0efed] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p className="text-[10px] font-bold text-[#777169] uppercase tracking-widest font-mono mb-3">
      {children}
    </p>
  );
}

// ── main component ─────────────────────────────────────────────────────────────

export function HospitalProfilePanel({ authSession, isOpen, onClose }) {
  const { referrals, hospitals } = useWebSocket();

  const [capacityRows, setCapacityRows] = useState([]);
  const [loadingCap, setLoadingCap]     = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [selectedLogRef, setSelectedLogRef] = useState(null); // referral opened from log

  // ── load capacity ────────────────────────────────────────────────────────────
  const loadCapacity = async () => {
    if (!authSession?.hospitalId) return;
    setLoadingCap(true);
    try {
      const res = await apiClient(`/api/hospitals/${authSession.hospitalId}`);
      if (res.ok) {
        const data = await res.json();
        // hospitals endpoint returns either data.resources or data.beds or raw rows
        const rows = data.resources || data.beds || [];
        setCapacityRows(rows);
      }
    } catch (e) {
      console.error('Profile panel capacity load:', e);
    } finally {
      setLoadingCap(false);
    }
  };

  useEffect(() => { if (isOpen) loadCapacity(); }, [isOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCapacity();
    setTimeout(() => setRefreshing(false), 700);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── derived data ─────────────────────────────────────────────────────────────
  const myHospital = hospitals?.find(h => String(h.id) === String(authSession?.hospitalId));

  // allMine includes ALL referrals this hospital is involved in (sender or receiver)
  // including REJECTED and COMPLETED — full history
  const allMine = referrals.filter(r =>
    String(r.originHospitalId) === String(authSession?.hospitalId) ||
    String(r.targetHospitalId) === String(authSession?.hospitalId) ||
    String(r.acceptedHospitalId) === String(authSession?.hospitalId)
  );

  const sent      = allMine.filter(r => String(r.originHospitalId)  === String(authSession?.hospitalId));
  const received  = allMine.filter(r => String(r.targetHospitalId)  === String(authSession?.hospitalId));
  const active    = allMine.filter(r => !['COMPLETED', 'REJECTED'].includes(r.status));
  const completed = allMine.filter(r => r.status === 'COMPLETED');
  const rejected  = allMine.filter(r => r.status === 'REJECTED');

  // Full log — newest first, no slice limit (all history including rejected/completed)
  const recentLog = [...allMine]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — sits above everything except the dashboard it spawns */}
      <div
        className="fixed inset-0 z-[9980] bg-[#0c0a09]/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel — z-[9981] keeps it above the backdrop */}
      <aside
        className="fixed top-0 right-0 bottom-0 z-[9981] w-full max-w-[420px] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-250 font-sans"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hpp-title"
      >

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h2 id="hpp-title" className="text-sm font-extrabold text-white truncate">
                {authSession?.hospitalName || 'My Hospital'}
              </h2>
              <p className="text-[11px] text-[#a8a29e] mt-0.5">Hospital Profile & Activity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a8a29e] hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
            aria-label="Close profile"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#f0efed]">

          {/* ── 1. Facility info ── */}
          <section className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Facility Information</SectionTitle>
              <button onClick={handleRefresh} className="p-1.5 rounded-lg hover:bg-[#f0efed] transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 text-[#a8a29e] ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3">
                <p className="text-[10px] text-[#777169] font-mono">Hospital ID</p>
                <p className="font-bold text-[#0c0a09] font-mono mt-0.5">#{authSession?.hospitalId}</p>
              </div>
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-3">
                <p className="text-[10px] text-[#777169] font-mono">Access Role</p>
                <p className="font-bold text-[#0c0a09] mt-0.5 capitalize">{authSession?.role || 'Doctor'}</p>
              </div>
            </div>

            {(authSession?.lat || myHospital?.locationLat || myHospital?.location_lat) && (
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl px-3 py-2 flex items-center gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-[#a8a29e] shrink-0" />
                <span className="font-mono text-[#292524]">
                  {parseFloat(authSession?.lat || myHospital?.locationLat || myHospital?.location_lat || 0).toFixed(4)}°N
                  {', '}
                  {parseFloat(authSession?.lng || myHospital?.locationLng || myHospital?.location_lng || 0).toFixed(4)}°E
                </span>
              </div>
            )}

            {/* Security tags */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { icon: Lock,        color: 'emerald', label: 'AES-256-GCM' },
                { icon: ShieldCheck, color: 'blue',    label: 'Blockchain Audit' },
                { icon: Fingerprint, color: 'purple',  label: 'HMAC Patient Keys' },
              ].map(({ icon: Icon, color, label }) => (
                <span key={label} className={`inline-flex items-center gap-1 text-[10px] font-mono text-${color}-700 bg-${color}-50 border border-${color}-200 px-2 py-1 rounded-lg font-bold`}>
                  <Icon className="w-2.5 h-2.5" />{label}
                </span>
              ))}
            </div>
          </section>

          {/* ── 2. Session stats ── */}
          <section className="px-5 py-4 space-y-3">
            <SectionTitle>Session Activity</SectionTitle>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Sent',      value: sent.length,      icon: ArrowUpRight,   color: 'blue'    },
                { label: 'Received',  value: received.length,  icon: ArrowDownLeft,  color: 'indigo'  },
                { label: 'Active',    value: active.length,    icon: Activity,       color: 'emerald' },
                { label: 'Completed', value: completed.length, icon: CheckCircle2,   color: 'gray'    },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className={`bg-${color === 'gray' ? '[#fafafa]' : color + '-50'} border border-${color === 'gray' ? '[#e7e5e4]' : color + '-200'} rounded-xl p-3 flex items-center gap-3`}>
                  <Icon className={`w-4 h-4 text-${color === 'gray' ? '[#a8a29e]' : color + '-600'} shrink-0`} />
                  <div>
                    <p className={`text-xl font-black font-mono text-${color === 'gray' ? '[#777169]' : color + '-700'}`}>{value}</p>
                    <p className="text-[10px] text-[#777169] font-bold uppercase tracking-wide">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {rejected.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{rejected.length}</strong> referral{rejected.length !== 1 ? 's' : ''} rejected this session</span>
              </div>
            )}
          </section>

          {/* ── 3. Live capacity ── */}
          <section className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <SectionTitle>Current Capacity</SectionTitle>
              {loadingCap && <Loader2 className="w-3.5 h-3.5 text-[#a8a29e] animate-spin" />}
            </div>

            {capacityRows.length > 0 ? (
              <div className="space-y-3">
                {capacityRows.map((r, i) => {
                  const label     = r.bed_type || r.type || r.resourceType || `Resource ${i + 1}`;
                  const available = r.available ?? r.availableCount ?? 0;
                  const total     = r.total ?? r.totalCapacity ?? 0;
                  return <CapBar key={label} label={label} available={available} total={total} />;
                })}
              </div>
            ) : loadingCap ? (
              <div className="py-4 text-center text-xs text-[#777169]">Loading capacity data…</div>
            ) : (
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-4 text-center text-xs text-[#777169]">
                <Bed className="w-6 h-6 mx-auto mb-2 text-[#d6d3d1]" />
                <p>No capacity data available.</p>
                <p className="mt-0.5">Update resources in the Capacity Panel tab.</p>
              </div>
            )}
          </section>

          {/* ── 4. Recent referral log ── */}
          <section className="px-5 py-4 space-y-3">
            <SectionTitle>Recent Referral Log</SectionTitle>

            {recentLog.length === 0 ? (
              <div className="bg-[#fafafa] border border-[#e7e5e4] rounded-xl p-5 text-center text-xs text-[#777169]">
                <Clock className="w-6 h-6 mx-auto mb-2 text-[#d6d3d1]" />
                No referrals in this session yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recentLog.map((ref, idx) => {
                  const isSending     = String(ref.originHospitalId) === String(authSession?.hospitalId);
                  const direction     = isSending ? 'Sent' : 'Received';
                  const DirecIcon     = isSending ? ArrowUpRight : ArrowDownLeft;
                  const otherHospital = isSending ? ref.targetHospitalName : ref.originHospitalName;
                  const diagnosis     = ref.patientData?.diagnosisSuspected || ref.requirementSummary || '—';
                  const timeStr       = ref.createdAt
                    ? new Date(ref.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                    : '—';
                  // Active + Rejected = clickable (REJECTED shows reason in dashboard)
                  // Only COMPLETED is non-clickable (nothing actionable left)
                  const isClickable = ref.status !== 'COMPLETED';
                  const isRejected  = ref.status === 'REJECTED';

                  return (
                    <div
                      key={ref.id}
                      onClick={() => isClickable ? setSelectedLogRef(ref) : undefined}
                      className={`border rounded-xl px-3 py-2.5 flex items-start gap-3 transition-all ${
                        isRejected
                          ? 'bg-red-50 border-red-200 hover:border-red-400'
                          : isClickable
                            ? 'bg-[#fafafa] border-[#e7e5e4] hover:border-[#292524] hover:bg-white cursor-pointer group'
                            : 'bg-[#fafafa] border-[#e7e5e4] opacity-60'
                      }`}
                    >
                      {/* Index + direction icon */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <span className="text-[10px] font-mono text-[#a8a29e] font-bold">#{idx + 1}</span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          isRejected   ? 'bg-red-100 border border-red-300' :
                          isSending    ? 'bg-blue-50 border border-blue-200' :
                                         'bg-indigo-50 border border-indigo-200'
                        }`}>
                          <DirecIcon className={`w-3 h-3 ${isRejected ? 'text-red-600' : isSending ? 'text-blue-600' : 'text-indigo-600'}`} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-[#0c0a09]">
                            {ref.patientRefCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <StatusPill status={ref.status} />
                            <span className="text-[10px] text-[#a8a29e] font-mono">{timeStr}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#292524] font-medium truncate">{diagnosis}</p>

                        <div className="flex items-center gap-1 text-[10px] text-[#777169]">
                          <span className={`font-bold ${isRejected ? 'text-red-600' : isSending ? 'text-blue-600' : 'text-indigo-600'}`}>
                            {direction}
                          </span>
                          {otherHospital && (
                            <>
                              <span className="text-[#d6d3d1]">·</span>
                              <span className="truncate">{otherHospital}</span>
                            </>
                          )}
                        </div>

                        {/* Rejection reason inline for rejected entries */}
                        {isRejected && ref.rejectionReason && (
                          <p className="text-[10px] text-red-600 leading-snug border-t border-red-100 pt-1 mt-1">
                            <strong>Reason:</strong> {ref.rejectionReason}
                          </p>
                        )}

                        {/* Patient key */}
                        {ref.patientKey && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Fingerprint className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                            <span className="font-mono text-[9px] text-emerald-700 truncate">
                              {ref.patientKey.substring(0, 10)}…
                            </span>
                          </div>
                        )}

                        {/* CTA hint for clickable entries */}
                        {isClickable && (
                          <p className="text-[9px] text-[#a8a29e] group-hover:text-emerald-700 transition-colors font-mono">
                            Click to open status dashboard →
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Footer padding ── */}
          <div className="h-6" />
        </div>

        {/* ── Sticky footer ── */}
        <div className="px-5 py-3 bg-[#fafafa] border-t border-[#e7e5e4] shrink-0 flex items-center justify-between text-[10px] text-[#a8a29e]">
          <span className="font-mono">Session · {authSession?.hospitalName}</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#e7e5e4] text-[#292524] font-bold text-xs hover:bg-[#f5f5f5] transition-colors"
          >
            Close
          </button>
        </div>
      </aside>

      {/* ReferralStatusDashboard — z-[9995] so it floats above the profile panel backdrop */}
      {selectedLogRef && (
        <ReferralStatusDashboard
          referral={selectedLogRef}
          authSession={authSession}
          onClose={() => setSelectedLogRef(null)}
        />
      )}
    </>
  );
}
