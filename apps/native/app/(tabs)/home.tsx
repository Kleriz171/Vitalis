import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import {
  Bot,
  ChevronRight,
  GraduationCap,
  Heart,
  LogOut,
  Phone,
  QrCode,
  Siren,
  Stethoscope,
  Users,
  Zap,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { logout, RootState } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, radius } from '@/lib/theme';

export default function Home() {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const router = useRouter();
  const [liveSos, setLiveSos] = useState<{ _id: string; status: string } | null>(null);
  const pulse = useSharedValue(1);

  // A live SOS survives app restarts: always offer the way back to it.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api.get('/emergencies/mine')
        .then(({ data }) => { if (alive) setLiveSos(data.emergency ?? null); })
        .catch(() => {});
      return () => { alive = false; };
    }, []),
  );

  useEffect(() => {
    pulse.value = liveSos ? withRepeat(withTiming(1.015, { duration: 900 }), -1, true) : withTiming(1);
  }, [liveSos, pulse]);
  const sosStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const isResponder = ['doctor', 'nurse', 'student_responder', 'blood_donor'].includes(user?.role ?? '');

  const openSos = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    router.push(liveSos ? '/emergency' : ({ pathname: '/emergency', params: { start: '1' } } as never));
  };

  const signOut = () => {
    dispatch(logout());
    router.replace('/');
  };

  const quickActions = [
    ...(isResponder
      ? [{ label: 'Responder inbox', hint: 'Go on duty, accept calls', icon: <Siren size={18} color={colors.primaryStrong} />, path: '/responder-inbox' as const }]
      : []),
    { label: 'Defibrillators', hint: 'Nearest public AEDs', icon: <Zap size={18} color={colors.warning} />, path: '/aeds' as const },
    { label: 'Doctors', hint: 'Find a specialist', icon: <Stethoscope size={18} color={colors.info} />, path: '/(tabs)/doctors' as const },
    { label: 'Supply', hint: 'Blood, organs, medicine', icon: <Heart size={18} color={colors.destructive} />, path: '/(tabs)/blood' as const },
    { label: 'Community', hint: 'Support groups', icon: <Users size={18} color={colors.purple} />, path: '/(tabs)/community' as const },
    { label: 'Assistant', hint: 'Health questions', icon: <Bot size={18} color={colors.success} />, path: '/assistant' as const },
  ];

  return (
    <AppScreen
      tone="dark"
      title={`Hello, ${firstName}`}
      subtitle="Your emergency tools and medical identity, ready when you need them."
      icon={<Heart size={24} color="#fff" fill="#fff" />}
      action={
        <Pressable onPress={signOut} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Sign out">
          <LogOut size={16} color="#fff" />
        </Pressable>
      }
    >
      <Animated.View style={sosStyle}>
        <Pressable
          onPress={openSos}
          style={({ pressed }) => [styles.sosButton, pressed && { opacity: 0.9 }]}
          accessibilityRole="button"
          accessibilityLabel={liveSos ? 'Open your live SOS' : 'Start SOS'}
          accessibilityHint={liveSos ? undefined : 'Starts a 3 second countdown you can cancel'}
        >
          <View style={styles.sosIcon}><Siren size={30} color={colors.destructive} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosLabel}>{liveSos ? 'Your SOS is live' : 'SOS'}</Text>
            <Text style={styles.sosHint}>
              {liveSos
                ? liveSos.status === 'pending' ? 'Alerting responders. Tap to follow.' : 'A responder is on the way. Tap to follow.'
                : 'Alerts certified responders near you. 3 s to cancel.'}
            </Text>
          </View>
          <ChevronRight size={22} color="#fff" />
        </Pressable>
      </Animated.View>

      <Button variant="outline" onPress={() => router.push('/sos')}>
        <Phone size={16} color={colors.foreground} />
        Emergency numbers & hospitals
      </Button>

      {!isResponder ? (
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Be the first on scene</Text>
          <Text style={styles.sectionBody}>
            Ambulances in a city take 10+ minutes. Pass the 20-minute CPR course and Vitalis can call you to an arrest next door.
          </Text>
          <Button onPress={() => router.push('/(tabs)/training')} style={styles.secondaryAction}>
            <GraduationCap size={16} color="#fff" />
            Start CPR training
          </Button>
        </Card>
      ) : null}

      <View style={styles.grid}>
        {quickActions.map((action) => (
          <Pressable key={action.label} onPress={() => router.push(action.path)} style={styles.gridItem} accessibilityRole="button">
            <Card style={styles.gridCard}>
              <View style={styles.gridIcon}>{action.icon}</View>
              <Text style={styles.gridLabel}>{action.label}</Text>
              <Text style={styles.gridHint}>{action.hint}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bio Passport</Text>
          <QrCode size={18} color={colors.primaryStrong} />
        </View>
        <Text style={styles.sectionBody}>
          Blood type, allergies and medication in one QR code a paramedic can scan. Keep it up to date.
        </Text>
        <Button variant="outline" onPress={() => router.push('/(tabs)/profile')}>
          Open Bio Passport
        </Button>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 96,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: radius.xl,
    backgroundColor: colors.destructive,
  },
  sosIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosLabel: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  sosHint: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 19, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%' },
  gridCard: { padding: 16, gap: 10, minHeight: 124, borderRadius: radius.lg },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  gridLabel: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  gridHint: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  sectionCard: { padding: 18, gap: 10, borderRadius: radius.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  sectionBody: { color: colors.mutedForeground, fontSize: 14, lineHeight: 20 },
  secondaryAction: { backgroundColor: colors.primaryStrong },
});
