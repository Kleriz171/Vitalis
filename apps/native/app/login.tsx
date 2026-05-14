import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Check, Heart, LogIn, ShieldCheck } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { api } from '@/lib/api';
import { setSession } from '@/lib/store';
import { colors, radius, shadows } from '@/lib/theme';

type Mode = 'login' | 'register';
type Step = 0 | 1 | 2;
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
type Gender = 'female' | 'male' | 'non_binary' | 'other' | 'prefer_not_to_say';
type Severity = 'mild' | 'moderate' | 'severe';

interface MedicationDraft {
  name: string;
  dosage?: string;
  isActive?: boolean;
}

interface AllergyDraft {
  allergen: string;
  severity: Severity;
}

interface VaccinationDraft {
  name: string;
  date?: string;
  provider?: string;
}

const OPERATOR_ROLES = ['dispatcher', 'admin'];
const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const isoDateRule = /^\d{4}-\d{2}-\d{2}$/;
const DEMO_EMAIL = 'demo@vitalis.dev';
const DEMO_PASSWORD = 'demo1234';

export default function Login() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const routeMode: Mode = modeParam === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState<Mode>(routeMode);
  const [step, setStep] = useState<Step>(0);

  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [bloodType, setBloodType] = useState<BloodType | null>(null);

  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  const [medications, setMedications] = useState<MedicationDraft[]>([]);
  const [allergyName, setAllergyName] = useState('');
  const [allergySeverity, setAllergySeverity] = useState<Severity>('mild');
  const [allergies, setAllergies] = useState<AllergyDraft[]>([]);
  const [vaccineName, setVaccineName] = useState('');
  const [vaccineProvider, setVaccineProvider] = useState('');
  const [vaccineDate, setVaccineDate] = useState('');
  const [vaccines, setVaccines] = useState<VaccinationDraft[]>([]);
  const [illnessInput, setIllnessInput] = useState('');
  const [illnesses, setIllnesses] = useState<string[]>([]);
  const [disabilityInput, setDisabilityInput] = useState('');
  const [disabilities, setDisabilities] = useState<string[]>([]);

  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    setMode(routeMode);
    setStep(0);
    if (routeMode === 'register') {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    }
  }, [routeMode]);

  const helperText = useMemo(() => {
    if (mode === 'login') return 'Sign in to access SOS, your Bio Passport, and care discovery.';
    return step === 0
      ? 'Step 1 of 3 - create your secure account.'
      : step === 1
      ? 'Step 2 of 3 - add biometric and identity information.'
      : 'Step 3 of 3 - complete your medical Bio Passport.';
  }, [mode, step]);

  const emailIsValid = /\S+@\S+\.\S+/.test(email);
  const passwordIsStrong = passwordRule.test(password);
  const ageValue = Number(age);
  const heightValue = Number(heightCm);
  const weightValue = Number(weightKg);
  const biometricsComplete =
    Number.isFinite(ageValue) &&
    ageValue > 0 &&
    Number.isFinite(heightValue) &&
    heightValue > 0 &&
    Number.isFinite(weightValue) &&
    weightValue > 0 &&
    Boolean(gender) &&
    Boolean(bloodType);

  const canContinue =
    !loading &&
    (mode === 'login'
      ? emailIsValid && password.length >= 8
      : step === 0
      ? Boolean(firstName.trim() && lastName.trim() && emailIsValid && passwordIsStrong)
      : step === 1
      ? biometricsComplete
      : true);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setStep(0);
  };

  const submitLogin = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (OPERATOR_ROLES.includes(data.user.role)) {
        toast.error('Wrong app', { description: 'Operators should use the desktop portal.' });
        return;
      }
      dispatch(setSession(data));
      toast.success('Welcome back');
      router.replace('/(tabs)/home');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'login failed');
    } finally {
      setLoading(false);
    }
  };

  const submitRegister = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        role: 'citizen',
        age: Number(age),
        gender,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        bloodType,
        illnesses,
        disabilities,
        medications,
        allergies,
        vaccinations: vaccines,
      });
      dispatch(setSession(data));
      toast.success('Account created');
      router.replace('/(tabs)/home');
    } catch (e: any) {
      toast.error(e.response?.data?.error ?? 'register failed');
    } finally {
      setLoading(false);
    }
  };

  const validateCurrentStep = () => {
    if (mode === 'login') return true;
    if (step === 0) {
      if (!firstName.trim() || !lastName.trim()) {
        toast.error('Enter your first and last name');
        return false;
      }
      if (!emailIsValid) {
        toast.error('Enter a valid email address');
        return false;
      }
      if (!passwordIsStrong) {
        toast.error('Password needs 8+ chars, an uppercase, a number, and a symbol');
        return false;
      }
    }
    if (step === 1 && !biometricsComplete) {
      toast.error('Complete all biometric fields');
      return false;
    }
    return true;
  };

  const addMedication = () => {
    if (!medicationName.trim()) {
      toast.error('Add a medication name first');
      return;
    }
    setMedications((current) => [...current, { name: medicationName.trim(), dosage: medicationDosage.trim() || undefined, isActive: true }]);
    setMedicationName('');
    setMedicationDosage('');
  };

  const addAllergy = () => {
    if (!allergyName.trim()) {
      toast.error('Add an allergen first');
      return;
    }
    setAllergies((current) => [...current, { allergen: allergyName.trim(), severity: allergySeverity }]);
    setAllergyName('');
  };

  const addVaccine = () => {
    if (!vaccineName.trim()) {
      toast.error('Add a vaccine name first');
      return;
    }
    if (vaccineDate.trim() && (!isoDateRule.test(vaccineDate.trim()) || Number.isNaN(Date.parse(`${vaccineDate.trim()}T00:00:00.000Z`)))) {
      toast.error('Use YYYY-MM-DD for the vaccine date');
      return;
    }
    setVaccines((current) => [
      ...current,
      {
        name: vaccineName.trim(),
        provider: vaccineProvider.trim() || undefined,
        date: vaccineDate.trim() ? new Date(`${vaccineDate.trim()}T00:00:00.000Z`).toISOString() : undefined,
      },
    ]);
    setVaccineName('');
    setVaccineProvider('');
    setVaccineDate('');
  };

  const addStringItem = (
    value: string,
    label: string,
    setter: Dispatch<SetStateAction<string[]>>,
    reset: () => void
  ) => {
    const normalized = value.trim();
    if (!normalized) {
      toast.error(`Add a ${label} first`);
      return;
    }
    setter((current) => (current.includes(normalized) ? current : [...current, normalized]));
    reset();
  };

  const stepAction = async () => {
    if (mode === 'login') {
      await submitLogin();
      return;
    }
    if (!validateCurrentStep()) return;
    if (step < 2) {
      setStep((current) => (current + 1) as Step);
      return;
    }
    await submitRegister();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <View style={styles.heroBackdrop}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.duration(320)} style={styles.heroHeader}>
            <Pressable
              onPress={() => {
                if (mode === 'register' && step > 0) {
                  setStep((current) => (current - 1) as Step);
                  return;
                }
                router.replace('/');
              }}
              style={styles.backBtn}
            >
              <ArrowLeft size={18} color="#fff" />
            </Pressable>
            <View style={styles.brandPill}>
              <Heart size={12} color="#fff" fill="#fff" />
              <Text style={styles.brandPillText}>VITALIS</Text>
            </View>
            <View style={styles.headerSpacer} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(60).duration(360)} style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{mode === 'login' ? 'Secure sign in' : 'Guided registration'}</Text>
            <Text style={styles.title}>
              {mode === 'login' ? 'Welcome back.' : 'Create your\nmedical passport.'}
            </Text>
            <Text style={styles.subtitle}>{helperText}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(380)} style={styles.card}>
            <View style={styles.modeSwitch}>
              {(['login', 'register'] as Mode[]).map((entry) => {
                const active = mode === entry;
                return (
                  <Pressable
                    key={entry}
                    onPress={() => switchMode(entry)}
                    style={[styles.modeChip, active && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                      {entry === 'login' ? 'Sign in' : 'Register'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'register' ? (
              <View style={styles.stepper}>
                {[0, 1, 2].map((entry) => {
                  const active = step === entry;
                  const done = step > entry;
                  return (
                    <View key={entry} style={styles.stepperItem}>
                      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                        {done ? (
                          <Check size={12} color="#fff" />
                        ) : (
                          <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{entry + 1}</Text>
                        )}
                      </View>
                      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                        {entry === 0 ? 'Identity' : entry === 1 ? 'Biometrics' : 'Medical'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {mode === 'login' ? (
              <View style={styles.form}>
                <View style={styles.field}>
                  <Label>Email</Label>
                  <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
                </View>
                <View style={styles.field}>
                  <Label>Password</Label>
                  <Input value={password} onChangeText={setPassword} secureTextEntry autoCorrect={false} />
                </View>

                <View style={styles.actions}>
                  <View style={styles.ctaBubble}>
                    <Button size="lg" onPress={() => void stepAction()} loading={loading} disabled={!canContinue} style={styles.primaryButton}>
                      Sign in
                    </Button>
                  </View>
                  <Pressable onPress={() => switchMode('register')} style={styles.secondaryLink}>
                    <Text style={styles.secondaryLinkText}>Need a new account? Register</Text>
                  </Pressable>
                  <Pressable onPress={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }} style={styles.demoLink}>
                    <LogIn size={15} color={colors.primaryStrong} />
                    <Text style={styles.demoLinkText}>Use demo credentials</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Animated.View key={`step-${step}`} entering={FadeInRight.duration(220)} exiting={FadeOutLeft.duration(180)}>
                <View style={styles.form}>
                  {step === 0 ? (
                    <>
                      <View style={styles.doubleRow}>
                        <View style={[styles.field, styles.half]}>
                          <Label>First name</Label>
                          <Input value={firstName} onChangeText={setFirstName} placeholder="Jane" autoCapitalize="words" />
                        </View>
                        <View style={[styles.field, styles.half]}>
                          <Label>Last name</Label>
                          <Input value={lastName} onChangeText={setLastName} placeholder="Doe" autoCapitalize="words" />
                        </View>
                      </View>
                      <View style={styles.field}>
                        <Label>Email</Label>
                        <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
                      </View>
                      <View style={styles.field}>
                        <Label>Password</Label>
                        <Input value={password} onChangeText={setPassword} secureTextEntry autoCorrect={false} />
                      </View>
                      <Card style={styles.helperCard}>
                        <View style={styles.helperRow}>
                          <ShieldCheck size={18} color={colors.primary} />
                          <Text style={styles.helperTitle}>Password requirements</Text>
                        </View>
                        <Text style={styles.helperBody}>Use at least 8 characters, one uppercase letter, one number, and one symbol.</Text>
                      </Card>
                      <View style={styles.actions}>
                        <View style={styles.ctaBubble}>
                          <Button size="lg" onPress={() => void stepAction()} loading={loading} disabled={!canContinue} style={styles.primaryButton}>
                            Continue
                          </Button>
                        </View>
                        <Pressable onPress={() => switchMode('login')} style={styles.secondaryLink}>
                          <Text style={styles.secondaryLinkText}>Already have an account? Sign in</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}

                  {step === 1 ? (
                    <>
                      <View style={styles.doubleRow}>
                        <View style={[styles.field, styles.half]}>
                          <Label>Age</Label>
                          <Input value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="29" />
                        </View>
                        <View style={[styles.field, styles.half]}>
                          <Label>Blood type</Label>
                          <View style={styles.chipWrap}>
                            {BLOOD_TYPES.map((entry) => {
                              const active = bloodType === entry;
                              return (
                                <Pressable key={entry} onPress={() => setBloodType(entry)} style={[styles.smallChip, active && styles.smallChipActive]}>
                                  <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{entry}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                      <View style={styles.doubleRow}>
                        <View style={[styles.field, styles.half]}>
                          <Label>Height (cm)</Label>
                          <Input value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="172" />
                        </View>
                        <View style={[styles.field, styles.half]}>
                          <Label>Weight (kg)</Label>
                          <Input value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="68" />
                        </View>
                      </View>
                      <View style={styles.field}>
                        <Label>Gender</Label>
                        <View style={styles.chipWrap}>
                          {GENDERS.map((entry) => {
                            const active = gender === entry.value;
                            return (
                              <Pressable key={entry.value} onPress={() => setGender(entry.value)} style={[styles.choiceChip, active && styles.choiceChipActive]}>
                                <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{entry.label}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                      <View style={styles.actions}>
                        <View style={styles.ctaBubble}>
                          <Button size="lg" onPress={() => void stepAction()} loading={loading} disabled={!canContinue} style={styles.primaryButton}>
                            Continue
                          </Button>
                        </View>
                        <Pressable onPress={() => switchMode('login')} style={styles.secondaryLink}>
                          <Text style={styles.secondaryLinkText}>Already have an account? Sign in</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}

                  {step === 2 ? (
                    <>
                      <FieldGroup title="Medications">
                        <View style={styles.doubleRow}>
                          <Input style={styles.flexInput} value={medicationName} onChangeText={setMedicationName} placeholder="Medication name" />
                          <Input style={styles.flexInput} value={medicationDosage} onChangeText={setMedicationDosage} placeholder="Dose or schedule" />
                        </View>
                        <Button variant="outline" size="sm" onPress={addMedication} style={styles.inlineButton}>Add medication</Button>
                        <ChipList items={medications.map((item) => `${item.name}${item.dosage ? ` - ${item.dosage}` : ''}`)} onRemove={(index) => setMedications((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                      </FieldGroup>

                      <FieldGroup title="Allergies">
                        <Input value={allergyName} onChangeText={setAllergyName} placeholder="Allergen" />
                        <View style={styles.chipWrap}>
                          {(['mild', 'moderate', 'severe'] as Severity[]).map((entry) => {
                            const active = allergySeverity === entry;
                            return (
                              <Pressable key={entry} onPress={() => setAllergySeverity(entry)} style={[styles.smallChip, active && styles.smallChipActive]}>
                                <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{entry}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Button variant="outline" size="sm" onPress={addAllergy} style={styles.inlineButton}>Add allergy</Button>
                        <ChipList items={allergies.map((item) => `${item.allergen} - ${item.severity}`)} onRemove={(index) => setAllergies((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                      </FieldGroup>

                      <FieldGroup title="Vaccines">
                        <Input value={vaccineName} onChangeText={setVaccineName} placeholder="Vaccine name" />
                        <Input value={vaccineProvider} onChangeText={setVaccineProvider} placeholder="Provider or clinic" />
                        <View style={styles.doubleRow}>
                          <Input style={styles.flexInput} value={vaccineDate} onChangeText={setVaccineDate} autoCapitalize="none" autoCorrect={false} placeholder="Date (YYYY-MM-DD)" />
                          <Button variant="outline" size="sm" onPress={addVaccine} style={styles.dateButton}>Add</Button>
                        </View>
                        <ChipList items={vaccines.map((item) => [item.name, item.provider, item.date ? item.date.slice(0, 10) : undefined].filter(Boolean).join(' - '))} onRemove={(index) => setVaccines((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                      </FieldGroup>

                      <FieldGroup title="Illnesses or chronic conditions">
                        <View style={styles.doubleRow}>
                          <Input style={styles.flexInput} value={illnessInput} onChangeText={setIllnessInput} placeholder="Add condition" />
                          <Button variant="outline" size="sm" onPress={() => addStringItem(illnessInput, 'condition', setIllnesses, () => setIllnessInput(''))} style={styles.dateButton}>Add</Button>
                        </View>
                        <ChipList items={illnesses} onRemove={(index) => setIllnesses((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                      </FieldGroup>

                      <FieldGroup title="Disabilities or accessibility needs">
                        <View style={styles.doubleRow}>
                          <Input style={styles.flexInput} value={disabilityInput} onChangeText={setDisabilityInput} placeholder="Add disability or need" />
                          <Button variant="outline" size="sm" onPress={() => addStringItem(disabilityInput, 'need', setDisabilities, () => setDisabilityInput(''))} style={styles.dateButton}>Add</Button>
                        </View>
                        <ChipList items={disabilities} onRemove={(index) => setDisabilities((current) => current.filter((_, itemIndex) => itemIndex !== index))} />
                      </FieldGroup>
                      <View style={styles.actions}>
                        <View style={styles.ctaBubble}>
                          <Button size="lg" onPress={() => void stepAction()} loading={loading} disabled={!canContinue} style={styles.primaryButton}>
                            Create secure account
                          </Button>
                        </View>
                        <Pressable onPress={() => switchMode('login')} style={styles.secondaryLink}>
                          <Text style={styles.secondaryLinkText}>Already have an account? Sign in</Text>
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipList({ items, onRemove }: { items: string[]; onRemove: (index: number) => void }) {
  if (!items.length) return null;
  return (
    <View style={styles.chipWrap}>
      {items.map((item, index) => (
        <Pressable key={`${item}-${index}`} onPress={() => onRemove(index)} style={styles.tokenChip}>
          <Text style={styles.tokenChipText}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
    backgroundColor: colors.primaryStrong,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  glowOne: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 9999,
    backgroundColor: colors.primary,
    opacity: 0.55,
  },
  glowTwo: {
    position: 'absolute',
    bottom: -100,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 9999,
    backgroundColor: colors.accent,
    opacity: 0.18,
  },
  safe: { flex: 1 },
  scrollFlex: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  brandPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  headerSpacer: {
    width: 44,
  },
  heroCopy: {
    gap: 8,
    marginBottom: 22,
    paddingHorizontal: 4,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 18,
    gap: 16,
    ...shadows.floating,
  },
  modeSwitch: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
  },
  modeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  modeChipActive: { backgroundColor: colors.card },
  modeChipText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  modeChipTextActive: { color: colors.primaryStrong },
  stepper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepperItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  stepDotActive: { backgroundColor: colors.primary },
  stepDotDone: { backgroundColor: colors.success },
  stepDotText: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: '700',
  },
  stepDotTextActive: { color: '#fff' },
  stepLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  stepLabelActive: { color: colors.primaryStrong },
  form: { gap: 14 },
  field: { gap: 8 },
  fieldGroup: { gap: 10 },
  groupTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  half: { flex: 1 },
  flexInput: { flex: 1 },
  helperCard: {
    padding: 14,
    gap: 6,
    backgroundColor: colors.infoSoft,
    borderColor: '#D7E5FF',
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helperTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '700',
  },
  helperBody: {
    color: colors.primaryStrong,
    fontSize: 12,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  choiceChipActive: { backgroundColor: colors.primary },
  choiceChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  choiceChipTextActive: { color: '#fff' },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  smallChipActive: { backgroundColor: colors.primary },
  smallChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  smallChipTextActive: { color: '#fff' },
  tokenChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  tokenChipText: {
    color: colors.accentForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineButton: {
    alignSelf: 'flex-start',
  },
  dateButton: {
    minWidth: 76,
  },
  actions: {
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  ctaBubble: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  primaryButton: {
    width: 236,
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.full,
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  secondaryLinkText: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  demoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  demoLinkText: {
    color: colors.primaryStrong,
    fontSize: 13,
    fontWeight: '700',
  },
});
