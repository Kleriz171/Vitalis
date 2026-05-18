import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { AlertTriangle, Award, Calendar, Heart, LogOut, Pill, QrCode, ShieldCheck, Syringe, UserCircle, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { logout, RootState, setSession, setTraining } from '@/lib/store';
import type { TrainingCertification, TrainingEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

type Severity = 'mild' | 'moderate' | 'severe';

type ProfileUser = {
  id?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  bloodType?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  illnesses?: string[];
  disabilities?: string[];
};

type Medication = { id: string; name: string; dosage?: string; isActive: boolean };
type Allergy = { id: string; allergen: string; severity: Severity };
type Vaccination = { id: string; name: string; date?: string; provider?: string };
type Appointment = { id: string; appointmentType: string; scheduledAt: string; status: string; notes?: string };
type Condition = { id: string; name: string; notes?: string };
type Disability = { id: string; name: string; notes?: string };

type HealthProfile = {
  user: ProfileUser;
  medications: Medication[];
  allergies: Allergy[];
  vaccinations: Vaccination[];
  appointments: Appointment[];
  conditions: Condition[];
  disabilities: Disability[];
};

type BioPassport = {
  profile: {
    name: string;
    bloodType?: string;
    age?: number;
    gender?: string;
    medications?: { name: string; dosage?: string }[];
    allergies?: { allergen: string; severity: string }[];
    vaccinations?: { name: string; date?: string }[];
    conditions?: { name: string; notes?: string }[];
    disabilities?: { name: string; notes?: string }[];
  };
  qr: string;
};

type SaveTarget = 'overview' | 'medication' | 'allergy' | 'vaccination' | 'appointment' | 'condition' | 'disability' | null;

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const genders = ['male', 'female', 'non-binary', 'prefer_not_to_say'];
const severities: Severity[] = ['mild', 'moderate', 'severe'];

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value))
    : 'Pending';

const toIsoDate = (value: string) => {
  if (!value.trim()) return undefined;
  return new Date(`${value.trim()}T00:00:00.000Z`).toISOString();
};

export default function Profile() {
  const dispatch = useDispatch();
  const router = useRouter();
  const auth = useSelector((state: RootState) => state.auth);
  const certifications = useSelector((state: RootState) => state.training.certifications);
  const activeCertifications = useMemo(
    () => certifications.filter((c) => new Date(c.expiresAt).getTime() > Date.now()),
    [certifications]
  );

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [passport, setPassport] = useState<BioPassport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SaveTarget>(null);

  const [bloodType, setBloodType] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [illnesses, setIllnesses] = useState('');

  const [medicationName, setMedicationName] = useState('');
  const [medicationDose, setMedicationDose] = useState('');
  const [allergen, setAllergen] = useState('');
  const [severity, setSeverity] = useState<Severity>('mild');
  const [vaccinationName, setVaccinationName] = useState('');
  const [vaccinationProvider, setVaccinationProvider] = useState('');
  const [vaccinationDate, setVaccinationDate] = useState('');
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('scheduled');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [conditionName, setConditionName] = useState('');
  const [conditionNotes, setConditionNotes] = useState('');
  const [disabilityName, setDisabilityName] = useState('');
  const [disabilityNotes, setDisabilityNotes] = useState('');

  const syncEditableFields = useCallback((next: HealthProfile) => {
    setBloodType(next.user.bloodType ?? '');
    setAge(next.user.age != null ? String(next.user.age) : '');
    setGender(next.user.gender ?? '');
    setHeightCm(next.user.heightCm != null ? String(next.user.heightCm) : '');
    setWeightKg(next.user.weightKg != null ? String(next.user.weightKg) : '');
    setIllnesses((next.user.illnesses ?? []).join(', '));
  }, []);

  const load = useCallback(async () => {
    const [profileRes, passportRes, enrollmentsRes, certsRes] = await Promise.all([
      api.get('/health/profile'),
      api.get('/biopassport/me'),
      api.get<TrainingEnrollment[]>('/training/enrollments'),
      api.get<TrainingCertification[]>('/training/certifications'),
    ]);
    const nextProfile = profileRes.data as HealthProfile;
    setProfile(nextProfile);
    setPassport(passportRes.data as BioPassport);
    syncEditableFields(nextProfile);
    dispatch(setTraining({ enrollments: enrollmentsRes.data ?? [], certifications: certsRes.data ?? [] }));

    if (auth.accessToken && auth.refreshToken) {
      dispatch(
        setSession({
          accessToken: auth.accessToken,
          refreshToken: auth.refreshToken,
          user: nextProfile.user,
        })
      );
    }
  }, [auth.accessToken, auth.refreshToken, dispatch, syncEditableFields]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await load();
      } catch (error: any) {
        toast.error('Could not load profile', {
          description: error.response?.data?.error ?? 'Please try again shortly.',
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [load]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } catch (error: any) {
      toast.error('Refresh failed', {
        description: error.response?.data?.error ?? 'Please try again shortly.',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: 'Medications', value: profile?.medications.length ?? 0, icon: <Pill size={16} color={colors.warning} /> },
      { label: 'Allergies', value: profile?.allergies.length ?? 0, icon: <AlertTriangle size={16} color={colors.destructive} /> },
      { label: 'Vaccines', value: profile?.vaccinations.length ?? 0, icon: <Syringe size={16} color={colors.success} /> },
      { label: 'Appointments', value: profile?.appointments.length ?? 0, icon: <Calendar size={16} color={colors.info} /> },
    ],
    [profile]
  );

  const saveOverview = async () => {
    try {
      setSaving('overview');
      await api.patch('/health/profile', {
        bloodType: bloodType || undefined,
        age: age ? Number(age) : undefined,
        gender: gender || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        illnesses: illnesses
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      await load();
      toast.success('Profile updated');
    } catch (error: any) {
      toast.error('Could not update profile', {
        description: error.response?.data?.error ?? 'Please check your details.',
      });
    } finally {
      setSaving(null);
    }
  };

  const isDuplicate = (target: SaveTarget, candidate: string): boolean => {
    const norm = candidate.trim().toLowerCase();
    if (!norm) return false;
    if (target === 'allergy') return (profile?.allergies ?? []).some(a => a.allergen.toLowerCase() === norm);
    if (target === 'medication') return (profile?.medications ?? []).some(m => m.name.toLowerCase() === norm);
    if (target === 'condition') return (profile?.conditions ?? []).some(c => c.name.toLowerCase() === norm);
    return false;
  };

  const createRecord = async (target: Exclude<SaveTarget, 'overview' | null>) => {
    try {
      setSaving(target);

      if (target === 'medication') {
        if (isDuplicate('medication', medicationName)) {
          toast.error('Already on your list', { description: `${medicationName.trim()} is already saved.` });
          return;
        }
        await api.post('/health/medications', { name: medicationName.trim(), dosage: medicationDose.trim() || undefined, isActive: true });
        setMedicationName('');
        setMedicationDose('');
      }

      if (target === 'allergy') {
        if (isDuplicate('allergy', allergen)) {
          toast.error('Already on your list', { description: `${allergen.trim()} is already saved.` });
          return;
        }
        await api.post('/health/allergies', { allergen: allergen.trim(), severity });
        setAllergen('');
      }

      if (target === 'vaccination') {
        await api.post('/health/vaccinations', {
          name: vaccinationName.trim(),
          provider: vaccinationProvider.trim() || undefined,
          date: toIsoDate(vaccinationDate),
        });
        setVaccinationName('');
        setVaccinationProvider('');
        setVaccinationDate('');
      }

      if (target === 'appointment') {
        await api.post('/health/appointments', {
          appointmentType,
          scheduledAt: new Date(`${appointmentDate.trim()}T12:00:00.000Z`).toISOString(),
          status: appointmentStatus,
          notes: appointmentNotes.trim() || undefined,
        });
        setAppointmentDate('');
        setAppointmentNotes('');
      }

      if (target === 'condition') {
        if (isDuplicate('condition', conditionName)) {
          toast.error('Already on your list', { description: `${conditionName.trim()} is already saved.` });
          return;
        }
        await api.post('/health/conditions', {
          name: conditionName.trim(),
          notes: conditionNotes.trim() || undefined,
        });
        setConditionName('');
        setConditionNotes('');
      }

      if (target === 'disability') {
        await api.post('/health/disabilities', {
          name: disabilityName.trim(),
          notes: disabilityNotes.trim() || undefined,
        });
        setDisabilityName('');
        setDisabilityNotes('');
      }

      await load();
      toast.success('Saved to Bio Passport');
    } catch (error: any) {
      toast.error('Could not save record', {
        description: error.response?.data?.error ?? 'Please complete the field and try again.',
      });
    } finally {
      setSaving(null);
    }
  };

  const removeRecord = async (path: string) => {
    try {
      await api.delete(path);
      await load();
      toast.success('Removed');
    } catch (error: any) {
      toast.error('Could not remove item', {
        description: error.response?.data?.error ?? 'Please try again.',
      });
    }
  };

  return (
    <AppScreen
      tone="dark"
      eyebrow="Bio Passport"
      title={profile?.user.name ?? auth.user?.name ?? 'Your profile'}
      subtitle={profile?.user.email ?? auth.user?.email ?? 'Citizen account'}
      icon={<UserCircle size={28} color="#fff" />}
      action={
        <Pressable
          onPress={() => {
            dispatch(logout());
            router.replace('/');
          }}
          style={styles.iconButton}
        >
          <LogOut size={16} color="#fff" />
        </Pressable>
      }
      headerContent={
        <View style={styles.headerContent}>
          <View style={styles.headerChip}>
            <Heart size={14} color="#fff" fill="#fff" />
            <Text style={styles.headerChipText}>Blood {profile?.user.bloodType ?? 'Unknown'}</Text>
          </View>
          <View style={styles.headerChip}>
            <ShieldCheck size={14} color="#fff" />
            <Text style={styles.headerChipText}>{profile?.user.role ?? auth.user?.role ?? 'citizen'}</Text>
          </View>
        </View>
      }
      scroll={false}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <Card key={stat.label} style={styles.statCard}>
              <View style={styles.statIcon}>{stat.icon}</View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        <Animated.View entering={FadeInDown.duration(280)}>
          <Card style={styles.passportCard}>
            <View style={styles.passportHeader}>
              <View style={styles.passportIcon}>
                <QrCode size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Generated Bio Passport</Text>
                <Text style={styles.sectionBody}>Your emergency identity updates from the same data used during signup and profile edits.</Text>
              </View>
            </View>

            <View style={styles.passportBodyCard}>
              <Text style={styles.passportBrand}>VITALIS</Text>
              <Text style={styles.passportName}>{passport?.profile.name ?? profile?.user.name ?? 'Citizen'}</Text>
              <Text style={styles.passportMeta}>
                {passport?.profile.bloodType ?? profile?.user.bloodType ?? 'Unknown blood type'} · {passport?.profile.gender ?? profile?.user.gender ?? 'Profile pending'}
              </Text>
              {passport?.qr ? <Image source={{ uri: passport.qr }} style={styles.qrImage} /> : null}
              <Text style={styles.passportHint}>Show this during triage, intake, or when confirming matched supply requests.</Text>
            </View>

            <View style={styles.tagWrap}>
              {(profile?.user.illnesses ?? []).map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
              {(profile?.conditions ?? []).map((item) => (
                <Badge key={item.id} style={styles.softBadge}>
                  {item.name}
                </Badge>
              ))}
            </View>
          </Card>
        </Animated.View>

        {activeCertifications.length ? (
          <Card style={styles.certCard}>
            <View style={styles.certHeader}>
              <Award size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>First aid certifications</Text>
            </View>
            <Text style={styles.sectionBody}>Visible to dispatchers during emergencies.</Text>
            <View style={styles.certRow}>
              {activeCertifications.map((cert: TrainingCertification) => (
                <Pressable
                  key={cert.id}
                  onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
                  style={styles.certBadge}
                >
                  <Text style={styles.certBadgeText}>{cert.badgeLabel}</Text>
                  <Text style={styles.certBadgeMeta}>
                    Valid until {new Date(cert.expiresAt).toLocaleDateString()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={styles.editorCard}>
          <Text style={styles.sectionTitle}>Core health profile</Text>
          <Text style={styles.sectionBody}>Keep your blood type, biometrics, and ongoing illnesses current so the rest of the app stays accurate.</Text>
          <View style={styles.formGrid}>
            <Input value={bloodType} onChangeText={setBloodType} placeholder="Blood type" />
            <Input value={age} onChangeText={setAge} placeholder="Age" keyboardType="number-pad" />
            <Input value={gender} onChangeText={setGender} placeholder="Gender" />
            <Input value={heightCm} onChangeText={setHeightCm} placeholder="Height (cm)" keyboardType="decimal-pad" />
            <Input value={weightKg} onChangeText={setWeightKg} placeholder="Weight (kg)" keyboardType="decimal-pad" />
            <Input value={illnesses} onChangeText={setIllnesses} placeholder="Illnesses, comma separated" />
          </View>
          <View style={styles.selectionRow}>
            {bloodTypes.map((item) => (
              <Pressable key={item} onPress={() => setBloodType(item)} style={[styles.choiceChip, bloodType === item && styles.choiceChipActive]}>
                <Text style={[styles.choiceLabel, bloodType === item && styles.choiceLabelActive]}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.selectionRow}>
            {genders.map((item) => (
              <Pressable key={item} onPress={() => setGender(item)} style={[styles.choiceChip, gender === item && styles.choiceChipActive]}>
                <Text style={[styles.choiceLabel, gender === item && styles.choiceLabelActive]}>{item.replaceAll('_', ' ')}</Text>
              </Pressable>
            ))}
          </View>
          <Button onPress={saveOverview} loading={saving === 'overview'}>
            Save profile basics
          </Button>
        </Card>

        <EntryCard
          title="Medications"
          description="Routine medication appears on your passport and helps responders avoid unsafe conflicts."
          fields={
            <>
              <Input value={medicationName} onChangeText={setMedicationName} placeholder="Medication name" />
              <Input value={medicationDose} onChangeText={setMedicationDose} placeholder="Dose or schedule" />
              <Button onPress={() => createRecord('medication')} loading={saving === 'medication'} style={styles.warningButton}>
                Add medication
              </Button>
            </>
          }
          items={(profile?.medications ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={item.dosage || 'Active medication'}
              badge={item.isActive ? 'Active' : 'Ended'}
              onDelete={() => removeRecord(`/health/medications/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title="Allergies"
          description="Severity stays attached to every allergy so emergency teams can act faster."
          fields={
            <>
              <Input value={allergen} onChangeText={setAllergen} placeholder="Allergen" />
              <View style={styles.selectionRow}>
                {severities.map((item) => (
                  <Pressable key={item} onPress={() => setSeverity(item)} style={[styles.choiceChip, severity === item && styles.destructiveChipActive]}>
                    <Text style={[styles.choiceLabel, severity === item && styles.choiceLabelActive]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Button onPress={() => createRecord('allergy')} loading={saving === 'allergy'} style={styles.destructiveButton}>
                Add allergy
              </Button>
            </>
          }
          items={(profile?.allergies ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.allergen}
              badge={item.severity}
              onDelete={() => removeRecord(`/health/allergies/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title="Vaccines"
          description="Enter the vaccine name, optional provider, and date so your passport can surface them correctly."
          fields={
            <>
              <Input value={vaccinationName} onChangeText={setVaccinationName} placeholder="Vaccine name" />
              <Input value={vaccinationProvider} onChangeText={setVaccinationProvider} placeholder="Provider or clinic" />
              <Input value={vaccinationDate} onChangeText={setVaccinationDate} placeholder="Date (YYYY-MM-DD)" autoCapitalize="none" />
              <Button onPress={() => createRecord('vaccination')} loading={saving === 'vaccination'} style={styles.successButton}>
                Add vaccine
              </Button>
            </>
          }
          items={(profile?.vaccinations ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={[item.provider, formatDate(item.date)].filter(Boolean).join(' · ')}
              onDelete={() => removeRecord(`/health/vaccinations/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title="Appointments"
          description="This is where you actually input upcoming visits and checkups for the profile screen."
          fields={
            <>
              <Input value={appointmentType} onChangeText={setAppointmentType} placeholder="Type (consultation, emergency, checkup)" />
              <Input value={appointmentDate} onChangeText={setAppointmentDate} placeholder="Date (YYYY-MM-DD)" autoCapitalize="none" />
              <Input value={appointmentStatus} onChangeText={setAppointmentStatus} placeholder="Status" />
              <Input value={appointmentNotes} onChangeText={setAppointmentNotes} placeholder="Notes" />
              <Button onPress={() => createRecord('appointment')} loading={saving === 'appointment'} style={styles.infoButton}>
                Add appointment
              </Button>
            </>
          }
          items={(profile?.appointments ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.appointmentType}
              subtitle={`${formatDate(item.scheduledAt)} · ${item.status}`}
              onDelete={() => removeRecord(`/health/appointments/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title="Conditions"
          description="Add longer-term medical conditions that should live on the passport."
          fields={
            <>
              <Input value={conditionName} onChangeText={setConditionName} placeholder="Condition name" />
              <Input value={conditionNotes} onChangeText={setConditionNotes} placeholder="Notes" />
              <Button onPress={() => createRecord('condition')} loading={saving === 'condition'}>
                Add condition
              </Button>
            </>
          }
          items={(profile?.conditions ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={item.notes}
              onDelete={() => removeRecord(`/health/conditions/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title="Disabilities"
          description="Capture accessibility needs and chronic disability notes directly inside the generated passport."
          fields={
            <>
              <Input value={disabilityName} onChangeText={setDisabilityName} placeholder="Disability or accessibility need" />
              <Input value={disabilityNotes} onChangeText={setDisabilityNotes} placeholder="Notes" />
              <Button onPress={() => createRecord('disability')} loading={saving === 'disability'} style={styles.purpleButton}>
                Add disability note
              </Button>
            </>
          }
          items={(profile?.disabilities ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={item.notes}
              onDelete={() => removeRecord(`/health/disabilities/${item.id}`)}
            />
          ))}
        />

        {loading ? (
          <Card style={styles.loadingCard}>
            <Text style={styles.sectionBody}>Loading your Bio Passport...</Text>
          </Card>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function EntryCard({
  title,
  description,
  fields,
  items,
}: {
  title: string;
  description: string;
  fields: ReactNode;
  items: ReactNode[];
}) {
  return (
    <Animated.View entering={FadeInDown.duration(260)}>
      <Card style={styles.editorCard}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionBody}>{description}</Text>
        <View style={styles.formStack}>{fields}</View>
        <View style={styles.listStack}>
          {items.length ? items : <Text style={styles.emptyText}>Nothing added yet.</Text>}
        </View>
      </Card>
    </Animated.View>
  );
}

function RecordRow({
  title,
  subtitle,
  badge,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  onDelete: () => void;
}) {
  return (
    <View style={styles.recordRow}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.recordTitle}>{title}</Text>
        {subtitle ? <Text style={styles.recordBody}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <Badge variant="outline" style={styles.recordBadge}>
          {badge}
        </Badge>
      ) : null}
      <Pressable onPress={onDelete} style={styles.deleteButton}>
        <X size={14} color={colors.destructive} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 140,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  headerContent: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 16,
    gap: 10,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  statValue: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '600',
  },
  passportCard: {
    padding: 18,
    gap: 16,
  },
  passportHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  passportIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  passportBodyCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    padding: 20,
    gap: 8,
  },
  passportBrand: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  passportName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  passportMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
  },
  qrImage: {
    width: 138,
    height: 138,
    borderRadius: radius.lg,
    alignSelf: 'center',
    marginVertical: 8,
    backgroundColor: '#fff',
  },
  passportHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    textAlign: 'center',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  softBadge: {
    backgroundColor: `${colors.primary}12`,
    borderColor: `${colors.primary}22`,
  },
  editorCard: {
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionBody: {
    color: colors.mutedForeground,
    fontSize: 13,
    lineHeight: 19,
  },
  formGrid: {
    gap: 10,
  },
  formStack: {
    gap: 10,
  },
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.soft,
  },
  choiceChipActive: {
    backgroundColor: colors.primary,
  },
  destructiveChipActive: {
    backgroundColor: colors.destructive,
  },
  choiceLabel: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  choiceLabelActive: {
    color: '#fff',
  },
  listStack: {
    gap: 10,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  recordBody: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  recordBadge: {
    backgroundColor: colors.soft,
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.destructiveSoft,
  },
  emptyText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  warningButton: {
    backgroundColor: colors.warning,
  },
  destructiveButton: {
    backgroundColor: colors.destructive,
  },
  successButton: {
    backgroundColor: colors.success,
  },
  infoButton: {
    backgroundColor: colors.info,
  },
  purpleButton: {
    backgroundColor: colors.purple,
  },
  loadingCard: {
    padding: 18,
  },
  certCard: {
    padding: 18,
    gap: 12,
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  certBadge: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    gap: 4,
  },
  certBadgeText: {
    color: colors.accentForeground,
    fontSize: 13,
    fontWeight: '800',
  },
  certBadgeMeta: {
    color: colors.primaryStrong,
    fontSize: 10,
    fontWeight: '600',
  },
});
