import { Text, TextProps, StyleSheet } from 'react-native';
import { colors } from '@/lib/theme';

export const Label = ({ style, ...props }: TextProps) => (
  <Text style={[styles.label, style]} {...props} />
);

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', color: colors.foreground },
});
