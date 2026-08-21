import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Radio, Sparkles, RotateCcw, FastForward } from 'lucide-react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export function LiveAmbulanceTrackingMap3D({ referral, onOpenRadioModal, originHospital, targetHospital, onComplete }) {
  const [progress, setProgress] = useState(0); // Start from Depot
  const [isAutoSim, setIsAutoSim] = useState(true);

  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  
  let rawOriginPos = [originHospital?.location_lng || 77.2090, originHospital?.location_lat || 28.6139];
  let rawTargetPos = [targetHospital?.location_lng || 77.6245, targetHospital?.location_lat || 12.9352];

  // If coordinates are identical or missing, artificially offset them so the simulation route works
  if (Math.abs(rawOriginPos[0] - rawTargetPos[0]) < 0.0001 && Math.abs(rawOriginPos[1] - rawTargetPos[1]) < 0.0001) {
    rawTargetPos = [rawOriginPos[0] + 0.03, rawOriginPos[1] - 0.03]; // Add artificial offset
  }

  const originPos = rawOriginPos;
  const targetPos = rawTargetPos;
  
  // Create an artificial Ambulance Depot offset from the Origin Hospital
  const depotPos = [originPos[0] - 0.04, originPos[1] + 0.02];

  const originName = originHospital?.name || 'Origin Hospital';
  const targetName = targetHospital?.name || 'Destination Hospital';
  const ambId = referral?.ambulance?.id || 'AMB-101';
  const driverName = referral?.ambulance?.driverName || 'Rajesh Verma (ALS Desk)';
  const speed = referral?.ambulance?.speed || '64 km/h';

  const remainingMins = Math.max(0, Math.round(10 * (1 - progress / 100)));

  // Calculate current ambulance position using 2-stage interpolation
  let ambLng, ambLat;
  if (progress < 50) {
    // Stage 1: Depot to Origin
    const p = progress / 50;
    ambLng = depotPos[0] + (originPos[0] - depotPos[0]) * p;
    ambLat = depotPos[1] + (originPos[1] - depotPos[1]) * p;
  } else {
    // Stage 2: Origin to Destination
    const p = (progress - 50) / 50;
    ambLng = originPos[0] + (targetPos[0] - originPos[0]) * p;
    ambLat = originPos[1] + (targetPos[1] - originPos[1]) * p;
  }

  // Refs for dynamically updating marker text without re-initializing the map
  const depotElRef = useRef(document.createElement('div'));
  const originElRef = useRef(document.createElement('div'));
  const targetElRef = useRef(document.createElement('div'));
  const ambElRef = useRef(document.createElement('div'));

  // Auto-simulation timer
  useEffect(() => {
    if (!isAutoSim) return;
    if (progress >= 100) return;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 1; // 1% per tick
      });
    }, 300); // 300ms per tick = 30 seconds total journey

    return () => clearInterval(timer);
  }, [isAutoSim, progress]);

  // Auto-complete API trigger
  useEffect(() => {
    if (progress === 100 && isAutoSim) {
      const token = localStorage.getItem('eron_auth_session');
      fetch(`http://localhost:3001/api/referrals/${referral.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        console.log("Auto-completed referral", data);
        if (onComplete) onComplete(data);
      })
      .catch(console.error);
    }
  }, [progress, isAutoSim, referral.id, onComplete]);

  // Update marker HTML when names change
  useEffect(() => {
    depotElRef.current.innerHTML = `<div style="background-color: #64748b; color: white; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); white-space: nowrap;">🏢 Depot</div>`;
    originElRef.current.innerHTML = `<div style="background-color: #10b981; color: white; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); white-space: nowrap;">🏥 ${originName.split(' ')[0]}</div>`;
    targetElRef.current.innerHTML = `<div style="background-color: #2563eb; color: white; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); white-space: nowrap;">🏥 ${targetName.split(' ')[0]}</div>`;
    ambElRef.current.innerHTML = `<div style="background-color: #f59e0b; color: #0c0a09; padding: 5px 10px; border-radius: 9999px; font-size: 11px; font-weight: 900; border: 2px solid white; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4); display: flex; align-items: center; gap: 6px; white-space: nowrap;"><span>🚑 ${ambId}</span></div>`;
  }, [originName, targetName, ambId]);

  useEffect(() => {
    if (mapRef.current) return; // Initialize map only once

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [ (depotPos[0] + targetPos[0])/2, (depotPos[1] + targetPos[1])/2 ],
      zoom: 11.5,
      pitch: 60, // 3D Pitch
      bearing: -20, // Rotate map slightly for better 3D isometric feel
      interactive: true,
      scrollZoom: false
    });

    mapRef.current.on('load', () => {
      // Add Route Line (3-point line)
      mapRef.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [depotPos, originPos, targetPos]
          }
        }
      });

      mapRef.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#10b981',
          'line-width': 6,
          'line-opacity': 0.8
        }
      });

      // Add Markers using refs
      new maplibregl.Marker({ element: depotElRef.current, anchor: 'bottom' })
        .setLngLat(depotPos)
        .addTo(mapRef.current);

      new maplibregl.Marker({ element: originElRef.current, anchor: 'bottom' })
        .setLngLat(originPos)
        .addTo(mapRef.current);

      new maplibregl.Marker({ element: targetElRef.current, anchor: 'bottom' })
        .setLngLat(targetPos)
        .addTo(mapRef.current);

      markerRef.current = new maplibregl.Marker({ element: ambElRef.current, anchor: 'bottom' })
        .setLngLat([ambLng, ambLat])
        .addTo(mapRef.current);
    });
  }, [originPos[0], originPos[1], targetPos[0], targetPos[1], depotPos[0], depotPos[1]]);

  // Update ambulance position when progress changes
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLngLat([ambLng, ambLat]);
    }
  }, [progress, ambLng, ambLat]);

  return (
    <div className="eleven-card bg-white border border-[#e7e5e4] rounded-2xl overflow-hidden shadow-md h-full flex flex-col">
      {/* Map Bar Header */}
      <div className="p-3.5 bg-[#fafafa] border-b border-[#e7e5e4] flex flex-wrap items-center justify-between font-mono text-xs gap-2">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-600 animate-pulse" />
          <span className="font-bold text-[#0c0a09]">Live Ambulance GPS Corridor</span>
          <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
            PROGRESS: {progress}%
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#777169]">
            ETA: <strong className="text-emerald-700 font-bold">{remainingMins} Mins</strong>
          </span>

          <button
            onClick={onOpenRadioModal}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-all"
            title="Open Live Driver Walkie-Talkie Radio"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Driver Radio</span>
          </button>
        </div>
      </div>

      {/* Interactive Simulation Controls */}
      <div className="bg-[#1c1917] px-3.5 py-2 flex items-center justify-between gap-2 border-b border-[#292524] text-[11px] font-mono">
        <span className="text-[#a8a29e] flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Sim Controls:
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setProgress(15)}
            className="px-2 py-0.5 rounded bg-[#292524] hover:bg-[#383330] text-white flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" /> Reset (15%)
          </button>
          <button
            onClick={() => setProgress(prev => Math.min(90, prev + 25))}
            className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 font-bold"
          >
            <FastForward className="w-3 h-3" /> Advance +25%
          </button>
          <button
            onClick={() => setProgress(100)}
            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-bold"
          >
            ✓ Arrived (100%)
          </button>
        </div>
      </div>

      {/* 3D MapLibre Map Container */}
      <div className="h-[460px] w-full relative flex-1">
        {/* Floating ETA Badge Overlay */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-[#1c1917]/95 border border-[#292524] text-white px-5 py-2.5 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <strong className="text-white font-sans text-sm">Arriving in {remainingMins} mins</strong>
          </div>
          <span className="text-[#383330]">|</span>
          <span className="text-emerald-400 font-bold font-mono">{speed}</span>
          <span className="text-[#383330]">|</span>
          <span className="text-amber-400 font-bold">{progress}% Route Completed</span>
        </div>

        <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Telemetry Footer */}
      <div className="bg-[#1c1917] p-3 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-[#292524]">
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Unit Dispatched:</span>
          <p className="font-bold text-white truncate">{ambId}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">ALS Driver On-Duty:</span>
          <p className="font-bold text-emerald-400 truncate">{driverName}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Current Speed:</span>
          <p className="font-bold text-amber-400 truncate">{speed}</p>
        </div>
        <div>
          <span className="text-[#a8a29e] text-[10px] block">Green Corridor:</span>
          <p className="font-bold text-blue-400 truncate">Signal Priority Active</p>
        </div>
      </div>
    </div>
  );
}
