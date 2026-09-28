import { useCallback, useEffect, useRef, useState } from 'react';
import { holdAppearanceReload } from '@/lib/appearance';
import { AccessibilityInfo, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { toast } from 'sonner-native';
import { Check, HeartPulse, MapPin, Phone, Radio, UserRound, X, Zap } from 'lucide-react-native';

import { api } from '@/lib/api';
import { socket } from '@/lib/socket';
import { callNumber, distanceM, etaMinutes, formatDistance, LngLat } from '@/lib/geo';
import { colors, radius } from '@/lib/theme';
import { apiError, t, tn } from '@/lib/i18n';

type Phase = 'countdown' | 'sending' | 'live' | 'ended';
type Person = { _id: string; name: string; role: string } | string | null | undefined;

interface LiveEmergency {
  _id: string;
  type: string;
  status: 'pending' | 'assigned' | 'en_route' | 'on_scene' | 'resolved' | 'cancelled';
  location: { coordinates: LngLat };
  responder?: Person;
  aedRunner?: Person;
  aed?: { name: string; placement?: string } | string;
  aedStatus?: 'to_aed' | 'has_aed' | 'delivered';
  etaSeconds?: number;
}

const COUNTDOWN_S = 3;
const CPR_BPM = 110;
const ROLE_LABEL: Record<string, string> = {
  doctor: t('Doctor'),
  nurse: t('Nurse'),
  student_responder: t('Certified first-aider'),
  blood_donor: t('Certified first-aider'),
};

const idOf = (p: Person) => (p && typeof p === 'object' ? p._id : p ?? null);
const nameOf = (p: Person) => (p && typeof p === 'object' ? p.name : null);
const roleOf = (p: Person) => (p && typeof p === 'object' ? ROLE_LABEL[p.role] ?? t('Responder') : t('Responder'));

export default function EmergencyScreen() {
  // A light/dark reload here would drop the CPR coach's timing: hold it while this screen is up.
  useEffect(() => holdAppearanceReload(), []);
  const router = useRouter();
  const params = useLocalSearchParams<{ start?: string }>();
  const [phase, setPhase] = useState<Phase>(params.start === '1' ? 'countdown' : 'live');
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_S);
  const [notBreathing, setNotBreathing] = useState(false);
  const [emergency, setEmergency] = useState<LiveEmergency | null>(null);
  const [nearbyCount, setNearbyCount] = useState<number | null>(null);
  const [responderPos, setResponderPos] = useState<Record<string, LngLat>>({});
  const [ambulance, setAmbulance] = useState('127');
  const [cprOn, setCprOn] = useState(false);
  const sentRef = useRef(false);
  const autoTriedRef = useRef(false);

  // Numbers come from the API so they can be localised per country without an app release.
  useEffect(() => {
    api.get('/emergencies/numbers')
      .then(({ data }) => {
        const amb = (data as { category: string; number: string }[]).find(n => n.category === 'ambulance');
        if (amb) setAmbulance(amb.number);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/emergencies/mine');
      if (data.emergency) {
        setEmergency(data.emergency);
        socket.emit('emergency:join', data.emergency._id);
      } else if (params.start !== '1') {
        // Opened without a live SOS (e.g. stale link): nothing to follow.
        router.replace('/(tabs)/home');
      }
    } catch {
      // keep last known state; socket events will retry
    }
  }, [params.start, router]);

  const send = useCallback(async () => {
    if (sentRef.current) return;
    sentRef.current = true;
    setPhase('sending');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('location');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { data } = await api.post('/emergencies', {
        type: notBreathing ? 'cardiac' : 'medical',
        priority: notBreathing ? 1 : 2,
        description: notBreathing ? 'Person collapsed, not breathing normally' : 'Citizen SOS',
        coordinates: [pos.coords.longitude, pos.coords.latitude],
      });
      setNearbyCount(data.nearbyCount);
      setEmergency(data.emergency);
      socket.emit('emergency:join', data.emergency._id);
      setPhase('live');
      if (notBreathing) setCprOn(true);
      await refresh();
    } catch (err: any) {
      sentRef.current = false;
      setPhase('countdown');
      setSecondsLeft(0);
      toast.error(err?.message === 'location' ? t('Location is off') : t('SOS could not be sent'), {
        description: err?.message === 'location'
          ? t('Turn on location, or call {number} directly.', { number: ambulance })
          : err?.response ? apiError(err, 'Try again.') : t('Call {number} now.', { number: ambulance }),
      });
    }
  }, [notBreathing, refresh, ambulance]);

  // Countdown gives a chance to cancel an accidental tap without slowing a real emergency much.
  useEffect(() => {
    if (phase !== 'countdown' || secondsLeft <= 0) return;
    const timer = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, secondsLeft]);

  useEffect(() => {
    if (phase === 'countdown' && secondsLeft === 0 && !autoTriedRef.current && params.start === '1') {
      // Only auto-send once; after a failure the user retries by hand.
      autoTriedRef.current = true;
      void send();
    }
  }, [phase, secondsLeft, send, params.start]);

  useEffect(() => {
    if (params.start !== '1') void refresh();
  }, [params.start, refresh]);

  useEffect(() => {
    const onChange = (e: LiveEmergency) => {
      if (e.status === 'resolved' || e.status === 'cancelled') {
        setPhase('ended');
        setEmergency(prev => (prev ? { ...prev, status: e.status } : prev));
        setCprOn(false);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      void refresh();
    };
    const onLocation = (p: { userId: string; coordinates: LngLat }) =>
      setResponderPos(prev => ({ ...prev, [p.userId]: p.coordinates }));
    socket.on('emergency:assigned', onChange);
    socket.on('emergency:status', onChange);
    socket.on('responder:location', onLocation);
    return () => {
      socket.off('emergency:assigned', onChange);
      socket.off('emergency:status', onChange);
      socket.off('responder:location', onLocation);
    };
  }, [refresh]);

  const cancel = () =>
    Alert.alert(t('Cancel SOS?'), t('Responders heading to you will be told to stand down.'), [
      { text: t('Keep SOS active'), style: 'cancel' },
      {
        text: t('Cancel SOS'),
        style: 'destructive',
        onPress: async () => {
          if (!emergency) return router.back();
          try {
            await api.patch(`/emergencies/${emergency._id}/status`, { status: 'cancelled' });
            router.replace('/(tabs)/home');
          } catch (err: any) {
            toast.error(t('Could not cancel'), { description: apiError(err, 'Try again.') });
          }
        },
      },
    ]);

  if (phase === 'countdown') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.destructive }]}>
        <StatusBar style="light" />
        <View style={styles.countdownWrap}>
          <Text style={styles.countdownLabel}>{secondsLeft > 0 ? t('Sending SOS in') : t('SOS not sent')}</Text>
          <Text style={styles.countdownNumber} accessibilityLiveRegion="assertive">
            {secondsLeft > 0 ? secondsLeft : '!'}
          </Text>
          <Text style={styles.countdownHint}>
            {t('Your location goes to certified responders nearby and the dispatch centre.')}
          </Text>

          <Pressable
            onPress={() => setNotBreathing(v => !v)}
            style={[styles.toggle, notBreathing && styles.toggleOn]}
            accessibilityRole="switch"
            accessibilityState={{ checked: notBreathing }}
          >
            <View style={[styles.toggleBox, notBreathing && styles.toggleBoxOn]}>
              {notBreathing ? <Check size={16} color={colors.destructive} strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>{t("Someone collapsed and isn't breathing")}</Text>
              <Text style={styles.toggleBody}>{t('Sends a second responder for the nearest defibrillator and starts CPR guidance.')}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.countdownActions}>
          {secondsLeft === 0 ? (
            <Pressable style={styles.sendNow} onPress={send} accessibilityRole="button">
              <Radio size={20} color={colors.destructive} />
              <Text style={styles.sendNowText}>{t('Send SOS now')}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.sendNow} onPress={() => setSecondsLeft(0)} accessibilityRole="button">
              <Radio size={20} color={colors.destructive} />
              <Text style={styles.sendNowText}>{t('Send immediately')}</Text>
            </Pressable>
          )}
          <Pressable style={styles.ghostLight} onPress={() => router.back()} accessibilityRole="button">
            <X size={18} color="#fff" />
            <Text style={styles.ghostLightText}>{t('Cancel')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const incident = emergency?.location?.coordinates;
  const responderId = idOf(emergency?.responder);
  const runnerId = idOf(emergency?.aedRunner);
  const responderAt = responderId ? responderPos[responderId] : undefined;
  const runnerAt = runnerId ? responderPos[runnerId] : undefined;
  const dist = (p?: LngLat) => (p && incident ? distanceM(p, incident) : null);
  const rDist = dist(responderAt);
  const aDist = dist(runnerAt);
  const ended = phase === 'ended';
  const headline = ended
    ? emergency?.status === 'cancelled' ? t('SOS cancelled') : t('Incident closed')
    : phase === 'sending' ? t('Sending your SOS…')
    : !responderId ? t('Alerting responders nearby')
    : emergency?.status === 'on_scene' ? t('Help is with you')
    : t('Help is on the way');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={[styles.header, ended && { backgroundColor: colors.dark }]}>
        <Text style={styles.headerTitle} accessibilityRole="header" accessibilityLiveRegion="polite">{headline}</Text>
        <Text style={styles.headerBody}>
          {ended
            ? t('Thank you for using Vitalis. Stay with the person until professional care takes over.')
            : !responderId
              ? nearbyCount === 0
                ? t('No certified responders are on duty near you. Call the ambulance now.')
                : nearbyCount == null
                  ? t('Nearby responders alerted. Also call the ambulance.')
                  : tn(nearbyCount, '1 responder alerted. Also call the ambulance.', '{n} responders alerted. Also call the ambulance.')
              : t('Stay where you are if it is safe. Keep your phone unlocked and nearby.')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {!ended ? (
          <Pressable style={styles.callButton} onPress={() => callNumber(ambulance)} accessibilityRole="button" accessibilityLabel={t('Call ambulance {number}', { number: ambulance })}>
            <Phone size={22} color="#fff" />
            <Text style={styles.callText}>{t('Call ambulance · {number}', { number: ambulance })}</Text>
          </Pressable>
        ) : null}

        {responderId ? (
          <PersonRow
            icon={<UserRound size={20} color={colors.primaryStrong} />}
            title={nameOf(emergency?.responder) ?? t('Responder')}
            subtitle={roleOf(emergency?.responder)}
            meta={
              emergency?.status === 'on_scene' ? t('On scene')
              : rDist != null ? `${formatDistance(rDist)} · ${t('~{n} min', { n: etaMinutes(rDist) })}`
              : emergency?.etaSeconds ? t('~{n} min', { n: Math.max(1, Math.round(emergency.etaSeconds / 60)) })
              : t('On the way')
            }
          />
        ) : !ended ? (
          <View style={styles.waitingRow}>
            <Radio size={18} color={colors.mutedForeground} />
            <Text style={styles.waitingText}>{t('Waiting for a responder to accept…')}</Text>
          </View>
        ) : null}

        {runnerId ? (
          <PersonRow
            icon={<Zap size={20} color={colors.warning} />}
            title={t('Defibrillator · {name}', { name: nameOf(emergency?.aedRunner) ?? t('runner') })}
            subtitle={typeof emergency?.aed === 'object' ? emergency.aed.name : t('Nearest AED')}
            meta={
              emergency?.aedStatus === 'delivered' ? t('AED arrived')
              : emergency?.aedStatus === 'has_aed' ? aDist != null ? t('Has AED · {distance}', { distance: formatDistance(aDist) }) : t('Has AED, coming')
              : t('Fetching AED')
            }
          />
        ) : null}

        {!ended && emergency?.type === 'cardiac' ? (
          <CprCoach on={cprOn} onToggle={() => setCprOn(v => !v)} />
        ) : !ended ? (
          <Pressable style={styles.linkRow} onPress={() => setCprOn(v => !v)} accessibilityRole="button">
            <HeartPulse size={18} color={colors.destructive} />
            <Text style={styles.linkText}>{cprOn ? t('Hide CPR guidance') : t('Person stopped breathing? Show CPR guidance')}</Text>
          </Pressable>
        ) : null}
        {!ended && emergency?.type !== 'cardiac' && cprOn ? <CprCoach on onToggle={() => setCprOn(false)} /> : null}

        {incident ? (
          <View style={styles.locRow}>
            <MapPin size={16} color={colors.mutedForeground} />
            <Text style={styles.locText}>
              {t('Shared location {lat}, {lng}', { lat: incident[1].toFixed(5), lng: incident[0].toFixed(5) })}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {ended ? (
          <Pressable style={styles.footerPrimary} onPress={() => router.replace('/(tabs)/home')} accessibilityRole="button">
            <Text style={styles.footerPrimaryText}>{t('Back to home')}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.footerGhost} onPress={cancel} disabled={phase === 'sending'} accessibilityRole="button">
            <Text style={styles.footerGhostText}>{t("I'm safe, cancel SOS")}</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </SafeAreaView>
  );
}

function PersonRow({ icon, title, subtitle, meta }: { icon: React.ReactNode; title: string; subtitle: string; meta: string }) {
  return (
    <View style={styles.personRow} accessible accessibilityLabel={`${title}, ${subtitle}, ${meta}`}>
      <View style={styles.personIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.personTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.personSub} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text style={styles.personMeta}>{meta}</Text>
    </View>
  );
}

/** Hands-only CPR metronome: 110/min haptic + visual beat, as bystander guidance recommends. */
function CprCoach({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const [count, setCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pulse = useSharedValue(1);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!on) return;
    setCount(0);
    const timer = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setCount(c => c + 1);
      if (!reduceMotion) {
        pulse.value = withSequence(
          withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 260, easing: Easing.out(Easing.exp) }),
        );
      }
    }, 60_000 / CPR_BPM);
    return () => clearInterval(timer);
  }, [on, pulse, reduceMotion]);

  const beatStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.cpr}>
      <View style={styles.cprHead}>
        <Text style={styles.cprTitle}>{t('CPR guidance')}</Text>
        <Pressable onPress={onToggle} hitSlop={12} accessibilityRole="button">
          <Text style={styles.cprToggle}>{on ? t('Pause') : t('Start')}</Text>
        </Pressable>
      </View>
      {on ? (
        <>
          <Animated.View style={[styles.cprBeat, beatStyle]}>
            <Text style={styles.cprCount}>{(count % 30) + 1}</Text>
            <Text style={styles.cprPush}>{t('Push')}</Text>
          </Animated.View>
          <Text style={styles.cprStep}>{t('Heel of your hand on the centre of the chest, other hand on top.')}</Text>
          <Text style={styles.cprStep}>{t('Push hard, 5–6 cm deep, with every pulse. Let the chest rise fully.')}</Text>
          <Text style={styles.cprStep}>{t("Don't stop until a responder or the ambulance takes over. Swap with someone every 2 minutes if you can.")}</Text>
        </>
      ) : (
        <Text style={styles.cprStep}>{t('Start if the person is unresponsive and not breathing normally. Your phone will pulse at the right pace.')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  countdownWrap: { flex: 1, paddingHorizontal: 24, paddingTop: 40, gap: 12 },
  countdownLabel: { color: '#fff', fontSize: 20, fontWeight: '600' },
  countdownNumber: { color: '#fff', fontSize: 120, fontWeight: '800', lineHeight: 132, fontVariant: ['tabular-nums'] },
  countdownHint: { color: '#fff', fontSize: 16, lineHeight: 23, maxWidth: 340 },
  toggle: {
    marginTop: 28, flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
  },
  toggleOn: { backgroundColor: 'rgba(255,255,255,0.14)', borderColor: '#fff' },
  toggleBox: {
    width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  toggleBoxOn: { backgroundColor: '#fff' },
  toggleTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  toggleBody: { color: '#fff', fontSize: 14, lineHeight: 20, marginTop: 4 },
  countdownActions: { padding: 20, gap: 10 },
  sendNow: {
    height: 58, borderRadius: radius.lg, backgroundColor: '#fff',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  sendNowText: { color: colors.destructive, fontSize: 18, fontWeight: '800' },
  ghostLight: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ghostLightText: { color: '#fff', fontSize: 17, fontWeight: '600' },

  header: { backgroundColor: colors.destructive, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 8 },
  headerTitle: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerBody: { color: '#fff', fontSize: 16, lineHeight: 22 },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  callButton: {
    height: 60, borderRadius: radius.lg, backgroundColor: colors.foreground,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  callText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  personIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  personTitle: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  personSub: { color: colors.mutedForeground, fontSize: 14, marginTop: 2 },
  personMeta: { color: colors.primaryStrong, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  waitingText: { color: colors.mutedForeground, fontSize: 15 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 4 },
  linkText: { color: colors.destructive, fontSize: 15, fontWeight: '600', flex: 1 },
  cpr: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cprHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cprTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  cprToggle: { color: colors.primaryStrong, fontSize: 16, fontWeight: '700' },
  cprBeat: {
    alignSelf: 'center', width: 150, height: 150, borderRadius: 75, marginVertical: 8,
    backgroundColor: colors.destructive, alignItems: 'center', justifyContent: 'center',
  },
  cprCount: { color: '#fff', fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cprPush: { color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '600', marginTop: -4 },
  cprStep: { color: colors.foreground, fontSize: 15, lineHeight: 22 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  locText: { color: colors.mutedForeground, fontSize: 13, fontVariant: ['tabular-nums'] },
  footer: { paddingHorizontal: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background },
  footerGhost: { height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  footerGhostText: { color: colors.foreground, fontSize: 16, fontWeight: '600' },
  footerPrimary: { height: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  footerPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
