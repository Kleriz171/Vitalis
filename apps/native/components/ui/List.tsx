import { ReactNode, useEffect, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View, type PressableProps, type ViewProps } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors, radius, shadows } from '@/lib/theme';

// The app's one list language (first used on Profile): a white card holding a small uppercase
// title and rows separated by hairlines. Rows carry an icon, a title, one line of summary, and
// either a chevron (navigates), a right-hand element (switch, value), or open in place.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { damping: 18, stiffness: 260, mass: 0.6 };

/** A Pressable that dips slightly while held and springs back: the app's one touch feel. */
export function Press({ style, children, scaleTo = 0.97, ...props }: PressableProps & { scaleTo?: number; style?: ViewProps['style']; children: ReactNode }) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => { scale.value = withSpring(scaleTo, SPRING); props.onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withSpring(1, SPRING); props.onPressOut?.(e); }}
      style={[style, anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Group({ title, children, style, delay = 60 }: { title?: string; children: ReactNode; style?: ViewProps['style']; delay?: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify().damping(18).stiffness(140)} style={[styles.group, style]}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      {children}
    </Animated.View>
  );
}

type RowProps = {
  icon?: ReactNode;
  /** Background of the icon tile; defaults to the page colour. */
  tint?: string;
  title: string;
  summary?: string;
  /** Replaces the chevron: a value, badge or switch. */
  right?: ReactNode;
  onPress?: () => void;
  /** No divider above (first row in a group without a title). */
  first?: boolean;
  /** Extra content under the title line, inside the row. */
  children?: ReactNode;
  accessibilityLabel?: string;
};

export function Row({ icon, tint, title, summary, right, onPress, first, children, accessibilityLabel }: RowProps) {
  const body = (
    <>
      {icon ? <View style={[styles.icon, tint ? { backgroundColor: tint } : null]}>{icon}</View> : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {summary ? <Text style={styles.summary} numberOfLines={2}>{summary}</Text> : null}
        {children}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.mutedForeground} /> : null)}
    </>
  );
  return onPress ? (
    <Press
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.row, !first && styles.divider]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={summary}
    >
      {body}
    </Press>
  ) : (
    <View style={[styles.row, !first && styles.divider]}>{body}</View>
  );
}

function Chevron({ open }: { open: boolean }) {
  const turn = useSharedValue(open ? 1 : 0);
  useEffect(() => { turn.value = withSpring(open ? 1 : 0, SPRING); }, [open, turn]);
  const anim = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={anim}>
      <ChevronDown size={18} color={colors.mutedForeground} />
    </Animated.View>
  );
}

/** A row that opens in place to show its content. Keep one open at a time per screen. */
export function Disclosure({
  icon,
  tint,
  title,
  summary,
  open,
  onToggle,
  first,
  children,
}: Omit<RowProps, 'right' | 'onPress'> & { open: boolean; onToggle: () => void }) {
  return (
    <View style={!first ? styles.divider : undefined}>
      <Press
        scaleTo={0.98}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.create(260, 'easeInEaseOut', 'opacity'));
          onToggle();
        }}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={summary}
      >
        {icon ? <View style={[styles.icon, tint ? { backgroundColor: tint } : null]}>{icon}</View> : null}
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          {!open && summary ? <Text style={styles.summary} numberOfLines={1}>{summary}</Text> : null}
        </View>
        <Chevron open={open} />
      </Press>
      {open ? <View style={styles.open}>{children}</View> : null}
    </View>
  );
}

/** iOS-style segmented control: equal-width options in a grey track, the active one lifted. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.key === value));
  const slot = width ? (width - 6) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(index * slot, SPRING); }, [index, slot, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={styles.segTrack} accessibilityRole="tablist" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {slot ? <Animated.View pointerEvents="none" style={[styles.segPill, { width: slot }, pill]} /> : null}
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={styles.segItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.segLabel, active && styles.segLabelActive]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Round icon button for a row's action (call, route). Always give it an accessibility label. */
export function IconButton({ icon, onPress, color = colors.primary, label }: { icon: ReactNode; onPress: () => void; color?: string; label: string }) {
  return (
    <Press
      onPress={onPress}
      scaleTo={0.9}
      style={[styles.iconButton, { backgroundColor: color }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      {icon}
    </Press>
  );
}

/** Small numbers side by side in one slim card (e.g. queued / matched / replies). */
export function Stats({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <View style={[styles.group, styles.stats]}>
      {items.map((s) => (
        <View key={s.label} style={styles.stat}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
    ...shadows.card,
  },
  groupTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 12,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '700' },
  summary: { color: colors.mutedForeground, fontSize: 13, lineHeight: 18 },
  open: { gap: 12, paddingBottom: 16 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  segTrack: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.full,
    padding: 3,
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  segPill: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: radius.full, backgroundColor: colors.card, ...shadows.card },
  segLabel: { color: colors.mutedForeground, fontSize: 13, fontWeight: '700' },
  segLabelActive: { color: colors.foreground },
  stats: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.foreground, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.mutedForeground, fontSize: 11, fontWeight: '700' },
});
