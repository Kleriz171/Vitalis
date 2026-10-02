import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Spotter from '@/modules/keyword-spotter/src';

// Off by default; the choice lives on this device (Profile → "Hey Vitalis").
const KEY = 'wakeWord';
let enabled = (() => { try { return Platform.OS !== 'web' && SecureStore.getItem(KEY) === 'on'; } catch { return false; } })();
const listeners = new Set<() => void>();

export const wakeWordSupported = Spotter.isAvailable;

export function setWakeWord(on: boolean) {
  enabled = on;
  void SecureStore.setItemAsync(KEY, on ? 'on' : 'off').catch(() => {});
  listeners.forEach(l => l());
}

export const useWakeWordEnabled = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => enabled);

/**
 * Listens offline for "Hey Vitalis" and English emergency phrases while `active` and the app is
 * in the foreground. Audio never leaves the phone. Albanian cries are caught after the wake word.
 */
export function useWakeWord(active: boolean, onWake: () => void, onSos: () => void, onError: () => void) {
  useEffect(() => {
    if (!active || !Spotter.isAvailable) return;
    // Mic permission revoked or the model failed: switch off, so the "listening" pill never lies.
    const fail = () => { setWakeWord(false); onError(); };
    const run = (state: string) => {
      try { if (state === 'active') Spotter.start(); else Spotter.stop(); } catch { fail(); }
    };
    let quietUntil = 0; // one keyword per 3 s: the screen change that pauses listening takes a moment
    const heard = (fire: () => void) => { if (Date.now() >= quietUntil) { quietUntil = Date.now() + 3000; fire(); } };
    run(AppState.currentState);
    const subs = [
      AppState.addEventListener('change', run),
      Spotter.addListener('onKeyword', ({ keyword }) => heard(keyword.startsWith('sos:') ? onSos : onWake)),
      Spotter.addListener('onError', fail),
    ];
    return () => { subs.forEach(s => s?.remove()); Spotter.stop(); };
  }, [active, onWake, onSos, onError]);
}
