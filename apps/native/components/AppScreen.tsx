import { ReactNode, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ScrollView, ScrollViewProps, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/lib/theme';

// Kept for callers; every screen now shares the welcome screen's deep green, except emergencies (red).
type Tone = 'primary' | 'critical' | 'info' | 'purple' | 'success' | 'dark';

interface AppScreenProps {
  tone?: Tone;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  bodyStyle?: ViewProps['style']; // the View's own type: shared ViewStyle is widened by web typings
  headerContent?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  /** Accepted for older callers; the header is always the slim one. */
  compact?: boolean;
}

/**
 * The app's page: a deep green backdrop (like the welcome screen) carrying the title, with the
 * content's white cards rising over its rounded edge onto the off-white page.
 */
export function AppScreen({
  tone = 'primary',
  title,
  subtitle,
  icon,
  action,
  children,
  footer,
  scroll = true,
  contentContainerStyle,
  bodyStyle,
  headerContent,
  scrollProps,
}: AppScreenProps) {
  const insets = useSafeAreaInsets();
  const ground = tone === 'critical' ? colors.destructive : colors.primaryStrong;
  // The backdrop ends a little below the header, so the first card overlaps its edge.
  const [backdropH, setBackdropH] = useState(200);

  // Fade and rise in every time the screen comes into focus (tabs stay mounted, so entering
  // animations alone would play only once). Nothing remounts: scroll and inputs are kept.
  const appear = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      appear.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })));
    }, [appear]),
  );
  const headerIn = useAnimatedStyle(() => ({ opacity: 0.4 + appear.get() * 0.6 }));
  const contentIn = useAnimatedStyle(() => ({ opacity: appear.get(), transform: [{ translateY: (1 - appear.get()) * 10 }] }));

  const body = (
    <View style={[styles.body, !scroll && styles.fill, bodyStyle]}>
      <Animated.View
        style={[styles.header, headerIn]}
        onLayout={(e) => setBackdropH(insets.top + 10 + e.nativeEvent.layout.y + e.nativeEvent.layout.height + 36)}
      >
        <View style={styles.headerRow}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
          </View>
          {action ? <View>{action}</View> : null}
        </View>
        {headerContent ? <View style={styles.headerContent}>{headerContent}</View> : null}
      </Animated.View>
      <Animated.View style={[styles.content, !scroll && styles.fill, contentIn]}>{children}</Animated.View>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={[styles.backdrop, { height: backdropH, backgroundColor: ground }]}>
        <View style={styles.glow} />
      </View>
      <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.scroll, contentContainerStyle]} showsVerticalScrollIndicator={false} {...scrollProps}>
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? (
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.footerSafe}>
            <Animated.View entering={FadeInDown.duration(240)} style={styles.footer}>{footer}</Animated.View>
          </SafeAreaView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  // One soft light in the corner, like the welcome screen: depth without decoration.
  glow: {
    position: 'absolute',
    top: -140,
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FFFFFF',
    opacity: 0.07,
  },
  scroll: { paddingTop: 10, paddingBottom: 136 },
  body: { gap: 16, paddingHorizontal: 16 },
  header: { paddingTop: 6, paddingBottom: 10, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerText: { flex: 1, gap: 2 },
  title: { color: '#fff', fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 14, lineHeight: 19 },
  headerContent: { borderRadius: radius.lg, padding: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  content: { gap: 14 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(243,247,247,0.97)',
  },
  footerSafe: { backgroundColor: 'rgba(243,247,247,0.97)' },
});
