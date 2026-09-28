import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { ChevronRight, GraduationCap, MessageCircle, Phone, QrCode, Siren, Zap } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useNearestAed } from '@/lib/geo';
import { RootState } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { colors, fonts, radius, type } from '@/lib/theme';

type Passport = { bloodType?: string; allergies: unknown[]; available: boolean };

export default function Home() {
  const user = useSelector((s: RootState) => s.auth.user);
  const router = useRouter();
  const [liveSos, setLiveSos] = useState<{ _id: string; status: string } | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const nearestAed = useNearestAed();
  const pulse = useSharedValue(1);

  // A live SOS survives app restarts: always offer the way back to it.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.get('/emergencies/mine')
        .then(({ data }) => { if (alive) setLiveSos(data.emergency ?? null); })
        .catch(() => {});
      api.get('/biopassport/me')
        .then(({ data }) => { if (alive) setPassport(data.profile); })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  useEffect(() => {
    pulse.value = liveSos ? withRepeat(withTiming(1.015, { duration: 900 }), -1, true) : withTiming(1);
  }, [liveSos, pulse]);
  const sosStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const firstName = user?.name?.split(' ')[0];
  const isResponder = ['doctor', 'nurse', 'student_responder', 'blood_donor'].includes(user?.role ?? '');

  const openSos = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    router.push(liveSos ? '/emergency' : ({ pathname: '/emergency', params: { start: '1' } } as never));
  };

  const passportDetail = passport
    ? [passport.bloodType ? `Blood ${passport.bloodType}` : 'Blood type missing',
       passport.allergies.length ? `${passport.allergies.length} ${passport.allergies.length === 1 ? 'allergy' : 'allergies'}` : 'No allergies'].join(' · ')
    : 'Your medical ID for paramedics';

  const rows: { icon: ReactNode; title: string; detail: string; path: string; status?: boolean }[] = [
    isResponder
      ? { icon: <Siren size={20} color={colors.primaryStrong} />, title: 'Responder duty', detail: passport?.available ? 'On duty · calls near you reach you' : 'Off duty · tap to go on duty', path: '/responder-inbox', status: !!passport?.available }
      : { icon: <GraduationCap size={20} color={colors.primaryStrong} />, title: 'Become a responder', detail: '20-minute CPR course', path: '/(tabs)/learn' },
    { icon: <QrCode size={20} color={colors.foreground} />, title: 'Bio Passport', detail: passportDetail, path: '/(tabs)/me' },
    { icon: <Zap size={20} color={colors.warning} />, title: 'Nearest defibrillator', detail: nearestAed ?? 'Public AEDs near you', path: '/aeds' },
    { icon: <MessageCircle size={20} color={colors.foreground} />, title: 'Talk to Vitalis', detail: 'First aid and health questions', path: '/assistant' },
    { icon: <Phone size={20} color={colors.foreground} />, title: 'Emergency numbers', detail: 'Ambulance 127 · Police 129 · Fire 128', path: '/sos' },
  ];

  return (
    <AppScreen title={firstName ? `Hello, ${firstName}` : 'Vitalis'}>
      <Animated.View style={sosStyle}>
        <Pressable
          onPress={openSos}
          style={({ pressed }) => [styles.sos, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel={liveSos ? 'Open your live SOS' : 'Start SOS'}
          accessibilityHint={liveSos ? undefined : 'Starts a 3 second countdown you can cancel'}
        >
          <Text style={styles.sosLabel}>{liveSos ? 'SOS live' : 'SOS'}</Text>
          <Text style={styles.sosHint}>
            {liveSos
              ? liveSos.status === 'pending' ? 'Alerting responders near you. Tap to follow.' : 'A responder is on the way. Tap to follow.'
              : 'Tap to alert certified responders near you.\nYou have 3 seconds to cancel.'}
          </Text>
        </Pressable>
      </Animated.View>

      <View style={styles.group}>
        {rows.map((r, i) => (
          <Pressable
            key={r.title}
            onPress={() => router.push(r.path as never)}
            style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && { backgroundColor: colors.muted }]}
            accessibilityRole="button"
          >
            <View style={styles.icon}>{r.icon}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              <Text style={styles.rowDetail} numberOfLines={1}>{r.detail}</Text>
            </View>
            {r.status !== undefined ? <View style={[styles.dot, r.status && styles.dotOn]} /> : null}
            <ChevronRight size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sos: {
    minHeight: 168,
    justifyContent: 'flex-end',
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.destructive,
  },
  sosLabel: { fontFamily: fonts.display, color: '#fff', fontSize: 56, lineHeight: 60, letterSpacing: -1 },
  sosHint: { ...type.callout, color: 'rgba(255,255,255,0.92)', marginTop: 4 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 68 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...type.headline, color: colors.foreground },
  rowDetail: { ...type.footnote, color: colors.mutedForeground, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.success },
});
