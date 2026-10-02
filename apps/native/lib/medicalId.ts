import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { t } from './i18n';

// Medical ID on the lock screen (Android): a quiet notification that cannot be swiped away, showing
// what a responder needs without unlocking the phone. Opt-in on Profile, because it is health data
// anyone holding the phone can read. iPhone apps cannot do this; iPhone users use Apple's Medical ID.

const KEY = 'medicalIdLockScreen';
const ID = 'medical-id';
export const medicalIdSupported = Platform.OS === 'android';

let enabled = (() => { try { return medicalIdSupported && SecureStore.getItem(KEY) === 'on'; } catch { return false; } })();
const listeners = new Set<() => void>();
export const useMedicalIdEnabled = () =>
  useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => enabled);

export type MedicalFacts = {
  name?: string;
  bloodType?: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  contact?: { name?: string; phone?: string } | null;
};

/** The lines a responder reads, most critical first. Pure, so it can be checked without a phone. */
export function medicalIdText(f: MedicalFacts) {
  const list = (items: string[]) => (items.length ? items.join(', ') : t('None'));
  const lines = [
    `${t('Allergies')}: ${list(f.allergies)}`,
    `${t('Medications')}: ${list(f.medications)}`,
    `${t('Conditions')}: ${list(f.conditions)}`,
  ];
  if (f.contact?.phone) lines.push(`${t('Emergency contact')}: ${f.contact.name ?? ''} ${f.contact.phone}`.replace(/\s+/g, ' '));
  return {
    title: `${t('Medical ID')} · ${f.name ?? ''} · ${t('Blood {type}', { type: f.bloodType ?? '?' })}`,
    body: lines.join('\n'),
  };
}

/** Shows or refreshes the lock-screen card. Call with the latest Bio Passport facts. */
export async function showMedicalId(f: MedicalFacts) {
  if (!medicalIdSupported || !enabled) return;
  await Notifications.setNotificationChannelAsync(ID, {
    name: t('Medical ID'),
    importance: Notifications.AndroidImportance.LOW, // silent, no pop-up
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
  });
  const { title, body } = medicalIdText(f);
  await Notifications.scheduleNotificationAsync({
    identifier: ID,
    content: { title, body, sticky: true, autoDismiss: false, data: { kind: 'medical-id' } },
    trigger: { channelId: ID },
  });
}

/** Turns the lock-screen card on (asks for notification permission) or off. Returns the new state. */
export async function setMedicalId(on: boolean, facts?: MedicalFacts) {
  if (on) {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return false;
  }
  enabled = on;
  try { await SecureStore.setItemAsync(KEY, on ? 'on' : 'off'); } catch {}
  listeners.forEach(l => l());
  if (on && facts) await showMedicalId(facts);
  if (!on) await Notifications.dismissNotificationAsync(ID).catch(() => {});
  return on;
}
