import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

/** Always visible while Vitalis listens for "Hey Vitalis", so the mic is never on silently. */
export function MicIndicator() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.pill, { top: insets.top + 4 }]} accessibilityLabel={t('Listening for “Hey Vitalis”')}>
      <Mic size={12} color="#fff" />
      <Text style={styles.text}>{t('Hey Vitalis')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.success, opacity: 0.92,
  },
  text: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
