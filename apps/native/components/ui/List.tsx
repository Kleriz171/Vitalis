import { ReactNode } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View, type ViewProps } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors, radius, shadows } from '@/lib/theme';

// The app's one list language (first used on Profile): a white card holding a small uppercase
// title and rows separated by hairlines. Rows carry an icon, a title, one line of summary, and
// either a chevron (navigates), a right-hand element (switch, value), or open in place.

export function Group({ title, children, style }: { title?: string; children: ReactNode; style?: ViewProps['style'] }) {
  return (
    <View style={[styles.group, style]}>
      {title ? <Text style={styles.groupTitle}>{title}</Text> : null}
      {children}
    </View>
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
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={summary}
    >
      {body}
    </Pressable>
  ) : (
    <View style={[styles.row, !first && styles.divider]}>{body}</View>
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
      <Pressable
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
        <View style={open ? styles.chevronOpen : undefined}>
          <ChevronDown size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
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
  return (
    <View style={styles.segTrack} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segItem, active && styles.segItemActive]}
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
  pressed: { opacity: 0.6 },
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
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  open: { gap: 12, paddingBottom: 16 },
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
  segItemActive: { backgroundColor: colors.card, ...shadows.card },
  segLabel: { color: colors.mutedForeground, fontSize: 13, fontWeight: '700' },
  segLabelActive: { color: colors.foreground },
  stats: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { color: colors.foreground, fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.mutedForeground, fontSize: 11, fontWeight: '700' },
});
