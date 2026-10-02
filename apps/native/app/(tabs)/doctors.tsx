import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageCircle, Search, Star, Stethoscope, UserPlus, Video } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Input } from '@/components/ui/Input';
import { Disclosure, Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { colors, radius } from '@/lib/theme';
import { apiError, t, tn } from '@/lib/i18n';

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
    toast.error(t('No phone number on file for this doctor.'));
    return;
  }
  const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(`Hello ${name}, I am reaching out via Vitalis.`)}`;
  try {
    await Linking.openURL(url);
  } catch {
    toast.error(t('Could not open WhatsApp'));
  }
};

export default function Doctors() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('All');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
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
        setError(apiError(err, 'Doctor directory is unavailable right now.'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [onlineOnly, search, specialty]);

  return (
    <AppScreen
      tone="info"
      title={t('Doctors')}
      subtitle={t('Search by specialty, online availability, or symptoms.')}
      icon={<Stethoscope size={20} color="#fff" />}
    >
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.mutedForeground} />
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder={t('Search doctor or specialty')}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={() => setOnlineOnly((value) => !value)}
          style={[styles.onlineToggle, onlineOnly && styles.onlineToggleOn]}
          accessibilityRole="switch"
          accessibilityState={{ checked: onlineOnly }}
          accessibilityLabel={t('Online only')}
        >
          <Video size={16} color={onlineOnly ? '#fff' : colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {SPECIALTIES.map((entry) => {
          const active = specialty === entry;
          return (
            <Pressable
              key={entry}
              onPress={() => setSpecialty(entry)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(entry)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <Group>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.skeletonRow}>
              <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton style={{ height: 14, width: 140 }} />
                <Skeleton style={{ height: 12, width: '70%' }} />
              </View>
            </View>
          ))}
        </Group>
      ) : error ? (
        <Group>
          <Empty icon={Search} title={t('Couldn’t load doctors')} description={error} />
        </Group>
      ) : doctors.length ? (
        <Group title={tn(doctors.length, '1 doctor', '{n} doctors')}>
          {doctors.map((doctor, index) => (
            <Disclosure
              key={doctor.id}
              first={index === 0}
              icon={<Text style={styles.initials}>{initials(doctor.name)}</Text>}
              tint={colors.infoSoft}
              title={doctor.name}
              summary={[
                t(doctor.specialty),
                doctor.rating != null ? `★ ${doctor.rating.toFixed(1)}` : null,
                doctor.availableOnline ? `● ${t('Online')}` : null,
              ].filter(Boolean).join(' · ')}
              open={openId === doctor.id}
              onToggle={() => setOpenId(openId === doctor.id ? null : doctor.id)}
            >
              <View style={styles.metaRow}>
                <Star size={14} color={colors.warning} fill={colors.warning} />
                <Text style={styles.meta}>
                  {[
                    doctor.rating?.toFixed(1) ?? '—',
                    doctor.reviewCount != null ? `(${doctor.reviewCount})` : null,
                    doctor.experience ? tn(doctor.experience, '1 year experience', '{n} years experience') : null,
                  ].filter(Boolean).join(' ')}
                </Text>
              </View>
              {doctor.biography ? <Text style={styles.bio}>{doctor.biography}</Text> : null}
              {doctor.phone ? (
                <Button style={styles.whatsApp} onPress={() => void openWhatsApp(doctor.phone!, doctor.name)}>
                  <MessageCircle size={16} color="#fff" />
                  {t('Contact on WhatsApp')}
                </Button>
              ) : (
                <Text style={styles.meta}>{t("{name} hasn't shared a WhatsApp number yet.", { name: doctor.name })}</Text>
              )}
            </Disclosure>
          ))}
        </Group>
      ) : (
        <Group>
          <Empty icon={Search} title={t('No doctors matched')} description={t('Try widening the specialty or turning off online-only.')} />
        </Group>
      )}

      <Group>
        <Row
          first
          icon={<UserPlus size={18} color={colors.info} />}
          title={t('Are you a doctor?')}
          summary={t('Apply to join Vitalis — upload your specialty certification for admin review.')}
          onPress={() => router.push('/doctor-application')}
        />
      </Group>
    </AppScreen>
  );
}

const initials = (name: string) =>
  name.replace(/^Dr\.?\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 10 },
  searchBox: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, height: 40, borderWidth: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
  onlineToggle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  onlineToggleOn: { backgroundColor: colors.success, borderColor: colors.success },
  chips: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.muted,
  },
  chipActive: { backgroundColor: colors.foreground },
  chipText: { color: colors.mutedForeground, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  initials: { color: colors.info, fontSize: 13, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { color: colors.mutedForeground, fontSize: 13 },
  bio: { color: colors.foreground, fontSize: 14, lineHeight: 20 },
  whatsApp: { backgroundColor: '#25D366' },
});
