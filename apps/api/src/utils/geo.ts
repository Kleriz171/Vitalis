import { env } from '../config/env';
import { logger } from '../config/logger';

export const point = (lng: number, lat: number) => ({ type: 'Point', coordinates: [lng, lat] });

export const nearQuery = (lng: number, lat: number, maxMeters = 5000) => ({
  location: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: maxMeters,
    },
  },
});

export const haversineKm = (a: [number, number], b: [number, number]) => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

// Straight line × 1.4 road factor at 35 km/h: the fallback when routing is unavailable.
export const estimateEtaSeconds = (a: [number, number], b: [number, number]) =>
  Math.round(((haversineKm(a, b) * 1.4) / 35) * 3600);

/** Driving time by road (OSRM), or the estimate if routing is off, slow (>2.5 s) or fails. */
export const roadEtaSeconds = async (a: [number, number], b: [number, number]) => {
  if (!env.osrmUrl) return estimateEtaSeconds(a, b);
  try {
    const res = await fetch(`${env.osrmUrl}/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=false`, {
      signal: AbortSignal.timeout(2500),
    });
    const data = (await res.json()) as { code?: string; routes?: { duration: number }[] };
    const s = data.routes?.[0]?.duration;
    if (data.code === 'Ok' && typeof s === 'number') return Math.round(s);
    throw new Error(`OSRM ${res.status} ${data.code}`);
  } catch (e: any) {
    logger.warn(`road ETA fell back to estimate: ${e?.message ?? e}`);
    return estimateEtaSeconds(a, b);
  }
};
