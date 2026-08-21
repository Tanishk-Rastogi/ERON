import React, { useState, useCallback } from 'react';
import { apiClient } from '../utils/apiClient.js';
import { useWebSocket } from '../context/WebSocketContext';
import { ReferralStatusDashboard } from './ReferralStatusDashboard.jsx';
import {
  ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck, Navigation,
  AlertTriangle, CheckCircle2, Ambulance, MapPin, RefreshCw, Eye,
  ChevronRight, Building2, Fingerprint, Copy, Check, Lock,
  KeyRound, Shield, Link2, Search, X, Loader2, AlertCircle, Activity
} from 'lucide-react';

// ─── Patient Key inline chip ──────────────────────────────────────────────────
function PatientKeyChip({ patientKey }) {
  const [copied, setCopied] = useState(false);
  if (!patientKey) return null;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(patientKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
      <Fingerprint className="w-3 h-3 text-emerald-600 shrink-0" />
      <span className="font-mono text-[10px] text-emerald-800 font-bold">
        {patientKey.substring(0, 8)}…{patientKey.substring(60)}
      </span>
      <button
        onClick={handleCopy}
        title="Copy full patient key"
        className={`p-0.5 rounded transition-colors ${copied ? 'text-emerald-600' : 'text-emerald-400 hover:text-emerald-700'}`}
      >
        {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      </button>
    </div>
  );
}

// ─── Blockchain audit trail panel ─────────────────────────────────────────────
function AuditTrailPanel({ referralId }) {
  const [auditData, setAuditData]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [isOpen, setIsOpen]         = useState(false);

  const loadAudit = async () => {
    if (auditData) { setIsOpen(v => !v); return; }
    setLoading(true);
    setError(null);
    setIsOpen(true);
    try {
      const res = await apiClient(`/api/referrals/${referralId}/verify-audit`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data);
      } else {
        setError('Could not load audit trail.');
      }
    } catch {
      setError('Network error loading audit trail.');
    } finally {
      setLoading(false);
    }
  };

  const actionColor = (action = '') => {
    if (action.includes('REROUTE') || action.includes('REJECTED'))  return 'text-amber-600 bg-amber-50 border-amber-200';
    if (action.includes('COMPLETE') || action.includes('CONFIRMED')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (action.includes('PATIENT_KEY'))                              return 'text-blue-700 bg-blue-50 border-blue-200';
    if (action.includes('ENCRYPTED') || action.includes('PACKET'))  return 'text-purple-700 bg-purple-50 border-purple-200';
    if (action.includes('TRANSIT') || action.includes('AMBULANCE')) return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    return 'text-[#292524] bg-[#fafafa] border-[#e7e5e4]';
  };

  return (
    <div className="space-y-2">
      {/* Toggle button */}
      <button
        onClick={loadAudit}
        className="flex items-center gap-2 text-xs font-bold text-[#292524] hover:text-emerald-700 transition-colors group"
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
          <Link2 className="w-3.5 h-3.5 text-emerald-600" />
        </div>
        <span>Blockchain Audit Trail</span>
        {auditData && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border font-bold ${
            auditData.is_valid
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-red-100 text-red-700 border-red-300'
          }`}>
            {auditData.is_valid ? '✓ Chain Intact' : '✗ Tamper Detected'}
          </span>
        )}
        {loading && <Loader2 className="w-3 h-3 animate-spin text-[#777169]" />}
        {!loading && <ChevronRight className={`w-3.5 h-3.5 text-[#a8a29e] transition-transform ${isOpen ? 'rotate-90' : ''}`} />}
      </button>

      {/* Chain panel */}
      {isOpen && (
        <div className="border border-[#e7e5e4] rounded-2xl overflow-hidden">
          {/* Panel header */}
          <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                SHA-256 Hash Chain
              </span>
              {auditData && (
                <span className="text-[10px] text-[#a8a29e] font-mono">
                  {auditData.chain_length} event{auditData.chain_length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {auditData && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-bold font-mono ${
                auditData.is_valid
                  ? 'bg-emerald-900/40 border-emerald-700/40 text-emerald-300'
                  : 'bg-red-900/40 border-red-700/40 text-red-300'
              }`}>
                {auditData.is_valid
                  ? <><Check className="w-3 h-3" /> INTEGRITY VERIFIED</>
                  : <><X className="w-3 h-3" /> TAMPER DETECTED</>
                }
              </div>
            )}
          </div>

          {/* Chain events */}
          <div className="bg-[#fafafa] max-h-72 overflow-y-auto">
            {loading && (
              <div className="p-6 text-center text-xs text-[#777169] flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying hash chain…
              </div>
            )}
            {error && (
              <div className="p-4 text-xs text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}
            {auditData?.verificationChain?.map((ev, idx) => (
              <div
                key={ev.id || idx}
                className={`px-4 py-3 border-b border-[#f0efed] last:border-0 ${idx === 0 ? '' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: chain link connector */}
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-bold ${
                      ev.hash_matched
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-700'
                        : 'bg-red-100 border-red-400 text-red-700'
                    }`}>
                      {ev.hash_matched ? '✓' : '✗'}
                    </div>
                    {idx < auditData.verificationChain.length - 1 && (
                      <div className="w-px h-full min-h-[16px] bg-emerald-200 mt-1" />
                    )}
                  </div>

                  {/* Right: event detail */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${actionColor(ev.action || ev.status_transition)}`}>
                        {ev.action || ev.status_transition}
                      </span>
                      {ev.timestamp && (
                        <span className="text-[10px] text-[#a8a29e] font-mono tabular-nums">
                          {new Date(ev.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                      {ev.actor && ev.actor !== 'SYSTEM' && (
                        <span className="text-[10px] text-[#777169] font-mono">actor:{ev.actor}</span>
                      )}
                      {ev.actor === 'SYSTEM' && (
                        <span className="text-[10px] text-amber-600 font-mono font-bold">SYSTEM</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <KeyRound className="w-2.5 h-2.5 text-[#a8a29e] shrink-0" />
                      <span className="font-mono text-[9px] text-[#a8a29e] break-all leading-relaxed">
                        {ev.event_hash?.substring(0, 24)}…{ev.event_hash?.substring(56)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer: genesis block indicator */}
          {auditData && (
            <div className="bg-[#f0efed] px-4 py-2 flex items-center gap-2 text-[10px] text-[#777169] font-mono">
              <Lock className="w-3 h-3" />
              <span>Genesis: ERON-GENESIS-BLOCK-v1 · Algorithm: SHA-256 · Source: {auditData.source}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Delivery-style live GPS map ──────────────────────────────────────────────
function DeliveryLiveMap({ referral }) {
  const origin     = referral?.originHospitalName || 'District Hospital Central';
  const target     = referral?.targetHospitalName || 'City Super Specialty Hospital';
  const ambId      = referral?.ambulance?.id || 'AMB-101';
  const driverName = referral?.ambulance?.driverName || 'Suresh Kumar';

  return (
    <div className="eleven-card overflow-hidden border-[#e7e5e4] shadow-sm font-sans space-y-0 bg-[#0c0a09] text-white rounded-2xl">
      <div className="bg-[#1c1917] px-4 py-3 border-b border-[#292524] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">Live GPS Map</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">ETA: 8 mins (4.2 km)</span>
          <span className="bg-[#292524] text-[#a8a29e] px-2.5 py-0.5 rounded-full font-semibold">Speed: 52 km/h</span>
        </div>
      </div>

      <div className="relative h-52 w-full bg-[#0c0a09] overflow-hidden flex items-center justify-center p-4">
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#ffffff" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 80 150 C 220 50, 360 210, 560 90" fill="none" stroke="#10b981" strokeWidth="6" strokeOpacity="0.2" />
          <path d="M 80 150 C 220 50, 360 220, 560 90" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray="8 6" className="animate-pulse" />
        </svg>

        <div className="absolute left-[8%] bottom-[22%] flex flex-col items-center z-10">
          <div className="bg-emerald-600 text-white p-2 rounded-full shadow-lg border-2 border-white ring-4 ring-emerald-950">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="mt-1 bg-[#1c1917]/90 border border-[#292524] px-2 py-0.5 rounded-lg text-[10px] font-bold text-[#e7e5e4] font-mono shadow-md whitespace-nowrap">
            FROM: {origin}
          </div>
        </div>

        <div className="absolute left-[50%] top-[35%] flex flex-col items-center animate-bounce z-20">
          <div className="bg-amber-500 text-[#0c0a09] p-2.5 rounded-full shadow-xl border-2 border-white ring-4 ring-amber-500/30">
            <Ambulance className="w-5 h-5" />
          </div>
          <div className="mt-1 bg-amber-500 text-[#0c0a09] px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono shadow-lg flex items-center gap-1">
            <span>{ambId}</span>
            <span className="text-[9px] opacity-80">(ALS)</span>
          </div>
        </div>

        <div className="absolute right-[10%] top-[18%] flex flex-col items-center z-10">
          <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg border-2 border-white ring-4 ring-blue-950">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="mt-1 bg-[#1c1917]/90 border border-[#292524] px-2 py-0.5 rounded-lg text-[10px] font-bold text-white font-mono shadow-md whitespace-nowrap">
            TO: {target}
          </div>
        </div>
      </div>

      <div className="bg-[#1c1917] p-3 border-t border-[#292524] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        <div><span className="text-[#a8a29e] text-[10px] block">Dispatched Unit:</span><p className="font-bold text-white truncate">{ambId}</p></div>
        <div><span className="text-[#a8a29e] text-[10px] block">Driver On-Duty:</span><p className="font-bold text-emerald-400 truncate">{driverName}</p></div>
        <div><span className="text-[#a8a29e] text-[10px] block">Emergency Lane:</span><p className="font-bold text-amber-400 truncate">Green Corridor Active</p></div>
        <div><span className="text-[#a8a29e] text-[10px] block">Reserved ICU Ward:</span><p className="font-bold text-white truncate">Bed #ICU-04</p></div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  switch (status) {
    case 'IN_TRANSIT':
      return <span className="eleven-badge bg-[#a8c8e8]/30 text-[#0c0a09] border-[#a8c8e8] flex items-center gap-1 font-mono tabular-nums"><Navigation className="w-3 h-3 text-[#2563eb]" /> IN TRANSIT</span>;
    case 'RE_ROUTED':
    case 'RE_ROUTING':
      return <span className="eleven-badge bg-[#f4c5a8]/40 text-[#0c0a09] border-[#f4c5a8] flex items-center gap-1 animate-pulse font-mono tabular-nums"><AlertTriangle className="w-3 h-3 text-[#d97706]" /> AUTO RE-ROUTING</span>;
    case 'ACCEPTED':
    case 'HOSPITAL_CONFIRMED':
      return <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] flex items-center gap-1 font-mono tabular-nums"><CheckCircle2 className="w-3 h-3 text-[#16a34a]" /> CONFIRMED</span>;
    case 'COMPLETED':
      return <span className="eleven-badge bg-[#f0efed] text-[#777169] border-[#e7e5e4] flex items-center gap-1 font-mono tabular-nums"><ShieldCheck className="w-3 h-3 text-[#16a34a]" /> CLOSED</span>;
    default:
      return <span className="eleven-badge bg-[#c8b8e0]/30 text-[#0c0a09] border-[#c8b8e0] flex items-center gap-1 font-mono tabular-nums"><Clock className="w-3 h-3 text-[#292524]" /> REQUEST SENT</span>;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MainDashboard({ onNavigateToReceiving, authSession }) {
  const { referrals, refreshAll, setLastNotification } = useWebSocket();

  const [selectedReferral, setSelectedReferral]         = useState(null);
  const [activeSubTab, setActiveSubTab]                 = useState('sending');
  const [decryptedPacket, setDecryptedPacket]           = useState(null);
  const [packetMeta, setPacketMeta]                     = useState(null);
  const [searchQuery, setSearchQuery]                   = useState('');
  const [loadingPacket, setLoadingPacket]               = useState(false);
  const [isRefreshing, setIsRefreshing]                 = useState(false);
  const [statusDashboardRef, setStatusDashboardRef]     = useState(null);

  // Include REJECTED in sending tab so Hospital A sees what happened
  const activeReferrals    = referrals.filter(r => r.status !== 'COMPLETED');
  const sendingReferrals   = activeReferrals.filter(r =>
    String(r.originHospitalId) === String(authSession?.hospitalId)
  );
  const receivingReferrals = activeReferrals.filter(r =>
    String(r.targetHospitalId)   === String(authSession?.hospitalId) ||
    String(r.acceptedHospitalId) === String(authSession?.hospitalId)
  );

  const rawList = activeSubTab === 'sending' ? sendingReferrals : receivingReferrals;

  const displayedReferrals = rawList.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.patientRefCode?.toLowerCase().includes(q) ||
      r.requirementSummary?.toLowerCase().includes(q) ||
      r.originHospitalName?.toLowerCase().includes(q) ||
      r.targetHospitalName?.toLowerCase().includes(q) ||
      r.patientKey?.toLowerCase().includes(q)
    );
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshAll();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleCompleteHandover = async (refId) => {
    try {
      await apiClient(`/api/referrals/${refId}/complete`, { method: 'POST' });
      setSelectedReferral(null);
      refreshAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDetail = useCallback(async (ref) => {
    setSelectedReferral(ref);
    setDecryptedPacket(null);
    setPacketMeta(null);
    setLoadingPacket(true);
    try {
      const res = await apiClient(`/api/referrals/${ref.id}/packet`);
      if (res.ok) {
        const data = await res.json();
        // Support both old (decryptedPayload) and new (patientData) response shapes
        setDecryptedPacket(data.patientData || data.decryptedPayload || null);
        setPacketMeta({
          patientKey:     data.patientKey || ref.patientKey || null,
          encryptionMode: data.encryptionMode || 'AES-256-GCM',
          isDecrypted:    data.isDecrypted ?? true
        });
      }
    } catch (err) {
      console.error('Fetch packet error:', err);
    } finally {
      setLoadingPacket(false);
    }
  }, []);

  return (
    <div className="space-y-6">

      {/* ── Sub-tabs + search + refresh ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e7e5e4] pb-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'sending',   icon: ArrowUpRight,   label: 'SENDING',   count: sendingReferrals.length },
            { id: 'receiving', icon: ArrowDownLeft,  label: 'RECEIVING', count: receivingReferrals.length },
          ].map(({ id, icon: Icon, label, count }) => (
            <button
              key={id}
              onClick={() => setActiveSubTab(id)}
              aria-current={activeSubTab === id ? 'true' : undefined}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524] ${
                activeSubTab === id
                  ? 'bg-[#292524] text-white border-[#292524]'
                  : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{label} (<strong className="font-mono tabular-nums">{count}</strong>)</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#a8a29e] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search referrals or patient key…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-[#e7e5e4] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#292524] w-52 font-medium"
            />
          </div>
          <button
            onClick={handleRefresh}
            className="eleven-button eleven-button-secondary text-xs py-1.5 px-3"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ── Referral cards ── */}
      <div
        key={activeSubTab}
        className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {displayedReferrals.length === 0 ? (
          <div className="eleven-card p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#a8a29e] mx-auto" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[#292524]">No Active Referrals in Queue</h3>
            <p className="text-xs text-[#777169] max-w-sm mx-auto">
              All patient transfers are completed or no referrals have been initiated yet.
            </p>
          </div>
        ) : (
          displayedReferrals.map((ref) => {
            const isRerouting = ref.status === 'RE_ROUTING' || ref.status === 'RE_ROUTED';
            const cleanDiagnosis = ref.requirementSummary
              ? ref.requirementSummary.split(' — ')[0].split(' - Requires')[0]
              : '—';

            return (
              <div
                key={ref.id}
                className={`eleven-card p-5 space-y-4 bg-white border transition-all ${
                  isRerouting ? 'border-amber-400 bg-amber-50/20' : 'border-[#e7e5e4]'
                }`}
              >
                {/* ── Card header: ref code + status + key ── */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f0efed] pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[#0c0a09]">#{ref.patientRefCode}</span>
                    <StatusBadge status={ref.status} />
                    {/* Rejection badge with reason tooltip */}
                    {ref.status === 'REJECTED' && (
                      <div className="relative group">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-700 bg-red-50 border border-red-300 px-2 py-0.5 rounded-full font-bold cursor-help">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Rejected by {ref.rejectedByName || ref.targetHospitalName || 'receiving hospital'}
                        </span>
                        {ref.rejectionReason && (
                          <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover:block w-72 bg-[#1c1917] text-white text-[11px] p-3 rounded-xl shadow-2xl border border-[#292524] leading-relaxed">
                            <p className="text-[10px] text-red-400 font-mono uppercase font-bold mb-1">Rejection Reason</p>
                            <p>{ref.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                    )}
                    {ref.status !== 'REJECTED' && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md font-bold">
                        <Lock className="w-2.5 h-2.5" />AES-256-GCM
                      </span>
                    )}
                  </div>

                  {ref.ambulance && (
                    <div className="flex items-center gap-1.5 text-xs text-[#292524] font-mono font-bold">
                      <Ambulance className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{ref.ambulance.id} ({ref.ambulance.type})</span>
                    </div>
                  )}
                </div>

                {/* ── Diagnosis ── */}
                <h3 className="text-sm font-bold text-[#0c0a09] leading-snug">{cleanDiagnosis}</h3>

                {/* ── Patient key chip ── */}
                {ref.patientKey && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#777169] font-mono uppercase tracking-wide shrink-0">Patient Key:</span>
                    <PatientKeyChip patientKey={ref.patientKey} />
                  </div>
                )}

                {/* ── Resource chips ── */}
                <div className="flex flex-wrap gap-1.5">
                  {(ref.requiredCapabilities || []).map((c, i) => (
                    <span key={`cap-${i}`} className="px-2 py-0.5 rounded-lg bg-[#292524] text-white font-mono text-[10px] font-bold">
                      [{c.replace(/_/g, ' ')}]
                    </span>
                  ))}
                  {(ref.requiredResources || []).map((r, i) => (
                    <span key={`res-${i}`} className="px-2 py-0.5 rounded-lg bg-[#292524] text-white font-mono text-[10px] font-bold">
                      [{r.replace(/_BED$/, '').replace(/_/g, ' ')}]
                    </span>
                  ))}
                </div>

                {/* ── Re-routing alert ── */}
                {isRerouting && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
                      <span className="text-[#0c0a09]">
                        <strong>Destination hospital lost capacity.</strong> System is auto-rerouting ambulance.
                      </span>
                    </div>
                    <span className="font-mono text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full ml-2 shrink-0">
                      Auto-Rerouting
                    </span>
                  </div>
                )}

                {/* ── Footer: route + actions ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#f0efed]">
                  <div className="flex items-center gap-2 text-xs text-[#777169] min-w-0">
                    <span className="font-mono font-bold text-[#4e4e4e] shrink-0">Transfer:</span>
                    <span className="font-semibold text-[#292524] truncate">{ref.originHospitalName || '—'}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#d6d3d1] shrink-0" />
                    <span className="font-extrabold text-[#0c0a09] truncate">{ref.targetHospitalName || '—'}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {activeSubTab === 'receiving' && !['ACCEPTED', 'HOSPITAL_CONFIRMED'].includes(ref.status) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); /* handled by ReceivingTab */ }}
                        className="eleven-button eleven-button-primary text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        ✓ Accept
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDetail(ref); }}
                      aria-label={`View details for referral ${ref.patientRefCode}`}
                      className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 font-bold"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>View Details</span>
                    </button>

                    {/* Quick Status Dashboard for active + rejected referrals */}
                    {ref.status !== 'COMPLETED' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatusDashboardRef(ref); }}
                        className={`eleven-button text-xs py-1.5 px-3 font-bold ${
                          ref.status === 'REJECTED'
                            ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                            : ['ACCEPTED','HOSPITAL_CONFIRMED','IN_TRANSIT'].includes(ref.status)
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'eleven-button-secondary'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{ref.status === 'REJECTED' ? 'See Rejection' : 'Live Status'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Detail Modal
         ════════════════════════════════════════════════════════════════════ */}
      {selectedReferral && (
        <div
          className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="eleven-card w-full max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white border-[#d6d3d1] shadow-2xl">

            {/* ── Sticky header ── */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-[#e7e5e4] flex items-center justify-between gap-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 id="modal-title" className="text-base font-bold text-[#0c0a09]">Referral Details</h2>
                  <span className="font-mono text-xs text-[#292524] bg-[#f5f5f5] border border-[#e7e5e4] px-2 py-0.5 rounded-full">
                    #{selectedReferral.patientRefCode}
                  </span>
                  <StatusBadge status={selectedReferral.status} />
                  {/* Encryption mode tag */}
                  {packetMeta?.encryptionMode && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                      <Lock className="w-2.5 h-2.5" />
                      {packetMeta.encryptionMode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#777169] mt-0.5 truncate">
                  {selectedReferral.requirementSummary?.split(' — ')[0] || ''}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCompleteHandover(selectedReferral.id)}
                  className="eleven-button eleven-button-primary text-xs py-1.5 px-3 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  ✓ Complete Handover
                </button>
                <button
                  onClick={() => { setSelectedReferral(null); setDecryptedPacket(null); setPacketMeta(null); }}
                  className="eleven-button eleven-button-secondary text-xs py-1.5 px-3 font-bold hover:bg-[#292524] hover:text-white"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">

              {/* Re-routing alert */}
              {(selectedReferral.status === 'RE_ROUTING' || selectedReferral.status === 'RE_ROUTED') && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-xs" role="status" aria-live="polite">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 animate-bounce" />
                  <div>
                    <h4 className="font-bold text-[#0c0a09]">AUTO RE-ROUTING IN PROGRESS</h4>
                    <p className="text-[#4e4e4e] mt-0.5">Capacity lost at destination. Recalculating route from live ambulance GPS…</p>
                  </div>
                </div>
              )}

              {/* ── Patient Key & Encryption Security Bar ── */}
              <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Patient Key */}
                <div className="sm:col-span-2">
                  <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest mb-1.5">Patient Key (HMAC-SHA256)</p>
                  {(packetMeta?.patientKey || selectedReferral.patientKey) ? (
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-mono text-xs text-emerald-200 font-bold break-all">
                        {(packetMeta?.patientKey || selectedReferral.patientKey).substring(0, 20)}
                        <span className="text-emerald-600">…</span>
                        {(packetMeta?.patientKey || selectedReferral.patientKey).substring(56)}
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(packetMeta?.patientKey || selectedReferral.patientKey)}
                        className="text-emerald-500 hover:text-white p-1 transition-colors shrink-0"
                        title="Copy full key"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[#a8a29e] font-mono">No key — patient phone not provided at registration</p>
                  )}
                </div>

                {/* Security indicators */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { icon: Lock,    color: 'emerald', label: 'Encryption', value: packetMeta?.encryptionMode || 'AES-256-GCM' },
                    { icon: Shield,  color: 'blue',    label: 'Audit Chain', value: 'SHA-256 ✓' },
                  ].map(({ icon: Icon, color, label, value }) => (
                    <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-2">
                      <Icon className={`w-3.5 h-3.5 text-${color}-400 mx-auto mb-0.5`} />
                      <p className={`text-[9px] text-${color}-300 font-mono uppercase tracking-wide`}>{label}</p>
                      <p className={`text-[10px] text-${color}-200 font-mono font-bold mt-0.5`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ambulance telemetry */}
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
                    <p className="font-bold text-[#292524]">{selectedReferral.ambulance.driverName}</p>
                  </div>
                </div>
              )}

              {/* Live GPS map */}
              <DeliveryLiveMap referral={selectedReferral} />

              {/* ── Decrypted clinical packet ── */}
              {loadingPacket && (
                <div className="eleven-card p-6 text-center text-xs text-[#777169] flex items-center justify-center gap-2" role="status">
                  <Loader2 className="w-4 h-4 animate-spin" /> Decrypting AES-256-GCM payload…
                </div>
              )}

              {!loadingPacket && decryptedPacket && (
                <div className="space-y-3">
                  {/* Packet header */}
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-[#0c0a09] uppercase tracking-wider font-mono">Decrypted Clinical Packet</h3>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono font-bold">
                      {packetMeta?.encryptionMode || 'AES-256-GCM'} · Authenticated ✓
                    </span>
                  </div>

                  <div className="eleven-card p-5 space-y-4 bg-[#fafafa] border-[#e7e5e4] text-xs">
                    {/* Core patient fields */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-3 border-b border-[#e7e5e4]">
                      <div>
                        <span className="text-[#777169] block mb-0.5">Patient</span>
                        <p className="font-bold text-[#0c0a09]">
                          {decryptedPacket.patientName || '—'}{' '}
                          {decryptedPacket.patientAge ? `(${decryptedPacket.patientAge}y` : ''}
                          {decryptedPacket.patientSex ? `, ${decryptedPacket.patientSex})` : ')'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[#777169] block mb-0.5">Diagnosis</span>
                        <p className="font-bold text-blue-700">{decryptedPacket.diagnosisSuspected || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[#777169] block mb-0.5">Referring Doctor</span>
                        <p className="font-bold text-[#0c0a09]">{decryptedPacket.referringDoctorName || '—'}</p>
                      </div>
                      <div>
                        <span className="text-[#777169] block mb-0.5">Reason for Transfer</span>
                        <p className="font-bold text-amber-700">{decryptedPacket.reasonForReferral || '—'}</p>
                      </div>
                    </div>

                    {/* Phone number (from encrypted packet) */}
                    {decryptedPacket.patientPhone && (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-[10px] text-emerald-700 font-mono font-bold uppercase tracking-wide">
                            Contact Number ({decryptedPacket.phoneOwner || 'patient'}) — from encrypted packet
                          </p>
                          <p className="font-mono font-bold text-emerald-800 mt-0.5">
                            {decryptedPacket.patientPhone.replace(/(\d{2})(\d{6})(\d{2})/, '$1••••••$3')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Vitals */}
                    {decryptedPacket.vitals && (
                      <div className="flex flex-wrap gap-2 font-mono tabular-nums">
                        <span className="font-bold text-[#777169] font-sans">Vitals:</span>
                        {[
                          ['BP', decryptedPacket.vitals.bp],
                          ['HR', decryptedPacket.vitals.hr && `${decryptedPacket.vitals.hr} bpm`],
                          ['SpO₂', decryptedPacket.vitals.spo2 && `${decryptedPacket.vitals.spo2}%`],
                          ['RR', decryptedPacket.vitals.rr],
                          ['GCS', decryptedPacket.vitals.gcs && `${decryptedPacket.vitals.gcs}/15`],
                        ].map(([label, value]) => value && value !== '—' && (
                          <span key={label} className="bg-white border border-[#e7e5e4] px-2.5 py-0.5 rounded-full text-[#292524] text-[11px]">
                            {label}: <strong>{value}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Clinical summary */}
                    {decryptedPacket.clinicalSummary && (
                      <div>
                        <span className="text-[#777169] font-semibold">Clinical Summary:</span>
                        <p className="text-[#292524] mt-1 leading-relaxed">{decryptedPacket.clinicalSummary}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Transfer progress timeline ── */}
              <div className="eleven-card p-5 space-y-4 bg-white border border-[#e7e5e4]">
                <div className="flex items-center justify-between border-b border-[#f0efed] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <h3 className="text-xs font-bold text-[#0c0a09] uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#292524]" />
                      <span>Live Transfer Progress</span>
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                    {selectedReferral.status === 'COMPLETED' ? '100% COMPLETE' : 'IN PROGRESS'}
                  </span>
                </div>

                <div className="relative pl-7 space-y-4 before:absolute before:left-3 before:top-3 before:bottom-3 before:w-0.5 before:bg-emerald-200">
                  {[
                    { step: 1, title: 'Referral Created & Patient Key Generated', completed: true, desc: `Patient registered with HMAC-SHA256 key. Clinical data encrypted with AES-256-GCM. Blockchain audit chain started.` },
                    { step: 2, title: 'Hospital Matched & Bed Soft-Hold Placed',  completed: true, desc: `Live capacity read. Best candidate matched. Atomic soft-hold placed on required resources.` },
                    { step: 3, title: 'Referral Dispatched — Receiving Desk Notified', completed: ['REQUEST_SENT','ACCEPTED','HOSPITAL_CONFIRMED','IN_TRANSIT','COMPLETED','RE_ROUTED'].includes(selectedReferral.status), desc: `WebSocket push to receiving hospital desk. No accept/reject gate — notification only.` },
                    { step: 4, title: selectedReferral.status === 'RE_ROUTED' ? 'Auto-Rerouted Mid-Transit' : 'Ambulance Dispatched — Green Corridor Active', completed: ['IN_TRANSIT','COMPLETED'].includes(selectedReferral.status), isCurrent: selectedReferral.status === 'IN_TRANSIT', desc: selectedReferral.status === 'RE_ROUTED' ? `Capacity loss detected. System auto-rerouted to next best hospital. Reroute logged to blockchain chain.` : `ALS unit en route. GPS tracked. Reroute engine armed and monitoring destination capacity.` },
                    { step: 5, title: 'Clinical Handover & Patient Admitted', completed: selectedReferral.status === 'COMPLETED', isCurrent: selectedReferral.status === 'COMPLETED', desc: 'Patient received. Referral closed. All events immutably recorded in hash chain.' }
                  ].map((item) => (
                    <div key={item.step} className="relative flex items-start gap-3">
                      <div className={`absolute -left-7 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                        item.isCurrent   ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100 animate-pulse' :
                        item.completed   ? 'bg-emerald-500 text-white border-emerald-500' :
                                           'bg-white text-[#a8a29e] border-[#d6d3d1]'
                      }`}>
                        {item.completed ? '✓' : item.step}
                      </div>
                      <div className={`eleven-card p-3.5 w-full border ${
                        item.isCurrent ? 'bg-emerald-50 border-emerald-300' :
                        item.completed ? 'bg-[#fafafa] border-[#e7e5e4]' :
                                         'bg-white border-[#f0efed] opacity-50'
                      }`}>
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-bold text-[#0c0a09] flex items-center gap-1.5">
                            {item.step}. {item.title}
                            {item.isCurrent && <span className="text-[9px] bg-emerald-600 text-white font-mono px-1.5 rounded-full">ACTIVE</span>}
                          </span>
                        </div>
                        <p className="text-xs text-[#4e4e4e] mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Blockchain Audit Trail ── */}
              <AuditTrailPanel referralId={selectedReferral.id} />

            </div>
          </div>
        </div>
      )}

      {/* ── ReferralStatusDashboard ── */}
      {statusDashboardRef && (
        <ReferralStatusDashboard
          referral={statusDashboardRef}
          authSession={authSession}
          onClose={() => setStatusDashboardRef(null)}
        />
      )}
    </div>
  );
}

// NOTE: ReferralStatusDashboard mount is rendered inside the MainDashboard return
// via statusDashboardRef state — see the JSX near the bottom of the component.
