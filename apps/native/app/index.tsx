import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Redirect, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {
  Activity,
  Droplet,
  Heart,
  MapPin,
  QrCode,
  ShieldCheck,
  Siren,
  Sparkles,
} from 'lucide-react-native';

import { Button } from '@/components/ui/Button';
import { RootState } from '@/lib/store';
import { colors, radius, shadows } from '@/lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - 32;

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  accent: string;
};

const slides: Slide[] = [
  {
    key: 'sos',
    eyebrow: 'One-tap SOS',
    title: 'Help, the moment you need it.',
    body: 'Broadcast emergencies to nearby responders with your location and live status.',
    icon: <Siren size={22} color="#fff" />,
    accent: colors.destructive,
  },
  {
    key: 'discover',
    eyebrow: 'Find trusted care',
    title: 'Blood, organs, meds, doctors.',
    body: 'Discover availability and verified medical contacts in one calm place.',
    icon: <MapPin size={22} color="#fff" />,
    accent: colors.info,
  },
  {
    key: 'passport',
    eyebrow: 'Bio Passport',
    title: 'Your health, ready to go.',
    body: 'A secure QR profile keeps you ready for triage and faster care.',
    icon: <QrCode size={22} color="#fff" />,
    accent: colors.primary,
  },
];

export default function Onboarding() {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const hydrated = useSelector((s: RootState) => s.auth.hydrated);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.18 }],
    opacity: 0.45 - pulse.value * 0.35,
  }));

  if (hydrated && token) return <Redirect href="/(tabs)/home" />;

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    if (next !== slideIndex) setSlideIndex(next);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.heroBackdrop}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(320)} style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Heart size={16} color="#fff" fill="#fff" />
            </View>
            <Text style={styles.brandText}>VITALIS</Text>
            <View style={styles.brandPill}>
              <Sparkles size={11} color={colors.accentForeground} />
              <Text style={styles.brandPillText}>Beta</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(80).duration(360)} style={styles.heroBlock}>
            <Text style={styles.heroEyebrow}>Emergency care companion</Text>
            <Text style={styles.heroTitle}>
              A calmer way to{'\n'}reach help, fast.
            </Text>
            <Text style={styles.heroSubtitle}>
              SOS, care discovery, and your medical identity - designed for the moments that matter.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.passportWrap}>
            <Animated.View style={[styles.passportPulse, pulseStyle]} />
            <View style={styles.passportCard}>
              <View style={styles.passportTop}>
                <View style={styles.passportBadge}>
                  <ShieldCheck size={14} color={colors.primary} />
                  <Text style={styles.passportBadgeText}>Bio Passport</Text>
                </View>
                <View style={styles.passportQr}>
                  <QrCode size={28} color={colors.foreground} />
                </View>
              </View>
              <Text style={styles.passportName}>Your name, your health,{'\n'}your control.</Text>
              <View style={styles.passportStats}>
                <View style={styles.statChip}>
                  <Droplet size={12} color={colors.destructive} />
                  <Text style={styles.statChipText}>Blood type</Text>
                </View>
                <View style={styles.statChip}>
                  <Activity size={12} color={colors.info} />
                  <Text style={styles.statChipText}>Live ETA</Text>
                </View>
                <View style={styles.statChip}>
                  <ShieldCheck size={12} color={colors.success} />
                  <Text style={styles.statChipText}>Encrypted</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          <View style={styles.pagerWrap}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SLIDE_WIDTH}
              decelerationRate="fast"
              onScroll={onScroll}
              scrollEventThrottle={16}
              contentContainerStyle={styles.pagerContent}
            >
              {slides.map((slide) => (
                <View key={slide.key} style={[styles.slide, { width: SLIDE_WIDTH }]}>
                  <View style={[styles.slideIcon, { backgroundColor: slide.accent }]}>{slide.icon}</View>
                  <View style={styles.slideCopy}>
                    <Text style={styles.slideEyebrow}>{slide.eyebrow}</Text>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideBody}>{slide.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {slides.map((slide, index) => (
                <View key={slide.key} style={[styles.dot, index === slideIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
          <Animated.View entering={FadeInDown.delay(180).duration(360)} style={styles.middleActions}>
            <View style={styles.ctaBubble}>
              <Button size="lg" onPress={() => router.push('/login')} style={styles.primaryButton}>
                Get started
              </Button>
            </View>

            <Pressable onPress={() => router.push('/login')} style={styles.signInLink}>
              <Text style={styles.signInText}>
                Already with us? <Text style={styles.signInAccent}>Sign in</Text>
              </Text>
            </Pressable>

            <Text style={styles.operatorText}>For operators, use the desktop portal.</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 460,
    backgroundColor: colors.primaryStrong,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  glowOne: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    opacity: 0.55,
  },
  glowTwo: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 9999,
    backgroundColor: colors.accent,
    opacity: 0.18,
  },
  safe: {
    flex: 1,
  },
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  brandText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.4,
    flex: 1,
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  brandPillText: {
    color: colors.accentForeground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroBlock: {
    gap: 10,
    marginBottom: 28,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 14,
    lineHeight: 21,
  },
  passportWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  passportPulse: {
    position: 'absolute',
    width: '90%',
    height: '100%',
    borderRadius: radius.xl,
    backgroundColor: '#fff',
  },
  passportCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: 18,
    gap: 14,
    ...shadows.floating,
  },
  passportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  passportBadgeText: {
    color: colors.accentForeground,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  passportQr: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  passportName: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  passportStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.soft,
  },
  statChipText: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
  },
  pagerWrap: {
    gap: 12,
  },
  pagerContent: {
    gap: 0,
  },
  slide: {
    flexDirection: 'row',
    gap: 14,
    paddingRight: 8,
    alignItems: 'flex-start',
  },
  slideIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  slideCopy: {
    flex: 1,
    gap: 4,
  },
  slideEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  slideTitle: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '800',
  },
  slideBody: {
    color: colors.primaryStrong,
    fontSize: 13,
    lineHeight: 19,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 28,
    backgroundColor: colors.primary,
  },
  middleActions: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 28,
    paddingBottom: 8,
  },
  ctaBubble: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    width: 236,
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.full,
    ...shadows.card,
  },
  signInLink: {
    alignItems: 'center',
  },
  signInText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  signInAccent: {
    color: colors.primaryStrong,
    fontWeight: '800',
  },
  operatorText: {
    color: colors.mutedForeground,
    fontSize: 12,
    textAlign: 'center',
  },
});
