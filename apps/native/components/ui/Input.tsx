import { forwardRef } from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { colors, radius } from '@/lib/theme';

export const Input = forwardRef<TextInput, TextInputProps>(
  ({ style, placeholderTextColor = colors.mutedForeground, ...props }, ref) => (
    <TextInput
      ref={ref}
      placeholderTextColor={placeholderTextColor}
      style={[styles.input, style]}
      {...props}
    />
  )
);
Input.displayName = 'Input';

const styles = StyleSheet.create({
  input: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.foreground,
  },
});
