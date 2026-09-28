import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Navigation, Phone, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen, HeaderButton } from '@/components/AppScreen';
import { Empty } from '@/components/ui/Empty';
import { colors, fonts, radius, type } from '@/lib/theme';
import { callNumber } from '@/lib/geo';
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
      title={t('Hospitals & emergency numbers')}
      action={<HeaderButton icon={X} onPress={() => router.back()} label={t('Close')} />}
    >
      {error ? <Text style={styles.notice}>{error}</Text> : null}

      <View style={styles.group}>
        {numbers.map((entry, i) => {
          const ambulance = entry.category === 'ambulance';
          return (
            <Pressable
              key={entry.id}
              onPress={() => callNumber(entry.number)}
              style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={t('Call {name}, {number}', { name: t(entry.name), number: entry.number })}
            >
              <Phone size={20} color={ambulance ? colors.destructive : colors.mutedForeground} />
              <Text style={styles.rowTitle}>{t(entry.name)}</Text>
              <Text style={[styles.number, ambulance && { color: colors.destructive }]}>{entry.number}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.groupTitle}>{t('Hospitals')}</Text>
      {hospitals.length ? (
        <View style={styles.group}>
          {hospitals.map((hospital, i) => (
            <View key={hospital.id} style={[styles.row, i > 0 && styles.divider]}>
              <Pressable
                onPress={() => void openDirections(hospital)}
                style={{ flex: 1 }}
                accessibilityRole="button"
                accessibilityLabel={t('Directions to {place}', { place: hospital.name })}
              >
                <Text style={styles.rowTitle}>{hospital.name}</Text>
                {hospital.address ? <Text style={styles.rowDetail} numberOfLines={2}>{hospital.address}</Text> : null}
              </Pressable>
              {hospital.phone ? (
                <Pressable
                  onPress={() => callNumber(hospital.phone!)}
                  hitSlop={8}
                  style={styles.iconButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('Call {name}, {number}', { name: hospital.name, number: hospital.phone })}
                >
                  <Phone size={18} color={colors.foreground} />
                </Pressable>
              ) : null}
              <Pressable onPress={() => void openDirections(hospital)} hitSlop={8} style={styles.iconButton} accessibilityElementsHidden importantForAccessibility="no">
                <Navigation size={18} color={colors.foreground} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Empty icon={MapPin} title={t('No nearby hospitals')} description={t('We could not find hospital records right now.')} />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  notice: { ...type.footnote, color: colors.mutedForeground },
  groupTitle: { ...type.footnote, fontWeight: '600', color: colors.mutedForeground, marginTop: 8, marginBottom: -6, marginLeft: 4 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  rowTitle: { ...type.headline, color: colors.foreground, flexShrink: 1 },
  rowDetail: { ...type.footnote, color: colors.mutedForeground, marginTop: 2 },
  number: { fontFamily: fonts.display, fontSize: 24, color: colors.foreground, marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
});
