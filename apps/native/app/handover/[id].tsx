import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} accessibilityRole="header">{t('Patient handover')}</Text>
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <X size={20} color={colors.foreground} />
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : !data ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton style={{ height: 120, borderRadius: radius.lg }} />
          <Skeleton style={{ height: 200, borderRadius: radius.lg }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.block}>
            <Text style={styles.name}>{p?.name ?? t('Unknown patient')}</Text>
            <Text style={styles.sub}>
              {[p?.age != null ? tn(p.age, '1 year', '{n} years') : null, p?.gender ? GENDER[p.gender] ?? cap(p.gender) : null, p?.bloodType ? t('Blood {type}', { type: p.bloodType }) : null]
                .filter(Boolean).join(' · ') || t('No profile details')}
            </Text>
            {severe.length ? (
              <View style={styles.alert}>
                <Text style={styles.alertText}>{t('Severe allergy: {items}', { items: severe.map(a => a.allergen).join(', ') })}</Text>
              </View>
            ) : null}
          </View>

          <Section title={t('Allergies')} items={p?.allergies.map(a => `${a.allergen} (${SEVERITY[a.severity] ?? a.severity})`)} />
          <Section title={t('Current medication')} items={p?.medications} />
          <Section title={t('Conditions')} items={p?.conditions} />

          {p?.emergencyContact?.phone ? (
            <Pressable style={styles.contact} onPress={() => callNumber(p.emergencyContact!.phone!)} accessibilityRole="button">
              <Text style={styles.contactLabel}>{t('Emergency contact')}</Text>
              <Text style={styles.contactValue}>{p.emergencyContact.name ?? t('Contact')} · {p.emergencyContact.phone}</Text>
            </Pressable>
          ) : null}

          <View style={styles.metrics}>
            <Metric label={t('To accept')} value={mmss(data.metrics.secondsToAssign)} />
            <Metric label={t('To scene')} value={mmss(data.metrics.secondsToScene)} />
            <Metric label={t('To AED')} value={mmss(data.metrics.secondsToAed)} />
          </View>

          <View style={styles.block}>
            <Text style={styles.sectionTitle}>{t('Timeline')}</Text>
            {data.timeline.map((t, i) => (
              <View key={i} style={styles.tlRow}>
                <Text style={styles.tlTime}>{clock(t.at)}</Text>
                <Text style={styles.tlText}>{STEP[t.status] ?? t.status}{t.by ? ` · ${t.by}` : ''}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  return (
    <View style={styles.block}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{items?.length ? items.join('\n') : t('None recorded')}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  barTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.destructive, fontSize: 15, padding: 16 },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  block: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 6 },
  name: { color: colors.foreground, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.mutedForeground, fontSize: 15 },
  alert: { marginTop: 8, backgroundColor: colors.destructiveSoft, borderRadius: radius.md, padding: 10 },
  alertText: { color: '#A61B1B', fontSize: 15, fontWeight: '700' },
  sectionTitle: { color: colors.mutedForeground, fontSize: 13, fontWeight: '700' },
  sectionBody: { color: colors.foreground, fontSize: 16, lineHeight: 23 },
  contact: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 16, gap: 2 },
  contactLabel: { color: colors.accentForeground, fontSize: 13, fontWeight: '700' },
  contactValue: { color: colors.accentForeground, fontSize: 16, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12, alignItems: 'center' },
  metricValue: { color: colors.foreground, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  tlRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  tlTime: { color: colors.mutedForeground, fontSize: 14, width: 70, fontVariant: ['tabular-nums'] },
  tlText: { color: colors.foreground, fontSize: 15, flex: 1 },
});
