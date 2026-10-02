import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ArrowLeft, ShieldCheck, Timer } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { apiError, locale, t, tn } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

type Active = { id: string; startedAt?: string; dueAt: string; note?: string; stage: number };
const DURATIONS = [15, 30, 60, 120, 240];
const isPin = (p: string) => /^\d{4,6}$/.test(p);

const here = async (): Promise<[number, number] | undefined> => {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return undefined;
    const pos = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({});
    return pos ? [pos.coords.longitude, pos.coords.latitude] : undefined;
  } catch {
    return undefined;
  }
};

const remaining = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/**
 * Safety check-in: "if I have not checked in by then, get help". The duress PIN checks in
 * like the real one and silently alerts dispatch and the emergency contact, so this screen
 * must behave identically for both PINs.
 */
export default function CheckInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasPins, setHasPins] = useState(false);
  const [active, setActive] = useState<Active | null>(null);
  const [editingPins, setEditingPins] = useState(false);
  const [pin, setPin] = useState('');
  const [duressPin, setDuressPin] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [note, setNote] = useState('');
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/checkin');
      setHasPins(data.hasPins);
      setActive(data.active);
    } catch (err) {
      toast.error(t('Could not load your check-in'), { description: apiError(err, 'Try again.') });
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (err) { toast.error(apiError(err, 'Try again.')); } finally { setBusy(false); }
  };

  const savePins = () => run(async () => {
    await api.put('/checkin/pins', { pin, duressPin });
    setPin(''); setDuressPin(''); setEditingPins(false); setHasPins(true);
    toast.success(t('PINs saved'));
  });

  const start = () => run(async () => {
    const { data } = await api.post('/checkin', { minutes, note: note.trim() || undefined, coordinates: await here() });
    setActive(data); setNote(''); setNow(Date.now());
    toast.success(t('Check-in started'));
  });

  const confirm = (action: 'ok' | 'cancel') => run(async () => {
    await api.post(`/checkin/${active!.id}/${action}`, { pin: entry, coordinates: await here() });
    setEntry(''); setActive(null);
    toast.success(action === 'ok' ? t("Checked in. Glad you're safe.") : t('Check-in stopped'));
  });

  const pinForm = (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>{t('Your check-in PINs')}</Text>
      <Text style={styles.cardBody}>
        {t('Pick two different PINs. If someone forces you to check in, enter the duress PIN: the app looks exactly the same, but dispatch and your emergency contact are alerted silently.')}
      </Text>
      <Input value={pin} onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))} placeholder={t('Check-in PIN (4–6 digits)')} accessibilityLabel={t('Check-in PIN (4–6 digits)')} keyboardType="number-pad" secureTextEntry />
      <Input value={duressPin} onChangeText={v => setDuressPin(v.replace(/\D/g, '').slice(0, 6))} placeholder={t('Duress PIN (4–6 digits)')} accessibilityLabel={t('Duress PIN (4–6 digits)')} keyboardType="number-pad" secureTextEntry />
      {pin && duressPin && pin === duressPin ? <Text style={styles.error}>{t('The two PINs must be different.')}</Text> : null}
      <Button onPress={savePins} loading={busy} disabled={!isPin(pin) || !isPin(duressPin) || pin === duressPin}>{t('Save PINs')}</Button>
    </Card>
  );

  const due = active ? new Date(active.dueAt).getTime() : 0;
  const overdue = active ? due <= now : false;
  const total = active?.startedAt ? due - new Date(active.startedAt).getTime() : 0;
  const left = total > 0 ? Math.min(1, Math.max(0, (due - now) / total)) : overdue ? 0 : 1;
  const tint = overdue ? colors.destructive : left < 0.1 ? colors.warning : colors.primary;

  return (
    <AppScreen
      tone="info"
      title={t('Safety check-in')}
      subtitle={t('Alerts your contact if you go quiet')}
      icon={<Timer size={24} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      {loading ? null : !hasPins || editingPins ? pinForm : active ? (
        <Card style={styles.card}>
          <View style={styles.timerBlock}>
            <Text style={styles.timerLabel}>{overdue ? t('Check in now') : t('Check in within')}</Text>
            <Text style={[styles.countdown, { color: tint }]} accessibilityLiveRegion="polite">
              {overdue ? t('Overdue') : remaining(due - now)}
            </Text>
            <Text style={styles.cardBody}>
              {t('Due at {time}', { time: new Date(due).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) })}
              {active.note ? ` · ${active.note}` : ''}
            </Text>
          </View>
          {/* Time left as a bar: green, amber in the last tenth, red once overdue. */}
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(left * 100)}%`, backgroundColor: tint }]} />
          </View>
          {active.stage >= 2 ? (
            <View style={styles.alert}>
              <Text style={styles.error}>{t('Your emergency contact has been told. Check in so they know you are safe.')}</Text>
            </View>
          ) : null}
          <Input value={entry} onChangeText={v => setEntry(v.replace(/\D/g, '').slice(0, 6))} placeholder={t('Your PIN')} accessibilityLabel={t('Your PIN')} keyboardType="number-pad" secureTextEntry />
          <Button onPress={() => confirm('ok')} loading={busy} disabled={!isPin(entry)}>
            <ShieldCheck size={16} color="#fff" />
            {t("I'm safe")}
          </Button>
          <Button variant="ghost" onPress={() => confirm('cancel')} disabled={busy || !isPin(entry)}>{t('Stop the timer')}</Button>
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>{t('How long until you check in?')}</Text>
            <View style={styles.chips}>
              {DURATIONS.map(m => (
                <Pressable
                  key={m}
                  onPress={() => setMinutes(m)}
                  style={[styles.chip, minutes === m && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: minutes === m }}
                >
                  <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>
                    {m < 60 ? t('{n} min', { n: m }) : tn(m / 60, '1 hour', '{n} hours')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input value={note} onChangeText={setNote} placeholder={t('Where are you going? (optional)')} accessibilityLabel={t('Where are you going? (optional)')} maxLength={200} />
            <Button onPress={start} loading={busy}>{t('Start check-in')}</Button>
          </Card>
          <Button variant="ghost" onPress={() => setEditingPins(true)}>{t('Change PINs')}</Button>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  card: { padding: 18, gap: 12 },
  cardTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  cardBody: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  timerBlock: { alignItems: 'center', gap: 4, paddingVertical: 6 },
  timerLabel: { color: colors.mutedForeground, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  countdown: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  alert: { backgroundColor: colors.destructiveSoft, borderRadius: radius.md, padding: 12 },
  error: { color: colors.destructive, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.soft },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
});
