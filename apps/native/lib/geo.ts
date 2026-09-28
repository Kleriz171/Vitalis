import { Linking, Platform } from 'react-native';

export type LngLat = [number, number];

export const distanceM = (a: LngLat, b: LngLat) => {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const formatDistance = (m: number) =>
  m < 50 ? 'Under 50 m' : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

// Walking/driving mix in a city: same heuristic as the API (×1.4 road factor, 35 km/h).
export const etaMinutes = (m: number) => Math.max(1, Math.round(((m * 1.4) / 35_000) * 60));

export const openDirections = (to: LngLat, label: string) => {
  const [lng, lat] = to;
  const q = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps://?daddr=${lat},${lng}&q=${q}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  })!;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`),
  );
};

export const callNumber = (n: string) => Linking.openURL(`tel:${n}`);
