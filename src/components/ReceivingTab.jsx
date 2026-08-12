import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  Navigation, 
  AlertCircle, 
  FileText, 
  Activity, 
  Ambulance, 
  CheckCircle2, 
  ArrowRight,
  Unlock
} from 'lucide-react';

export function ReceivingTab({ onNavigateToCapacity }) {
  const { referrals } = useWebSocket();
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [packetData, setPacketData] = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);

  const incomingReferrals = referrals.filter(r => 
    (r.targetHospitalId === 'hosp-b' || r.targetHospitalId === 'hosp-c' || r.acceptedHospitalId === 'hosp-b' || r.acceptedHospitalId === 'hosp-c') &&
    r.status !== 'COMPLETED'
  );

  const handleSelectReferral = async (ref) => {
    setSelectedReferral(ref);
    setPacketData(null);
    setLoadingPacket(true);

    try {
      const res = await fetch(`/api/referrals/${ref.id}/packet`);
      if (res.ok) {
        const data = await res.json();
        setPacketData(data.decryptedPayload);
      }
    } catch (err) {
      console.error('Packet decrypt fetch error:', err);
    } finally {
      setLoadingPacket(false);
    }
  };

  const handleCompleteHandover = async (refId) => {
    try {
      await fetch(`/api/referrals/${refId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: 'user-admin-b' })
      });
    } catch (err) {
      console.error('Handover error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#292524] text-white flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#0c0a09]">Receiving Tab (Incoming Transfers)</h1>
              <p className="text-xs text-[#777169] font-light">
                Live notification feed for receiving admission desks and trauma teams.
              </p>
            </div>
          </div>

          <button
            onClick={onNavigateToCapacity}
            className="eleven-button eleven-button-secondary text-xs"
          >
            <span>Update Capacity Panel</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#777169]" />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-[#777169] uppercase tracking-widest font-mono">
          INCOMING PATIENT PIPELINE ({incomingReferrals.length})
        </h2>

        {incomingReferrals.length === 0 ? (
          <div className="eleven-card p-12 text-center text-xs text-[#777169] space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#16a34a] mx-auto" />
            <h3 className="font-semibold text-[#0c0a09]">No Incoming Referrals</h3>
            <p>Your hospital has no active incoming patient transfers right now.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {incomingReferrals.map((ref) => (
              <div
                key={ref.id}
                className="eleven-card p-6 space-y-4 bg-white hover:border-[#292524]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#0c0a09]">#{ref.patientRefCode}</span>
                    <span className="eleven-badge bg-[#a7e5d3]/30 text-[#0c0a09] border-[#a7e5d3]">
                      {ref.status}
                    </span>
                  </div>

                  <span className="text-xs font-bold text-[#d97706] flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" /> ETA: 8-12M
                  </span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#292524]">{ref.requirementSummary}</h3>
                  <p className="text-xs text-[#777169]">Referring Hospital: <strong className="text-[#0c0a09]">{ref.originHospitalName}</strong></p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#f0efed] text-xs">
                  <button
                    onClick={() => handleSelectReferral(ref)}
                    className="eleven-button eleven-button-secondary py-1.5 px-3 text-xs"
                  >
                    <Unlock className="w-3.5 h-3.5 text-[#16a34a]" />
                    <span>Decrypt Packet</span>
                  </button>

                  {ref.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleCompleteHandover(ref.id)}
                      className="eleven-button eleven-button-primary py-1.5 px-3 text-xs"
                    >
                      Complete Handover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Packet Modal */}
      {selectedReferral && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="eleven-card w-full max-w-3xl p-8 space-y-5 bg-white border-[#d6d3d1] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-light text-[#0c0a09]">Digital Clinical Handoff Packet</h3>
                  <span className="eleven-badge bg-[#a7e5d3]/40 text-[#0c0a09] border-[#a7e5d3]">
                    AES-256 Decrypted
                  </span>
                </div>
                <p className="text-xs text-[#777169]">Referral #{selectedReferral.patientRefCode}</p>
              </div>

              <button
                onClick={() => setSelectedReferral(null)}
                className="eleven-button eleven-button-secondary py-1 px-3 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {loadingPacket ? (
              <div className="p-8 text-center text-xs text-[#777169]">
                Decrypting packet payload...
              </div>
            ) : packetData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 eleven-card p-4 bg-[#fafafa]">
                  <div>
                    <span className="text-[#777169]">Patient:</span>
                    <p className="font-bold text-[#0c0a09]">{packetData.patientName} ({packetData.patientAge}y {packetData.patientSex})</p>
                  </div>
                  <div>
                    <span className="text-[#777169]">Suspected Condition:</span>
                    <p className="font-bold text-[#2563eb]">{packetData.diagnosisSuspected}</p>
                  </div>
                  <div>
                    <span className="text-[#777169]">Referring Doctor:</span>
                    <p className="font-bold text-[#0c0a09]">{packetData.referringDoctorName}</p>
                  </div>
                </div>

                <div className="eleven-card p-4 space-y-2 bg-[#fafafa]">
                  <h4 className="font-bold text-[#0c0a09]">Clinical Summary & Vitals</h4>
                  <p className="text-[#292524]">{packetData.clinicalSummary}</p>
                  {packetData.vitals && (
                    <div className="flex flex-wrap gap-2 pt-2 text-[11px] font-mono">
                      <span className="bg-white border border-[#e7e5e4] px-2.5 py-1 rounded-full text-[#292524]">BP: {packetData.vitals.bp}</span>
                      <span className="bg-white border border-[#e7e5e4] px-2.5 py-1 rounded-full text-[#292524]">HR: {packetData.vitals.hr}</span>
                      <span className="bg-white border border-[#e7e5e4] px-2.5 py-1 rounded-full text-[#292524]">SpO2: {packetData.vitals.spo2}%</span>
                      <span className="bg-[#a7e5d3]/40 text-[#0c0a09] border border-[#a7e5d3] px-2.5 py-1 rounded-full font-bold">GCS: {packetData.vitals.gcs}/15</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
