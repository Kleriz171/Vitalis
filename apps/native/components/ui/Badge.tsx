import { View, Text, TextStyle, StyleSheet, type ViewProps } from 'react-native';

// The View's own style type: the shared ViewStyle is widened by web typings (position: fixed).
type BoxStyle = ViewProps['style'];
import { colors, radius } from '@/lib/theme';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  style?: BoxStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

const variantBox: Record<BadgeVariant, BoxStyle> = {
  default:     { backgroundColor: colors.primary },
  secondary:   { backgroundColor: colors.muted },
  destructive: { backgroundColor: colors.destructive },
  outline:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
};

const variantText: Record<BadgeVariant, TextStyle> = {
  default:     { color: colors.primaryForeground },
  secondary:   { color: colors.foreground },
  destructive: { color: colors.destructiveForeground },
  outline:     { color: colors.foreground },
};

export const Badge = ({ variant = 'default', style, textStyle, children }: BadgeProps) => (
  <View style={[styles.box, variantBox[variant], style]}>
    <Text style={[styles.text, variantText[variant], textStyle]}>{children}</Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
