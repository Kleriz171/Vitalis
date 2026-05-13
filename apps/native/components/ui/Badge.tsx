import { View, Text, ViewStyle, TextStyle, StyleSheet } from 'react-native';
import { colors, radius } from '@/lib/theme';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface BadgeProps {
  variant?: BadgeVariant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

const variantBox: Record<BadgeVariant, ViewStyle> = {
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
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
