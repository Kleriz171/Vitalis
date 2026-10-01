import { ReactNode } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, radius, shadows } from '@/lib/theme';

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
  contentContainerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  headerContent?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
  /** Slim header (default): title, one short line, smaller icon, no eyebrow; content gets the space. */
  compact?: boolean;
}

const toneMap: Record<Tone, { background: string; soft: string; text: string; chip: string }> = {
  primary: { background: colors.primary, soft: colors.accent, text: colors.primaryForeground, chip: 'rgba(255,255,255,0.16)' },
  critical: { background: colors.destructive, soft: colors.destructiveSoft, text: colors.destructiveForeground, chip: 'rgba(255,255,255,0.16)' },
  info: { background: colors.info, soft: colors.infoSoft, text: '#FFFFFF', chip: 'rgba(255,255,255,0.16)' },
  purple: { background: colors.purple, soft: colors.purpleSoft, text: '#FFFFFF', chip: 'rgba(255,255,255,0.16)' },
  success: { background: colors.success, soft: colors.successSoft, text: '#FFFFFF', chip: 'rgba(255,255,255,0.16)' },
  dark: { background: colors.dark, soft: colors.darkSoft, text: '#FFFFFF', chip: 'rgba(255,255,255,0.12)' },
};

export function AppScreen({
  tone = 'primary',
  eyebrow,
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
  compact = true,
}: AppScreenProps) {
  const palette = toneMap[tone];

  const body = (
    <View style={[styles.body, bodyStyle]}>
      <Animated.View entering={FadeInDown.duration(320)} style={[styles.hero, compact && styles.heroCompact, { backgroundColor: palette.background }]}>
        <View style={[styles.heroTop, compact && styles.heroTopCompact]}>
          <View style={styles.heroTitleWrap}>
            {eyebrow && !compact ? <Text style={[styles.eyebrow, { color: 'rgba(255,255,255,0.74)' }]}>{eyebrow}</Text> : null}
            <View style={styles.heroHeadingRow}>
              {icon ? <View style={[styles.iconBadge, compact && styles.iconBadgeCompact, { backgroundColor: palette.chip }]}>{icon}</View> : null}
              <View style={styles.heroTextWrap}>
                <Text style={[styles.title, compact && styles.titleCompact, { color: palette.text }]} numberOfLines={compact ? 2 : undefined}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, compact && styles.subtitleCompact, { color: 'rgba(255,255,255,0.82)' }]} numberOfLines={compact ? 2 : undefined}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          {action ? <View style={[styles.actionWrap, compact && styles.actionWrapCompact]}>{action}</View> : null}
        </View>
        {headerContent ? <View style={[styles.heroContent, { backgroundColor: palette.chip }]}>{headerContent}</View> : null}
      </Animated.View>
      <Animated.View entering={FadeIn.delay(80).duration(260)} style={styles.content}>{children}</Animated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
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
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingTop: 10,
    paddingBottom: 136,
  },
  body: {
    gap: 18,
    paddingHorizontal: 16,
  },
  hero: {
    borderRadius: radius.lg,
    padding: 20,
    gap: 16,
    ...shadows.card,
  },
  heroCompact: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  heroTopCompact: {
    alignItems: 'center',
  },
  iconBadgeCompact: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
  },
  titleCompact: {
    fontSize: 20,
  },
  subtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionWrapCompact: {
    alignSelf: 'center',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleWrap: {
    flex: 1,
    gap: 10,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroHeadingRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionWrap: {
    alignSelf: 'flex-start',
  },
  heroContent: {
    borderRadius: radius.lg,
    padding: 14,
  },
  content: {
    gap: 14,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(243,247,247,0.97)',
  },
  footerSafe: {
    backgroundColor: 'rgba(243,247,247,0.97)',
  },
});
