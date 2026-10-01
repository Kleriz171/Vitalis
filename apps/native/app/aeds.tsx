import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { toast } from 'sonner-native';
import { ChevronLeft, Navigation, Plus, ShieldCheck, Zap } from 'lucide-react-native';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatDistance, LngLat, openDirections } from '@/lib/geo';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';

interface AedItem {
  id: string;
  name: string;
  placement?: string;
  access: '24h' | 'business_hours' | 'restricted';
  coordinates: LngLat;
  verified: boolean;
  distanceM?: number;
}

const ACCESS_LABEL: Record<AedItem['access'], string> = {
  '24h': t('Open 24 hours'),
  business_hours: t('Business hours'),
  restricted: t('Ask staff for access'),
};

export default function AedsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AedItem[]>([]);
  const [here, setHere] = useState<LngLat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setError(t('Turn on location to find the defibrillators closest to you.'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: LngLat = [pos.coords.longitude, pos.coords.latitude];
      setHere(coords);
      const { data } = await api.get('/aeds', { params: { lng: coords[0], lat: coords[1] } });
      setItems(data);
    } catch (err: any) {
      setError(apiError(err, 'Could not load defibrillators. Pull to retry.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <AppScreen
      tone="dark"
      title={t('Defibrillators')}
      subtitle={t('Nearest public AEDs')}
      icon={<Zap size={22} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ChevronLeft size={20} color="#fff" />
        </Pressable>
      }
      scrollProps={{ refreshControl: <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} /> }}
    >
      {reporting && here ? (
        <ReportForm here={here} onDone={created => {
          setReporting(false);
          if (created) void load();
        }} />
      ) : (
        <Button variant="outline" onPress={() => setReporting(true)} disabled={!here}>
          <Plus size={16} color={colors.foreground} />
          {t('Report a defibrillator here')}
        </Button>
      )}

      {loading ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map(i => <Skeleton key={i} style={{ height: 88, borderRadius: radius.lg }} />)}
        </View>
      ) : error ? (
        <Empty icon={Zap} title={t('No location')} description={error} />
      ) : items.length === 0 ? (
        <Empty icon={Zap} title={t('None registered within 10 km')} description={t('If you know where one hangs, report it. A dispatcher verifies each entry.')} />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map(a => (
            <Card key={a.id} style={styles.row}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                  {a.verified ? <ShieldCheck size={16} color={colors.success} accessibilityLabel={t('Verified')} /> : null}
                </View>
                {a.placement ? <Text style={styles.placement} numberOfLines={2}>{a.placement}</Text> : null}
                <Text style={styles.meta}>
                  {a.distanceM != null ? `${formatDistance(a.distanceM)} · ` : ''}{ACCESS_LABEL[a.access]}{a.verified ? '' : ` · ${t('Unverified')}`}
                </Text>
              </View>
              <Pressable
                onPress={() => openDirections(a.coordinates, a.name)}
                style={styles.navButton}
                accessibilityRole="button"
                accessibilityLabel={t('Directions to {place}', { place: a.name })}
              >
                <Navigation size={18} color={colors.primaryStrong} />
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

function ReportForm({ here, onDone }: { here: LngLat; onDone: (created: boolean) => void }) {
  const [name, setName] = useState('');
  const [placement, setPlacement] = useState('');
  const [access, setAccess] = useState<AedItem['access']>('business_hours');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return toast.error(t('Add the name of the place'));
    setSaving(true);
    try {
      await api.post('/aeds', { name: name.trim(), placement: placement.trim() || undefined, access, coordinates: here });
      toast.success(t('Thanks, reported'), { description: t('A dispatcher will verify it.') });
      onDone(true);
    } catch (err: any) {
      toast.error(t('Could not report'), { description: apiError(err, 'Try again.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.form}>
      <Text style={styles.formTitle}>{t('Report a defibrillator at your location')}</Text>
      <Text style={styles.label}>{t('Place')}</Text>
      <TextInput value={name} onChangeText={setName} placeholder={t('e.g. City Hall lobby')} placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={120} />
      <Text style={styles.label}>{t('Exactly where')}</Text>
      <TextInput value={placement} onChangeText={setPlacement} placeholder={t('e.g. Wall cabinet left of the lifts')} placeholderTextColor={colors.mutedForeground} style={styles.input} maxLength={240} />
      <Text style={styles.label}>{t('Access')}</Text>
      <View style={styles.segment}>
        {(Object.keys(ACCESS_LABEL) as AedItem['access'][]).map(k => (
          <Pressable
            key={k}
            onPress={() => setAccess(k)}
            style={[styles.segItem, access === k && styles.segItemOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: access === k }}
          >
            <Text style={[styles.segText, access === k && styles.segTextOn]}>{k === '24h' ? t('24 h') : k === 'business_hours' ? t('Hours') : t('Staff')}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.formActions}>
        <Button variant="ghost" onPress={() => onDone(false)} style={{ flex: 1 }}>{t('Cancel')}</Button>
        <Button onPress={submit} loading={saving} style={{ flex: 1 }}>{t('Report')}</Button>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.foreground, fontSize: 16, fontWeight: '700', flexShrink: 1 },
  placement: { color: colors.foreground, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.mutedForeground, fontSize: 13 },
  navButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  form: { padding: 16, gap: 8, borderRadius: radius.lg },
  formTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  label: { color: colors.mutedForeground, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 12, fontSize: 16, color: colors.foreground, backgroundColor: colors.card,
  },
  segment: { flexDirection: 'row', backgroundColor: colors.muted, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segItemOn: { backgroundColor: colors.card },
  segText: { color: colors.mutedForeground, fontSize: 14, fontWeight: '600' },
  segTextOn: { color: colors.foreground },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
