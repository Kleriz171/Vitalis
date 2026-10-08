import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MapPin, Navigation, Phone, Shield, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Group, IconButton, Row, Segmented } from '@/components/ui/List';
import { colors, radius } from '@/lib/theme';
import { t } from '@/lib/i18n';

interface EmergencyNumber {
  id: string;
  name: string;
  number: string;
  category: 'ambulance' | 'general' | 'police' | 'fire' | 'poison' | 'hospital' | 'other';
}

interface Hospital {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isOpen24h?: boolean;
}

const fallbackNumbers: EmergencyNumber[] = [
  { id: 'ambulance', name: 'Ambulance', number: '127', category: 'ambulance' },
  { id: 'general', name: 'European emergency number', number: '112', category: 'other' },
  { id: 'police', name: 'Police', number: '129', category: 'police' },
  { id: 'fire', name: 'Fire brigade', number: '128', category: 'fire' },
];

export default function SOSModal() {
  const router = useRouter();
  const [tab, setTab] = useState<'numbers' | 'hospitals'>('numbers');
  const [numbers, setNumbers] = useState<EmergencyNumber[]>(fallbackNumbers);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setError(null);
      try {
        const [numbersResponse, hospitalsResponse] = await Promise.allSettled([
          api.get('/emergencies/numbers'),
          api.get('/emergencies/hospitals'),
        ]);

        if (numbersResponse.status === 'fulfilled' && Array.isArray(numbersResponse.value.data)) {
          setNumbers(numbersResponse.value.data);
        }
        if (hospitalsResponse.status === 'fulfilled' && Array.isArray(hospitalsResponse.value.data)) {
          setHospitals(hospitalsResponse.value.data);
        }
        if (numbersResponse.status === 'rejected' || hospitalsResponse.status === 'rejected') {
          setError(t('Some emergency resources are using fallback data.'));
        }
      } catch {
        setError(t('Emergency resources could not be loaded.'));
      }
    };

    void load();
  }, []);

  const openDirections = async (hospital: Hospital) => {
    const target = hospital.address || hospital.name;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      toast.error(t('Maps unavailable'), { description: t('No map app is available on this device.') });
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <AppScreen
      tone="critical"
      title={t('SOS directory')}
      subtitle="127 · 112"
      icon={<Heart size={20} color="#fff" fill="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={16} color="#fff" />
        </Pressable>
      }
    >
      {error ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>{error}</Text>
        </Card>
      ) : null}

      <Segmented
        options={[
          { key: 'numbers' as const, label: t('Emergency numbers') },
          { key: 'hospitals' as const, label: t('Hospitals') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'numbers' ? (
        <Group>
          {numbers.map((entry, index) => (
            <Row
              key={entry.id}
              first={index === 0}
              icon={entry.category === 'police' ? <Shield size={18} color={colors.info} /> : <Phone size={18} color={colors.destructive} />}
              title={entry.number}
              summary={t(entry.name)}
              right={
                <IconButton
                  icon={<Phone size={18} color="#fff" />}
                  color={colors.destructive}
                  label={`${t('Call')} ${entry.number}`}
                  onPress={() => void Linking.openURL(`tel:${entry.number}`)}
                />
              }
            />
          ))}
        </Group>
      ) : hospitals.length ? (
        <Group title={t('Hospitals')}>
          {hospitals.map((hospital, index) => (
            <Row
              key={hospital.id}
              first={index === 0}
              icon={<MapPin size={18} color={colors.destructive} />}
              title={hospital.name}
              summary={[hospital.address, hospital.phone].filter(Boolean).join(' · ')}
              right={
                <View style={styles.actions}>
                  {hospital.phone ? (
                    <IconButton
                      icon={<Phone size={16} color={colors.foreground} />}
                      color={colors.muted}
                      label={`${t('Call')} ${hospital.name}`}
                      onPress={() => void Linking.openURL(`tel:${hospital.phone}`)}
                    />
                  ) : null}
                  <IconButton
                    icon={<Navigation size={16} color="#fff" />}
                    color={colors.primary}
                    label={`${t('Route')} ${hospital.name}`}
                    onPress={() => void openDirections(hospital)}
                  />
                </View>
              }
            />
          ))}
        </Group>
      ) : (
        <Group>
          <Empty icon={MapPin} title={t('No nearby hospitals')} description={t('We could not find hospital records right now.')} />
        </Group>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 8 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  noticeCard: {
    padding: 16,
    backgroundColor: colors.warningSoft,
    borderColor: '#F6D89B',
  },
  noticeText: {
    color: colors.foreground,
    fontSize: 13,
  },
});
