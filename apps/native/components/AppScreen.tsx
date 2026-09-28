import { ReactNode } from 'react';
import { Pressable, ScrollView, ScrollViewProps, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LucideIcon } from 'lucide-react-native';
import { colors, radius, type } from '@/lib/theme';

interface AppScreenProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  /** Summary under the title (stats, chips). Sits on a dark ink panel: pass light text. */
  headerContent?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}

/**
 * Platform-style screen: large title on the plain background, content below.
 * Colour is left to the content (red for danger, teal for actions), not the header.
 */
export function AppScreen({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  footer,
  scroll = true,
  contentContainerStyle,
  bodyStyle,
  headerContent,
  scrollProps,
}: AppScreenProps) {
  const body = (
    <View style={[styles.body, bodyStyle]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {headerContent ? <View style={styles.summary}>{headerContent}</View> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, contentContainerStyle]} showsVerticalScrollIndicator={false} {...scrollProps}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.footerSafe}>
          <View style={styles.footer}>{footer}</View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

/** Round icon button for the header's action slot. */
export function HeaderButton({ icon: Icon, onPress, label }: { icon: LucideIcon; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: colors.border }]}
    >
      <Icon size={18} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingTop: 8, paddingBottom: 120 },
  body: { gap: 16, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8 },
  eyebrow: { ...type.footnote, fontWeight: '600', color: colors.primaryStrong, marginBottom: 2 },
  title: { ...type.largeTitle, color: colors.foreground },
  subtitle: { ...type.callout, color: colors.mutedForeground, marginTop: 4 },
  action: { paddingTop: 4 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  // ponytail: one dark panel keeps every screen's existing light chips legible; restyle per screen later.
  summary: { backgroundColor: colors.dark, borderRadius: radius.lg, padding: 14 },
  content: { gap: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
  footerSafe: { backgroundColor: colors.background },
});
