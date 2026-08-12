import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { 
  Bed, 
  Plus, 
  Minus, 
  Clock, 
  AlertTriangle, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  Zap,
  RefreshCcw
} from 'lucide-react';

export function CapacityPanel() {
  const { hospitals, isConnected } = useWebSocket();
  const [selectedHospitalId, setSelectedHospitalId] = useState('hosp-b');

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId) || hospitals[0];

  const handleAdjustCapacity = async (resourceType, delta) => {
    if (!selectedHospital) return;

    try {
      await fetch(`/api/hospitals/${selectedHospital.id}/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          delta,
          staffId: 'user-admin-b'
        })
      });
    } catch (err) {
      console.error('Capacity update error:', err);
    }
  };

  const handleSetZero = async (resourceType) => {
    if (!selectedHospital) return;

    try {
      await fetch(`/api/hospitals/${selectedHospital.id}/capacity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType,
          exactCount: 0,
          staffId: 'user-admin-b'
        })
      });
    } catch (err) {
      console.error('Set zero error:', err);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Banner */}
      <div className="eleven-card p-8 bg-gradient-to-r from-white via-[#fafafa] to-[#f5f5f5]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#292524] text-white flex items-center justify-center">
              <Bed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-light text-[#0c0a09]">Capacity Panel (+/- Counter)</h1>
              <p className="text-xs text-[#777169] font-light">
                Single-tap live bed & equipment updates. Broadcasts capacity changes instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#f5f5f5] border border-[#e7e5e4] px-3 py-1.5 rounded-full text-xs">
            <Building2 className="w-4 h-4 text-[#292524]" />
            <span className="text-[#777169] font-semibold">Desk:</span>
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="bg-transparent text-[#0c0a09] font-bold cursor-pointer focus:outline-none"
            >
              {hospitals.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedHospital ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between font-mono">
            <h2 className="text-xs font-bold text-[#777169] uppercase tracking-widest">
              LIVE CAPACITY COUNTERS: <span className="text-[#0c0a09]">{selectedHospital.name}</span>
            </h2>
            <span className="text-xs text-[#777169] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#777169]" />
              UPDATED: {new Date(selectedHospital.lastCapacityUpdateAt || Date.now()).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(selectedHospital.resources || []).map((res) => {
              const available = res.availableCount;
              const total = res.totalCapacity;
              const isStale = (Date.now() - new Date(res.updatedAt || Date.now()).getTime()) > 20 * 60000;

              return (
                <div
                  key={res.id || res.resourceType}
                  className={`eleven-card p-6 space-y-4 bg-white ${
                    available === 0 ? 'bg-[#e8b8c4]/20 border-[#e8b8c4]' : 'hover:border-[#292524]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#0c0a09] tracking-widest uppercase font-mono">
                        {res.resourceType.replace('_', ' ')}
                      </h3>
                      <p className="text-xs text-[#777169]">Total Pool Capacity: {total}</p>
                    </div>

                    {isStale && (
                      <span className="eleven-badge bg-[#f4c5a8]/40 text-[#d97706] border-[#f4c5a8] text-[10px]">
                        STALE DATA NUDGE
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 font-mono">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-extrabold tracking-tight ${
                        available === 0 ? 'text-[#dc2626]' : available <= 2 ? 'text-[#d97706]' : 'text-[#16a34a]'
                      }`}>
                        {available}
                      </span>
                      <span className="text-xs text-[#777169] font-semibold">/ {total} FREE</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAdjustCapacity(res.resourceType, -1)}
                        disabled={available === 0}
                        className="w-10 h-10 rounded-full bg-[#f5f5f5] hover:bg-[#e7e5e4] disabled:opacity-30 border border-[#e7e5e4] text-[#dc2626] font-bold flex items-center justify-center text-lg transition-all"
                        title="Decrement capacity (-1)"
                      >
                        <Minus className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleAdjustCapacity(res.resourceType, 1)}
                        className="w-10 h-10 rounded-full bg-[#f5f5f5] hover:bg-[#e7e5e4] border border-[#e7e5e4] text-[#16a34a] font-bold flex items-center justify-center text-lg transition-all"
                        title="Increment capacity (+1)"
                      >
                        <Plus className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleSetZero(res.resourceType)}
                        className="eleven-button eleven-button-danger text-[10px] py-1.5 px-3"
                        title="Emergency set to 0 (Triggers auto-reroute!)"
                      >
                        Set 0
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
