import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius } from '@/lib/theme';

export const Card = ({ style, ...props }: ViewProps) => (
  <View style={[styles.card, style]} {...props} />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    // Flat, like the grouped lists: a border separates, shadows read as decoration.
    borderRadius: radius.lg,
  },
});
