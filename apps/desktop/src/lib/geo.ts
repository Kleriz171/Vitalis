/** Coordinates are [lng, lat], as the API stores them; people read and paste "lat, lng". */
export type LngLat = [number, number];

/**
 * Reads coordinates people paste: "41.32750, 19.81870" (lat, lng, as maps apps copy them),
 * "41.3275° N, 19.8187° E", or a maps link containing "@41.3275,19.8187".
 */
export const parseCoords = (text: string): LngLat | null => {
  const m = /(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?/i.exec(text);
  if (!m) return null;
  const lat = +m[1] * (/s/i.test(m[2] ?? '') ? -1 : 1);
  const lng = +m[3] * (/w/i.test(m[4] ?? '') ? -1 : 1);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
};

/** "41.32750, 19.81870": what the copy buttons put on the clipboard, and parseCoords reads back. */
export const formatCoords = ([lng, lat]: LngLat) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

const rad = (d: number) => (d * Math.PI) / 180;

export const distanceM = (a: LngLat, b: LngLat) => {
  const x = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(x));
};

/** Compass bearing from a to b, degrees clockwise from north. Same formula as the API's. */
export const bearingDeg = (a: LngLat, b: LngLat) => {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const compassPoint = (deg: number) => COMPASS[Math.round(deg / 45) % 8];
