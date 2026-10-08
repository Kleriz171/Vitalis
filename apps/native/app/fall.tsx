import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Radio } from 'lucide-react-native';
import { t } from '@/lib/i18n';
import { colors, radius } from '@/lib/theme';

const ANSWER_S = 30;

/** Shown after a detected fall. No answer in 30 s sends an SOS, like the SOS countdown screen. */
export default function FallScreen() {
  const router = useRouter();
  const [left, setLeft] = useState(ANSWER_S);

  const getHelp = () => router.replace({ pathname: '/emergency', params: { start: '1', reason: 'fall' } } as never);

  useEffect(() => {
    if (left <= 0) { getHelp(); return; }
    const timer = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setLeft(s => s - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.wrap}>
        <Text style={styles.title} accessibilityRole="header">{t('Did you fall?')}</Text>
        <Text style={styles.number} accessibilityLiveRegion="assertive">{left}</Text>
        <Text style={styles.body}>{t('If you do not answer, Vitalis sends an SOS to certified responders nearby.')}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.okButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.okText}>{t("I'm OK")}</Text>
        </Pressable>
        <Pressable style={styles.helpButton} onPress={getHelp} accessibilityRole="button">
          <Radio size={18} color="#fff" />
          <Text style={styles.helpText}>{t('Get help now')}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.destructive },
  wrap: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800' },
  number: { color: '#fff', fontSize: 120, fontWeight: '800', lineHeight: 130 },
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 22 },
  actions: { padding: 20, gap: 10 },
  okButton: { height: 64, borderRadius: radius.lg, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  okText: { color: colors.destructive, fontSize: 22, fontWeight: '800' },
  helpButton: { height: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  helpText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
