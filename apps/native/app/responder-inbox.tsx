import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { toast } from 'sonner-native';
import { ChevronLeft, ClipboardList, Inbox as InboxIcon, Navigation, Radio, ShieldCheck, Zap } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AppScreen, HeaderButton } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { distanceM, formatDistance, LngLat, openDirections } from '@/lib/geo';
import { RootState } from '@/lib/store';
import { startDutyTracking, stopDutyTracking } from '@/lib/dutyLocation';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';

type Status = 'pending' | 'assigned' | 'en_route' | 'on_scene' | 'resolved' | 'cancelled';

interface Incident {
  _id: string;
  type: string;
  priority: number;
  status: Status;
  createdAt: string;
  description?: string;
  location?: { coordinates: LngLat };
  responder?: string;
  aedRunner?: string;
  aedStatus?: 'to_aed' | 'has_aed' | 'delivered';
  needsAedRunner?: boolean;
  aed?: { name: string; placement?: string; coordinates: LngLat };
}

const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder', 'blood_donor'];

const TYPE_LABEL: Record<string, string> = {
  cardiac: t('Cardiac arrest'),
  medical: t('Medical emergency'),
  trauma: t('Injury'),
  blood_needed: t('Blood needed'),
  rare_medicine: t('Medicine needed'),
  other: t('Emergency'),
};

const STATUS_LABEL: Record<Status, string> = {
  pending: t('Waiting'),
  assigned: t('Accepted'),
  en_route: t('On the way'),
  on_scene: t('On scene'),
  resolved: t('Closed'),
  cancelled: t('Cancelled'),
};

const timeAgo = (iso: string) => {
  const m = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return t('Just now');
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.floor(m / 60);
  return h < 24 ? t('{n} h ago', { n: h }) : t('{n} d ago', { n: Math.floor(h / 24) });
};

export default function ResponderInbox() {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const me = user?.id ?? user?._id ?? '';
  const canAccess = !!user && RESPONDER_ROLES.includes(user.role);

  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [active, setActive] = useState<Incident | null>(null);
  const [here, setHere] = useState<LngLat | null>(null);
  const [loading, setLoading] = useState(true);
  const lastDutyPush = useRef(0);

  const load = useCallback(async () => {
    try {
      const [{ data: list }, { data: passport }] = await Promise.all([
        api.get<Incident[]>('/emergencies'),
        api.get('/biopassport/me'),
      ]);
      const onDuty = !!passport?.profile?.available;
      setAvailable(onDuty);
      // Resume background tracking after an app restart; the OS may have stopped it.
      if (onDuty) startDutyTracking().catch(() => {});
      const mine = list.find(e => e.responder === me || e.aedRunner === me) ?? null;
      setActive(mine);
      setIncidents(list.filter(e => e !== mine));
    } catch {
      toast.error(t('Could not load the inbox'), { description: t('Pull down to retry.') });
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => { if (canAccess) void load(); }, [canAccess, load]);

  // While on duty (or handling a call), keep our position fresh: the server uses it to decide
  // who gets alerted, and the caller sees us approach.
  const activeId = active?._id ?? null;
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  useEffect(() => {
    if (!available && !activeId) return;
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== 'granted' || cancelled) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: activeId ? 15 : 150 },
        pos => {
          const c: LngLat = [pos.coords.longitude, pos.coords.latitude];
          setHere(c);
          if (activeIdRef.current) socket.emit('responder:location', { emergencyId: activeIdRef.current, coordinates: c });
          if (available && Date.now() - lastDutyPush.current > 60_000) {
            lastDutyPush.current = Date.now();
            api.patch('/biopassport/me', { location: { type: 'Point', coordinates: c } }).catch(() => {});
          }
        },
      );
      if (cancelled) { try { sub.remove(); } catch {} }
    })();
    return () => {
      cancelled = true;
      // expo-location's web shim throws on remove(); native is fine.
      try { sub?.remove(); } catch {}
    };
  }, [available, activeId]);

  useEffect(() => {
    if (activeId) socket.emit('emergency:join', activeId);
  }, [activeId]);

  useEffect(() => {
    if (!canAccess) return;
    const onNew = ({ emergency }: { emergency: Incident }) => {
      if (!emergency?._id) return;
      setIncidents(prev => [emergency, ...prev.filter(x => x._id !== emergency._id)]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast(TYPE_LABEL[emergency.type] ?? t('New emergency'), { description: t('Nearby. Open the inbox to accept.') });
    };
    const onTaken = ({ _id, needsAedRunner }: { _id: string; needsAedRunner: boolean }) =>
      setIncidents(prev =>
        needsAedRunner
          ? prev.map(i => (i._id === _id ? { ...i, status: 'assigned', needsAedRunner: true } : i))
          : prev.filter(i => i._id !== _id),
      );
    const onStatus = (e: Incident & { responder?: any; aedRunner?: any }) => {
      setActive(prev => {
        if (!prev || prev._id !== e._id) return prev;
        if (e.status === 'resolved' || e.status === 'cancelled') {
          toast(e.status === 'cancelled' ? t('Caller cancelled the SOS') : t('Incident closed'));
          return null;
        }
        return { ...prev, status: e.status, aedStatus: e.aedStatus };
      });
    };
    socket.on('emergency:new', onNew);
    socket.on('emergency:taken', onTaken);
    socket.on('emergency:status', onStatus);
    return () => {
      socket.off('emergency:new', onNew);
      socket.off('emergency:taken', onTaken);
      socket.off('emergency:status', onStatus);
    };
  }, [canAccess]);

  if (!canAccess) {
    return (
      <AppScreen title={t('Responder inbox')} subtitle={t('For doctors, nurses and certified first-aiders.')}>
        <Empty
          icon={ShieldCheck}
          title={t('Become a responder')}
          description={t("Pass the CPR or AED course in Training. You'll then be able to go on duty and receive SOS calls near you.")}
        />
        <Button onPress={() => router.replace('/(tabs)/learn')}>{t('Open training')}</Button>
      </AppScreen>
    );
  }

  const toggleDuty = async (next: boolean) => {
    if (busy) return;
    setBusy('duty');
    try {
      if (next) {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') {
          toast.error(t('Location needed'), { description: t('Vitalis only alerts responders close to an emergency.') });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const c: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setHere(c);
        await api.patch('/biopassport/me', { available: true, location: { type: 'Point', coordinates: c } });
        // "Always" location lets calls reach you with Vitalis closed. Without it, duty still
        // works while the app is open, so warn instead of refusing.
        if (!(await startDutyTracking())) {
          toast(t('Only while Vitalis is open'), {
            description: t('Allow location “Always” in Settings to receive SOS calls with the app closed.'),
          });
        }
        lastDutyPush.current = Date.now();
        setAvailable(true);
        await load();
      } else {
        await api.patch('/biopassport/me', { available: false });
        await stopDutyTracking();
        setAvailable(false);
      }
    } catch (err: any) {
      toast.error(next ? t('Could not go on duty') : t('Could not go off duty'), {
        description: apiError(err, 'Try again.'),
        ...(err?.response?.status === 403
          ? { action: { label: t('Training'), onClick: () => router.push('/(tabs)/learn') } }
          : {}),
      });
    } finally {
      setBusy(null);
    }
  };

  const accept = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const { data } = await api.post(`/emergencies/${id}/accept`);
      const incident: Incident = {
        ...data,
        responder: String(data.responder ?? ''),
        aedRunner: data.aedRunner ? String(data.aedRunner) : undefined,
        aed: data.aed,
      };
      setActive(incident);
      setIncidents(prev => prev.filter(i => i._id !== id));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (data.myRole === 'aed' && data.aed) {
        toast.success(t('You are the AED runner'), { description: t('Get the defibrillator at {place} first.', { place: data.aed.name }) });
        openDirections(data.aed.coordinates, data.aed.name);
      } else {
        toast.success(t('Accepted'), { description: t('Directions are opening.') });
        if (data.location?.coordinates) openDirections(data.location.coordinates, t('Emergency'));
      }
    } catch (err: any) {
      toast.error(t('Could not accept'), { description: apiError(err, 'Someone else may have taken it.') });
      void load();
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: Status) => {
    if (!active || busy) return;
    setBusy('status');
    try {
      await api.patch(`/emergencies/${active._id}/status`, { status });
      setActive(status === 'resolved' ? null : { ...active, status });
      if (status === 'resolved') toast.success(t('Incident closed. Thank you.'));
    } catch (err: any) {
      toast.error(t('Update failed'), { description: apiError(err, 'Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const setAed = async (status: 'has_aed' | 'delivered') => {
    if (!active || busy) return;
    setBusy('status');
    try {
      await api.patch(`/emergencies/${active._id}/aed`, { status });
      setActive({ ...active, aedStatus: status });
      if (status === 'has_aed' && active.location) openDirections(active.location.coordinates, t('Emergency'));
    } catch (err: any) {
      toast.error(t('Update failed'), { description: apiError(err, 'Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const isRunner = !!active && active.aedRunner === me;
  const distTo = (c?: LngLat) => (here && c ? formatDistance(distanceM(here, c)) : null);

  return (
    <AppScreen
      title={t('Responder inbox')}
      subtitle={available ? t('On duty. Nearby SOS calls appear here instantly.') : t('Off duty. You will not receive SOS calls.')}
      action={<HeaderButton icon={ChevronLeft} onPress={() => router.back()} label={t('Back')} />}
      scrollProps={{ refreshControl: <RefreshControl refreshing={false} onRefresh={load} tintColor={colors.primary} /> }}
    >
      <Card style={styles.dutyCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dutyTitle}>{t('On duty')}</Text>
          <Text style={styles.dutyBody}>{t('Share your location with Vitalis while on duty.')}</Text>
        </View>
        <Switch
          value={available}
          onValueChange={toggleDuty}
          disabled={busy === 'duty'}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={t('On duty')}
        />
      </Card>

      {active ? (
        <Animated.View entering={FadeInDown.duration(220)}>
          <Card style={styles.activeCard}>
            <Text style={styles.activeLabel}>{isRunner ? t('You are fetching the AED') : t('Your active call')}</Text>
            <Text style={styles.activeTitle}>{TYPE_LABEL[active.type] ?? t('Emergency')}</Text>
            <Text style={styles.activeMeta}>
              {distTo(active.location?.coordinates) ? `${t('{distance} away', { distance: distTo(active.location?.coordinates)! })} · ` : ''}
              {isRunner
                ? active.aedStatus === 'delivered' ? t('AED delivered') : active.aedStatus === 'has_aed' ? t('AED picked up') : t('Heading to the AED')
                : STATUS_LABEL[active.status]}
            </Text>

            {isRunner && active.aed && active.aedStatus === 'to_aed' ? (
              <View style={styles.aedBox}>
                <Zap size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.aedName}>{active.aed.name}</Text>
                  {active.aed.placement ? <Text style={styles.aedPlace}>{active.aed.placement}</Text> : null}
                </View>
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Button
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => {
                  const toAed = isRunner && active.aedStatus === 'to_aed' && active.aed;
                  const target = toAed ? active.aed!.coordinates : active.location?.coordinates;
                  if (target) openDirections(target, toAed ? active.aed!.name : t('Emergency'));
                }}
              >
                <Navigation size={16} color={colors.foreground} />
                {t('Directions')}
              </Button>
              <Button
                variant="outline"
                style={{ flex: 1 }}
                onPress={() => router.push({ pathname: '/handover/[id]', params: { id: active._id } } as never)}
              >
                <ClipboardList size={16} color={colors.foreground} />
                {t('Patient')}
              </Button>
            </View>

            {isRunner ? (
              active.aedStatus === 'to_aed' ? (
                <Button onPress={() => setAed('has_aed')} loading={busy === 'status'}>{t('I have the AED')}</Button>
              ) : active.aedStatus === 'has_aed' ? (
                <Button onPress={() => setAed('delivered')} loading={busy === 'status'}>{t('AED is with the patient')}</Button>
              ) : null
            ) : active.status === 'assigned' ? (
              <Button onPress={() => setStatus('en_route')} loading={busy === 'status'}>{t("I'm on my way")}</Button>
            ) : active.status === 'en_route' ? (
              <Button onPress={() => setStatus('on_scene')} loading={busy === 'status'}>{t("I've arrived")}</Button>
            ) : (
              <Button onPress={() => setStatus('resolved')} loading={busy === 'status'}>{t('Handed over, close call')}</Button>
            )}
          </Card>
        </Animated.View>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{t('Nearby calls')}</Text>
        <Text style={styles.listCount}>{incidents.length}</Text>
      </View>

      {loading ? (
        <View style={{ gap: 10 }}>
          {[0, 1].map(i => <Skeleton key={i} style={{ height: 110, borderRadius: radius.lg }} />)}
        </View>
      ) : incidents.length === 0 ? (
        <Empty
          icon={InboxIcon}
          title={available ? t('All quiet nearby') : t('You are off duty')}
          description={available
            ? t('Keep Vitalis open. New calls within 20 km appear here with a vibration.')
            : t('Turn on duty to receive SOS calls within 20 km of you.')}
        />
      ) : (
        <View style={{ gap: 10 }}>
          {incidents.map(e => (
            <Animated.View key={e._id} entering={FadeInDown.duration(200)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)}>
              <Card style={styles.incident}>
                <View style={styles.incidentTop}>
                  <Text style={[styles.incidentType, e.priority === 1 && { color: colors.destructive }]}>{TYPE_LABEL[e.type] ?? t('Emergency')}</Text>
                  <Text style={styles.incidentTime}>{timeAgo(e.createdAt)}</Text>
                </View>
                <Text style={styles.incidentMeta}>
                  {distTo(e.location?.coordinates) ?? t('Distance unknown')}
                  {e.needsAedRunner ? ' · Responder on the way, AED needed' : ''}
                </Text>
                {/* The app writes known descriptions in English; t() shows them in the responder's language. */}
                {e.description ? <Text style={styles.incidentDesc} numberOfLines={2}>{t(e.description)}</Text> : null}
                <Button
                  onPress={() => accept(e._id)}
                  loading={busy === e._id}
                  disabled={!available || !!active}
                  variant={e.needsAedRunner ? 'outline' : 'default'}
                >
                  {!available ? t('Go on duty to accept') : active ? t('Finish your current call first') : e.needsAedRunner ? t('Fetch the AED') : t('Accept')}
                </Button>
              </Card>
            </Animated.View>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  dutyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg },
  dutyTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  dutyBody: { color: colors.mutedForeground, fontSize: 14, marginTop: 2 },
  activeCard: { padding: 16, gap: 10, borderRadius: radius.lg, borderColor: colors.primary, borderWidth: 1.5 },
  activeLabel: { color: colors.primaryStrong, fontSize: 13, fontWeight: '700' },
  activeTitle: { color: colors.foreground, fontSize: 22, fontWeight: '800' },
  activeMeta: { color: colors.mutedForeground, fontSize: 14 },
  aedBox: { flexDirection: 'row', gap: 10, padding: 12, backgroundColor: colors.warningSoft, borderRadius: radius.md },
  aedName: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  aedPlace: { color: colors.foreground, fontSize: 14, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10 },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  listTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  listCount: { color: colors.mutedForeground, fontSize: 15, fontVariant: ['tabular-nums'] },
  incident: { padding: 16, gap: 8, borderRadius: radius.lg },
  incidentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  incidentType: { color: colors.foreground, fontSize: 17, fontWeight: '700' },
  incidentTime: { color: colors.mutedForeground, fontSize: 13 },
  incidentMeta: { color: colors.foreground, fontSize: 14 },
  incidentDesc: { color: colors.mutedForeground, fontSize: 14, lineHeight: 20 },
});
