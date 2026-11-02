import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, FileText, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Group, Row, Segmented, tick } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';

// Same values as apps/api/src/models/IncidentReport.ts.
type Conscious = 'yes' | 'no' | 'unknown';
type Breathing = 'normal' | 'abnormal' | 'none' | 'unknown';
type Handover = 'ambulance' | 'hospital' | 'stayed_on_scene' | 'refused_care' | 'none';
type Report = {
  conscious: Conscious; breathing: Breathing; cprPerformed: boolean; aedUsed: boolean; shocks?: number;
  actions: string[]; notes?: string; handover: Handover; arrivedAt?: string;
};

const ACTIONS: [string, string][] = [
  ['cpr', t('Chest compressions (CPR)')],
  ['aed_shock', t('Defibrillator shock')],
  ['recovery_position', t('Recovery position')],
  ['bleeding_control', t('Stopped bleeding')],
  ['airway', t('Cleared the airway')],
  ['reassurance', t('Stayed with them, reassured them')],
  ['called_ambulance', t('Called the ambulance')],
];
const HANDOVER: [Handover, string][] = [
  ['ambulance', t('To the ambulance crew')],
  ['hospital', t('Taken to a hospital')],
  ['stayed_on_scene', t('Stayed at home or on scene')],
  ['refused_care', t('Refused help')],
  ['none', t('Not handed over')],
];

const BLANK: Report = { conscious: 'unknown', breathing: 'unknown', cprPerformed: false, aedUsed: false, actions: [], handover: 'none' };

/** The responder's quick report on one call: mostly taps, one optional note. */
export default function QuickReport() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [r, setR] = useState<Report | null>(null);
  const [shocks, setShocks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Report[]>(`/emergencies/${id}/reports`)
      .then(({ data }) => {
        const mine = data[0];
        setR(mine ? { ...BLANK, ...mine } : BLANK);
        if (mine?.shocks != null) setShocks(String(mine.shocks));
      })
      .catch(err => setError(apiError(err, 'Could not load the report.')));
  }, [id]);

  const set = (patch: Partial<Report>) => setR(cur => (cur ? { ...cur, ...patch } : cur));
  const toggleAction = (key: string) => {
    tick();
    set({ actions: r!.actions.includes(key) ? r!.actions.filter(a => a !== key) : [...r!.actions, key] });
  };

  const save = async () => {
    if (!r) return;
    setSaving(true);
    try {
      const n = Number(shocks);
      await api.put(`/emergencies/${id}/report`, {
        conscious: r.conscious,
        breathing: r.breathing,
        cprPerformed: r.cprPerformed,
        aedUsed: r.aedUsed,
        ...(r.aedUsed && shocks.trim() && Number.isInteger(n) ? { shocks: n } : {}),
        actions: r.actions,
        ...(r.notes?.trim() ? { notes: r.notes.trim() } : {}),
        handover: r.handover,
      });
      toast.success(t('Report saved. Thank you.'));
      router.back();
    } catch (err) {
      toast.error(apiError(err, 'Could not save the report.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen
      tone="dark"
      title={t('Quick report')}
      subtitle={t('For the operators and the crew who take over. The caller does not see it.')}
      icon={<FileText size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel={t('Close')}>
          <X size={18} color="#fff" />
        </Pressable>
      }
    >
      {error ? (
        <Group><Text style={styles.error}>{error}</Text></Group>
      ) : !r ? (
        <View style={{ gap: 12 }}>
          <Skeleton style={{ height: 120, borderRadius: radius.lg }} />
          <Skeleton style={{ height: 260, borderRadius: radius.lg }} />
        </View>
      ) : (
        <>
          <Group title={t('When you arrived')}>
            <Text style={styles.label}>{t('Conscious')}</Text>
            <Segmented<Conscious>
              value={r.conscious}
              onChange={conscious => set({ conscious })}
              options={[{ key: 'yes', label: t('Yes') }, { key: 'no', label: t('No') }, { key: 'unknown', label: t('Not sure') }]}
            />
            <Text style={styles.label}>{t('Breathing')}</Text>
            <Segmented<Breathing>
              value={r.breathing}
              onChange={breathing => set({ breathing })}
              options={[
                { key: 'normal', label: t('Normal') },
                { key: 'abnormal', label: t('Abnormal') },
                { key: 'none', label: t('None') },
                { key: 'unknown', label: t('Not sure') },
              ]}
            />
            <View style={{ height: 12 }} />
          </Group>

          <Group title={t('What you did')}>
            <Row first title={t('CPR performed')} right={<Switch value={r.cprPerformed} onValueChange={cprPerformed => set({ cprPerformed })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('CPR performed')} />} />
            <Row title={t('Defibrillator used')} right={<Switch value={r.aedUsed} onValueChange={aedUsed => set({ aedUsed })} trackColor={{ true: colors.primary, false: colors.border }} accessibilityLabel={t('Defibrillator used')} />} />
            {r.aedUsed ? (
              <Row title={t('Shocks given')} right={<Input value={shocks} onChangeText={setShocks} keyboardType="number-pad" maxLength={2} placeholder="0" style={styles.shocks} accessibilityLabel={t('Shocks given')} />} />
            ) : null}
            {ACTIONS.map(([key, label]) => (
              <Row
                key={key}
                title={label}
                onPress={() => toggleAction(key)}
                accessibilityLabel={label}
                right={<View style={[styles.check, r.actions.includes(key) && styles.checkOn]}>{r.actions.includes(key) ? <Check size={14} color="#fff" /> : null}</View>}
              />
            ))}
          </Group>

          <Group title={t('Handover')}>
            {HANDOVER.map(([key, label], i) => (
              <Row
                key={key}
                first={i === 0}
                title={label}
                onPress={() => { tick(); set({ handover: key }); }}
                accessibilityLabel={label}
                right={r.handover === key ? <Check size={18} color={colors.primary} /> : <View style={{ width: 18 }} />}
              />
            ))}
          </Group>

          <Group title={t('Notes')}>
            <Input
              value={r.notes ?? ''}
              onChangeText={notes => set({ notes })}
              multiline
              maxLength={1000}
              placeholder={t('Anything the next person should know (optional)')}
              style={styles.notes}
            />
            <View style={{ height: 12 }} />
          </Group>

          <Button onPress={save} loading={saving}>{t('Save report')}</Button>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  close: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  error: { color: colors.destructive, fontSize: 14, paddingVertical: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.mutedForeground, marginTop: 12, marginBottom: 8 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  shocks: { width: 64, textAlign: 'center' },
  notes: { minHeight: 96, textAlignVertical: 'top', marginTop: 4 },
});
