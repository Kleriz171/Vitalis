import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { HeartPulse, MapPin, Phone, QrCode, Siren } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Group, Row } from '@/components/ui/List';
import { RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { t } from '@/lib/i18n';
import { callNumber } from '@/lib/geo';

const features = [
  {
    key: 'sos',
    title: t('One-tap SOS'),
    body: t('Broadcast emergencies to nearby responders with your location and live status.'),
    icon: <Siren size={18} color="#fff" />,
    tint: colors.destructive,
  },
  {
    key: 'passport',
    title: t('Bio Passport'),
    body: t('A secure QR profile keeps you ready for triage and faster care.'),
    icon: <QrCode size={18} color="#fff" />,
    tint: colors.primary,
  },
  {
    key: 'discover',
    title: t('Find trusted care'),
    body: t('Blood, organs, meds, doctors.'),
    icon: <MapPin size={18} color="#fff" />,
    tint: colors.info,
  },
];

/** Welcome: what Vitalis does in three rows, then sign up. SOS needs an account; 127 does not. */
export default function Onboarding() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const router = useRouter();

  if (hydrated && token) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.backdrop} />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(320)} style={styles.brandRow}>
            <Logo size={32} />
            <Text style={styles.brandText}>VITALIS</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(80).duration(360)} style={styles.hero}>
            <Text style={styles.title}>{t('Help, the moment you need it.')}</Text>
            <Text style={styles.subtitle}>{t('Your health, ready when you need it.')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).duration(380)}>
            <Group>
              {features.map((f, index) => (
                <Row key={f.key} first={index === 0} icon={f.icon} tint={f.tint} title={f.title} summary={f.body} />
              ))}
            </Group>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(360)} style={styles.actions}>
            <Button size="lg" onPress={() => router.push('/login')}>
              {t('Get started')}
            </Button>

            {/* Before sign-in the only emergency action is the ambulance number: SOS needs an account. */}
            <Button size="lg" variant="outline" onPress={() => callNumber('127')} accessibilityHint={t('Calls the ambulance')}>
              <Phone size={18} color={colors.destructive} />
              <Text style={styles.callText}>{t('Emergency? Call 127')}</Text>
            </Button>

            <Button size="lg" variant="outline" onPress={() => router.push('/first-aid' as never)}>
              <HeartPulse size={18} color={colors.foreground} />
              {t('First aid')}
            </Button>

            <Pressable onPress={() => router.push('/login')} style={styles.signIn} accessibilityRole="link">
              <Text style={styles.signInText}>
                {t('Already with us?')} <Text style={styles.signInAccent}>{t('Sign in')}</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    backgroundColor: colors.primaryStrong,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24, gap: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 },
  brandText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 2.4 },
  hero: { gap: 8, paddingTop: 28, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 16, lineHeight: 22 },
  actions: { gap: 10, marginTop: 'auto' },
  callText: { color: colors.destructive, fontSize: 16, fontWeight: '700' },
  signIn: { alignSelf: 'center', paddingVertical: 10 },
  signInText: { color: colors.mutedForeground, fontSize: 15 },
  signInAccent: { color: colors.primaryStrong, fontWeight: '800' },
});
