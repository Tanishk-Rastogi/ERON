/**
 * LiveAmbulanceMap
 * ============================================================================
 * Premium live-tracking map for an ambulance transfer between two hospitals,
 * in the style of Swiggy/Zomato/Uber's delivery tracker.
 *
 * WHY LEAFLET INSTEAD OF MAPBOX GL:
 * Mapbox requires an API token this environment doesn't have. This component
 * uses Leaflet + free CARTO tiles + free OSRM routing instead, so it works
 * with zero API keys. All animation/interpolation/rotation logic is
 * map-library-agnostic — if you have a Mapbox token, you can swap the
 * <MapContainer>/<TileLayer>/<Marker> block for `react-map-gl` equivalents
 * without touching useAmbulanceAnimation.ts or mockLocationFeed.ts.
 *
 * ============================================================================
 * >>> PLUGGING IN A REAL BACKEND <<<
 * Only ONE thing changes: the `mockMode` branch inside the `useEffect` below.
 * Replace `startMockFeed(...)` with a socket subscription that calls the same
 * `handleIncomingPoint` function:
 *
 *   const socket = io(SOCKET_URL);
 *   socket.on('ambulance:location', (point: LocationPoint) => handleIncomingPoint(point));
 *
 * The real-time payload shape must match `LocationPoint`:
 *   { lat: number, lng: number, bearing: number, timestamp: number, speedKmph: number }
 *
 * Nothing in the rendering layer, the animation hook, or the info card needs
 * to change — they all consume points the same way regardless of source.
 * ============================================================================
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import {
  useAmbulanceAnimation,
  haversineKm,
  type LocationPoint,
} from "./useAmbulanceAnimation";
import { startMockFeed, fetchRoadRoute, type RouteCoord } from "./mockLocationFeed";

export interface HospitalPoint {
  name: string;
  lat: number;
  lng: number;
}

export interface LiveAmbulanceMapProps {
  source: HospitalPoint;
  destination: HospitalPoint;
  onLocationUpdate?: (point: LocationPoint) => void;
  onMetricsUpdate?: (metrics: { progressPct: number; etaMin: number; remainingKm: number; speedKmph: number }) => void;
  onComplete?: () => void;
  /** true: use the internal simulator. false: expects points via `externalPoint` prop. */
  mockMode?: boolean;
  /** Only used when mockMode is false — feed real-time points in from outside. */
  externalPoint?: LocationPoint | null;
  theme?: "light" | "dark";
  /** Shows a red "critical" badge on the info card. */
  priority?: "critical" | "standard";
}

const TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};

function hospitalDivIcon(kind: "src" | "dst") {
  return L.divIcon({
    className: "",
    html: `<div class="lam-pulse-pin ${kind}"><div class="lam-ring"></div><div class="lam-core"></div></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function ambulanceDivIcon(bearing: number, lean: number) {
  return L.divIcon({
    className: "",
    html: `
      <div class="lam-amb-wrap">
        <div class="lam-amb-shadow"></div>
        <div class="lam-amb-glow"></div>
        <div class="lam-amb-tilt" style="transform:rotateX(12deg) rotateZ(${lean}deg)">
          <div class="lam-amb-rotor" style="transform:rotate(${bearing}deg)">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <g transform="translate(26 26)">
                <rect x="-13" y="-21" width="26" height="38" rx="7" fill="#fff" stroke="#0f766e" stroke-width="2"/>
                <rect x="-9.5" y="-18" width="19" height="8.5" rx="2.4" fill="#bfe0ff" stroke="#2563eb" stroke-width="1"/>
                <rect x="-9" y="-7.5" width="18" height="13" rx="2" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.6"/>
                <rect x="-1.9" y="-5.2" width="3.8" height="8.4" fill="#ef4444"/>
                <rect x="-6.1" y="-1" width="12.2" height="3.8" fill="#ef4444"/>
                <path d="M-13 9.5 L13 9.5 L13 14.5 L-13 14.5 Z" fill="#0f766e"/>
                <rect x="-8.2" y="-24.5" width="16.4" height="4.2" rx="2.1" fill="#111827"/>
                <rect class="lam-beacon-a" x="-7.4" y="-23.7" width="6.9" height="2.7" rx="1.35" fill="#ef4444"/>
                <rect class="lam-beacon-b" x="0.5" y="-23.7" width="6.9" height="2.7" rx="1.35" fill="#2563eb"/>
                <circle cx="-9.8" cy="16.2" r="3.1" fill="#111"/>
                <circle cx="-9.8" cy="16.2" r="1.2" fill="#666"/>
                <circle cx="9.8" cy="16.2" r="3.1" fill="#111"/>
                <circle cx="9.8" cy="16.2" r="1.2" fill="#666"/>
                <circle cx="-9.8" cy="-16.2" r="3.1" fill="#111"/>
                <circle cx="-9.8" cy="-16.2" r="1.2" fill="#666"/>
                <circle cx="9.8" cy="-16.2" r="3.1" fill="#111"/>
                <circle cx="9.8" cy="-16.2" r="1.2" fill="#666"/>
                <rect x="-14.8" y="-13.5" width="2.6" height="4.2" rx="1" fill="#0f766e"/>
                <rect x="12.2" y="-13.5" width="2.6" height="4.2" rx="1" fill="#0f766e"/>
              </g>
            </svg>
          </div>
        </div>
      </div>`,
    iconSize: [74, 74],
    iconAnchor: [37, 37],
  });
}

/** Small helper component: keeps the map auto-panned/zoomed to follow the ambulance. */
function CameraFollower({ lat, lng, progressPct }: { lat: number; lng: number; progressPct: number }) {
  const map = useMap();
  const lastMoveRef = useRef(0);

  useEffect(() => {
    const now = performance.now();
    if (now - lastMoveRef.current < 550) return; // throttle camera recalculation
    lastMoveRef.current = now;

    map.panTo([lat, lng], { animate: true, duration: 0.6, easeLinearity: 0.3 });
    if (progressPct > 88 && map.getZoom() < 15) {
      map.setZoom(15, { animate: true });
    }
  }, [lat, lng, progressPct, map]);

  return null;
}

export default function LiveAmbulanceMap({
  source,
  destination,
  onLocationUpdate,
  onMetricsUpdate,
  onComplete,
  mockMode = true,
  externalPoint = null,
  theme = "light",
  priority = "critical",
}: LiveAmbulanceMapProps) {
  // Setup the waypoints for a 3-stage route: Depot -> Origin -> Target
  const safeDestination = { ...destination };
  if (Math.abs(source.lat - destination.lat) < 0.0001 && Math.abs(source.lng - destination.lng) < 0.0001) {
    safeDestination.lat = source.lat - 0.03;
    safeDestination.lng = source.lng + 0.03;
  }
  const depot = {
    name: "Depot",
    lat: source.lat + 0.02,
    lng: source.lng - 0.04
  };
  const waypoints = [depot, source, safeDestination];

  const [route, setRoute] = useState<RouteCoord[]>([]);
  const [cumulativeDist, setCumulativeDist] = useState<number[]>([]);
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastSpeed, setLastSpeed] = useState(0);

  const { position, pushPoint } = useAmbulanceAnimation({ lat: depot.lat, lng: depot.lng });
  const feedStopRef = useRef<{ stop: () => void } | null>(null);

  // Smoothed banking-lean effect: leans into turns based on how fast the
  // bearing is changing frame-to-frame, purely cosmetic (pseudo-3D).
  const prevBearingRef = useRef<number | null>(null);
  const leanRef = useRef(0);
  const [lean, setLean] = useState(0);
  useEffect(() => {
    if (prevBearingRef.current !== null) {
      const diff = ((position.bearing - prevBearingRef.current + 540) % 360) - 180;
      const target = Math.max(-14, Math.min(14, diff * 2.4));
      leanRef.current = leanRef.current + (target - leanRef.current) * 0.25;
      setLean(leanRef.current);
    }
    prevBearingRef.current = position.bearing;
  }, [position.bearing]);

  // Single seam for real-time data, mock or real (see file header).
  const handleIncomingPoint = useCallback(
    (point: LocationPoint, prevTimestamp?: number) => {
      pushPoint(point, prevTimestamp);
      setLastSpeed(point.speedKmph);
      onLocationUpdate?.(point);
    },
    [pushPoint, onLocationUpdate]
  );

  // 1. Fetch the real road route once on mount / when endpoints change.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRoadRoute(waypoints)
      .then(({ coords }) => {
        if (cancelled) return;
        setRoute(coords);
        const cum = [0];
        for (let i = 1; i < coords.length; i++) {
          cum.push(cum[i - 1] + haversineKm(coords[i - 1], coords[i]));
        }
        setCumulativeDist(cum);
        setTotalDistanceKm(cum[cum.length - 1] ?? 0);
        setLoading(false);
      })
      .catch((err) => {
        console.error("LiveAmbulanceMap: route fetch failed", err);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.lat, source.lng, destination.lat, destination.lng]);

  // 2. Start the mock feed once the route is ready (mockMode only).
  useEffect(() => {
    if (!mockMode || route.length === 0) return;
    feedStopRef.current = startMockFeed(route, handleIncomingPoint);
    return () => {
      feedStopRef.current?.stop();
      feedStopRef.current = null;
    };
  }, [mockMode, route, handleIncomingPoint]);

  // 2b. In production (mockMode=false), consume externally-pushed points instead.
  useEffect(() => {
    if (mockMode || !externalPoint) return;
    handleIncomingPoint(externalPoint);
  }, [mockMode, externalPoint, handleIncomingPoint]);

  // Traveled trail + progress metrics derived from current interpolated position.
  const nearestIdx = (() => {
    if (route.length === 0) return 0;
    let best = 0;
    let bestD = Infinity;
    const stride = Math.max(1, Math.floor(route.length / 300));
    for (let i = 0; i < route.length; i += stride) {
      const d = (route[i].lat - position.lat) ** 2 + (route[i].lng - position.lng) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  })();

  const traveledKm = cumulativeDist[nearestIdx] ?? 0;
  const remainingKm = Math.max(0, totalDistanceKm - traveledKm);
  const etaMin = lastSpeed > 0 ? (remainingKm / lastSpeed) * 60 : 0;
  const progressPct = totalDistanceKm > 0 ? Math.min(100, (traveledKm / totalDistanceKm) * 100) : 0;

  const hasCompleted = useRef(false);

  // Trigger onComplete when we reach the end of the route
  useEffect(() => {
    if (progressPct >= 99.5 && !loading && totalDistanceKm > 0 && !hasCompleted.current) {
      hasCompleted.current = true;
      if (onComplete) onComplete();
    }
  }, [progressPct, loading, totalDistanceKm, onComplete]);

  // Report metrics upward
  useEffect(() => {
    if (onMetricsUpdate) {
      onMetricsUpdate({ progressPct, etaMin, remainingKm, speedKmph: lastSpeed });
    }
  }, [progressPct, etaMin, remainingKm, lastSpeed, onMetricsUpdate]);

  const traveledCoords: [number, number][] = [
    ...route.slice(0, nearestIdx + 1).map((p) => [p.lat, p.lng] as [number, number]),
    [position.lat, position.lng],
  ];

  return (
    <div className="lam-app" data-theme={theme}>
      <MapContainer
        center={[(depot.lat + safeDestination.lat) / 2, (depot.lng + safeDestination.lng) / 2]}
        zoom={12}
        zoomControl={false}
        className="lam-map"
      >
        <TileLayer url={TILE_URLS[theme]} attribution="&copy; OpenStreetMap &copy; CARTO" />

        {route.length > 0 && (
          <Polyline positions={route.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#c7d2d8", weight: 5, lineCap: "round" }} />
        )}
        {traveledCoords.length > 1 && (
          <Polyline positions={traveledCoords} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.95, lineCap: "round" }} />
        )}

        <Marker position={[depot.lat, depot.lng]} icon={hospitalDivIcon("src")} />
        <Marker position={[source.lat, source.lng]} icon={hospitalDivIcon("src")} />
        <Marker position={[safeDestination.lat, safeDestination.lng]} icon={hospitalDivIcon("dst")} />
        <Marker position={[position.lat, position.lng]} icon={ambulanceDivIcon(position.bearing, lean)} zIndexOffset={1000} />

        <CameraFollower lat={position.lat} lng={position.lng} progressPct={progressPct} />
      </MapContainer>

      {loading && (
        <div className="lam-veil">
          <div className="lam-spinner" />
          <div>Fetching live road route…</div>
        </div>
      )}

      <div className="lam-topbar">
        <div className="lam-brand">
          <span className="lam-dot" />
          <div>
            <div className="lam-label">Live Transfer Tracking</div>
            <div className="lam-sub">
              {source.name} → {destination.name}
            </div>
          </div>
        </div>
      </div>

      <div className="lam-sheet">
        <div className="lam-sheet-top">
          <div className="lam-status-text">
            <div className="lam-title">Ambulance In Transit</div>
            <div className="lam-sub">
              {progressPct >= 99.5 ? "Arriving at destination" : `${remainingKm.toFixed(1)} km remaining · en route`}
            </div>
          </div>
          {priority === "critical" && <div className="lam-priority-chip">CRITICAL</div>}
        </div>

        <div className="lam-metrics">
          <div className="lam-metric">
            <div className="lam-k">ETA</div>
            <div className="lam-v lam-big">
              {Math.max(0, Math.round(etaMin))}
              <span className="lam-unit">min</span>
            </div>
          </div>
          <div className="lam-metric">
            <div className="lam-k">Distance left</div>
            <div className="lam-v">
              {remainingKm.toFixed(1)}
              <span className="lam-unit">km</span>
            </div>
          </div>
          <div className="lam-metric">
            <div className="lam-k">Speed</div>
            <div className="lam-v">
              {lastSpeed || "--"}
              <span className="lam-unit">km/h</span>
            </div>
          </div>
        </div>

        <div className="lam-progress-track">
          <div className="lam-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="lam-progress-labels">
          <span>{Math.round(progressPct)}% complete</span>
          <span>{destination.name}</span>
        </div>
      </div>
    </div>
  );
}
