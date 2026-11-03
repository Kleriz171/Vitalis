import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, MessageSquare } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Group, Row, tick } from '@/components/ui/List';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t } from '@/lib/i18n';

type Item = { id: string; category: string; message: string; status: 'new' | 'in_review' | 'resolved' | 'dismissed'; resolution?: string; createdAt: string };
const CATEGORIES: [string, string][] = [
  ['app', t('The app')], ['emergency', t('An emergency')], ['responder', t('A responder')], ['clinician', t('A clinician')],
  ['hospital', t('A hospital')], ['privacy', t('Privacy')], ['other', t('Something else')],
];
const STATUS: Record<Item['status'], string> = { new: t('Received'), in_review: t('Being looked at'), resolved: t('Resolved'), dismissed: t('Closed') };

/** Feedback or a complaint to the Vitalis team, and what became of earlier ones. */
export default function FeedbackScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<Item[]>([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => api.get<Item[]>('/feedback/mine').then(r => setMine(r.data)).catch(() => {}), []);
  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    if (!category || message.trim().length < 5) return;
    setSending(true);
    try {
      await api.post('/feedback', { category, message: message.trim() });
      setMessage(''); setCategory(null);
      toast.success(t('Sent. Thank you, we read every message.'));
      await load();
    } catch (err) {
      toast.error(apiError(err, 'Could not send.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <AppScreen
      tone="dark"
      title={t('Feedback')}
      subtitle={t('Tell the Vitalis team what worked and what did not. In an emergency, call 127 or 112.')}
      icon={<MessageSquare size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      <Group title={t('About')}>
        {CATEGORIES.map(([key, label], i) => (
          <Row key={key} first={i === 0} title={label} onPress={() => { tick(); setCategory(key); }} accessibilityLabel={label}
            right={category === key ? <Check size={18} color={colors.primary} /> : <View style={{ width: 18 }} />} />
        ))}
      </Group>
      <Group title={t('Message')}>
        <Input value={message} onChangeText={setMessage} multiline maxLength={2000} placeholder={t('What happened?')} style={styles.message} />
        <View style={{ height: 12 }} />
      </Group>
      <Button onPress={send} loading={sending} disabled={!category || message.trim().length < 5}>{t('Send')}</Button>
      {mine.length ? (
        <Group title={t('Sent before')}>
          {mine.map((f, i) => (
            <Row key={f.id} first={i === 0} title={f.message} summary={[new Date(f.createdAt).toLocaleDateString(locale), f.resolution].filter(Boolean).join(' · ')}
              right={<Badge variant={f.status === 'resolved' ? 'default' : 'secondary'}>{STATUS[f.status]}</Badge>} />
          ))}
        </Group>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  message: { minHeight: 110, textAlignVertical: 'top', marginTop: 12 },
});
