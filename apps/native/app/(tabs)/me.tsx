import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, StyleSheet, Text, TextInputProps, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'expo-router';
import { Award, ChevronDown, ChevronRight, ChevronUp, Languages, LogOut, Users, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { signOut } from '@/lib/session';
import { AppScreen } from '@/components/AppScreen';
import { formatPhone, isE164, toE164 } from '@/lib/geo';
import { apiError, lang, locale, setLanguage, t, tn } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RootState, setSession, setTraining } from '@/lib/store';
import type { TrainingCertification, TrainingEnrollment } from '@/lib/store';
import { colors, fonts, radius, type } from '@/lib/theme';

type Severity = 'mild' | 'moderate' | 'severe';

type ProfileUser = {
  id?: string;
  email?: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  bloodType?: string;
  age?: number;
  dateOfBirth?: string;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  illnesses?: string[];
  phone?: string;
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

type SaveTarget = 'overview' | 'contact' | 'medication' | 'allergy' | 'vaccination' | 'appointment' | 'condition' | 'disability' | null;

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
  const [contactName, setContactName] = useState('');
  const [contactPhoneRaw, setContactPhoneRaw] = useState('');

  const syncEditableFields = useCallback((next: HealthProfile) => {
    setBloodType(next.user.bloodType ?? '');
    setAge(next.user.age != null ? String(next.user.age) : '');
    setGender(next.user.gender ?? '');
    setHeightCm(next.user.heightCm != null ? String(next.user.heightCm) : '');
    setWeightKg(next.user.weightKg != null ? String(next.user.weightKg) : '');
    setIllnesses((next.user.illnesses ?? []).join(', '));
    setContactName(next.user.emergencyContact?.name ?? '');
    setContactPhoneRaw(next.user.emergencyContact?.phone ?? '');
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
  const contactValid = contactName.trim() && isE164(contactPhone) && !contactOwnNumber;
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
          toast.error(t('Already on your list'), { description: t('{item} is already saved.', { item: medicationName.trim() }) });
          return;
        }
        await api.post('/health/medications', { name: medicationName.trim(), dosage: medicationDose.trim() || undefined, isActive: true });
        setMedicationName('');
        setMedicationDose('');
      }

      if (target === 'allergy') {
        if (isDuplicate('allergy', allergen)) {
          toast.error(t('Already on your list'), { description: t('{item} is already saved.', { item: allergen.trim() }) });
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
          toast.error(t('Already on your list'), { description: t('{item} is already saved.', { item: conditionName.trim() }) });
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
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(o => (o === id ? null : id));
  const list = (items: string[]) => (items.length ? items.join(', ') : t('None added'));

  const user = profile?.user;
  const walletMeta = [user?.age != null ? tn(user.age, '1 year', '{n} years') : null, user?.gender && genderLabels[user.gender]].filter(Boolean).join(' · ');
  const basicsDetail = [user?.bloodType, user?.age != null ? tn(user.age, '1 year', '{n} years') : null, user?.gender && genderLabels[user.gender]].filter(Boolean).join(' · ');

  return (
    <AppScreen
      title={t('Me')}
      subtitle={formatPhone(profile?.user.phone ?? auth.user?.phone) || profile?.user.email || auth.user?.email}
      scrollProps={{ refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> }}
    >
      <View style={styles.wallet} accessible accessibilityLabel={t('Bio Passport. {name}. Blood type {type}.', { name: user?.name ?? '', type: user?.bloodType ?? t('unknown') })}>
        <Text style={styles.walletBrand}>{t('Vitalis · Bio Passport')}</Text>
        <View style={styles.walletBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>{t('Blood type')}</Text>
            <Text style={[styles.walletBlood, !user?.bloodType && styles.walletUnknown]}>{user?.bloodType ?? t('Unknown')}</Text>
            <Text style={styles.walletName} numberOfLines={1}>{user?.name ?? auth.user?.name ?? ''}</Text>
            {walletMeta ? <Text style={styles.walletMeta}>{walletMeta}</Text> : null}
          </View>
          {passport?.qr ? (
            <View style={styles.qrTile}>
              <Image source={{ uri: passport.qr }} style={styles.qr} accessibilityLabel={t('Bio Passport QR code')} />
            </View>
          ) : null}
        </View>
      </View>
      <Text style={styles.footnote}>
        {t('Paramedics scan the code with any phone camera. It carries only what they need in the first minutes: blood type, allergies, medication, conditions and your emergency contact.')}
      </Text>

      {/* Called when you cannot answer; shown to paramedics through the QR. */}
      <Text style={styles.groupTitle}>{t('Emergency contact')}</Text>
      <View style={styles.group}>
        <Section
          id="contact"
          title={profile?.user.emergencyContact?.name || t('Not set')}
          detail={formatPhone(profile?.user.emergencyContact?.phone) || t('Someone we can call if you can\'t answer.')}
          open={open}
          onToggle={toggle}
          first
        >
          <Field label={t('Their name')} value={contactName} onChangeText={setContactName} />
          <Field label={t('Their phone')} value={contactPhoneRaw} onChangeText={setContactPhoneRaw} placeholder="069 123 4567" keyboardType="phone-pad" />
          {contactOwnNumber ? <Text style={styles.error}>{t("Use someone else's number, not your own.")}</Text> : null}
          <Button onPress={saveContact} loading={saving === 'contact'} disabled={!contactValid}>{t('Save')}</Button>
        </Section>
      </View>

      <Text style={styles.groupTitle}>{t('Medical record')}</Text>
      <View style={styles.group}>
        <Section id="basics" title={t('Basics')} detail={basicsDetail || t('Blood type, age, height, weight')} open={open} onToggle={toggle} first>
          {user?.dateOfBirth ? (
            <Text style={styles.fieldLabel}>{t('Born {date}', { date: formatDate(user.dateOfBirth) })}</Text>
          ) : null}
          <Text style={styles.fieldLabel}>{t('Blood type')}</Text>
          <View style={styles.selectionRow}>
            {bloodTypes.map((item) => (
              <Choice key={item} label={item} active={bloodType === item} onPress={() => setBloodType(item)} />
            ))}
          </View>
          <Text style={styles.fieldLabel}>{t('Gender')}</Text>
          <View style={styles.selectionRow}>
            {genders.map((item) => (
              <Choice key={item} label={genderLabels[item]} active={gender === item} onPress={() => setGender(item)} />
            ))}
          </View>
          <View style={styles.fieldRow}>
            {/* Age follows the date of birth when we have one; only older accounts type it in. */}
            {user?.dateOfBirth ? null : <Field grow label={t('Age')} value={age} onChangeText={setAge} keyboardType="number-pad" />}
            <Field grow label={t('Height, cm')} value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" />
            <Field grow label={t('Weight, kg')} value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" />
          </View>
          <Field label={t('Illnesses')} value={illnesses} onChangeText={setIllnesses} placeholder={t('Comma separated')} />
          <Button onPress={saveOverview} loading={saving === 'overview'}>{t('Save')}</Button>
        </Section>

        <Section id="allergies" title={t('Allergies')} detail={list((profile?.allergies ?? []).map(a => a.allergen))} open={open} onToggle={toggle}>
          {(profile?.allergies ?? []).map((item) => (
            <RecordRow key={item.id} title={item.allergen} badge={severityLabels[item.severity]} onDelete={() => removeRecord(`/health/allergies/${item.id}`)} />
          ))}
          <Input value={allergen} onChangeText={setAllergen} placeholder={t('Allergen')} />
          <View style={styles.selectionRow}>
            {severities.map((item) => (
              <Choice key={item} label={severityLabels[item]} active={severity === item} onPress={() => setSeverity(item)} />
            ))}
          </View>
          <Button onPress={() => createRecord('allergy')} loading={saving === 'allergy'}>{t('Add allergy')}</Button>
        </Section>

        <Section id="medications" title={t('Medication')} detail={list((profile?.medications ?? []).filter(m => m.isActive).map(m => m.name))} open={open} onToggle={toggle}>
          {(profile?.medications ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={item.dosage}
              badge={item.isActive ? undefined : t('Ended')}
              onDelete={() => removeRecord(`/health/medications/${item.id}`)}
            />
          ))}
          <Input value={medicationName} onChangeText={setMedicationName} placeholder={t('Medication name')} />
          <Input value={medicationDose} onChangeText={setMedicationDose} placeholder={t('Dose or schedule')} />
          <Button onPress={() => createRecord('medication')} loading={saving === 'medication'}>{t('Add medication')}</Button>
        </Section>

        <Section id="conditions" title={t('Conditions')} detail={list([...new Set([...(user?.illnesses ?? []), ...(profile?.conditions ?? []).map(c => c.name)])])} open={open} onToggle={toggle}>
          {(profile?.conditions ?? []).map((item) => (
            <RecordRow key={item.id} title={item.name} subtitle={item.notes} onDelete={() => removeRecord(`/health/conditions/${item.id}`)} />
          ))}
          <Input value={conditionName} onChangeText={setConditionName} placeholder={t('Condition')} />
          <Input value={conditionNotes} onChangeText={setConditionNotes} placeholder={t('Notes')} />
          <Button onPress={() => createRecord('condition')} loading={saving === 'condition'}>{t('Add condition')}</Button>
        </Section>

        <Section id="disabilities" title={t('Accessibility needs')} detail={list((profile?.disabilities ?? []).map(d => d.name))} open={open} onToggle={toggle}>
          {(profile?.disabilities ?? []).map((item) => (
            <RecordRow key={item.id} title={item.name} subtitle={item.notes} onDelete={() => removeRecord(`/health/disabilities/${item.id}`)} />
          ))}
          <Input value={disabilityName} onChangeText={setDisabilityName} placeholder={t('Disability or accessibility need')} />
          <Input value={disabilityNotes} onChangeText={setDisabilityNotes} placeholder={t('Notes')} />
          <Button onPress={() => createRecord('disability')} loading={saving === 'disability'}>{t('Add')}</Button>
        </Section>

        <Section id="vaccines" title={t('Vaccines')} detail={list((profile?.vaccinations ?? []).map(v => v.name))} open={open} onToggle={toggle}>
          {(profile?.vaccinations ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.name}
              subtitle={[item.provider, formatDate(item.date)].filter(Boolean).join(' · ')}
              onDelete={() => removeRecord(`/health/vaccinations/${item.id}`)}
            />
          ))}
          <Input value={vaccinationName} onChangeText={setVaccinationName} placeholder={t('Vaccine')} />
          <Input value={vaccinationProvider} onChangeText={setVaccinationProvider} placeholder={t('Provider or clinic')} />
          <Input value={vaccinationDate} onChangeText={setVaccinationDate} placeholder={t('Date (YYYY-MM-DD)')} autoCapitalize="none" />
          <Button onPress={() => createRecord('vaccination')} loading={saving === 'vaccination'}>{t('Add vaccine')}</Button>
        </Section>

        <Section id="appointments" title={t('Appointments')} detail={profile?.appointments.length ? t('{n} saved', { n: profile.appointments.length }) : t('None added')} open={open} onToggle={toggle}>
          {(profile?.appointments ?? []).map((item) => (
            <RecordRow
              key={item.id}
              title={item.appointmentType}
              subtitle={`${formatDate(item.scheduledAt)} · ${item.status}`}
              onDelete={() => removeRecord(`/health/appointments/${item.id}`)}
            />
          ))}
          <Input value={appointmentType} onChangeText={setAppointmentType} placeholder={t('Type (consultation, emergency, checkup)')} />
          <Input value={appointmentDate} onChangeText={setAppointmentDate} placeholder={t('Date (YYYY-MM-DD)')} autoCapitalize="none" />
          <Input value={appointmentStatus} onChangeText={setAppointmentStatus} placeholder={t('Status')} />
          <Input value={appointmentNotes} onChangeText={setAppointmentNotes} placeholder={t('Notes')} />
          <Button onPress={() => createRecord('appointment')} loading={saving === 'appointment'}>{t('Add appointment')}</Button>
        </Section>
      </View>

      {activeCertifications.length ? (
        <>
          <Text style={styles.groupTitle}>{t('Certifications')}</Text>
          <View style={styles.group}>
            {activeCertifications.map((cert: TrainingCertification, i) => (
              <LinkRow
                key={cert.id}
                first={i === 0}
                icon={<Award size={20} color={colors.primaryStrong} />}
                title={cert.badgeLabel}
                detail={t('Valid until {date}', { date: formatDate(cert.expiresAt) })}
                onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
              />
            ))}
          </View>
        </>
      ) : null}

      <View style={[styles.group, { marginTop: 8 }]}>
        {/* Always bilingual, so someone who cannot read the current language can still find it. */}
        <LinkRow
          first
          icon={<Languages size={20} color={colors.foreground} />}
          title="Gjuha · Language"
          detail={lang === 'sq' ? 'Shqip' : 'English'}
          onPress={() => void setLanguage(lang === 'sq' ? 'en' : 'sq')}
        />
        <LinkRow icon={<Users size={20} color={colors.foreground} />} title={t('Community')} detail={t('Support groups')} onPress={() => router.push('/community')} />
        <Pressable
          onPress={async () => { await signOut(); router.replace('/'); }}
          style={({ pressed }) => [styles.row, styles.divider, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.icon}><LogOut size={20} color={colors.destructive} /></View>
          <Text style={[styles.rowTitle, { color: colors.destructive }]}>{t('Sign out')}</Text>
        </Pressable>
      </View>

      {loading ? <Text style={styles.footnote}>{t('Loading your Bio Passport…')}</Text> : null}
    </AppScreen>
  );
}

function Section({ id, title, detail, open, onToggle, first, children }: {
  id: string;
  title: string;
  detail: string;
  open: string | null;
  onToggle: (id: string) => void;
  first?: boolean;
  children: ReactNode;
}) {
  const expanded = open === id;
  return (
    <View style={!first && styles.divider}>
      <Pressable
        onPress={() => onToggle(id)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
        </View>
        {expanded ? <ChevronUp size={18} color={colors.mutedForeground} /> : <ChevronDown size={18} color={colors.mutedForeground} />}
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function LinkRow({ icon, title, detail, onPress, first }: { icon: ReactNode; title: string; detail: string; onPress: () => void; first?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.divider, pressed && styles.pressed]} accessibilityRole="button">
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail} numberOfLines={1}>{detail}</Text>
      </View>
      <ChevronRight size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function Field({ label, grow, ...props }: { label: string; grow?: boolean } & TextInputProps) {
  return (
    <View style={[{ gap: 6 }, grow && { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Input accessibilityLabel={label} {...props} />
    </View>
  );
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function RecordRow({ title, subtitle, badge, onDelete }: { title: string; subtitle?: string; badge?: string; onDelete: () => void }) {
  return (
    <View style={styles.record}>
      <View style={{ flex: 1 }}>
        <Text style={styles.recordTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowDetail}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.recordBadge}>{badge}</Text> : null}
      <Pressable onPress={onDelete} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Remove {item}', { item: title })}>
        <X size={18} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Wallet card: credit-card proportions so it reads as an object you carry, not a panel.
  wallet: {
    aspectRatio: 1.586,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: radius.xl,
    backgroundColor: colors.primarySurface,
    padding: 20,
    justifyContent: 'space-between',
  },
  walletBrand: { ...type.footnote, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  walletBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  walletLabel: { ...type.footnote, color: 'rgba(255,255,255,0.75)' },
  walletBlood: { fontFamily: fonts.display, color: '#fff', fontSize: 52, lineHeight: 58, letterSpacing: -1 },
  walletUnknown: { fontSize: 30, lineHeight: 58 },
  walletName: { ...type.headline, color: '#fff', marginTop: 4 },
  walletMeta: { ...type.footnote, color: 'rgba(255,255,255,0.75)' },
  qrTile: { backgroundColor: '#fff', borderRadius: radius.md, padding: 6 },
  qr: { width: 104, height: 104 },
  footnote: { ...type.footnote, color: colors.mutedForeground, marginTop: -4 },
  groupTitle: { ...type.footnote, fontWeight: '600', color: colors.mutedForeground, marginTop: 8, marginBottom: -6, marginLeft: 4 },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  icon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...type.headline, color: colors.foreground },
  rowDetail: { ...type.footnote, color: colors.mutedForeground, marginTop: 2 },
  sectionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  error: { ...type.footnote, color: colors.destructive },
  fieldLabel: { ...type.footnote, fontWeight: '600', color: colors.mutedForeground },
  fieldRow: { flexDirection: 'row', gap: 10 },
  selectionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  choiceActive: { backgroundColor: colors.primarySurface, borderColor: colors.primarySurface },
  choiceLabel: { ...type.footnote, fontWeight: '600', color: colors.foreground },
  choiceLabelActive: { color: '#fff' },
  record: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  recordTitle: { ...type.callout, fontWeight: '600', color: colors.foreground },
  recordBadge: { ...type.footnote, color: colors.mutedForeground, textTransform: 'capitalize' },
});
