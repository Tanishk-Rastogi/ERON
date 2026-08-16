/**
 * useAmbulanceAnimation
 * ----------------------------------------------------------------------------
 * Pure animation/interpolation logic, isolated from rendering so it can be
 * unit-tested on its own. Consumes discrete GPS-style points (whether they
 * come from mockLocationFeed.ts or a real WebSocket) and produces a smooth,
 * continuously-updating { lat, lng, bearing } every animation frame by
 * tweening between the last two received points.
 *
 * Usage:
 *   const { position, pushPoint } = useAmbulanceAnimation({ durationMs: 2500 });
 *   // on each feed/socket point:
 *   pushPoint({ lat, lng, bearing, timestamp, speedKmph });
 *   // in render:
 *   <Marker position={[position.lat, position.lng]} rotationAngle={position.bearing} />
 */
import { useRef, useState, useCallback, useEffect } from "react";

export interface LocationPoint {
  lat: number;
  lng: number;
  bearing: number;
  timestamp: number;
  speedKmph: number;
}

export interface AnimatedPosition {
  lat: number;
  lng: number;
  bearing: number;
  speedKmph: number;
}

interface Options {
  /** How long to tween between two points. Defaults to the gap between their timestamps. */
  durationMs?: number;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (d: number) => (d * 180) / Math.PI;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Interpolates the shorter way around the compass (e.g. 350deg -> 10deg
// crosses through 0/360, not backwards through 180) so the icon never spins
// the "long way" when the ambulance turns.
function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function useAmbulanceAnimation(
  initial: { lat: number; lng: number; bearing?: number },
  options: Options = {}
) {
  const [position, setPosition] = useState<AnimatedPosition>({
    lat: initial.lat,
    lng: initial.lng,
    bearing: initial.bearing ?? 0,
    speedKmph: 0,
  });

  const fromRef = useRef<AnimatedPosition>(position);
  const toRef = useRef<LocationPoint | null>(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(options.durationMs ?? 2500);
  const rafRef = useRef<number | null>(null);

  const tick = useCallback((now: number) => {
    if (!toRef.current) {
      rafRef.current = null;
      return;
    }
    const t = Math.min(1, (now - startTimeRef.current) / durationRef.current);
    const eased = easeInOut(t);

    const next: AnimatedPosition = {
      lat: lerp(fromRef.current.lat, toRef.current.lat, eased),
      lng: lerp(fromRef.current.lng, toRef.current.lng, eased),
      bearing: lerpAngle(fromRef.current.bearing, toRef.current.bearing, eased),
      speedKmph: toRef.current.speedKmph,
    };
    setPosition(next);

    if (t < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      fromRef.current = next;
      rafRef.current = null;
    }
  }, []);

  /**
   * Feed a new point into the animator. Call this from your data source —
   * the mock feed during development, or a `socket.on('ambulance:location', pushPoint)`
   * listener in production. This is the ONLY function that needs to change
   * when swapping mock data for a real feed.
   */
  const pushPoint = useCallback(
    (point: LocationPoint, prevTimestamp?: number) => {
      // snapshot current interpolated value synchronously
      setPosition((cur) => {
        fromRef.current = cur;
        return cur;
      });

      toRef.current = point;
      startTimeRef.current = performance.now();
      durationRef.current =
        options.durationMs ?? (prevTimestamp ? Math.max(500, point.timestamp - prevTimestamp) : 2500);

      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    },
    [options.durationMs, tick]
  );

  // Cleanup: cancel any in-flight animation frame on unmount.
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { position, pushPoint };
}
