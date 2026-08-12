import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Zap, 
  AlertTriangle, 
  MessageSquareText, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Send,
  Navigation,
  ShieldCheck,
  Play
} from 'lucide-react';

export function DemoCenterpiece({ onRerouteTriggered }) {
  const { referrals, refreshAll } = useWebSocket();
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  const [smsPhone, setSmsPhone] = useState('+91-98765-43210');
  const [smsText, setSmsText] = useState('CT 500 URGENT');
  const [smsReply, setSmsReply] = useState(null);
  const [smsLoading, setSmsLoading] = useState(false);

  const activeInTransitReferral = referrals.find(r => r.status === 'IN_TRANSIT') || referrals[0];

  const handleSimulateCapacityLoss = async () => {
    setSimulating(true);
    setSimulationResult(null);

    try {
      const res = await fetch('/api/referrals/simulate-capacity-loss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralId: activeInTransitReferral ? activeInTransitReferral.id : null
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
        refreshAll();
        if (onRerouteTriggered) onRerouteTriggered();
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleSendSms = async () => {
    setSmsLoading(true);
    setSmsReply(null);

    try {
      const res = await fetch('/api/sms/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPhone: smsPhone,
          body: smsText
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSmsReply(data);
      }
    } catch (err) {
      console.error('SMS error:', err);
    } finally {
      setSmsLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <div className="eleven-card p-8 bg-gradient-to-r from-[#292524] via-[#1c1917] to-[#0c0a09] text-white border-none shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-light">Auto-Reroute Engine Demo & SMS Sandbox</h1>
              <span className="eleven-badge bg-white/20 text-white border-white/30">
                Interactive Tool
              </span>
            </div>
            <p className="text-xs text-[#a8a29e] font-light">
              Trigger mid-transit capacity loss to observe automatic re-routing recalculation in real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Centerpiece Demo */}
      <div className="eleven-card p-8 space-y-5 bg-white border-[#e7e5e4]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-[#0c0a09] uppercase tracking-widest font-mono flex items-center gap-2">
              <Play className="w-4 h-4 text-[#292524]" />
              <span>Centerpiece Demo Trigger: Mid-Transit Capacity Loss</span>
            </h2>
            <p className="text-xs text-[#777169] max-w-xl font-light">
              Simulates a walk-in taking the last ICU bed at Hospital B while an ambulance carrying Referral #{activeInTransitReferral ? activeInTransitReferral.patientRefCode : 'PAT-8941'} is en-route.
            </p>
          </div>

          <button
            onClick={handleSimulateCapacityLoss}
            disabled={simulating}
            className="eleven-button eleven-button-primary text-xs"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{simulating ? 'Executing Engine...' : 'TRIGGER MID-TRANSIT REROUTE DEMO'}</span>
          </button>
        </div>

        {simulationResult && (
          <div className="eleven-card p-5 bg-[#fafafa] border-[#a7e5d3] space-y-3 text-xs">
            <div className="flex items-center gap-2 text-[#16a34a] font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-[#16a34a]" />
              <span>Auto-Reroute Engine Executed Successfully!</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="eleven-card p-4 border-[#e8b8c4] bg-[#e8b8c4]/20">
                <span className="text-[#777169]">Previous Destination:</span>
                <p className="font-bold text-[#dc2626]">{simulationResult.rerouteResult.oldHospitalName}</p>
                <span className="text-[10px] text-[#dc2626] font-mono">Capacity set to 0 (Walk-in)</span>
              </div>

              <div className="eleven-card p-4 border-[#a7e5d3] bg-[#a7e5d3]/20">
                <span className="text-[#777169]">New Target Destination:</span>
                <p className="font-bold text-[#0c0a09]">{simulationResult.rerouteResult.newHospitalName}</p>
                <span className="text-[10px] text-[#16a34a] font-mono">Matched from Live Ambulance GPS</span>
              </div>

              <div className="eleven-card p-4 border-[#a8c8e8] bg-[#a8c8e8]/20">
                <span className="text-[#777169]">Updated Travel ETA:</span>
                <p className="font-bold text-[#2563eb] text-sm">{simulationResult.rerouteResult.newEtaMinutes} mins</p>
                <span className="text-[10px] text-[#2563eb] font-mono">Destination Pin Updated</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SMS Sandbox */}
      <div className="eleven-card p-8 space-y-5 bg-white border-[#e7e5e4]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#292524] text-white flex items-center justify-center">
            <MessageSquareText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#0c0a09] font-mono">SMS Short-Code Fallback Sandbox (Twilio / MSG91)</h2>
            <p className="text-xs text-[#777169] font-light">
              For low-connectivity rural peripheral staff without smartphone internet access.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[#777169] font-semibold">Staff Mobile Number:</label>
              <input
                type="text"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-2.5 mt-1 text-[#292524] font-mono focus:outline-none focus:border-[#292524] focus:bg-white"
              />
            </div>

            <div>
              <label className="text-[#777169] font-semibold">SMS Payload (Short-Code 1923):</label>
              <input
                type="text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#e7e5e4] rounded-2xl p-2.5 mt-1 text-[#292524] font-mono focus:outline-none focus:border-[#292524] uppercase focus:bg-white"
              />
            </div>

            <button
              onClick={handleSendSms}
              disabled={smsLoading}
              className="eleven-button eleven-button-primary text-xs"
            >
              <Send className="w-4 h-4" />
              <span>{smsLoading ? 'Sending...' : 'Simulate Inbound SMS'}</span>
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <label className="text-[#777169] font-semibold">Gateway Response (Max 160 Chars):</label>
            {smsReply ? (
              <div className="eleven-card p-4 bg-[#fafafa] border-[#e7e5e4] space-y-2">
                <div className="flex items-center justify-between text-[11px] text-[#777169] font-mono">
                  <span>To: {smsReply.fromPhone}</span>
                  <span className="text-[#16a34a] font-bold">✓ Sent via MSG91</span>
                </div>
                <p className="font-mono text-sm text-[#0c0a09] font-bold bg-white p-3 rounded-xl border border-[#e7e5e4]">
                  "{smsReply.replyText}"
                </p>
              </div>
            ) : (
              <div className="eleven-card p-6 text-center text-[#777169] font-mono">
                Click "Simulate Inbound SMS" to test short-code reply.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
