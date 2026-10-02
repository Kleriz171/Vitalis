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
import { Accessibility, Activity, AlertTriangle, Heart, Award, Calendar, FileText, LogOut, Phone, Pill, Syringe, User, UserCircle, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api, PRIVACY_URL } from '@/lib/api';
import { signOut } from '@/lib/session';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Disclosure as Section } from '@/components/ui/List';
import { Input } from '@/components/ui/Input';
import { RootState, setSession, setTraining } from '@/lib/store';
import type { TrainingCertification, TrainingEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { apiError, lang, locale, setLanguage, t } from '@/lib/i18n';
import { formatPhone, isE164, toE164 } from '@/lib/geo';
import { setFallDetection, useFallDetectionEnabled } from '@/lib/fallDetection';
import { setWakeWord, useWakeWordEnabled, wakeWordSupported } from '@/lib/wakeWord';
import { medicalIdSupported, setMedicalId, showMedicalId, useMedicalIdEnabled, type MedicalFacts } from '@/lib/medicalId';
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
  // One record section open at a time keeps the page short (Bio Passport stays the focus).
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const listSummary = (names: (string | undefined)[]) =>
    names.filter(Boolean).length ? names.filter(Boolean).join(', ') : t('None added');

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
  const medicalIdOn = useMedicalIdEnabled();
  const medicalFacts = useMemo<MedicalFacts | null>(() => profile ? {
    name: profile.user.name,
    bloodType: profile.user.bloodType,
    allergies: profile.allergies.map((a) => `${a.allergen} (${severityLabels[a.severity] ?? a.severity})`),
    medications: profile.medications.filter((m) => m.isActive !== false).map((m) => m.name),
    conditions: profile.conditions.map((c) => c.name),
    contact: profile.user.emergencyContact,
  } : null, [profile]);
  // Keep the lock-screen card in step with the Bio Passport.
  useEffect(() => { if (medicalFacts && medicalIdOn) void showMedicalId(medicalFacts); }, [medicalFacts, medicalIdOn]);
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
      icon={<UserCircle size={24} color="#fff" />}
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
      scroll={false}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(280)} style={styles.passportBodyCard}>
          <Text style={styles.passportBrand}>VITALIS · {t('Bio Passport').toUpperCase()}</Text>
          <Text style={styles.passportName}>{passport?.profile.name ?? profile?.user.name ?? t('Citizen')}</Text>
          <Text style={styles.passportMeta}>
            {passport?.profile.bloodType ?? profile?.user.bloodType ?? t('Unknown blood type')} · {genderLabels[passport?.profile.gender ?? profile?.user.gender ?? ''] ?? t('Profile pending')}
          </Text>
          {passport?.qr ? (
            <View style={styles.qrTile}>
              <Image source={{ uri: passport.qr }} style={styles.qrImage} accessibilityLabel={t('Bio Passport')} />
            </View>
          ) : null}
          <Text style={styles.passportHint}>{t('Show this during triage, intake, or when confirming matched supply requests.')}</Text>
        </Animated.View>

        {activeCertifications.length ? (
          <Card style={styles.certCard}>
            <View style={styles.certHeader}>
              <Award size={18} color={colors.primary} />
              <Text style={styles.rowTitle}>{t('First aid certifications')}</Text>
            </View>
            <View style={styles.certRow}>
              {activeCertifications.map((cert: TrainingCertification) => (
                <Pressable
                  key={cert.id}
                  onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
                  style={styles.certBadge}
                >
                  <Text style={styles.certBadgeText}>{cert.badgeLabel}</Text>
                  <Text style={styles.certBadgeMeta}>
                    {t('Valid until {date}', { date: formatDate(cert.expiresAt) })}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={styles.groupCard}>
          <Text style={styles.groupTitle}>{t('Medical record')}</Text>
          <Section
            icon={<User size={18} color={colors.primary} />}
            title={t('Core health profile')}
            summary={[profile?.user.bloodType, profile?.user.dateOfBirth ? formatDate(profile.user.dateOfBirth) : undefined, genderLabels[profile?.user.gender ?? '']].filter(Boolean).join(' · ') || t('None added')}
            open={open === 'basics'}
            onToggle={() => toggle('basics')}
          >
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
          </Section>

        {/* Called when you cannot answer; paramedics also see it through the QR. */}
        <Section
          icon={<Phone size={18} color={colors.primary} />}
          title={t('Emergency contact')}
          summary={contactName ? `${contactName} · ${formatPhone(toE164(contactPhoneRaw) ?? contactPhoneRaw) || contactPhoneRaw}` : t('Not set')}
          open={open === 'contact'}
          onToggle={() => toggle('contact')}
        >
          <Text style={styles.sectionBody}>{t("Someone we can call if you can't answer.")}</Text>
          <View style={styles.formStack}>
            <Input value={contactName} onChangeText={setContactName} placeholder={t('Their name')} accessibilityLabel={t('Their name')} />
            <Input value={contactPhoneRaw} onChangeText={setContactPhoneRaw} placeholder={t('Their phone')} accessibilityLabel={t('Their phone')} keyboardType="phone-pad" />
            {contactOwnNumber ? <Text style={styles.errorText}>{t("Use someone else's number, not your own.")}</Text> : null}
            <Button onPress={saveContact} loading={saving === 'contact'} disabled={!contactValid}>
              {t('Save')}
            </Button>
          </View>
        </Section>

        <EntryCard
          icon={<Pill size={18} color={colors.warning} />}
          title={t('Medications')}
          summary={listSummary((profile?.medications ?? []).map((m) => m.name))}
          open={open === 'meds'}
          onToggle={() => toggle('meds')}
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
          icon={<AlertTriangle size={18} color={colors.destructive} />}
          title={t('Allergies')}
          summary={listSummary((profile?.allergies ?? []).map((a) => a.allergen))}
          open={open === 'allergies'}
          onToggle={() => toggle('allergies')}
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
          icon={<Syringe size={18} color={colors.success} />}
          title={t('Vaccines')}
          summary={listSummary((profile?.vaccinations ?? []).map((v) => v.name))}
          open={open === 'vaccines'}
          onToggle={() => toggle('vaccines')}
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
          icon={<Calendar size={18} color={colors.info} />}
          title={t('Appointments')}
          summary={listSummary((profile?.appointments ?? []).map((a) => a.appointmentType))}
          open={open === 'appointments'}
          onToggle={() => toggle('appointments')}
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
          icon={<Activity size={18} color={colors.primary} />}
          title={t('Conditions')}
          summary={listSummary((profile?.conditions ?? []).map((c) => c.name))}
          open={open === 'conditions'}
          onToggle={() => toggle('conditions')}
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
          icon={<Accessibility size={18} color={colors.purple} />}
          title={t('Disabilities')}
          summary={listSummary((profile?.disabilities ?? []).map((d) => d.name))}
          open={open === 'disabilities'}
          onToggle={() => toggle('disabilities')}
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

        </Card>

        <Card style={styles.groupCard}>
          <Text style={styles.groupTitle}>{t('Settings')}</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.rowTitle}>{t('Fall detection')}</Text>
              <Text style={styles.rowSummary}>{t('After a hard fall, asks if you are OK. No answer in 30 s sends an SOS.')}</Text>
            </View>
            <Switch
              value={fallOn}
              onValueChange={setFallDetection}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel={t('Fall detection')}
            />
          </View>

          {medicalIdSupported ? (
            <View style={[styles.switchRow, styles.rowDivider]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.rowTitle}>{t('Medical ID on lock screen')}</Text>
                <Text style={styles.rowSummary}>{t('Responders can read your blood type, allergies, medication and emergency contact without unlocking your phone.')}</Text>
              </View>
              <Switch
                value={medicalIdOn}
                onValueChange={(on) => void setMedicalId(on, medicalFacts ?? undefined).then((ok) => { if (on && !ok) toast.error(t('Allow notifications to show your Medical ID.')); })}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel={t('Medical ID on lock screen')}
              />
            </View>
          ) : (
            <Section
              icon={<Heart size={18} color={colors.destructive} />}
              title={t('Medical ID on lock screen')}
              summary={t('On iPhone, add it in the Health app: Medical ID, Show When Locked.')}
              open={open === 'medicalid'}
              onToggle={() => toggle('medicalid')}
            >
              <Text style={styles.sectionBody}>{t('On iPhone, add it in the Health app: Medical ID, Show When Locked.')}</Text>
              <Button variant="outline" onPress={() => void Linking.openURL('x-apple-health://').catch(() => {})}>{t('Open Health')}</Button>
            </Section>
          )}

          {wakeWordSupported ? (
            <View style={[styles.switchRow, styles.rowDivider]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.rowTitle}>{t('“Hey Vitalis”')}</Text>
                <Text style={styles.rowSummary}>
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
          ) : null}

          {/* Always bilingual, so someone who cannot read the current language can still find it. */}
          <View style={[styles.switchRow, styles.rowDivider]}>
            <Text style={[styles.rowTitle, { flex: 1 }]}>Gjuha · Language</Text>
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
          </View>

          {/* Your data: a copy of everything, or erase it (account.routes.ts on the API). */}
          <Section
            icon={<FileText size={18} color={colors.mutedForeground} />}
            title={t('Your data')}
            summary={t('Download, privacy policy, delete account')}
            open={open === 'data'}
            onToggle={() => toggle('data')}
          >
            <Text style={styles.sectionBody}>{t('Get a copy of everything Vitalis stores about you, or delete your account.')}</Text>
            <Button variant="outline" onPress={() => void exportData()} loading={saving === 'export'}>{t('Download my data')}</Button>
            <Button variant="ghost" onPress={() => void Linking.openURL(PRIVACY_URL)}>{t('Privacy policy')}</Button>
            <Button variant="destructive" onPress={confirmDelete} loading={saving === 'delete'}>{t('Delete my account')}</Button>
          </Section>
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
  icon,
  title,
  summary,
  open,
  onToggle,
  description,
  fields,
  items,
}: {
  icon: ReactNode;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  description: string;
  fields: ReactNode;
  items: ReactNode[];
}) {
  return (
    <Section icon={icon} title={title} summary={summary} open={open} onToggle={onToggle}>
      <View style={styles.listStack}>
        {items.length ? items : <Text style={styles.emptyText}>{t('Nothing added yet.')}</Text>}
      </View>
      <Text style={styles.sectionBody}>{description}</Text>
      <View style={styles.formStack}>{fields}</View>
    </Section>
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
  groupCard: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  groupTitle: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingTop: 10,
    paddingBottom: 4,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowTitle: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  rowSummary: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
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
  passportBodyCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    padding: 20,
    gap: 6,
    alignItems: 'center',
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
    textAlign: 'center',
  },
  passportMeta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
  },
  // White tile = the quiet zone scanners need; the code itself keeps square corners.
  qrTile: {
    alignSelf: 'center',
    marginVertical: 10,
    padding: 12,
    borderRadius: radius.xl,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  qrImage: {
    width: 168,
    height: 168,
  },

  passportHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    textAlign: 'center',
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
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
