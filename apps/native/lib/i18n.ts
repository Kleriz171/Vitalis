import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { reloadAppAsync } from 'expo';
import { sq } from './i18n.sq';

// Albanian by default; English on request (Me → Language). The English source text is the
// key, so code stays readable, English needs no dictionary, and API messages translate too.
// Missing keys fall back to English; `npm run check:i18n` lists them.
export type Lang = 'sq' | 'en';
const KEY = 'lang';

const read = () => {
  try {
    return Platform.OS === 'web' ? window.localStorage.getItem(KEY) : SecureStore.getItem(KEY);
  } catch {
    return null;
  }
};

// Read synchronously at launch, like the colour scheme: module-level text is built from it.
export const lang: Lang = read() === 'en' ? 'en' : 'sq';
export const locale = lang === 'sq' ? 'sq-AL' : 'en-GB';

/** Translate English source text. `{name}` placeholders are filled from `vars`. */
export function t(text: string, vars?: Record<string, string | number>) {
  const s = lang === 'sq' ? sq[text] ?? text : text;
  return vars ? s.replace(/\{(\w+)\}/g, (_: string, k: string) => String(vars[k] ?? '')) : s;
}

/** For counts: t('1 lesson') vs t('{n} lessons'). Albanian has the same one/other split. */
export const tn = (n: number, one: string, other: string) => (n === 1 ? t(one, { n }) : t(other, { n }));

/** Server message for a failed request, translated when we know it, else the fallback. */
export const apiError = (e: any, fallback: string) =>
  t(e?.response?.data?.issues?.[0]?.message ?? e?.response?.data?.error ?? fallback);

export async function setLanguage(next: Lang) {
  if (next === lang) return;
  if (Platform.OS === 'web') window.localStorage.setItem(KEY, next);
  else await SecureStore.setItemAsync(KEY, next);
  await reloadAppAsync('Language changed');
}

export const formatDate = (value: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat(locale, opts).format(new Date(value));
