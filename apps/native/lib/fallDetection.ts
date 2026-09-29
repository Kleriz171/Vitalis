import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as SecureStore from 'expo-secure-store';
import { createFallDetector } from './fallDetector';

// Off by default; the choice lives on this device (Profile → Fall detection).
const KEY = 'fallDetection';
const read = () => {
  try { return (Platform.OS === 'web' ? window.localStorage.getItem(KEY) : SecureStore.getItem(KEY)) === 'on'; } catch { return false; }
};
let enabled = read();
const listeners = new Set<() => void>();

export function setFallDetection(on: boolean) {
  enabled = on;
  try {
    if (Platform.OS === 'web') window.localStorage.setItem(KEY, on ? 'on' : 'off');
    else void SecureStore.setItemAsync(KEY, on ? 'on' : 'off');
  } catch {}
  listeners.forEach(l => l());
}

export const useFallDetectionEnabled = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => enabled);

/** Watches the accelerometer (50 Hz) while `active`. Works only while the app is open. */
export function useFallDetection(active: boolean, onFall: () => void) {
  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    let quietUntil = 0; // one alert per minute at most
    const feed = createFallDetector(() => {
      if (Date.now() < quietUntil) return;
      quietUntil = Date.now() + 60_000;
      onFall();
    });
    Accelerometer.setUpdateInterval(20);
    const sub = Accelerometer.addListener(({ x, y, z }) => feed({ x, y, z, t: Date.now() }));
    return () => sub.remove();
  }, [active, onFall]);
}
