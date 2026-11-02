import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, Check, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Group, Row, tick } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t } from '@/lib/i18n';

type ConsultationType = { id: string; name: string; minutes: number; price: number; online: boolean };
type Doctor = { id: string; name: string; specialty: string; consultationTypes: ConsultationType[] };
type Day = { date: string; times: string[] };

const lek = (n: number) => `${n.toLocaleString(locale)} lekë`;
const dayLabel = (date: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const timeLabel = (iso: string) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Tirane' }).format(new Date(iso));

/** Book (or, with ?reschedule=<booking id>&type=<type id>, move) a consultation with one clinician. */
export default function BookConsultation() {
  const { id, reschedule, type: fixedType } = useLocalSearchParams<{ id: string; reschedule?: string; type?: string }>();
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [typeId, setTypeId] = useState<string | null>(fixedType ?? null);
  const [days, setDays] = useState<Day[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Doctor>(`/doctors/${id}`)
      .then(({ data }) => { setDoctor(data); if (!fixedType && data.consultationTypes.length === 1) setTypeId(data.consultationTypes[0].id); })
      .catch(err => setError(apiError(err, 'Could not load this doctor.')));
  }, [id, fixedType]);

  useEffect(() => {
    if (!typeId) return;
    setDays(null); setDate(null); setTime(null);
    api.get<Day[]>(`/doctors/${id}/slots`, { params: { type: typeId, days: 14 } })
      .then(({ data }) => { setDays(data); setDate(data.find(d => d.times.length)?.date ?? null); })
      .catch(err => setError(apiError(err, 'Could not load free times.')));
  }, [id, typeId]);

  const type = doctor?.consultationTypes.find(x => x.id === typeId);
  const times = useMemo(() => days?.find(d => d.date === date)?.times ?? [], [days, date]);

  const submit = async () => {
    if (!time || !typeId) return;
    setSaving(true);
    try {
      if (reschedule) {
        await api.post(`/bookings/${reschedule}/reschedule`, { startsAt: time });
        toast.success(t('Moved. The clinician will confirm the new time.'));
      } else {
        await api.post(`/doctors/${id}/bookings`, { typeId, startsAt: time, shareRecord: share, ...(reason.trim() ? { reason: reason.trim() } : {}) });
        toast.success(t('Requested. You will see here when the clinician confirms.'));
      }
      router.replace('/consultations' as never);
    } catch (err) {
      toast.error(apiError(err, 'Could not book this time.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen
      tone="dark"
      title={reschedule ? t('Move consultation') : t('Book a consultation')}
      subtitle={doctor ? `${doctor.name} · ${t(doctor.specialty)}` : undefined}
      icon={<CalendarPlus size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <X size={18} color="#fff" />
        </Pressable>
      }
    >
      {error ? <Group><Text style={styles.error}>{error}</Text></Group>
        : !doctor ? <Skeleton style={{ height: 180, borderRadius: radius.lg }} />
        : (
          <>
            {!fixedType ? (
              <Group title={t('Consultation')}>
                {doctor.consultationTypes.map((c, i) => (
                  <Row
                    key={c.id}
                    first={i === 0}
                    title={c.name}
                    summary={[t('{n} min', { n: c.minutes }), lek(c.price), c.online ? t('Online') : null].filter(Boolean).join(' · ')}
                    onPress={() => { tick(); setTypeId(c.id); }}
                    right={typeId === c.id ? <Check size={18} color={colors.primary} /> : <View style={{ width: 18 }} />}
                  />
                ))}
              </Group>
            ) : null}

            {type ? (
              <Group title={t('When')}>
                {!days ? <Skeleton style={{ height: 90, borderRadius: radius.md, marginVertical: 12 }} />
                  : !days.some(d => d.times.length) ? <Text style={styles.empty}>{t('No free times in the next two weeks.')}</Text>
                  : (
                    <>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                        {days.filter(d => d.times.length).map(d => (
                          <Pressable key={d.date} onPress={() => { tick(); setDate(d.date); setTime(null); }} style={[styles.chip, date === d.date && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: date === d.date }}>
                            <Text style={[styles.chipText, date === d.date && styles.chipTextOn]}>{dayLabel(d.date)}</Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <View style={styles.grid}>
                        {times.map(iso => (
                          <Pressable key={iso} onPress={() => { tick(); setTime(iso); }} style={[styles.chip, time === iso && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: time === iso }}>
                            <Text style={[styles.chipText, time === iso && styles.chipTextOn]}>{timeLabel(iso)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  )}
              </Group>
            ) : null}

            {type && !reschedule ? (
              <Group title={t('Details')}>
                <Input value={reason} onChangeText={setReason} maxLength={500} multiline placeholder={t('What is it about? (optional)')} style={styles.reason} />
                <Row
                  title={t('Share my Bio Passport and Vitalis history')}
                  summary={t('Only with this clinician, for this consultation. Every view is logged.')}
                  right={<Switch value={share} onValueChange={setShare} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('Share my Bio Passport and Vitalis history')} />}
                />
              </Group>
            ) : null}

            {type ? (
              <>
                <Text style={styles.price}>{t('Price: {price}, paid at the consultation. Vitalis takes no payment.', { price: lek(type.price) })}</Text>
                <Button onPress={submit} loading={saving} disabled={!time}>{reschedule ? t('Move to this time') : t('Request this time')}</Button>
              </>
            ) : null}
          </>
        )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  error: { color: colors.destructive, fontSize: 14, paddingVertical: 16 },
  empty: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 16 },
  chips: { gap: 8, paddingVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.foreground, fontVariant: ['tabular-nums'] },
  chipTextOn: { color: '#fff' },
  reason: { minHeight: 72, textAlignVertical: 'top', marginTop: 12, marginBottom: 4 },
  price: { color: colors.mutedForeground, fontSize: 13, textAlign: 'center' },
});
