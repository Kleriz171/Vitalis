import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { t } from './i18n';

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
  m < 50 ? t('Under 50 m') : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;

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

/** Local Albanian formats (069…, 69…, 355…) and 00-prefixed numbers → E.164. */
export const toE164 = (raw: string) => {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (d.startsWith('+')) return d;
  if (d.startsWith('355')) return `+${d}`;
  return `+355${d.replace(/^0/, '')}`;
};
export const isE164 = (p: string) => /^\+[1-9]\d{7,14}$/.test(p);
/** +355691234567 → +355 69 123 4567 for reading back; other countries stay as stored. */
export const formatPhone = (p?: string | null) =>
  p?.replace(/^\+355(6\d)(\d{3})(\d{3,4})$/, '+355 $1 $2 $3') ?? '';

export const callNumber = (n: string) => Linking.openURL(`tel:${n}`);

/** "120 m · Name" for the closest public AED, refreshed on focus. Null until known or without location permission. */
export function useNearestAed() {
  const [label, setLabel] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        const pos = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({});
        if (!pos) return;
        const { data } = await api.get('/aeds', { params: { lng: pos.coords.longitude, lat: pos.coords.latitude } });
        if (alive && data[0]) setLabel(`${formatDistance(data[0].distanceM)} · ${data[0].name}`);
      })().catch(() => {});
      return () => { alive = false; };
    }, []),
  );
  return label;
}
