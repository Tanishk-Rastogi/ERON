import React, { useState, useEffect } from 'react';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { CriticalFind } from './components/CriticalFind';
import { ReceivingTab } from './components/ReceivingTab';
import { CapacityPanel } from './components/CapacityPanel';
import { TransferTab } from './components/TransferTab';
import { ControlRoomAnalytics } from './components/ControlRoomAnalytics';
import { DemoCenterpiece } from './components/DemoCenterpiece';
import { MessagingCenter } from './components/MessagingCenter';
import { RoleSwitcher } from './components/RoleSwitcher';
import { FlowTester } from './components/FlowTester';
import { SMSModal } from './components/SMSModal';
import { AuthPage } from './components/AuthPage';
import { Bell, X, ShieldCheck } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('receiving');
  const [authSession, setAuthSession] = useState(() => {
    try {
      const saved = localStorage.getItem('eron_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Perspective switcher role
  const [activeRole, setActiveRole] = useState({
    id: 'nurse-a',
    name: 'Nurse Anjali Verma',
    roleDesk: 'Duty Nurse',
    hospitalId: 'hosp-a',
    hospitalName: 'District Hospital Central (Hosp A)'
  });

  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [activePacketModalId, setActivePacketModalId] = useState(null);
  const [decryptedPacketData, setDecryptedPacketData] = useState(null);
  const [loadingPacket, setLoadingPacket] = useState(false);

  const { lastNotification, setLastNotification } = useWebSocket();
  const [preSelectedReceivingRef, setPreSelectedReceivingRef] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem('eron_auth_session');
    setAuthSession(null);
  };

  const handleOpenPacketModal = async (packetId = 'pkt-1') => {
    setActivePacketModalId(packetId);
    setDecryptedPacketData(null);
    setLoadingPacket(true);

    try {
      const res = await fetch('/api/referrals/ref-1001/packet');
      if (res.ok) {
        const data = await res.json();
        setDecryptedPacketData(data.decryptedPayload);
      }
    } catch (err) {
      console.error('Packet decrypt error:', err);
    } finally {
      setLoadingPacket(false);
    }
  };

  if (!authSession) {
    return <AuthPage onLoginSuccess={(session) => setAuthSession(session)} />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#292524] flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        authSession={authSession}
        onLogout={handleLogout}
      />

      {/* Live Toast Notification Banner */}
      {lastNotification && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full mt-4">
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm text-xs font-medium animate-in slide-in-from-top duration-300 ${
            lastNotification.type === 'success' ? 'bg-[#a7e5d3]/30 text-[#0c0a09] border-[#a7e5d3]' :
            lastNotification.type === 'warning' ? 'bg-[#f4c5a8]/40 text-[#0c0a09] border-[#f4c5a8]' :
            lastNotification.type === 'error' ? 'bg-[#e8b8c4]/40 text-[#dc2626] border-[#e8b8c4]' :
            'bg-[#a8c8e8]/30 text-[#0c0a09] border-[#a8c8e8]'
          }`}>
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>{lastNotification.text}</span>
            </div>
            <button
              onClick={() => setLastNotification(null)}
              className="text-[#777169] hover:text-[#0c0a09] p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Screen Content Router */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">

        {activeTab === 'messages' && (
          <div className="space-y-6">
            {/* End-to-End Referral Flow Test Suite */}
            <FlowTester 
              onSelectPerspective={(role) => setActiveRole(role)}
              onOpenPacketModal={(pktId) => handleOpenPacketModal(pktId)}
            />

            {/* Tester Perspective / Role Switcher */}
            <RoleSwitcher 
              activeRole={activeRole} 
              onRoleChange={(role) => setActiveRole(role)} 
            />

            {/* Messaging & Communication Center */}
            <MessagingCenter 
              activeRole={activeRole} 
              onOpenPacketModal={(pktId) => handleOpenPacketModal(pktId)}
            />
          </div>
        )}

        {activeTab === 'transfer' && (
          <TransferTab />
        )}
        {activeTab === 'receiving' && (
          <ReceivingTab 
            preSelectedReferral={preSelectedReceivingRef}
            onNavigateToCapacity={() => setActiveTab('capacity')} 
          />
        )}
        {activeTab === 'capacity' && (
          <CapacityPanel />
        )}
        {activeTab === 'control-room' && (
          <ControlRoomAnalytics />
        )}
        {activeTab === 'demo-centerpiece' && (
          <DemoCenterpiece onRerouteTriggered={() => setActiveTab('dashboard')} />
        )}
      </main>

      {/* SMS Short-Code 1923 Sandbox Modal */}
      <SMSModal 
        isOpen={isSmsModalOpen} 
        onClose={() => setIsSmsModalOpen(false)} 
      />

      {/* Clinical Packet Decryption Modal */}
      {activePacketModalId && (
        <div className="fixed inset-0 z-[9999] bg-[#0c0a09]/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="eleven-card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 bg-white border-[#d6d3d1] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7e5e4] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm font-bold text-[#0c0a09]">
                  Clinical Handoff Packet (#PAT-2026-8941)
                </h2>
              </div>

              <button
                onClick={() => setActivePacketModalId(null)}
                className="eleven-button eleven-button-secondary text-xs py-1 px-3"
              >
                ✕ Close
              </button>
            </div>

            {loadingPacket ? (
              <div className="p-8 text-center text-xs text-[#777169] font-mono">
                Decrypting payload with private key...
              </div>
            ) : decryptedPacketData ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4]">
                  <div>
                    <span className="text-[#777169] text-[10px] block">Patient Name:</span>
                    <p className="font-bold text-[#0c0a09]">{decryptedPacketData.patientName} ({decryptedPacketData.patientAge}y, {decryptedPacketData.patientSex})</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Suspected Condition:</span>
                    <p className="font-bold text-blue-600">{decryptedPacketData.diagnosisSuspected}</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Referring Doctor:</span>
                    <p className="font-bold text-[#0c0a09]">{decryptedPacketData.referringDoctorName}</p>
                  </div>
                  <div>
                    <span className="text-[#777169] text-[10px] block">Transfer Reason:</span>
                    <p className="font-bold text-amber-700">{decryptedPacketData.reasonForReferral}</p>
                  </div>
                </div>

                {decryptedPacketData.vitals && (
                  <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-2xl flex flex-wrap gap-2 text-[11px] font-mono">
                    <span className="font-bold text-emerald-900">Vitals:</span>
                    <span className="bg-white border px-2 py-0.5 rounded-full">BP: {decryptedPacketData.vitals.bp}</span>
                    <span className="bg-white border px-2 py-0.5 rounded-full">HR: {decryptedPacketData.vitals.hr} bpm</span>
                    <span className="bg-white border px-2 py-0.5 rounded-full">SpO2: {decryptedPacketData.vitals.spo2}%</span>
                    <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">GCS: {decryptedPacketData.vitals.gcs}/15</span>
                  </div>
                )}

                <div className="bg-[#fafafa] p-4 rounded-2xl border border-[#e7e5e4] space-y-1">
                  <span className="font-bold text-[#0c0a09] block">Clinical Summary & Treatment:</span>
                  <p className="text-[#292524] leading-relaxed">{decryptedPacketData.clinicalSummary}</p>
                  <p className="text-blue-700 font-semibold pt-1">Treatment Given: {decryptedPacketData.treatmentGiven}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}
