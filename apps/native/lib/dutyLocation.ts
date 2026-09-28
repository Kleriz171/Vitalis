import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from './api';
import { t } from './i18n';

/**
 * While on duty, the OS wakes this task with new positions even when Vitalis is closed,
 * so SOS matching uses where the responder is now, not where they last opened the app.
 * The task runs without React or the Redux store, so it reads tokens from SecureStore.
 */
export const DUTY_TASK = 'vitalis-duty-location';

const post = (token: string, coordinates: [number, number]) =>
  fetch(`${API_BASE_URL}/biopassport/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ location: { type: 'Point', coordinates } }),
  });

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(DUTY_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const last = data.locations[data.locations.length - 1];
    const coords: [number, number] = [last.coords.longitude, last.coords.latitude];
    try {
      const at = await SecureStore.getItemAsync('at');
      if (!at) return;
      let res = await post(at, coords);
      if (res.status === 401) {
        // Access token expired in the background: refresh once and retry.
        const rt = await SecureStore.getItemAsync('rt');
        if (!rt) return;
        const r = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!r.ok) return;
        const session = await r.json();
        await SecureStore.setItemAsync('at', session.accessToken);
        await SecureStore.setItemAsync('rt', session.refreshToken);
        res = await post(session.accessToken, coords);
      }
    } catch {
      // Offline: the next update will try again.
    }
  });
}

/** Asks for "Always" location and starts background updates. Returns false if not granted. */
export async function startDutyTracking() {
  if (Platform.OS === 'web') return true;
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return false;
  if (await Location.hasStartedLocationUpdatesAsync(DUTY_TASK)) return true;
  await Location.startLocationUpdatesAsync(DUTY_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 150,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: t('Vitalis: on duty'),
      notificationBody: t('Sharing your location so SOS calls near you can reach you.'),
      notificationColor: '#14A897',
    },
  });
  return true;
}

export async function stopDutyTracking() {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(DUTY_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(DUTY_TASK);
  }
}
