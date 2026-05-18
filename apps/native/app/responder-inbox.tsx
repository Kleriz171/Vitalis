import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner-native';
import {
  Ambulance,
  CheckCircle2,
  Inbox as InboxIcon,
  LogOut,
  MapPin,
  Radio,
  ShieldCheck,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeOut, Layout } from 'react-native-reanimated';

import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { logout, RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

type Status = 'pending' | 'accepted' | 'en_route' | 'on_scene' | 'resolved';

interface Emergency {
  _id: string;
  type: string;
  priority: number;
  status: Status;
  createdAt: string;
  description?: string;
  etaSeconds?: number;
  coordinates?: [number, number];
  location?: { type: 'Point'; coordinates: [number, number] };
}

const hasCoords = (e: Emergency) =>
  Array.isArray(e.coordinates) || Array.isArray(e.location?.coordinates);

const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder'];

const timeAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const formatEta = (s?: number) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const shortId = (id: string) => id.slice(-6).toUpperCase();

export default function ResponderInbox() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((s: RootState) => s.auth.user);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState<'duty' | string | null>(null);
  const [incidents, setIncidents] = useState<Emergency[]>([]);
  const [active, setActive] = useState<Emergency | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canAccess = !!user && RESPONDER_ROLES.includes(user.role ?? '');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/emergencies', {
        params: { status: 'pending,assigned' },
      });
      const list: Emergency[] = data?.emergencies ?? data ?? [];
      setIncidents(list.filter(e => e.status === 'pending').slice(0, 30));
      setActive(list.find(e => e.status !== 'pending' && e.status !== 'resolved') ?? null);
    } catch {
      // silent — inbox stays empty
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    if (!canAccess) return;
    load();

    const onNew = (e: any) => {
      const incoming: Emergency = e?.emergency ?? e;
      if (!incoming?._id) return;
      setIncidents(prev => [incoming, ...prev.filter(x => x._id !== incoming._id)].slice(0, 30));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      toast(`New ${incoming.type ?? 'incident'}`, {
        description: `P${incoming.priority} · just received`,
      });
    };

    const onAssigned = (e: any) => {
      if (e?.responder === user?.id) setActive(e);
      setIncidents(prev => prev.filter(i => i._id !== e?._id));
    };

    socket.on('emergency:new', onNew);
    socket.on('emergency:assigned', onAssigned);
    return () => {
      socket.off('emergency:new', onNew);
      socket.off('emergency:assigned', onAssigned);
    };
  }, [canAccess, load, user?.id]);

  if (!canAccess) {
    return (
      <AppScreen
        tone="info"
        eyebrow="Restricted"
        title="Responder area"
        subtitle="Doctors, nurses, and student responders only."
      >
        <Empty
          icon={ShieldCheck}
          title="No access"
          description="Sign in with a responder account to view the inbox."
        />
        <View style={{ height: 12 }} />
        <Button onPress={() => router.replace('/(tabs)/home')}>Back to home</Button>
      </AppScreen>
    );
  }

  const toggleDuty = async () => {
    if (busy) return;
    setBusy('duty');
    try {
      if (!available) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          toast.error('Location needed', {
            description: 'Enable location to receive nearby SOS.',
            action: { label: 'Try again', onClick: () => toggleDuty() },
          });
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        await api.patch('/biopassport/me', {
          location: {
            type: 'Point',
            coordinates: [position.coords.longitude, position.coords.latitude],
          },
          available: true,
        });
        setAvailable(true);
        toast.success('On duty', { description: "You'll receive nearby SOS broadcasts." });
      } else {
        await api.patch('/biopassport/me', { available: false });
        setAvailable(false);
        toast('Off duty');
      }
    } catch (err: any) {
      toast.error('Could not update status', {
        description: err.response?.data?.error ?? 'Please try again.',
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
      setActive(data);
      setIncidents(prev => prev.filter(i => i._id !== id));
      socket.emit('emergency:join', id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.success('Accepted', { description: `ETA ${formatEta(data.etaSeconds)}` });
    } catch (err: any) {
      toast.error('Accept failed', {
        description: err.response?.data?.error ?? 'Someone else may have taken it.',
      });
    } finally {
      setBusy(null);
    }
  };

  const setStatus = async (status: Status) => {
    if (!active) return;
    try {
      const { data } = await api.patch(`/emergencies/${active._id}/status`, { status });
      setActive(status === 'resolved' ? null : data);
      toast(`Marked ${status.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error('Status update failed', {
        description: err.response?.data?.error ?? 'Please try again.',
      });
    }
  };

  const signOut = () => {
    dispatch(logout());
    router.replace('/');
  };

  return (
    <AppScreen
      tone="info"
      eyebrow="Responder"
      title={`Inbox · ${user?.name?.split(' ')[0] ?? 'On call'}`}
      subtitle="Live broadcasts from nearby citizens needing help."
      icon={<Radio size={22} color="#fff" />}
      action={
        <Pressable onPress={signOut} style={styles.iconButton}>
          <LogOut size={16} color="#fff" />
        </Pressable>
      }
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
    >
      <Card style={styles.dutyCard}>
        <View style={styles.dutyHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dutyTitle}>Duty status</Text>
            <Text style={styles.dutyBody}>Receive nearby SOS broadcasts when on duty.</Text>
          </View>
          <Badge
            variant={available ? 'default' : 'outline'}
            style={available ? styles.onDutyBadge : undefined}
          >
            {available ? 'ON DUTY' : 'OFF DUTY'}
          </Badge>
        </View>
        <Button onPress={toggleDuty} loading={busy === 'duty'} style={{ marginTop: 14 }}>
          {available ? 'Go off duty' : 'Go on duty'}
        </Button>
      </Card>

      {active && (
        <Animated.View entering={FadeInDown.duration(280)}>
          <Card style={styles.activeCard}>
            <View style={styles.activeHeader}>
              <View>
                <Text style={styles.activeEyebrow}>Active incident</Text>
                <Text style={styles.activeId}>#{shortId(active._id)}</Text>
              </View>
              <Badge variant="default" style={styles.activeStatus}>
                {active.status.replace('_', ' ')}
              </Badge>
            </View>
            <Text style={styles.activeMeta}>
              {active.type?.replace('_', ' ') ?? 'incident'} · P{active.priority}
            </Text>
            {active.etaSeconds != null && (
              <Text style={styles.etaValue}>ETA {formatEta(active.etaSeconds)}</Text>
            )}
            <View style={styles.statusRow}>
              <Button variant="outline" onPress={() => setStatus('en_route')} style={styles.statusBtn}>
                En route
              </Button>
              <Button variant="outline" onPress={() => setStatus('on_scene')} style={styles.statusBtn}>
                On scene
              </Button>
              <Button onPress={() => setStatus('resolved')} style={styles.statusBtn}>
                Resolve
              </Button>
            </View>
          </Card>
        </Animated.View>
      )}

      <View style={styles.inboxHeader}>
        <Text style={styles.inboxTitle}>Inbox</Text>
        <Text style={styles.inboxCount}>{incidents.length} waiting</Text>
      </View>

      {loading && !incidents.length ? (
        <View style={{ gap: 10 }}>
          {[0, 1, 2].map(i => (
            <Card key={i} style={[styles.skeletonCard]}>
              <View style={{ height: 12, width: '40%', borderRadius: 6, backgroundColor: colors.muted }} />
              <View style={{ height: 10, width: '70%', borderRadius: 5, backgroundColor: colors.muted, marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : incidents.length === 0 ? (
        <Empty
          icon={InboxIcon}
          title={available ? 'No incidents yet' : 'Go on duty to receive SOS'}
          description={
            available
              ? 'Stand by — new broadcasts will appear here in real time.'
              : 'You will only receive incidents while on duty.'
          }
        />
      ) : (
        <View style={{ gap: 10 }}>
          {incidents.map((e, i) => (
            <Animated.View
              key={e._id}
              entering={FadeInDown.duration(280).delay(i * 30)}
              exiting={FadeOut.duration(160)}
              layout={Layout.springify()}
            >
              <Card style={styles.incidentCard}>
                <View style={styles.incidentTop}>
                  <View style={styles.incidentMetaRow}>
                    <Text style={styles.incidentId}>#{shortId(e._id)}</Text>
                    <Badge
                      variant={e.priority === 1 ? 'destructive' : 'outline'}
                      style={e.priority === 1 ? undefined : styles.prioBadge}
                    >
                      P{e.priority}
                    </Badge>
                  </View>
                  <Text style={styles.incidentTime}>{timeAgo(e.createdAt)}</Text>
                </View>
                <Text style={styles.incidentType}>
                  {e.type?.replace('_', ' ') ?? 'incident'}
                </Text>
                {e.description && (
                  <Text style={styles.incidentDesc} numberOfLines={2}>
                    {e.description}
                  </Text>
                )}
                <View style={styles.incidentBottom}>
                  <View style={styles.incidentHint}>
                    <MapPin size={12} color={colors.mutedForeground} />
                    <Text style={styles.incidentHintText}>
                      {hasCoords(e) ? 'Location attached' : 'Location pending'}
                    </Text>
                  </View>
                  <Button
                    onPress={() => accept(e._id)}
                    loading={busy === e._id}
                    disabled={!available}
                  >
                    {available ? 'Accept' : 'Go on duty first'}
                  </Button>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>
      )}

      <View style={styles.footerHint}>
        <Ambulance size={14} color={colors.mutedForeground} />
        <Text style={styles.footerHintText}>
          Patient bio-passport context loads automatically on accept.
        </Text>
      </View>

      <View style={styles.footerHint}>
        <CheckCircle2 size={14} color={colors.success} />
        <Text style={styles.footerHintText}>
          Every status change is recorded to the tamper-evident ledger.
        </Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dutyCard: { padding: 18, gap: 4 },
  dutyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dutyTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  dutyBody: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 },
  onDutyBadge: { backgroundColor: colors.success },

  activeCard: {
    padding: 18,
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: colors.accent,
    marginTop: 14,
  },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  activeEyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.primaryStrong,
    fontWeight: '600',
  },
  activeId: { fontFamily: 'Menlo', fontSize: 18, color: colors.foreground, marginTop: 4 },
  activeStatus: { backgroundColor: colors.primary },
  activeMeta: {
    marginTop: 10,
    fontSize: 14,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  etaValue: {
    marginTop: 8,
    fontFamily: 'Menlo',
    fontSize: 24,
    color: colors.primaryStrong,
    fontWeight: '700',
  },
  statusRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statusBtn: { flex: 1 },

  inboxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  inboxTitle: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.mutedForeground,
    fontWeight: '600',
  },
  inboxCount: { fontSize: 11, color: colors.mutedForeground },

  skeletonCard: { padding: 16, opacity: 0.7 },
  incidentCard: { padding: 16, gap: 8 },
  incidentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  incidentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  incidentId: { fontFamily: 'Menlo', fontSize: 11, color: colors.mutedForeground },
  incidentTime: { fontSize: 11, color: colors.mutedForeground },
  incidentType: { fontSize: 15, fontWeight: '600', color: colors.foreground, textTransform: 'capitalize' },
  incidentDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
  incidentBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  incidentHint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  incidentHintText: { fontSize: 11, color: colors.mutedForeground },
  prioBadge: { borderColor: colors.border },

  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  footerHintText: { fontSize: 12, color: colors.mutedForeground, flex: 1 },
});

// (radius referenced indirectly via Card styles)
void radius;
