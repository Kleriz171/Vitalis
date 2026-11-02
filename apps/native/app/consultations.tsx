import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Calendar, CalendarClock, CalendarX, FileText } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t } from '@/lib/i18n';

type Booking = {
  id: string;
  doctor: { id: string; name: string; specialty: string };
  type: { id: string; name: string; minutes: number; online: boolean };
  price: number;
  startsAt: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'declined';
  summary?: { observations?: string; recommendations?: string; summary?: string; writtenAt?: string };
};

const STATUS: Record<Booking['status'], string> = {
  requested: t('Waiting for the clinician'),
  confirmed: t('Confirmed'),
  completed: t('Done'),
  cancelled: t('Cancelled'),
  declined: t('Declined by the clinician'),
};
const when = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Tirane' }).format(new Date(iso));

/** The patient's consultations: upcoming ones to move or cancel, past ones with the clinician's summary. */
export default function Consultations() {
  const router = useRouter();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api.get<Booking[]>('/bookings/mine')
    .then(({ data }) => setItems(data))
    .catch(err => { setItems([]); toast.error(apiError(err, 'Could not load your consultations.')); }), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const cancel = async (b: Booking) => {
    setBusy(b.id);
    try {
      await api.post(`/bookings/${b.id}/cancel`, {});
      toast.success(t('Cancelled. The time is free again.'));
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not cancel.'));
    } finally {
      setBusy(null);
    }
  };

  const now = Date.now();
  const upcoming = (items ?? []).filter(b => ['requested', 'confirmed'].includes(b.status) && Date.parse(b.startsAt) > now).reverse();
  const past = (items ?? []).filter(b => !upcoming.includes(b));

  const card = (b: Booking, i: number) => (
    <View key={b.id}>
      <Row
        first={i === 0}
        icon={<Calendar size={18} color={colors.primary} />}
        title={`${b.doctor.name} · ${b.type.name}`}
        summary={`${when(b.startsAt)} · ${b.price.toLocaleString(locale)} lekë${b.type.online ? ` · ${t('Online')}` : ''}`}
        onPress={() => setOpen(open === b.id ? null : b.id)}
        right={<Badge variant={b.status === 'confirmed' || b.status === 'completed' ? 'default' : b.status === 'requested' ? 'secondary' : 'outline'}>{STATUS[b.status]}</Badge>}
      />
      {open === b.id ? (
        <View style={styles.open}>
          {b.summary?.summary ? (
            <View style={styles.summary}>
              <View style={styles.summaryHead}><FileText size={16} color={colors.primary} /><Text style={styles.summaryTitle}>{t('Summary from {name}', { name: b.doctor.name })}</Text></View>
              <Text style={styles.summaryText}>{b.summary.summary}</Text>
              {b.summary.recommendations ? <Text style={styles.summaryText}>{t('Recommendations')}: {b.summary.recommendations}</Text> : null}
              <Text style={styles.note}>{t('Not a prescription or a medical certificate.')}</Text>
            </View>
          ) : null}
          {['requested', 'confirmed'].includes(b.status) && Date.parse(b.startsAt) > now ? (
            <View style={styles.actions}>
              <Button variant="outline" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/book/[id]', params: { id: b.doctor.id, reschedule: b.id, type: b.type.id } } as never)}>
                <CalendarClock size={16} color={colors.foreground} />{t('Move')}
              </Button>
              <Button variant="outline" style={{ flex: 1 }} loading={busy === b.id} onPress={() => cancel(b)}>
                <CalendarX size={16} color={colors.destructive} />{t('Cancel')}
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <AppScreen
      tone="dark"
      title={t('My consultations')}
      subtitle={t('Booked with clinicians on Vitalis.')}
      icon={<Calendar size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
      scrollProps={{ refreshControl: <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} /> }}
    >
      {!items ? <Skeleton style={{ height: 160, borderRadius: radius.lg }} />
        : !items.length ? <Group><Empty icon={Calendar} title={t('No consultations yet')} description={t('Book one from the Doctors tab: look for “Book a consultation”.')} /></Group>
        : (
          <>
            {upcoming.length ? <Group title={t('Upcoming')}>{upcoming.map(card)}</Group> : null}
            {past.length ? <Group title={t('Past and cancelled')}>{past.map(card)}</Group> : null}
          </>
        )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  open: { paddingBottom: 14, gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
  summary: { backgroundColor: colors.successSoft, borderRadius: radius.md, padding: 12, gap: 6 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  summaryText: { fontSize: 14, color: colors.foreground, lineHeight: 20 },
  note: { fontSize: 12, color: colors.mutedForeground },
});
