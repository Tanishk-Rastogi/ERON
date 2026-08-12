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
  FileText, 
  Ambulance, 
  Activity,
  MapPin,
  RefreshCw,
  Eye,
  ChevronRight,
  Sparkles,
  Building2,
  Plus
} from 'lucide-react';

export function MainDashboard({ onNavigateToCriticalFind }) {
  const { referrals, isConnected, refreshAll } = useWebSocket();
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('sending');
  const [decryptedPacket, setDecryptedPacket] = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);

  const sendingReferrals = referrals.filter(r => r.originHospitalId === 'hosp-a' || r.originHospitalId === 'hosp-d');
  const receivingReferrals = referrals.filter(r => r.targetHospitalId === 'hosp-b' || r.targetHospitalId === 'hosp-c');

  const displayedReferrals = activeSubTab === 'sending' ? sendingReferrals : receivingReferrals;

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
        return <span className="eleven-badge bg-[#a8c8e8]/30 text-[#0c0a09] border-[#a8c8e8] flex items-center gap-1 font-mono"><Navigation className="w-3 h-3 text-[#2563eb]" /> IN TRANSIT</span>;
      case 'RE_ROUTING':
        return <span className="eleven-badge bg-[#f4c5a8]/40 text-[#0c0a09] border-[#f4c5a8] flex items-center gap-1 animate-pulse"><AlertTriangle className="w-3 h-3 text-[#d97706]" /> AUTO RE-ROUTING</span>;
      case 'RE_ROUTING_ESCALATED':
        return <span className="eleven-badge bg-[#e8b8c4]/40 text-[#dc2626] border-[#e8b8c4] flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-[#dc2626]" /> ESCALATED TO CONTROL ROOM</span>;
      case 'ACCEPTED':
      case 'HOSPITAL_CONFIRMED':
        return <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3] flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#16a34a]" /> HOSPITAL CONFIRMED</span>;
      case 'COMPLETED':
        return <span className="eleven-badge bg-[#f0efed] text-[#777169] border-[#e7e5e4] flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#16a34a]" /> CLOSED & HANDED OVER</span>;
      default:
        return <span className="eleven-badge bg-[#c8b8e0]/30 text-[#0c0a09] border-[#c8b8e0] flex items-center gap-1"><Clock className="w-3 h-3 text-[#292524]" /> REQUEST SENT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Header Card */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5] relative overflow-hidden border-[#e7e5e4]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-light tracking-tight text-[#0c0a09]">Referral Orchestration Control</h1>
              <span className="text-[10px] bg-[#f0efed] text-[#4e4e4e] font-mono px-2 py-0.5 rounded-full border border-[#e7e5e4]">
                DISTRICT-01
              </span>
            </div>
            <p className="text-xs text-[#777169] mt-1 max-w-2xl font-light leading-relaxed">
              Quiet real-time coordination layer. Live bed capacity telemetries and automatic mid-transit re-routing updates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={refreshAll}
              className="eleven-button eleven-button-secondary text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={onNavigateToCriticalFind}
              className="eleven-button eleven-button-primary text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Critical Referral</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab('sending')}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border ${
              activeSubTab === 'sending'
                ? 'bg-[#292524] text-white border-[#292524]'
                : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>SENDING ({sendingReferrals.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('receiving')}
            className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border ${
              activeSubTab === 'receiving'
                ? 'bg-[#292524] text-white border-[#292524]'
                : 'bg-white text-[#777169] border-[#e7e5e4] hover:bg-[#f0efed]'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>RECEIVING ({receivingReferrals.length})</span>
          </button>
        </div>

        <span className="text-xs text-[#777169] font-mono hidden sm:inline">
          Active Records: {displayedReferrals.length}
        </span>
      </div>

      {/* Referral List */}
      <div className="grid grid-cols-1 gap-4">
        {displayedReferrals.length === 0 ? (
          <div className="eleven-card p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#a8a29e] mx-auto" />
            <h3 className="text-sm font-semibold text-[#292524]">No Active Referrals in Queue</h3>
            <p className="text-xs text-[#777169] max-w-sm mx-auto">
              All patient transfers are completed or no referrals have been initiated.
            </p>
          </div>
        ) : (
          displayedReferrals.map((ref) => (
            <div
              key={ref.id}
              onClick={() => handleOpenDetail(ref)}
              className="eleven-card p-6 cursor-pointer space-y-3 group"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#0c0a09]">#{ref.patientRefCode}</span>
                    {getStatusBadge(ref.status)}
                    <span className={`eleven-badge ${
                      ref.priority === 'CRITICAL' ? 'bg-[#e8b8c4]/30 text-[#dc2626] border-[#e8b8c4]' : 'bg-[#f4c5a8]/30 text-[#d97706] border-[#f4c5a8]'
                    }`}>
                      {ref.priority} PRIORITY
                    </span>
                    {ref.reroutedCount > 0 && (
                      <span className="eleven-badge bg-[#f4c5a8] text-[#0c0a09] border-[#f4c5a8]">
                        ⚡ Rerouted ({ref.reroutedCount}x)
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-medium text-[#292524] group-hover:text-[#0c0a09] transition-colors">
                    {ref.requirementSummary}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#777169]">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#a8a29e]" />
                      <span>From: <strong className="text-[#292524]">{ref.originHospitalName}</strong></span>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#d6d3d1]" />
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#292524]" />
                      <span>To: <strong className="text-[#0c0a09] font-bold">{ref.targetHospitalName}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 border-t lg:border-t-0 border-[#f0efed] pt-3 lg:pt-0">
                  {ref.ambulance && (
                    <div className="text-right text-xs">
                      <div className="flex items-center gap-1 font-bold text-[#292524]">
                        <Ambulance className="w-3.5 h-3.5 text-[#292524]" />
                        <span>{ref.ambulance.id} ({ref.ambulance.type})</span>
                      </div>
                      <p className="text-[11px] text-[#777169]">Driver: {ref.ambulance.driverName}</p>
                    </div>
                  )}

                  <button className="eleven-button eleven-button-secondary text-xs py-2 px-3">
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Detail</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="eleven-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 space-y-6 bg-white border-[#d6d3d1]">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-light text-[#0c0a09]">Referral Telemetry & Packet</h2>
                  <span className="font-mono text-xs text-[#292524] bg-[#f5f5f5] border border-[#e7e5e4] px-2 py-0.5 rounded-full">
                    #{selectedReferral.patientRefCode}
                  </span>
                </div>
                <p className="text-xs text-[#777169] mt-0.5">{selectedReferral.requirementSummary}</p>
              </div>

              <button
                onClick={() => setSelectedReferral(null)}
                className="eleven-button eleven-button-secondary text-xs py-1 px-3"
              >
                ✕ Close
              </button>
            </div>

            {selectedReferral.status === 'RE_ROUTING' && (
              <div className="bg-[#f4c5a8]/30 border border-[#f4c5a8] p-4 rounded-2xl flex items-center gap-3 text-[#0c0a09] text-xs">
                <AlertTriangle className="w-5 h-5 text-[#d97706] flex-shrink-0 animate-bounce" />
                <div>
                  <h4 className="font-bold">AUTO RE-ROUTING IN PROGRESS</h4>
                  <p className="text-[#4e4e4e]">Capacity lost at destination. Recalculating candidate route from live ambulance GPS coordinates...</p>
                </div>
              </div>
            )}

            {/* Decrypted Clinical Packet */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#777169] flex items-center gap-1.5 font-mono">
                <ShieldCheck className="w-4 h-4 text-[#16a34a]" />
                <span>AES-256 ENCRYPTED CLINICAL HANDOFF PACKET</span>
              </h3>

              {loadingPacket ? (
                <div className="eleven-card p-6 text-center text-xs text-[#777169]">
                  Decrypting payload...
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
                    <div className="flex flex-wrap gap-2 text-[11px]">
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

            {/* Audit Log Events */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs uppercase font-extrabold tracking-widest text-[#777169] flex items-center gap-1.5 font-mono">
                <Clock className="w-4 h-4 text-[#292524]" />
                <span>IMMUTABLE AUDIT LOG (ReferralEvent Stream)</span>
              </h3>

              <div className="space-y-2 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#e7e5e4]">
                {(selectedReferral.events || []).map((evt, idx) => (
                  <div key={evt.id || idx} className="flex items-start gap-3 relative pl-8 text-xs font-mono">
                    <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full bg-[#292524]" />
                    <div className="eleven-card p-3 w-full bg-[#fafafa]">
                      <div className="flex items-center justify-between text-[11px] text-[#777169]">
                        <span className="font-bold text-[#0c0a09] uppercase">{evt.eventType}</span>
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-[#292524] font-sans mt-1">{evt.metadata?.note || evt.metadata?.reason || JSON.stringify(evt.metadata)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
