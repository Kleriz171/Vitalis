import { useEffect } from 'react';
import { ViewProps, ViewStyle, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, radius } from '@/lib/theme';

export const Skeleton = ({ style, ...props }: ViewProps & { style?: ViewStyle }) => {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.box, animatedStyle, style]} {...props} />;
};

const styles = StyleSheet.create({
  box: { backgroundColor: colors.muted, borderRadius: radius.sm },
});
