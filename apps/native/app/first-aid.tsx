import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, ArrowLeft, Droplets, Flame, HeartPulse, Phone, Wind } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Disclosure, Group } from '@/components/ui/List';
import { guides, type Guide } from '@/lib/firstAid';
import { callNumber } from '@/lib/geo';
import { colors, radius } from '@/lib/theme';
import { t } from '@/lib/i18n';

const icons: Record<Guide['id'], React.ReactNode> = {
  choking: <Wind size={18} color={colors.destructive} />,
  bleeding: <Droplets size={18} color={colors.destructive} />,
  stroke: <Activity size={18} color={colors.destructive} />,
  anaphylaxis: <HeartPulse size={18} color={colors.destructive} />,
  burns: <Flame size={18} color={colors.destructive} />,
};

/** First aid while waiting for help: one guide open at a time, numbered steps, 127 always on top. */
export default function FirstAid() {
  const router = useRouter();
  const { open: initial } = useLocalSearchParams<{ open?: string }>();
  const [open, setOpen] = useState<string | null>(initial ?? null);

  return (
    <AppScreen
      tone="critical"
      title={t('First aid')}
      subtitle={t('Steps to follow while help is on the way.')}
      icon={<HeartPulse size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      <Button size="lg" style={styles.call} onPress={() => callNumber('127')} accessibilityHint={t('Calls the ambulance')}>
        <Phone size={18} color="#fff" />
        {t('Call ambulance · {number}', { number: '127' })}
      </Button>

      <Group>
        {guides.map((g, index) => (
          <Disclosure
            key={g.id}
            first={index === 0}
            icon={icons[g.id]}
            tint={colors.destructiveSoft}
            title={g.title}
            summary={g.summary}
            open={open === g.id}
            onToggle={() => setOpen(open === g.id ? null : g.id)}
          >
            {g.steps.map((step, i) => (
              <View key={i} style={styles.step}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Disclosure>
        ))}
      </Group>

      <Text style={styles.note}>{t('Based on Red Cross and ERC first-aid guidance. Not a substitute for training.')}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  call: { backgroundColor: colors.destructive },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructive,
    marginTop: 1,
  },
  stepNumberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, color: colors.foreground, fontSize: 16, lineHeight: 23 },
  note: { color: colors.mutedForeground, fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
});
