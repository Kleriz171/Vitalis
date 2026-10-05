import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Watch, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Disclosure } from '@/components/ui/List';
import { api } from '@/lib/api';
import { apiError, formatDate, t } from '@/lib/i18n';
import { colors } from '@/lib/theme';

type Device = { id: string; name?: string; pairedAt: string; lastSeenAt?: string };

/** Profile row: pair a Vitalis watch with the code it shows, list and unpair watches. */
export function WatchSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => api.get<Device[]>('/watch/devices').then(({ data }) => setDevices(data)).catch(() => {});
  useEffect(() => { if (open) void refresh(); }, [open]);

  const connect = async () => {
    setBusy(true);
    try {
      await api.post('/watch/pair/confirm', { code });
      setCode('');
      toast.success(t('Watch connected'));
      await refresh();
    } catch (err) {
      toast.error(t('Could not connect the watch'), { description: apiError(err, 'Check the code on the watch.') });
    } finally {
      setBusy(false);
    }
  };

  const unpair = (id: string) => api.delete(`/watch/devices/${id}`).then(refresh).catch((err) => toast.error(apiError(err, 'Try again.')));

  return (
    <Disclosure
      icon={<Watch size={18} color={colors.primary} />}
      title={t('Watch')}
      summary={devices.length ? t('{n} connected', { n: devices.length }) : t('SOS and heart check from your wrist')}
      open={open}
      onToggle={onToggle}
    >
      <Text style={styles.body}>{t('Open Vitalis on your Wear OS watch and type the 6-digit code it shows.')}</Text>
      <Input
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        accessibilityLabel={t('Code from the watch')}
        keyboardType="number-pad"
      />
      <Button onPress={() => void connect()} loading={busy} disabled={code.length !== 6}>{t('Connect watch')}</Button>
      {devices.map((d) => (
        <View key={d.id} style={styles.device}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{d.name ?? t('Watch')}</Text>
            <Text style={styles.body}>{t('Connected {date}', { date: formatDate(d.pairedAt) })}</Text>
          </View>
          <Pressable onPress={() => void unpair(d.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Disconnect {name}', { name: d.name ?? t('Watch') })}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
    </Disclosure>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
  name: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 },
});
