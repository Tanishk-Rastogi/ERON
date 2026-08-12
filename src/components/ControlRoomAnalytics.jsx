import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  BarChart3, 
  AlertTriangle, 
  Activity, 
  TrendingUp, 
  Building2, 
  ShieldAlert, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export function ControlRoomAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const { referrals } = useWebSocket();

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/district');
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [referrals]);

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#292524] text-white flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#0c0a09]">District Control Room Analytics</h1>
              <p className="text-xs text-[#777169] font-light">
                Systemic referral intelligence & capacity analytics for Health Authorities.
              </p>
            </div>
          </div>

          <button
            onClick={fetchAnalytics}
            className="eleven-button eleven-button-secondary text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Analytics</span>
          </button>
        </div>
      </div>

      {analytics && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
            <div className="eleven-card p-6 space-y-1 bg-white">
              <span className="text-xs text-[#777169] font-bold">ACTIVE REFERRALS</span>
              <div className="text-3xl font-bold text-[#0c0a09]">{analytics.activeCount}</div>
              <p className="text-[11px] text-[#777169] font-sans">In transit or matched</p>
            </div>

            <div className="eleven-card p-6 space-y-1 bg-white">
              <span className="text-xs text-[#777169] font-bold">AUTO-REROUTED TODAY</span>
              <div className="text-3xl font-bold text-[#d97706]">{analytics.reroutedCount}</div>
              <p className="text-[11px] text-[#d97706] font-semibold font-sans">⚡ Rate: {analytics.rerouteRatePercent}%</p>
            </div>

            <div className="eleven-card p-6 space-y-1 bg-white">
              <span className="text-xs text-[#777169] font-bold">ESCALATED QUEUE</span>
              <div className="text-3xl font-bold text-[#dc2626]">{analytics.escalatedCount}</div>
              <p className="text-[11px] text-[#dc2626] font-semibold font-sans">Requires control desk</p>
            </div>

            <div className="eleven-card p-6 space-y-1 bg-white">
              <span className="text-xs text-[#777169] font-bold">NETWORK HOSPITALS</span>
              <div className="text-3xl font-bold text-[#16a34a]">{analytics.hospitalsSummary.length}</div>
              <p className="text-[11px] text-[#16a34a] font-sans">100% Online</p>
            </div>
          </div>

          {/* Escalation Queue */}
          {analytics.escalatedCount > 0 && (
            <div className="eleven-card p-6 border-[#e8b8c4] bg-[#e8b8c4]/20 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#dc2626] flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 text-[#dc2626] animate-bounce" />
                <span>NEEDS MANUAL INTERVENTION (Escalation Queue)</span>
              </h2>
              <div className="eleven-card p-4 bg-white text-xs space-y-1 border-[#e7e5e4]">
                <div className="flex items-center justify-between font-bold text-[#dc2626]">
                  <span>Referral #PAT-2026-8941 — No Candidate Found</span>
                  <span>PRIORITY: CRITICAL</span>
                </div>
                <p className="text-[#4e4e4e] font-sans">
                  Auto-rerouting failed: No alternative hospital within 25km radius has available ICU + Ventilator capacity right now.
                </p>
              </div>
            </div>
          )}

          {/* Bottlenecks & Capacity Table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="eleven-card p-6 space-y-4 bg-white">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#777169] font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#292524]" />
                <span>Systemic Bottlenecks</span>
              </h2>

              <div className="space-y-3">
                {analytics.resourceGaps.map((gap, idx) => (
                  <div key={idx} className="eleven-card p-4 space-y-2 bg-[#fafafa] border-[#e7e5e4] text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-[#0c0a09]">{gap.resource} Shortage</span>
                      <span className="font-bold text-[#dc2626]">{gap.failedPercent}% failure factor</span>
                    </div>
                    <div className="w-full bg-[#e7e5e4] h-2 rounded-full overflow-hidden">
                      <div className="bg-gradient-to-r from-[#f4c5a8] to-[#e8b8c4] h-full" style={{ width: `${gap.failedPercent}%` }} />
                    </div>
                    <p className="text-[#777169] text-[11px]">{gap.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="eleven-card p-6 space-y-4 bg-white">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#777169] font-mono flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#16a34a]" />
                <span>Hospital Capacity Summary</span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#292524]">
                  <thead className="bg-[#fafafa] text-[#777169] uppercase text-[10px] font-mono">
                    <tr>
                      <th className="p-2.5">Hospital Name</th>
                      <th className="p-2.5 text-center">ICU Free</th>
                      <th className="p-2.5 text-center">Vent Free</th>
                      <th className="p-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e7e5e4] font-mono">
                    {analytics.hospitalsSummary.map(h => (
                      <tr key={h.id} className="hover:bg-[#fafafa]">
                        <td className="p-2.5 font-bold text-[#0c0a09] font-sans">{h.name}</td>
                        <td className={`p-2.5 text-center font-bold ${h.icuAvailable > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                          {h.icuAvailable}
                        </td>
                        <td className={`p-2.5 text-center font-bold ${h.ventAvailable > 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                          {h.ventAvailable}
                        </td>
                        <td className="p-2.5 text-right">
                          {h.isStale ? (
                            <span className="text-[#d97706] text-[10px]">STALE</span>
                          ) : (
                            <span className="text-[#16a34a] text-[10px]">ONLINE</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
