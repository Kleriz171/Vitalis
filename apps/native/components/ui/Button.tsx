import { forwardRef, Children } from 'react';
import {
  Pressable,
  PressableProps,
  Text,
  ActivityIndicator,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, radius } from '@/lib/theme';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: ViewStyle;
  children?: React.ReactNode;
}

const variantBox: Record<ButtonVariant, ViewStyle> = {
  default:     { backgroundColor: colors.primary },
  destructive: { backgroundColor: colors.destructive },
  outline:     { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  secondary:   { backgroundColor: colors.muted },
  ghost:       { backgroundColor: 'transparent' },
};

const variantText: Record<ButtonVariant, TextStyle> = {
  default:     { color: colors.primaryForeground },
  destructive: { color: colors.destructiveForeground },
  outline:     { color: colors.foreground },
  secondary:   { color: colors.foreground },
  ghost:       { color: colors.foreground },
};

const sizeBox: Record<ButtonSize, ViewStyle> = {
  default: { height: 44, paddingHorizontal: 20 },
  sm:      { height: 36, paddingHorizontal: 16 },
  lg:      { height: 52, paddingHorizontal: 24 },
  icon:    { height: 44, width: 44 },
};

const sizeText: Record<ButtonSize, TextStyle> = {
  default: { fontSize: 14, fontWeight: '600' },
  sm:      { fontSize: 14, fontWeight: '500' },
  lg:      { fontSize: 16, fontWeight: '700' },
  icon:    { fontSize: 14, fontWeight: '600' },
};

const isTextLike = (node: React.ReactNode): boolean => {
  if (node == null || typeof node === 'boolean') return true;
  if (typeof node === 'string' || typeof node === 'number') return true;
  if (Array.isArray(node)) return node.every(isTextLike);
  return false;
};

export const Button = forwardRef<View, ButtonProps>(
  ({ variant = 'default', size = 'default', loading, disabled, style, children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const childArray = Children.toArray(children);
    const allText = isTextLike(children);
    const textStyle = [variantText[variant], sizeText[size]];

    return (
      <Pressable
        ref={ref as any}
        disabled={isDisabled}
        style={({ pressed }) => [
          styles.base,
          variantBox[variant],
          sizeBox[size],
          isDisabled && { opacity: 0.75 },
          pressed && { opacity: 0.8 },
          style,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator color={variantText[variant].color as string} />
        ) : allText ? (
          <Text style={textStyle}>{childArray}</Text>
        ) : (
          childArray.map((child, index) =>
            typeof child === 'string' || typeof child === 'number' ? (
              <Text key={`text-${index}`} style={textStyle}>
                {child}
              </Text>
            ) : (
              child
            )
          )
        )}
      </Pressable>
    );
  }
);
Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.lg,
  },
});
