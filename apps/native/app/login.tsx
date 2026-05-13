import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Check, Heart, ShieldCheck } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { api } from '@/lib/api';
import { setSession } from '@/lib/store';
import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { colors, radius } from '@/lib/theme';

type Mode = 'login' | 'register';
type Step = 0 | 1 | 2;
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
type Gender = 'female' | 'male' | 'non_binary' | 'other' | 'prefer_not_to_say';
type Severity = 'mild' | 'moderate' | 'severe';

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

export default function Login() {
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(modeParam === 'register' ? 'register' : 'login');
  const [step, setStep] = useState<Step>(0);

  const [email, setEmail] = useState('demo@vitalis.dev');
  const [password, setPassword] = useState('demo1234');
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

  const helperText = useMemo(() => {
    if (mode === 'login') return 'Sign in to access SOS, your Bio Passport, and care discovery.';
    return step === 0
      ? 'Step 1 of 3 — create your secure account.'
      : step === 1
      ? 'Step 2 of 3 — add biometric and identity information.'
      : 'Step 3 of 3 — complete your medical Bio Passport.';
  }, [mode, step]);

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
      if (!/\S+@\S+\.\S+/.test(email)) {
        toast.error('Enter a valid email address');
        return false;
      }
      if (!passwordRule.test(password)) {
        toast.error('Password needs 8+ chars, an uppercase, a number, and a symbol');
        return false;
      }
    }
    if (step === 1) {
      if (!age || !gender || !heightCm || !weightKg || !bloodType) {
        toast.error('Complete all biometric fields');
        return false;
      }
    }
    return true;
  };

  const addMedication = () => {
    if (!medicationName.trim()) return;
    setMedications((current) => [...current, { name: medicationName.trim(), dosage: medicationDosage.trim() || undefined, isActive: true }]);
    setMedicationName('');
    setMedicationDosage('');
  };

  const addAllergy = () => {
    if (!allergyName.trim()) return;
    setAllergies((current) => [...current, { allergen: allergyName.trim(), severity: allergySeverity }]);
    setAllergyName('');
  };

  const addVaccine = () => {
    if (!vaccineName.trim()) return;
    setVaccines((current) => [
      ...current,
      { name: vaccineName.trim(), provider: vaccineProvider.trim() || undefined, date: vaccineDate.trim() ? new Date(`${vaccineDate.trim()}T00:00:00.000Z`).toISOString() : undefined },
    ]);
    setVaccineName('');
    setVaccineProvider('');
    setVaccineDate('');
  };

  const addStringItem = (value: string, setter: Dispatch<SetStateAction<string[]>>, reset: () => void) => {
    const normalized = value.trim();
    if (!normalized) return;
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
      <AppScreen
        tone="primary"
        eyebrow={mode === 'login' ? 'Secure sign in' : 'Guided registration'}
        title={mode === 'login' ? 'Welcome back.' : 'Create your medical passport.'}
        subtitle={helperText}
        icon={<Heart size={24} color="#fff" fill="#fff" />}
        action={
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
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        }
      >
        <Card style={styles.card}>
          <View style={styles.modeSwitch}>
            {(['login', 'register'] as Mode[]).map((entry) => {
              const active = mode === entry;
              return (
                <Pressable
                  key={entry}
                  onPress={() => {
                    setMode(entry);
                    setStep(0);
                  }}
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
                      {done ? <Check size={12} color="#fff" /> : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{entry + 1}</Text>}
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
                <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              </View>
              <View style={styles.field}>
                <Label>Password</Label>
                <Input value={password} onChangeText={setPassword} secureTextEntry />
              </View>
            </View>
          ) : (
            <Animated.View key={`step-${step}`} entering={FadeInRight.duration(220)} exiting={FadeOutLeft.duration(180)}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.form}>
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
                      <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                    </View>
                    <View style={styles.field}>
                      <Label>Password</Label>
                      <Input value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 chars, uppercase, number, symbol" />
                    </View>
                    <Card style={styles.helperCard}>
                      <View style={styles.helperRow}>
                        <ShieldCheck size={18} color={colors.primary} />
                        <Text style={styles.helperTitle}>Password requirements</Text>
                      </View>
                      <Text style={styles.helperBody}>Use at least 8 characters, one uppercase letter, one number, and one symbol.</Text>
                    </Card>
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
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <View style={styles.field}>
                      <Label>Medications</Label>
                      <View style={styles.doubleRow}>
                        <Input style={styles.flexInput} value={medicationName} onChangeText={setMedicationName} placeholder="Medication name" />
                        <Input style={styles.flexInput} value={medicationDosage} onChangeText={setMedicationDosage} placeholder="Dose or schedule" />
                      </View>
                      <Button variant="outline" size="sm" onPress={addMedication}>Add medication</Button>
                      <ChipList items={medications.map(item => `${item.name}${item.dosage ? ` • ${item.dosage}` : ''}`)} onRemove={(index) => setMedications(current => current.filter((_, itemIndex) => itemIndex !== index))} />
                    </View>

                    <View style={styles.field}>
                      <Label>Allergies</Label>
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
                      <Button variant="outline" size="sm" onPress={addAllergy}>Add allergy</Button>
                      <ChipList items={allergies.map(item => `${item.allergen} • ${item.severity}`)} onRemove={(index) => setAllergies(current => current.filter((_, itemIndex) => itemIndex !== index))} />
                    </View>

                    <View style={styles.field}>
                      <Label>Vaccines</Label>
                      <Input value={vaccineName} onChangeText={setVaccineName} placeholder="Vaccine name" />
                      <Input value={vaccineProvider} onChangeText={setVaccineProvider} placeholder="Provider or clinic" />
                      <View style={styles.inlineRow}>
                        <Input style={styles.flexInput} value={vaccineDate} onChangeText={setVaccineDate} placeholder="Date (YYYY-MM-DD)" autoCapitalize="none" />
                        <Button variant="outline" size="sm" onPress={addVaccine}>Add</Button>
                      </View>
                      <ChipList
                        items={vaccines.map(item =>
                          [item.name, item.provider, item.date ? item.date.slice(0, 10) : undefined].filter(Boolean).join(' • ')
                        )}
                        onRemove={(index) => setVaccines(current => current.filter((_, itemIndex) => itemIndex !== index))}
                      />
                    </View>

                    <View style={styles.field}>
                      <Label>Illnesses or chronic conditions</Label>
                      <View style={styles.inlineRow}>
                        <Input style={styles.flexInput} value={illnessInput} onChangeText={setIllnessInput} placeholder="Add condition" />
                        <Button variant="outline" size="sm" onPress={() => addStringItem(illnessInput, setIllnesses, () => setIllnessInput(''))}>Add</Button>
                      </View>
                      <ChipList items={illnesses} onRemove={(index) => setIllnesses(current => current.filter((_, itemIndex) => itemIndex !== index))} />
                    </View>

                    <View style={styles.field}>
                      <Label>Disabilities or accessibility needs</Label>
                      <View style={styles.inlineRow}>
                        <Input style={styles.flexInput} value={disabilityInput} onChangeText={setDisabilityInput} placeholder="Add disability or need" />
                        <Button variant="outline" size="sm" onPress={() => addStringItem(disabilityInput, setDisabilities, () => setDisabilityInput(''))}>Add</Button>
                      </View>
                      <ChipList items={disabilities} onRemove={(index) => setDisabilities(current => current.filter((_, itemIndex) => itemIndex !== index))} />
                    </View>
                  </>
                ) : null}
              </ScrollView>
            </Animated.View>
          )}

          <Button onPress={() => void stepAction()} loading={loading} size="lg" style={styles.primaryButton}>
            {mode === 'login' ? 'Sign in to Vitalis' : step === 2 ? 'Create secure account' : 'Continue'}
          </Button>
        </Card>
      </AppScreen>
    </KeyboardAvoidingView>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  card: {
    padding: 18,
    gap: 16,
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
  modeChipText: { color: colors.mutedForeground, fontSize: 14, fontWeight: '600' },
  modeChipTextActive: { color: colors.foreground },
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
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepDotDone: {
    backgroundColor: colors.success,
  },
  stepDotText: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: '700',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLabel: {
    color: colors.mutedForeground,
    fontSize: 11,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: colors.foreground,
  },
  form: {
    gap: 14,
  },
  field: {
    gap: 8,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  half: {
    flex: 1,
  },
  flexInput: {
    flex: 1,
  },
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
    color: colors.mutedForeground,
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
  choiceChipActive: {
    backgroundColor: colors.primary,
  },
  choiceChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '600',
  },
  choiceChipTextActive: {
    color: '#fff',
  },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  smallChipActive: {
    backgroundColor: colors.primary,
  },
  smallChipText: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  smallChipTextActive: {
    color: '#fff',
  },
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
  primaryButton: {
    backgroundColor: colors.primaryStrong,
  },
});
