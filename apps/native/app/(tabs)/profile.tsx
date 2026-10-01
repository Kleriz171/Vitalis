import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  Switch,
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
import { api, PRIVACY_URL } from '@/lib/api';
import { signOut } from '@/lib/session';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { RootState, setSession, setTraining } from '@/lib/store';
import type { TrainingCertification, TrainingEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { apiError, lang, locale, setLanguage, t } from '@/lib/i18n';
import { formatPhone, isE164, toE164 } from '@/lib/geo';
import { setFallDetection, useFallDetectionEnabled } from '@/lib/fallDetection';
import { setWakeWord, useWakeWordEnabled, wakeWordSupported } from '@/lib/wakeWord';
import { speech } from '@/lib/speech';

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
  phone?: string;
  dateOfBirth?: string;
  emergencyContact?: { name?: string; phone: string } | null;
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

type SaveTarget = 'overview' | 'contact' | 'medication' | 'allergy' | 'vaccination' | 'appointment' | 'condition' | 'disability' | 'export' | 'delete' | null;

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
// Values must match GENDERS in apps/api/src/models/User.ts.
const genderLabels: Record<string, string> = {
  female: t('Female'),
  male: t('Male'),
  non_binary: t('Non-binary'),
  other: t('Other'),
  prefer_not_to_say: t('Prefer not to say'),
};
const genders = Object.keys(genderLabels);
const severities: Severity[] = ['mild', 'moderate', 'severe'];
const severityLabels: Record<Severity, string> = { mild: t('Mild'), moderate: t('Moderate'), severe: t('Severe') };

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(value))
    : t('Pending');

const toIsoDate = (value: string) => {
  if (!value.trim()) return undefined;
  return new Date(`${value.trim()}T00:00:00.000Z`).toISOString();
};

const ROLE_LABEL: Record<string, string> = {
  citizen: t('Citizen'),
  blood_donor: t('Blood donor'),
  doctor: t('Doctor'),
  nurse: t('Nurse'),
  student_responder: t('Certified first-aider'),
};

export default function Profile() {
  const dispatch = useDispatch();
  const router = useRouter();
  const auth = useSelector((state: RootState) => state.auth);
  const certifications = useSelector((state: RootState) => state.training.certifications);
  const [now] = useState(Date.now); // screen-open time is precise enough for expiry
  const activeCertifications = useMemo(
    () => certifications.filter((c) => new Date(c.expiresAt).getTime() > now),
    [certifications, now]
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
  const fallOn = useFallDetectionEnabled();
  const wakeOn = useWakeWordEnabled();
  const toggleWakeWord = async (on: boolean) => {
    if (on && !(await speech?.requestPermissionsAsync())?.granted) {
      toast.error(t('Allow the microphone to talk to Vitalis.'));
      return;
    }
    setWakeWord(on);
  };

  // ponytail: shares the JSON as text; a file (expo-file-system + expo-sharing) if exports get large.
  const exportData = async () => {
    setSaving('export');
    try {
      const { data } = await api.get('/account/export');
      await Share.share({ title: 'vitalis-data.json', message: JSON.stringify(data, null, 2) });
    } catch (e) {
      toast.error(apiError(e, 'Could not export your data. Try again.'));
    } finally {
      setSaving(null);
    }
  };

  // Two steps, like the system: an account and its Bio Passport cannot be brought back.
  const confirmDelete = () =>
    Alert.alert(t('Delete your account?'), t('Your Bio Passport, health records, certificates and check-ins are erased for good. This cannot be undone.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          setSaving('delete');
          try {
            await api.delete('/account', { data: { confirm: 'DELETE' } });
            await signOut();
            router.replace('/');
            toast.success(t('Your account was deleted.'));
          } catch (e) {
            toast.error(apiError(e, 'Could not delete your account. Try again.'));
          } finally {
            setSaving(null);
          }
        },
      },
    ]);
  const [contactName, setContactName] = useState('');
  const [contactPhoneRaw, setContactPhoneRaw] = useState('');

  const syncEditableFields = useCallback((next: HealthProfile) => {
    setBloodType(next.user.bloodType ?? '');
    setAge(next.user.age != null ? String(next.user.age) : '');
    setContactName(next.user.emergencyContact?.name ?? '');
    setContactPhoneRaw(next.user.emergencyContact?.phone ?? '');
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
        toast.error(t('Could not load profile'), {
          description: apiError(error, 'Please try again shortly.'),
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
      toast.error(t('Refresh failed'), {
        description: apiError(error, 'Please try again shortly.'),
      });
    } finally {
      setRefreshing(false);
    }
  };

  const stats = useMemo(
    () => [
      { label: t('Medications'), value: profile?.medications.length ?? 0, icon: <Pill size={16} color={colors.warning} /> },
      { label: t('Allergies'), value: profile?.allergies.length ?? 0, icon: <AlertTriangle size={16} color={colors.destructive} /> },
      { label: t('Vaccines'), value: profile?.vaccinations.length ?? 0, icon: <Syringe size={16} color={colors.success} /> },
      { label: t('Appointments'), value: profile?.appointments.length ?? 0, icon: <Calendar size={16} color={colors.info} /> },
    ],
    [profile]
  );

  const contactPhone = toE164(contactPhoneRaw);
  const contactOwnNumber = !!profile?.user.phone && contactPhone === profile.user.phone;
  const contactValid = !!contactName.trim() && isE164(contactPhone) && !contactOwnNumber;
  const saveContact = async () => {
    try {
      setSaving('contact');
      await api.patch('/health/profile', { emergencyContact: { name: contactName.trim(), phone: contactPhone } });
      await load();
      toast.success(t('Emergency contact saved'));
    } catch (error: any) {
      toast.error(t('Could not update profile'), { description: apiError(error, 'Please check your details.') });
    } finally {
      setSaving(null);
    }
  };

  const saveOverview = async () => {
    try {
      setSaving('overview');
      await api.patch('/health/profile', {
        bloodType: bloodType || undefined,
        // Age follows the date of birth when we have one.
        age: !profile?.user.dateOfBirth && age ? Number(age) : undefined,
        gender: gender || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        illnesses: illnesses
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      await load();
      toast.success(t('Profile updated'));
    } catch (error: any) {
      toast.error(t('Could not update profile'), {
        description: apiError(error, 'Please check your details.'),
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
          toast.error(t('Already on your list'), { description: `${medicationName.trim()} is already saved.` });
          return;
        }
        await api.post('/health/medications', { name: medicationName.trim(), dosage: medicationDose.trim() || undefined, isActive: true });
        setMedicationName('');
        setMedicationDose('');
      }

      if (target === 'allergy') {
        if (isDuplicate('allergy', allergen)) {
          toast.error(t('Already on your list'), { description: `${allergen.trim()} is already saved.` });
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
          toast.error(t('Already on your list'), { description: `${conditionName.trim()} is already saved.` });
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
      toast.success(t('Saved to Bio Passport'));
    } catch (error: any) {
      toast.error(t('Could not save record'), {
        description: apiError(error, 'Please complete the field and try again.'),
      });
    } finally {
      setSaving(null);
    }
  };

  const removeRecord = async (path: string) => {
    try {
      await api.delete(path);
      await load();
      toast.success(t('Removed'));
    } catch (error: any) {
      toast.error(t('Could not remove item'), {
        description: apiError(error, 'Please try again.'),
      });
    }
  };

  return (
    <AppScreen
      tone="dark"
      eyebrow={t('Bio Passport')}
      title={profile?.user.name ?? auth.user?.name ?? t('Your profile')}
      subtitle={formatPhone(profile?.user.phone ?? auth.user?.phone) || profile?.user.email || auth.user?.email || t('Citizen account')}
      icon={<UserCircle size={28} color="#fff" />}
      action={
        <Pressable
          onPress={async () => {
            await signOut();
            router.replace('/');
          }}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={t('Sign out')}
        >
          <LogOut size={16} color="#fff" />
        </Pressable>
      }
      headerContent={
        <View style={styles.headerContent}>
          <View style={styles.headerChip}>
            <Heart size={14} color="#fff" fill="#fff" />
            <Text style={styles.headerChipText}>{t('Blood {type}', { type: profile?.user.bloodType ?? t('Unknown') })}</Text>
          </View>
          <View style={styles.headerChip}>
            <ShieldCheck size={14} color="#fff" />
            <Text style={styles.headerChipText}>{ROLE_LABEL[profile?.user.role ?? auth.user?.role ?? 'citizen'] ?? profile?.user.role}</Text>
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
                <Text style={styles.sectionTitle}>{t('Generated Bio Passport')}</Text>
                <Text style={styles.sectionBody}>{t('Your emergency identity updates from the same data used during signup and profile edits.')}</Text>
              </View>
            </View>

            <View style={styles.passportBodyCard}>
              <Text style={styles.passportBrand}>VITALIS</Text>
              <Text style={styles.passportName}>{passport?.profile.name ?? profile?.user.name ?? t('Citizen')}</Text>
              <Text style={styles.passportMeta}>
                {passport?.profile.bloodType ?? profile?.user.bloodType ?? t('Unknown blood type')} · {genderLabels[passport?.profile.gender ?? profile?.user.gender ?? ''] ?? t('Profile pending')}
              </Text>
              {passport?.qr ? <Image source={{ uri: passport.qr }} style={styles.qrImage} /> : null}
              <Text style={styles.passportHint}>{t('Show this during triage, intake, or when confirming matched supply requests.')}</Text>
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
              <Text style={styles.sectionTitle}>{t('First aid certifications')}</Text>
            </View>
            <Text style={styles.sectionBody}>{t('Visible to dispatchers during emergencies.')}</Text>
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
          <Text style={styles.sectionTitle}>{t('Core health profile')}</Text>
          <Text style={styles.sectionBody}>{t('Keep your blood type, biometrics, and ongoing illnesses current so the rest of the app stays accurate.')}</Text>
          <View style={styles.formGrid}>
            <Input value={bloodType} onChangeText={setBloodType} placeholder={t('Blood type')} />
            {profile?.user.dateOfBirth ? (
              <Text style={styles.sectionBody}>{t('Born {date}', { date: formatDate(profile.user.dateOfBirth) })}</Text>
            ) : (
              <Input value={age} onChangeText={setAge} placeholder={t('Age')} keyboardType="number-pad" />
            )}
            <Input value={gender} onChangeText={setGender} placeholder={t('Gender')} />
            <Input value={heightCm} onChangeText={setHeightCm} placeholder={t('Height (cm)')} keyboardType="decimal-pad" />
            <Input value={weightKg} onChangeText={setWeightKg} placeholder={t('Weight (kg)')} keyboardType="decimal-pad" />
            <Input value={illnesses} onChangeText={setIllnesses} placeholder={t('Illnesses, comma separated')} />
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
                <Text style={[styles.choiceLabel, gender === item && styles.choiceLabelActive]}>{genderLabels[item]}</Text>
              </Pressable>
            ))}
          </View>
          <Button onPress={saveOverview} loading={saving === 'overview'}>
            {t('Save profile basics')}
          </Button>
        </Card>

        {/* Called when you cannot answer; paramedics also see it through the QR. */}
        <Card style={styles.editorCard}>
          <Text style={styles.sectionTitle}>{t('Emergency contact')}</Text>
          <Text style={styles.sectionBody}>{t("Someone we can call if you can't answer.")}</Text>
          <View style={styles.formStack}>
            <Input value={contactName} onChangeText={setContactName} placeholder={t('Their name')} accessibilityLabel={t('Their name')} />
            <Input value={contactPhoneRaw} onChangeText={setContactPhoneRaw} placeholder={t('Their phone')} accessibilityLabel={t('Their phone')} keyboardType="phone-pad" />
            {contactOwnNumber ? <Text style={styles.errorText}>{t("Use someone else's number, not your own.")}</Text> : null}
            <Button onPress={saveContact} loading={saving === 'contact'} disabled={!contactValid}>
              {t('Save')}
            </Button>
          </View>
        </Card>

        <EntryCard
          title={t('Medications')}
          description={t('Routine medication appears on your passport and helps responders avoid unsafe conflicts.')}
          fields={
            <>
              <Input value={medicationName} onChangeText={setMedicationName} placeholder={t('Medication name')} />
              <Input value={medicationDose} onChangeText={setMedicationDose} placeholder={t('Dose or schedule')} />
              <Button onPress={() => createRecord('medication')} loading={saving === 'medication'} style={styles.warningButton}>
                {t('Add medication')}
              </Button>
            </>
          }
          items={(profile?.medications ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={item.dosage || t('Active medication')}
              badge={item.isActive ? t('Active') : t('Ended')}
              onDelete={() => removeRecord(`/health/medications/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title={t('Allergies')}
          description={t('Severity stays attached to every allergy so emergency teams can act faster.')}
          fields={
            <>
              <Input value={allergen} onChangeText={setAllergen} placeholder={t('Allergen')} />
              <View style={styles.selectionRow}>
                {severities.map((item) => (
                  <Pressable key={item} onPress={() => setSeverity(item)} style={[styles.choiceChip, severity === item && styles.destructiveChipActive]}>
                    <Text style={[styles.choiceLabel, severity === item && styles.choiceLabelActive]}>{severityLabels[item]}</Text>
                  </Pressable>
                ))}
              </View>
              <Button onPress={() => createRecord('allergy')} loading={saving === 'allergy'} style={styles.destructiveButton}>
                {t('Add allergy')}
              </Button>
            </>
          }
          items={(profile?.allergies ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.allergen}
              badge={severityLabels[item.severity]}
              onDelete={() => removeRecord(`/health/allergies/${item.id}`)}
            />
          ))}
        />

        <EntryCard
          title={t('Vaccines')}
          description={t('Enter the vaccine name, optional provider, and date so your passport can surface them correctly.')}
          fields={
            <>
              <Input value={vaccinationName} onChangeText={setVaccinationName} placeholder={t('Vaccine name')} />
              <Input value={vaccinationProvider} onChangeText={setVaccinationProvider} placeholder={t('Provider or clinic')} />
              <Input value={vaccinationDate} onChangeText={setVaccinationDate} placeholder={t('Date (YYYY-MM-DD)')} autoCapitalize="none" />
              <Button onPress={() => createRecord('vaccination')} loading={saving === 'vaccination'} style={styles.successButton}>
                {t('Add vaccine')}
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
          title={t('Appointments')}
          description={t('This is where you actually input upcoming visits and checkups for the profile screen.')}
          fields={
            <>
              <Input value={appointmentType} onChangeText={setAppointmentType} placeholder={t('Type (consultation, emergency, checkup)')} />
              <Input value={appointmentDate} onChangeText={setAppointmentDate} placeholder={t('Date (YYYY-MM-DD)')} autoCapitalize="none" />
              <Input value={appointmentStatus} onChangeText={setAppointmentStatus} placeholder={t('Status')} />
              <Input value={appointmentNotes} onChangeText={setAppointmentNotes} placeholder={t('Notes')} />
              <Button onPress={() => createRecord('appointment')} loading={saving === 'appointment'} style={styles.infoButton}>
                {t('Add appointment')}
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
          title={t('Conditions')}
          description={t('Add longer-term medical conditions that should live on the passport.')}
          fields={
            <>
              <Input value={conditionName} onChangeText={setConditionName} placeholder={t('Condition name')} />
              <Input value={conditionNotes} onChangeText={setConditionNotes} placeholder={t('Notes')} />
              <Button onPress={() => createRecord('condition')} loading={saving === 'condition'}>
                {t('Add condition')}
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
          title={t('Disabilities')}
          description={t('Capture accessibility needs and chronic disability notes directly inside the generated passport.')}
          fields={
            <>
              <Input value={disabilityName} onChangeText={setDisabilityName} placeholder={t('Disability or accessibility need')} />
              <Input value={disabilityNotes} onChangeText={setDisabilityNotes} placeholder={t('Notes')} />
              <Button onPress={() => createRecord('disability')} loading={saving === 'disability'} style={styles.purpleButton}>
                {t('Add disability note')}
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

        <Card style={styles.editorCard}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.sectionTitle}>{t('Fall detection')}</Text>
              <Text style={styles.sectionBody}>
                {t('While Vitalis is open, a hard fall followed by no movement asks if you are OK. No answer in 30 seconds sends an SOS.')}
              </Text>
            </View>
            <Switch
              value={fallOn}
              onValueChange={setFallDetection}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('Fall detection')}
            />
          </View>
        </Card>

        {wakeWordSupported ? (
          <Card style={styles.editorCard}>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.sectionTitle}>{t('“Hey Vitalis”')}</Text>
                <Text style={styles.sectionBody}>
                  {t('While Vitalis is open, say “Hey Vitalis” to ask a question or to call for help. Listening happens on your phone; no sound is sent anywhere until you speak after “Hey Vitalis”.')}
                </Text>
              </View>
              <Switch
                value={wakeOn}
                onValueChange={(on) => void toggleWakeWord(on)}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t('“Hey Vitalis”')}
              />
            </View>
          </Card>
        ) : null}

        {/* Always bilingual, so someone who cannot read the current language can still find it. */}
        <Card style={styles.editorCard}>
          <Text style={styles.sectionTitle}>Gjuha · Language</Text>
          <View style={styles.selectionRow}>
            {(['sq', 'en'] as const).map((code) => (
              <Pressable
                key={code}
                onPress={() => void setLanguage(code)}
                style={[styles.choiceChip, lang === code && styles.choiceChipActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: lang === code }}
              >
                <Text style={[styles.choiceLabel, lang === code && styles.choiceLabelActive]}>{code === 'sq' ? 'Shqip' : 'English'}</Text>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* Your data: a copy of everything, or erase it (account.routes.ts on the API). */}
        <Card style={styles.editorCard}>
          <Text style={styles.sectionTitle}>{t('Your data')}</Text>
          <Text style={styles.sectionBody}>{t('Get a copy of everything Vitalis stores about you, or delete your account.')}</Text>
          <Button variant="outline" onPress={() => void exportData()} loading={saving === 'export'}>{t('Download my data')}</Button>
          <Button variant="ghost" onPress={() => void Linking.openURL(PRIVACY_URL)}>{t('Privacy policy')}</Button>
          <Button variant="destructive" onPress={confirmDelete} loading={saving === 'delete'}>{t('Delete my account')}</Button>
        </Card>

        {loading ? (
          <Card style={styles.loadingCard}>
            <Text style={styles.sectionBody}>{t('Loading your Bio Passport...')}</Text>
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
          {items.length ? items : <Text style={styles.emptyText}>{t('Nothing added yet.')}</Text>}
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
  errorText: { color: colors.destructive, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
