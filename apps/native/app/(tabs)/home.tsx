import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Bot, GraduationCap, Heart, Phone, QrCode, Siren, Stethoscope, Timer, Users, Zap } from 'lucide-react-native';
import { api } from '@/lib/api';
import { RootState } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { Group, Row } from '@/components/ui/List';
import { colors, radius } from '@/lib/theme';
import { t } from '@/lib/i18n';

export default function Home() {
  const user = useSelector((s: RootState) => s.auth.user);
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

  const firstName = user?.name?.split(' ')[0];
  const isResponder = ['doctor', 'nurse', 'student_responder', 'blood_donor'].includes(user?.role ?? '');

  const openSos = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    router.push(liveSos ? '/emergency' : ({ pathname: '/emergency', params: { start: '1' } } as never));
  };

  const row = (path: string) => () => router.push(path as never);

  return (
    <AppScreen
      tone="dark"
      title={firstName ? t('Hello, {name}', { name: firstName }) : t('Hello')}
      subtitle={user?.bloodType ? t('Blood {type}', { type: user.bloodType }) : undefined}
      icon={<Heart size={20} color="#fff" fill="#fff" />}
    >
      {/* SOS stays the biggest, reddest thing in the app. */}
      <Animated.View style={sosStyle}>
        <Pressable
          onPress={openSos}
          style={({ pressed }) => [styles.sosButton, pressed && { opacity: 0.92 }]}
          accessibilityRole="button"
          accessibilityLabel={liveSos ? t('Open your live SOS') : t('Start SOS')}
          accessibilityHint={liveSos ? undefined : t('Starts a 3 second countdown you can cancel')}
        >
          <View style={styles.sosIcon}><Siren size={34} color={colors.destructive} /></View>
          <Text style={styles.sosLabel}>{liveSos ? t('Your SOS is live') : 'SOS'}</Text>
          <Text style={styles.sosHint}>
            {liveSos
              ? liveSos.status === 'pending' ? t('Alerting responders. Tap to follow.') : t('A responder is on the way. Tap to follow.')
              : t('Alerts certified responders near you. 3 s to cancel.')}
          </Text>
        </Pressable>
      </Animated.View>

      <Group>
        <Row first icon={<Phone size={18} color={colors.destructive} />} title={t('Emergency numbers & hospitals')} summary="127 · 112" onPress={row('/sos')} />
        <Row icon={<Zap size={18} color={colors.warning} />} title={t('Defibrillators')} summary={t('Nearest public AEDs')} onPress={row('/aeds')} />
        <Row icon={<Timer size={18} color={colors.info} />} title={t('Safety check-in')} summary={t('Alerts your contact if you go quiet')} onPress={row('/checkin')} />
        {isResponder ? (
          <Row icon={<Siren size={18} color={colors.primaryStrong} />} title={t('Responder inbox')} summary={t('Go on duty, accept calls')} onPress={row('/responder-inbox')} />
        ) : null}
      </Group>

      <Group>
        <Row
          first
          icon={<QrCode size={18} color="#fff" />}
          tint={colors.primary}
          title={t('Bio Passport')}
          summary={t('One QR code with what a paramedic needs.')}
          onPress={row('/(tabs)/profile')}
        />
      </Group>

      <Group title={t('Services')}>
        <Row first icon={<Stethoscope size={18} color={colors.info} />} title={t('Doctors')} summary={t('Find a specialist')} onPress={row('/(tabs)/doctors')} />
        <Row icon={<Heart size={18} color={colors.destructive} />} title={t('Supply')} summary={t('Blood, organs, medicine')} onPress={row('/(tabs)/blood')} />
        <Row icon={<Bot size={18} color={colors.success} />} title={t('Assistant')} summary={t('Health questions')} onPress={row('/assistant')} />
        <Row icon={<Users size={18} color={colors.purple} />} title={t('Community')} summary={t('Support groups')} onPress={row('/(tabs)/community')} />
      </Group>

      {!isResponder ? (
        <Group>
          <Row
            first
            icon={<GraduationCap size={18} color={colors.primaryStrong} />}
            title={t('Be the first on scene')}
            summary={t('Pass the 20-minute CPR course and Vitalis can call you to an arrest next door.')}
            onPress={row('/(tabs)/training')}
          />
        </Group>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  sosButton: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 26,
    borderRadius: radius.xl,
    backgroundColor: colors.destructive,
  },
  sosIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sosLabel: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  sosHint: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 19, textAlign: 'center' },
});
