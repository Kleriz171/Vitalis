import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, AlertTriangle, ClipboardList, Phone, Pill, X } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { Group, IconButton, Row, Stats } from '@/components/ui/List';

import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { callNumber } from '@/lib/geo';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t, tn } from '@/lib/i18n';

interface Handover {
  type: string;
  createdAt: string;
  metrics: { secondsToAssign: number | null; secondsToScene: number | null; secondsToAed: number | null };
  patient: {
    name: string;
    age?: number;
    gender?: string;
    bloodType?: string;
    allergies: { allergen: string; severity: string }[];
    medications: string[];
    conditions: string[];
    emergencyContact?: { name?: string; phone?: string };
  } | null;
  responder?: { name: string; role: string };
  aedRunner?: { name: string; role: string };
  aed?: { name: string; placement?: string; status?: string };
  timeline: { status: string; at: string; by: string | null }[];
}

const mmss = (s: number | null) => (s == null ? '—' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
const clock = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ') : null);
const GENDER: Record<string, string> = {
  female: t('Female'), male: t('Male'), non_binary: t('Non-binary'), other: t('Other'), prefer_not_to_say: t('Prefer not to say'),
};
const SEVERITY: Record<string, string> = { mild: t('mild'), moderate: t('moderate'), severe: t('severe') };
const STEP: Record<string, string> = {
  pending: t('SOS sent'),
  assigned: t('Responder accepted'),
  aed_runner_assigned: t('AED runner accepted'),
  released: t('Responder did not move, re-alerted'),
  en_route: t('Responder on the way'),
  on_scene: t('Responder on scene'),
  aed_has_aed: t('AED collected'),
  aed_delivered: t('AED at patient'),
  resolved: t('Handed over'),
  cancelled: t('Cancelled'),
};

/** What the ambulance crew needs in the first 30 seconds of taking over. */
export default function HandoverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Handover | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/emergencies/${id}/handover`)
      .then(r => setData(r.data))
      .catch(err => setError(apiError(err, 'Could not load the handover.')));
  }, [id]);

  const p = data?.patient;
  const severe = p?.allergies.filter(a => a.severity === 'severe') ?? [];

  const facts = (items?: string[]) => (items?.length ? items.join('\n') : t('None recorded'));

  return (
    <AppScreen
      tone="dark"
      title={p?.name ?? t('Patient handover')}
      subtitle={p ? [p.age != null ? tn(p.age, '1 year', '{n} years') : null, p.gender ? GENDER[p.gender] ?? cap(p.gender) : null, p.bloodType ? t('Blood {type}', { type: p.bloodType }) : null].filter(Boolean).join(' · ') || t('No profile details') : t('Patient handover')}
      icon={<ClipboardList size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <X size={18} color="#fff" />
        </Pressable>
      }
    >
      {error ? (
        <Group><Text style={styles.error}>{error}</Text></Group>
      ) : !data ? (
        <View style={{ gap: 12 }}>
          <Skeleton style={{ height: 80, borderRadius: radius.lg }} />
          <Skeleton style={{ height: 200, borderRadius: radius.lg }} />
        </View>
      ) : (
        <>
          {severe.length ? (
            <View style={styles.alert} accessibilityRole="alert">
              <AlertTriangle size={18} color="#fff" />
              <Text style={styles.alertText}>{t('Severe allergy: {items}', { items: severe.map(a => a.allergen).join(', ') })}</Text>
            </View>
          ) : null}

          <Stats
            items={[
              { label: t('To accept'), value: mmss(data.metrics.secondsToAssign) },
              { label: t('To scene'), value: mmss(data.metrics.secondsToScene) },
              { label: t('To AED'), value: mmss(data.metrics.secondsToAed) },
            ]}
          />

          <Group title={t('Patient')}>
            <Row first icon={<AlertTriangle size={18} color={colors.destructive} />} title={t('Allergies')} summary={facts(p?.allergies.map(a => `${a.allergen} (${SEVERITY[a.severity] ?? a.severity})`))} />
            <Row icon={<Pill size={18} color={colors.warning} />} title={t('Current medication')} summary={facts(p?.medications)} />
            <Row icon={<Activity size={18} color={colors.primary} />} title={t('Conditions')} summary={facts(p?.conditions)} />
            {p?.emergencyContact?.phone ? (
              <Row
                icon={<Phone size={18} color={colors.info} />}
                title={t('Emergency contact')}
                summary={`${p.emergencyContact.name ?? t('Contact')} · ${p.emergencyContact.phone}`}
                right={<IconButton icon={<Phone size={16} color="#fff" />} color={colors.info} label={t('Call')} onPress={() => callNumber(p.emergencyContact!.phone!)} />}
              />
            ) : null}
          </Group>

          <Group title={t('Timeline')}>
            {data.timeline.map((step, i) => (
              <Row key={i} first={i === 0} icon={<Text style={styles.time}>{clock(step.at)}</Text>} title={STEP[step.status] ?? step.status} summary={step.by ?? undefined} />
            ))}
          </Group>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  error: { color: colors.destructive, fontSize: 14, paddingVertical: 16 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.destructive },
  alertText: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '700' },
  time: { color: colors.foreground, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
