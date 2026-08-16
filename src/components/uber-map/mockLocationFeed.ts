/**
 * mockLocationFeed
 * ----------------------------------------------------------------------------
 * Simulates a real-time GPS feed by walking along a fetched road route and
 * emitting points on a fixed interval, structured EXACTLY like the payload a
 * real `ambulance:location` WebSocket event will send:
 *
 *   { lat, lng, timestamp, bearing, speedKmph }
 *
 * ============================================================================
 * >>> SWAPPING TO A REAL BACKEND <<<
 * Replace the call to `startMockFeed(...)` in LiveAmbulanceMap.tsx with a
 * socket subscription that calls the same `onPoint` callback:
 *
 *   useEffect(() => {
 *     const socket = io(SOCKET_URL);
 *     socket.on('ambulance:location', (point: LocationPoint) => onPoint(point));
 *     return () => socket.disconnect();
 *   }, []);
 *
 * No other file needs to change — useAmbulanceAnimation and the rendering
 * layer consume points identically regardless of their origin.
 * ============================================================================
 */
import { bearingDeg, type LocationPoint } from "./useAmbulanceAnimation";

export interface RouteCoord {
  lat: number;
  lng: number;
}

interface MockFeedHandle {
  stop: () => void;
}

/**
 * @param route        Full-resolution route geometry from the Directions/OSRM fetch
 * @param onPoint       Called on each simulated GPS ping
 * @param intervalMs    Time between pings (default 2500ms)
 * @param targetPings   How many waypoints to decimate the route into (default 55)
 */
export function startMockFeed(
  route: RouteCoord[],
  onPoint: (point: LocationPoint, prevTimestamp?: number) => void,
  intervalMs = 2500,
  targetPings = 55
): MockFeedHandle {
  if (route.length < 2) {
    return { stop: () => {} };
  }

  const stride = Math.max(1, Math.floor(route.length / targetPings));
  const waypoints: RouteCoord[] = [];
  for (let i = 0; i < route.length; i += stride) waypoints.push(route[i]);
  if (waypoints[waypoints.length - 1] !== route[route.length - 1]) {
    waypoints.push(route[route.length - 1]);
  }

  let idx = 0;
  let prevTimestamp: number | undefined;

  const emit = () => {
    if (idx >= waypoints.length) {
      clearInterval(timer);
      return;
    }
    const p = waypoints[idx];
    const next = waypoints[Math.min(idx + 1, waypoints.length - 1)];
    const point: LocationPoint = {
      lat: p.lat,
      lng: p.lng,
      bearing: bearingDeg(p, next),
      timestamp: Date.now(),
      // simulated live speed with light jitter, like a real ambulance in traffic
      speedKmph: 42 + Math.round(Math.random() * 18),
    };
    onPoint(point, prevTimestamp);
    prevTimestamp = point.timestamp;
    idx += 1;
  };

  emit(); // emit starting position immediately
  const timer = setInterval(emit, intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}

/**
 * Fetches a real road route between two points via OSRM's free public API
 * (no API key required). Swap this for the Mapbox Directions API if you have
 * a Mapbox token — same return shape.
 */
export async function fetchRoadRoute(
  waypoints: RouteCoord[]
): Promise<{ coords: RouteCoord[]; distanceKm: number }> {
  const coordsStr = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Route fetch failed: ${res.status}`);
  const data = await res.json();
  const geometry = data.routes?.[0]?.geometry?.coordinates as [number, number][];
  if (!geometry) throw new Error("No route returned");

  const coords: RouteCoord[] = geometry.map(([lng, lat]) => ({ lat, lng }));
  const distanceKm = (data.routes[0].distance ?? 0) / 1000;

  return { coords, distanceKm };
}
