import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Eye, QrCode, RefreshCw } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t } from '@/lib/i18n';

type Share = { bloodType: boolean; allergies: boolean; medications: boolean; conditions: boolean; contact: boolean };
type MedicalId = { enabled: boolean; share: Share; url: string | null; preview: string[] };
type Access = { id: string; kind: 'clinician_record' | 'admin_record' | 'qr_profile'; at: string; actor: string | null };

const FIELDS: [keyof Share, string][] = [
  ['bloodType', t('Blood type')], ['allergies', t('Allergies')], ['medications', t('Current medication')], ['conditions', t('Conditions')], ['contact', t('Emergency contact')],
];
const when = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** What the Bio Passport QR shows, its revocable link, and who has opened the record. */
export default function MedicalIdSettings() {
  const router = useRouter();
  const [id, setId] = useState<MedicalId | null>(null);
  const [log, setLog] = useState<Access[] | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([api.get('/biopassport/me'), api.get<Access[]>('/account/access-log')]);
    setId(p.data.medicalId);
    setLog(l.data);
  }, []);
  useEffect(() => { load().catch(err => toast.error(apiError(err, 'Could not load your medical ID.'))); }, [load]);

  const patch = async (body: object) => {
    setSaving(true);
    try { await api.patch('/biopassport/medical-id', body); await load(); }
    catch (err) { toast.error(apiError(err, 'Could not save.')); }
    finally { setSaving(false); }
  };
  const rotate = () => Alert.alert(t('Make a new QR?'), t('The old QR and its link stop working at once. Use this if a printed card or screenshot went somewhere it should not.'), [
    { text: t('Cancel'), style: 'cancel' },
    { text: t('Make a new QR'), style: 'destructive', onPress: async () => {
      try { await api.post('/biopassport/medical-id/rotate'); await load(); toast.success(t('New QR made. The old one no longer works.')); }
      catch (err) { toast.error(apiError(err, 'Could not save.')); }
    } },
  ]);
  const who = (a: Access) => (a.kind === 'qr_profile' ? t('Someone opened your medical ID link')
    : a.kind === 'admin_record' ? t('A Vitalis administrator ({name}) opened your record', { name: a.actor ?? '' })
    : t('{name} opened your record for your consultation', { name: a.actor ?? t('A clinician') }));

  return (
    <AppScreen
      tone="dark"
      title={t('Medical ID')}
      subtitle={t('What paramedics see when they scan your QR.')}
      icon={<QrCode size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      {!id ? <Skeleton style={{ height: 200, borderRadius: radius.lg }} /> : (
        <>
          <Group title={t('Shown on the QR and its link')}>
            {FIELDS.map(([key, label], i) => (
              <Row key={key} first={i === 0} title={label} right={<Switch value={id.share[key]} disabled={saving} onValueChange={v => { void patch({ share: { [key]: v } }); }} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={label} />} />
            ))}
          </Group>
          <Group title={t('Online link')}>
            <Row first title={t('Include a link in the QR')} summary={t('Opens these facts online, even for a phone that cannot read text QRs. Every opening is listed below.')}
              right={<Switch value={id.enabled} disabled={saving} onValueChange={enabled => { void patch({ enabled }); }} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('Include a link in the QR')} />} />
            <Row icon={<RefreshCw size={18} color={colors.destructive} />} title={t('Make a new QR')} summary={t('The old QR and link stop working.')} onPress={rotate} />
          </Group>
          <Group title={t('What the QR says')}>
            <Text style={styles.preview}>{id.preview.join('\n')}</Text>
          </Group>
          <Group title={t('Who opened my records')}>
            {!log?.length ? <Text style={styles.empty}>{t('Nobody yet.')}</Text>
              : log.slice(0, 50).map((a, i) => <Row key={a.id} first={i === 0} icon={<Eye size={18} color={colors.primary} />} title={who(a)} summary={when(a.at)} />)}
          </Group>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  preview: { fontFamily: 'Menlo', fontSize: 13, color: colors.foreground, lineHeight: 20, paddingVertical: 12 },
  empty: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 14 },
});
