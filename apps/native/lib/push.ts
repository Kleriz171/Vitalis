import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import { lang, t } from './i18n';

let registeredToken: string | null = null;

// Show alerts even while the app is open: an SOS must never be silent.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('sos', {
    name: t('SOS calls near you'),
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400, 200, 800],
    lightColor: '#E14545',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync('updates', {
    name: t('Updates on your SOS'),
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

/**
 * Registers this device for push and tells the API. Safe to call on every launch.
 * Push needs a real device and an EAS project id (run `eas init` once).
 */
export async function registerForPush() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  await ensureAndroidChannels();
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowCriticalAlerts: true } })).status;
  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) console.warn('[push] no EAS projectId: run `npx eas init` in apps/native to enable push');
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (token !== registeredToken) {
    await api.post('/push/token', { token, language: lang });
    registeredToken = token;
  }
  return token;
}

/** Call before clearing the session so this phone stops receiving the old account's alerts. */
export async function unregisterPush() {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api.delete('/push/token', { data: { token } }).catch(() => {});
}

/** Where a tapped notification should take the user. */
export const routeForNotification = (data: Record<string, unknown> | undefined) =>
  data?.type === 'sos' ? '/responder-inbox' : data?.type === 'update' ? '/emergency' : null;
