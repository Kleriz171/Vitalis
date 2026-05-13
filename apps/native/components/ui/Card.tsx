import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius, shadows } from '@/lib/theme';

export const Card = ({ style, ...props }: ViewProps) => (
  <View style={[styles.card, style]} {...props} />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    ...shadows.card,
  },
});
