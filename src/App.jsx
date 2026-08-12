import React, { useState } from 'react';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { Header } from './components/Header';
import { MainDashboard } from './components/MainDashboard';
import { CriticalFind } from './components/CriticalFind';
import { ReceivingTab } from './components/ReceivingTab';
import { CapacityPanel } from './components/CapacityPanel';
import { ControlRoomAnalytics } from './components/ControlRoomAnalytics';
import { DemoCenterpiece } from './components/DemoCenterpiece';
import { Bell, X } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { lastNotification, setLastNotification } = useWebSocket();

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#292524] flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
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
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {activeTab === 'dashboard' && (
          <MainDashboard onNavigateToCriticalFind={() => setActiveTab('critical-find')} />
        )}
        {activeTab === 'critical-find' && (
          <CriticalFind onReferralCreated={() => setActiveTab('dashboard')} />
        )}
        {activeTab === 'receiving' && (
          <ReceivingTab onNavigateToCapacity={() => setActiveTab('capacity')} />
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

      {/* Clean Footer */}
      <footer className="border-t border-[#e7e5e4] py-4 text-center text-xs text-[#777169] bg-white/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Emergency Referral Orchestration Network (ERON) — Real-time Bed State Machine</span>
          <span className="font-mono text-[#292524] font-semibold">Notify, Don't Gate</span>
        </div>
      </footer>
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
