import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, MapPin, Phone, Shield, TriangleAlert, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { colors, radius } from '@/lib/theme';

interface EmergencyNumber {
  id: string;
  name: string;
  number: string;
  category: 'ambulance' | 'police' | 'fire' | 'poison' | 'hospital' | 'other';
}

interface Hospital {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isOpen24h?: boolean;
}

const fallbackNumbers: EmergencyNumber[] = [
  { id: 'ambulance', name: 'Ambulance', number: '112', category: 'ambulance' },
  { id: 'police', name: 'Police', number: '129', category: 'police' },
  { id: 'fire', name: 'Fire brigade', number: '128', category: 'fire' },
  { id: 'poison', name: 'Poison control', number: '127', category: 'poison' },
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
          setError('Some emergency resources are using fallback data.');
        }
      } catch {
        setError('Emergency resources could not be loaded.');
      }
    };

    void load();
  }, []);

  const openDirections = async (hospital: Hospital) => {
    const target = hospital.address || hospital.name;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target)}`;
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      toast.error('Maps unavailable', { description: 'No map app is available on this device.' });
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <AppScreen
      tone="critical"
      eyebrow="Emergency resources"
      title="SOS directory"
      subtitle="Call fast, find care, and navigate to open hospitals without leaving the app."
      icon={<Heart size={24} color="#fff" fill="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <X size={16} color="#fff" />
        </Pressable>
      }
      headerContent={
        <View style={styles.headerBadge}>
          <TriangleAlert size={16} color="#fff" />
          <Text style={styles.headerBadgeText}>Use these resources when emergency dispatch needs a backup path.</Text>
        </View>
      }
    >
      {error ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeText}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.tabRow}>
        {([
          { key: 'numbers', label: 'Emergency numbers' },
          { key: 'hospitals', label: 'Hospitals' },
        ] as const).map((entry) => {
          const active = tab === entry.key;
          return (
            <Pressable key={entry.key} onPress={() => setTab(entry.key)} style={[styles.tab, active && styles.tabActive]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'numbers'
        ? numbers.map((entry) => (
            <Card key={entry.id} style={styles.itemCard}>
              <View style={styles.itemIcon}>
                {entry.category === 'police' ? <Shield size={20} color={colors.info} /> : <Phone size={20} color={colors.destructive} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{entry.name}</Text>
                <Text style={styles.itemValue}>{entry.number}</Text>
              </View>
              <Button size="sm" style={styles.callButton} onPress={() => void Linking.openURL(`tel:${entry.number}`)}>
                Call
              </Button>
            </Card>
          ))
        : hospitals.length
        ? hospitals.map((hospital) => (
            <Card key={hospital.id} style={styles.itemCard}>
              <View style={styles.itemIcon}>
                <MapPin size={20} color={colors.destructive} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.itemTitle}>{hospital.name}</Text>
                {hospital.address ? <Text style={styles.itemBody}>{hospital.address}</Text> : null}
                {hospital.phone ? <Text style={styles.itemBody}>{hospital.phone}</Text> : null}
              </View>
              <View style={styles.hospitalActions}>
                {hospital.phone ? (
                  <Button size="sm" variant="outline" onPress={() => void Linking.openURL(`tel:${hospital.phone}`)}>
                    Call
                  </Button>
                ) : null}
                <Button size="sm" style={styles.callButton} onPress={() => void openDirections(hospital)}>
                  Route
                </Button>
              </View>
            </Card>
          ))
        : (
          <Card style={styles.emptyCard}>
            <Empty icon={MapPin} title="No nearby hospitals" description="We could not find hospital records right now." />
          </Card>
        )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
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
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  tabActive: {
    backgroundColor: colors.destructiveSoft,
  },
  tabText: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.destructive,
  },
  itemCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  itemTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  itemValue: {
    color: colors.destructive,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  itemBody: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  hospitalActions: {
    gap: 8,
  },
  callButton: {
    backgroundColor: colors.destructive,
  },
  emptyCard: {
    padding: 18,
  },
});
