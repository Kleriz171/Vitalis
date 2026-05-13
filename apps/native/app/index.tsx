import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { Activity, ArrowRight, Heart, MapPin, ShieldCheck, Sparkles } from 'lucide-react-native';
import { RootState } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, radius } from '@/lib/theme';

const bullets = [
  {
    icon: <Heart size={18} color={colors.destructive} />,
    title: 'One-tap SOS dispatch',
    body: 'Broadcast emergencies to nearby responders with location and live status updates.',
  },
  {
    icon: <MapPin size={18} color={colors.info} />,
    title: 'Trusted medical discovery',
    body: 'Find blood availability, organ and tissue requests, medicine support, doctors, and urgent guidance in one place.',
  },
  {
    icon: <ShieldCheck size={18} color={colors.success} />,
    title: 'Secure health profile',
    body: 'Keep your Bio Passport ready for emergencies, triage, and faster care.',
  },
];

export default function Onboarding() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const router = useRouter();

  if (hydrated && token) return <Redirect href="/(tabs)/home" />;

  return (
    <AppScreen
      tone="dark"
      eyebrow="VITALIS Mobile"
      title="Emergency care, redesigned for real life."
      subtitle="A calmer, faster health companion for citizens, donors, and responders."
      icon={<Heart size={24} color="#fff" fill="#fff" />}
      headerContent={
        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Activity size={14} color="#fff" />
            <Text style={styles.heroStatText}>Live responder ETA</Text>
          </View>
          <View style={styles.heroStat}>
            <ShieldCheck size={14} color="#fff" />
            <Text style={styles.heroStatText}>QR Bio Passport</Text>
          </View>
          <View style={styles.heroStat}>
            <Sparkles size={14} color="#fff" />
            <Text style={styles.heroStatText}>3-step smart signup</Text>
          </View>
        </View>
      }
    >
      <Card style={styles.valueCard}>
        <Text style={styles.sectionEyebrow}>Why it feels better</Text>
        <Text style={styles.valueTitle}>Focused on urgent moments, not app clutter.</Text>
        <Text style={styles.valueBody}>
          Vitalis keeps the highest-priority actions up front: SOS, care discovery, supply exchange, and the medical identity you build during signup.
        </Text>
      </Card>

      <Card style={styles.pathCard}>
        <Text style={styles.sectionEyebrow}>How onboarding works</Text>
        <Text style={styles.valueBody}>
          Start with your account details, add biometrics next, then finish with medications, allergies, vaccines, illnesses, and disabilities to generate your Bio Passport.
        </Text>
      </Card>

      {bullets.map((bullet) => (
        <Card key={bullet.title} style={styles.bulletCard}>
          <View style={styles.bulletIcon}>{bullet.icon}</View>
          <View style={styles.bulletCopy}>
            <Text style={styles.bulletTitle}>{bullet.title}</Text>
            <Text style={styles.bulletBody}>{bullet.body}</Text>
          </View>
        </Card>
      ))}

      <View style={styles.actions}>
        <Button size="lg" onPress={() => router.push('/login?mode=register')} style={styles.primaryButton}>
          <Text style={styles.primaryText}>Create account</Text>
          <ArrowRight size={18} color="#fff" />
        </Button>
        <Button variant="outline" size="lg" onPress={() => router.push('/login')}>
          Sign in
        </Button>
        <Pressable onPress={() => router.push('/login')} style={styles.operatorLink}>
          <Text style={styles.operatorText}>For operators, use the desktop portal instead.</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroStatText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  valueCard: {
    padding: 18,
    gap: 8,
  },
  sectionEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  valueTitle: {
    color: colors.foreground,
    fontSize: 22,
    fontWeight: '800',
  },
  valueBody: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
  },
  bulletCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  pathCard: {
    padding: 16,
    gap: 8,
    backgroundColor: colors.infoSoft,
    borderColor: '#D9E7FF',
  },
  bulletIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  bulletCopy: {
    flex: 1,
    gap: 4,
  },
  bulletTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  bulletBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: colors.primaryStrong,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  operatorLink: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  operatorText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
});
