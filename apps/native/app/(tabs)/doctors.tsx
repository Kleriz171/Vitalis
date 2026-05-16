import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Filter, MessageCircle, Search, Star, Stethoscope, UserPlus, Video } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius } from '@/lib/theme';

const SPECIALTIES = ['All', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Dermatology', 'Psychology'];

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  biography?: string;
  experience?: number;
  rating?: number;
  reviewCount?: number;
  availableOnline?: boolean;
  phone?: string;
}

const openWhatsApp = async (phone: string, name: string) => {
  const cleaned = phone.replace(/[^\d]/g, '');
  if (!cleaned) {
    toast.error('No phone number on file for this doctor.');
    return;
  }
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(`Hello ${name}, I am reaching out via Vitalis.`)}`;
  try {
    await Linking.openURL(url);
  } catch {
    toast.error('Could not open WhatsApp');
  }
};

export default function Doctors() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (specialty !== 'All') params.set('specialty', specialty);
        if (onlineOnly) params.set('availableOnline', 'true');
        if (search) params.set('search', search);
        const response = await api.get(`/doctors${params.toString() ? `?${params}` : ''}`);
        setDoctors(response.data ?? []);
      } catch (err: any) {
        setDoctors([]);
        setError(err.response?.data?.error ?? 'Doctor directory is unavailable right now.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [onlineOnly, search, specialty]);

  return (
    <AppScreen
      tone="info"
      eyebrow="Care discovery"
      title="Doctors and specialist access."
      subtitle="Search by specialty, online availability, or symptoms."
      icon={<Stethoscope size={24} color="#fff" />}
      headerContent={
        <View style={styles.headerContent}>
          <Text style={styles.headerMetric}>{doctors.length}</Text>
          <Text style={styles.headerMetricLabel}>results in the current filter</Text>
        </View>
      }
    >
      <Pressable onPress={() => router.push('/doctor-application')}>
        <Card style={styles.applyCard}>
          <View style={styles.applyIcon}><UserPlus size={20} color={colors.info} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.applyTitle}>Are you a doctor?</Text>
            <Text style={styles.applyBody}>Apply to join Vitalis — upload your specialty certification for admin review.</Text>
          </View>
        </Card>
      </Pressable>

      <Card style={styles.searchCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search size={18} color={colors.mutedForeground} />
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search doctor or specialty"
              style={styles.searchInput}
            />
          </View>
          <Pressable onPress={() => setShowFilters((value) => !value)} style={styles.filterButton}>
            <Filter size={18} color={showFilters ? '#fff' : colors.mutedForeground} />
          </Pressable>
        </View>
        {showFilters ? (
          <View style={styles.filterPanel}>
            <Pressable onPress={() => setOnlineOnly((value) => !value)} style={[styles.filterPill, onlineOnly && styles.filterPillActive]}>
              <Video size={12} color={onlineOnly ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.filterPillText, onlineOnly && styles.filterPillTextActive]}>Online only</Text>
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.specialtyRow}>
              {SPECIALTIES.map((entry) => {
                const active = specialty === entry;
                return (
                  <Pressable key={entry} onPress={() => setSpecialty(entry)} style={[styles.specialtyPill, active && styles.specialtyPillActive]}>
                    <Text style={[styles.specialtyText, active && styles.specialtyTextActive]}>{entry}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Card>

      {loading ? (
        Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} style={styles.loadingCard}>
            <Skeleton style={{ width: 60, height: 60, borderRadius: radius.lg }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 16, width: 140 }} />
              <Skeleton style={{ height: 12, width: 90 }} />
              <Skeleton style={{ height: 12, width: '100%' }} />
            </View>
          </Card>
        ))
      ) : error ? (
        <Card style={styles.emptyCard}>
          <Empty icon={Search} title="Couldn’t load doctors" description={error} />
        </Card>
      ) : doctors.length ? (
        doctors.map((doctor) => (
          <Card key={doctor.id} style={styles.doctorCard}>
            <View style={styles.doctorTop}>
              <View style={styles.doctorIcon}>
                <Stethoscope size={24} color={colors.info} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.doctorHeading}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.doctorName}>{doctor.name}</Text>
                    <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
                  </View>
                  {doctor.availableOnline ? (
                    <View style={styles.onlineTag}>
                      <Video size={10} color={colors.success} />
                      <Text style={styles.onlineTagText}>Online</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.ratingRow}>
                  <Star size={14} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.ratingText}>{doctor.rating?.toFixed(1) ?? '—'}</Text>
                  {doctor.reviewCount != null ? <Text style={styles.reviewText}>({doctor.reviewCount})</Text> : null}
                  {doctor.experience ? <Text style={styles.reviewText}>{doctor.experience} years</Text> : null}
                </View>
                {doctor.biography ? <Text style={styles.doctorBio}>{doctor.biography}</Text> : null}
              </View>
            </View>
            <View style={styles.buttonRow}>
              {doctor.phone ? (
                <Button
                  size="sm"
                  style={styles.bookButton}
                  onPress={() => void openWhatsApp(doctor.phone!, doctor.name)}
                >
                  <MessageCircle size={14} color="#fff" />
                  Contact on WhatsApp
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onPress={() => toast('No contact number', { description: `${doctor.name} hasn't shared a WhatsApp number yet.` })}
                >
                  Contact unavailable
                </Button>
              )}
            </View>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Empty icon={Search} title="No doctors matched" description="Try widening the specialty or turning off online-only." />
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: 2,
  },
  headerMetric: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  headerMetricLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  searchCard: {
    padding: 16,
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.info,
  },
  filterPanel: {
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  filterPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  filterPillActive: {
    backgroundColor: colors.success,
  },
  filterPillText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#fff',
  },
  specialtyRow: {
    gap: 8,
  },
  specialtyPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  specialtyPillActive: {
    backgroundColor: colors.info,
  },
  specialtyText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  specialtyTextActive: {
    color: '#fff',
  },
  loadingCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  emptyCard: {
    padding: 18,
  },
  doctorCard: {
    padding: 16,
    gap: 14,
  },
  doctorTop: {
    flexDirection: 'row',
    gap: 12,
  },
  doctorIcon: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoSoft,
  },
  doctorHeading: {
    flexDirection: 'row',
    gap: 8,
  },
  doctorName: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
  },
  doctorSpecialty: {
    color: colors.info,
    fontSize: 13,
    fontWeight: '600',
  },
  onlineTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  onlineTagText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  doctorBio: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  bookButton: {
    backgroundColor: colors.info,
  },
  applyCard: {
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  applyIcon: {
    width: 44, height: 44, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.infoSoft,
  },
  applyTitle: { color: colors.foreground, fontSize: 14, fontWeight: '800' },
  applyBody: { color: colors.mutedForeground, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
