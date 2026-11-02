import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Phone, Trash2, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { formatPhone, isE164, toE164 } from '@/lib/geo';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';

type Contact = { name: string; phone: string; notify: boolean; shareLocation: boolean };
type Circle = { emergencyContact: { name?: string; phone: string } | null; circle: (Contact & { id?: string })[] };

/** Up to five more people texted when you send an SOS, each with your choices. */
export default function EmergencyCircle() {
  const router = useRouter();
  const [data, setData] = useState<Circle | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Circle>('/circle').then(r => setData(r.data)).catch(err => toast.error(apiError(err, 'Could not load your circle.')));
  }, []);

  const save = useCallback(async (circle: Contact[]) => {
    setSaving(true);
    try {
      const { data: next } = await api.put<Circle>('/circle', { circle: circle.map(({ name: n, phone: p, notify, shareLocation }) => ({ name: n, phone: p, notify, shareLocation })) });
      setData(next);
      return true;
    } catch (err) {
      toast.error(apiError(err, 'Could not save your circle.'));
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  const add = async () => {
    const e164 = toE164(phone);
    if (!name.trim() || !isE164(e164)) { toast.error(t('Enter a name and a phone number.')); return; }
    if (await save([...(data?.circle ?? []), { name: name.trim(), phone: e164, notify: true, shareLocation: true }])) {
      setName(''); setPhone('');
      toast.success(t('Added. Let them know you added them.'));
    }
  };
  const update = (i: number, patch: Partial<Contact>) => save(data!.circle.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  return (
    <AppScreen
      tone="dark"
      title={t('Emergency circle')}
      subtitle={t('Texted when you send an SOS, besides your emergency contact.')}
      icon={<Users size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      {!data ? <Skeleton style={{ height: 160, borderRadius: radius.lg }} /> : (
        <>
          <Group title={t('Emergency contact')}>
            <Row first icon={<Phone size={18} color={colors.info} />} title={data.emergencyContact?.name ?? t('Not set')} summary={data.emergencyContact ? `${formatPhone(data.emergencyContact.phone)} · ${t('Always texted, with your location. Change it on Profile.')}` : t('Add one on Profile.')} />
          </Group>

          {data.circle.map((c, i) => (
            <Group key={c.phone} title={c.name}>
              <Row first title={formatPhone(c.phone)} right={
                <Pressable onPress={() => save(data.circle.filter((_, j) => j !== i))} accessibilityRole="button" accessibilityLabel={t('Remove {name}', { name: c.name })} hitSlop={10}>
                  <Trash2 size={18} color={colors.destructive} />
                </Pressable>
              } />
              <Row title={t('Text them on an SOS')} right={<Switch value={c.notify} disabled={saving} onValueChange={notify => { void update(i, { notify }); }} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('Text them on an SOS')} />} />
              <Row title={t('Include my live location')} summary={c.shareLocation ? t('They get a private link that shows where you are until the SOS ends.') : t('They are told about the SOS, not where you are.')}
                right={<Switch value={c.shareLocation} disabled={saving || !c.notify} onValueChange={shareLocation => { void update(i, { shareLocation }); }} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('Include my live location')} />} />
            </Group>
          ))}

          {data.circle.length < 5 ? (
            <Group title={t('Add someone')}>
              <View style={styles.form}>
                <Input value={name} onChangeText={setName} placeholder={t('Name')} maxLength={80} />
                <Input value={phone} onChangeText={setPhone} placeholder="+355 69 123 4567" keyboardType="phone-pad" />
                <Button onPress={add} loading={saving}>{t('Add to my circle')}</Button>
              </View>
            </Group>
          ) : <Text style={styles.note}>{t('Your circle is full (five people).')}</Text>}

          <Text style={styles.note}>{t('Texts need an SMS provider. On a test server they are not sent, and the SOS screen says so.')}</Text>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  form: { gap: 10, paddingVertical: 12 },
  note: { color: colors.mutedForeground, fontSize: 13, textAlign: 'center', paddingHorizontal: 12 },
});
