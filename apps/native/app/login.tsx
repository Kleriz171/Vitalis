import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { api, PRIVACY_URL } from '@/lib/api';
import { setSession } from '@/lib/store';
import { colors, radius, shadows } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';
import { isE164, toE164 } from '@/lib/geo';

type Step = 'phone' | 'code' | 'about' | 'passport' | 'email';
type Severity = 'mild' | 'moderate' | 'severe';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEVERITIES: Severity[] = ['mild', 'moderate', 'severe'];
const severityLabels: Record<Severity, string> = { mild: t('Mild'), moderate: t('Moderate'), severe: t('Severe') };
const RESEND_SECONDS = 30;


const errorText = (e: any) => apiError(e, 'Check your connection and try again.');

/** YYYY-MM-DD from separate fields, or null when it is not a real past date. */
const isoDob = (d: string, m: string, y: string) => {
  const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (y.length !== 4 || Number.isNaN(date.getTime()) || !date.toISOString().startsWith(iso)) return null;
  const years = (Date.now() - date.getTime()) / (365.25 * 24 * 3600_000);
  return years >= 0 && years <= 130 ? iso : null;
};

export default function SignIn() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [step, setStep] = useState<Step>('phone');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const [phoneRaw, setPhoneRaw] = useState('');
  const phone = toE164(phoneRaw);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [signupToken, setSignupToken] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhoneRaw, setContactPhoneRaw] = useState('');
  const contactPhone = toE164(contactPhoneRaw);

  // Passport answers: null = not answered yet. Every question needs an answer.
  const [bloodType, setBloodType] = useState<string | null>(null);
  const [hasAllergies, setHasAllergies] = useState<boolean | null>(null);
  const [allergies, setAllergies] = useState<{ allergen: string; severity: Severity }[]>([]);
  const [hasMeds, setHasMeds] = useState<boolean | null>(null);
  const [meds, setMeds] = useState<{ name: string; dosage?: string }[]>([]);
  const [hasConditions, setHasConditions] = useState<boolean | null>(null);
  const [conditions, setConditions] = useState<string[]>([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (step !== 'code') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(errorText(e)); } finally { setBusy(false); }
  };

  const signedIn = (data: any) => {
    dispatch(setSession(data));
    router.replace('/(tabs)/home');
  };

  const sendCode = () => run(async () => {
    const { data } = await api.post('/auth/phone/start', { phone });
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
    setCode(__DEV__ && data.devCode ? data.devCode : '');
    setStep('code');
  });

  const verify = (value = code) => run(async () => {
    const { data } = await api.post('/auth/phone/verify', { phone, code: value });
    if (!data.isNew) return signedIn(data);
    setSignupToken(data.signupToken);
    setStep('about');
  });

  const register = () => run(async () => {
    const { data } = await api.post('/auth/phone/register', {
      signupToken,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: isoDob(day, month, year),
      emergencyContact: { name: contactName.trim(), phone: contactPhone },
      bloodType,
      allergies: hasAllergies ? allergies : [],
      medications: hasMeds ? meds : [],
      conditions: hasConditions ? conditions : [],
      consent,
    });
    signedIn(data);
  });

  const emailSignIn = () => run(async () => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (['eso', 'admin', 'dispatcher'].includes(data.user.role)) {
      toast.error(t('This account is for the Vitalis desktop console.'));
      return;
    }
    signedIn(data);
  });

  const back = () => {
    if (step === 'code' || step === 'email') setStep('phone');
    else if (step === 'passport') setStep('about');
    else if (step === 'about') setStep('phone'); // token stays valid 30 min; re-verify is cheap
    else router.back();
  };

  const aboutDone = firstName.trim() && lastName.trim() && isoDob(day, month, year)
    && contactName.trim() && isE164(contactPhone) && contactPhone !== phone;
  const answered = (has: boolean | null, n: number) => has === false || (has === true && n > 0);
  const passportDone = consent && bloodType !== null
    && answered(hasAllergies, allergies.length) && answered(hasMeds, meds.length) && answered(hasConditions, conditions.length);

  const screens: Record<Step, { title: string; subtitle: string; body: ReactNode; cta: ReactNode }> = {
    phone: {
      title: t('Your phone number'),
      subtitle: t("We'll text you a 6-digit code. There is no password to remember."),
      body: (
        <>
          <Field
            label={t("Mobile number")}
            value={phoneRaw}
            onChangeText={setPhoneRaw}
            placeholder="069 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoFocus
          />
        </>
      ),
      cta: <Button size="lg" style={styles.primaryButton} onPress={sendCode} loading={busy} disabled={!isE164(phone)}>{t("Send code")}</Button>,
    },
    code: {
      title: t('Enter the code'),
      subtitle: t('Sent by SMS to {phone}.', { phone }),
      body: (
        <>
          <Input
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              if (digits.length === 6) void verify(digits);
            }}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
            accessibilityLabel={t('6-digit code')}
            style={styles.codeInput}
          />
          <Button variant="ghost" onPress={sendCode} disabled={resendIn > 0 || busy}>
            {resendIn > 0 ? t('Send a new code in {n} s', { n: resendIn }) : t('Send a new code')}
          </Button>
        </>
      ),
      cta: <Button size="lg" style={styles.primaryButton} onPress={() => verify()} loading={busy} disabled={code.length !== 6}>{t("Continue")}</Button>,
    },
    about: {
      title: t('About you'),
      subtitle: t('Paramedics see this when you call for help. Step 1 of 2.'),
      body: (
        <>
          <View style={styles.doubleRow}>
            <Field grow={1} label={t("First name")} value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" />
            <Field grow={1} label={t("Last name")} value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" />
          </View>
          <Text style={styles.label}>{t("Date of birth")}</Text>
          <View style={styles.doubleRow}>
            <Field grow={1} label={t("Day")} hideLabel value={day} onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))} placeholder={t("DD")} keyboardType="number-pad" />
            <Field grow={1} label={t("Month")} hideLabel value={month} onChangeText={(v) => setMonth(v.replace(/\D/g, '').slice(0, 2))} placeholder={t("MM")} keyboardType="number-pad" />
            <Field label={t("Year")} hideLabel value={year} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} placeholder={t("YYYY")} keyboardType="number-pad" grow={1.6} />
          </View>
          {day && month && year.length === 4 && !isoDob(day, month, year) ? (
            <Text style={styles.error}>{t("That date doesn't exist. Check the day and month.")}</Text>
          ) : null}
          <Text style={[styles.label, { marginTop: 8 }]}>{t("Emergency contact")}</Text>
          <Text style={styles.hint}>{t("Someone we can call if you can't answer.")}</Text>
          <Field label={t("Their name")} value={contactName} onChangeText={setContactName} />
          <Field label={t("Their phone")} value={contactPhoneRaw} onChangeText={setContactPhoneRaw} placeholder="069 123 4567" keyboardType="phone-pad" />
          {contactPhoneRaw && contactPhone === phone ? (
            <Text style={styles.error}>{t("Use someone else's number, not your own.")}</Text>
          ) : null}
        </>
      ),
      cta: <Button size="lg" style={styles.primaryButton} onPress={() => setStep('passport')} disabled={!aboutDone}>{t("Continue")}</Button>,
    },
    passport: {
      title: t('Your Bio Passport'),
      subtitle: t('Answer each question. “I don’t know” and “None” are good answers; a guess is not. Step 2 of 2.'),
      body: (
        <>
          <Question title={t("Blood type")}>
            <View style={styles.chipWrap}>
              {BLOOD_TYPES.map((b) => <Chip key={b} label={b} active={bloodType === b} onPress={() => setBloodType(b)} />)}
              <Chip label={t("I don't know")} active={bloodType === 'unknown'} onPress={() => setBloodType('unknown')} />
            </View>
          </Question>

          <YesNo title={t("Allergies")} has={hasAllergies} setHas={setHasAllergies}>
            <ItemEditor
              items={allergies.map((a) => `${a.allergen} (${severityLabels[a.severity].toLowerCase()})`)}
              onRemove={(i) => setAllergies(allergies.filter((_, j) => j !== i))}
              placeholder={t("e.g. Penicillin")}
              withSeverity
              onAdd={(allergen, severity) => setAllergies([...allergies, { allergen, severity: severity! }])}
            />
          </YesNo>

          <YesNo title={t("Medication you take regularly")} has={hasMeds} setHas={setHasMeds}>
            <ItemEditor
              items={meds.map((m) => m.name)}
              onRemove={(i) => setMeds(meds.filter((_, j) => j !== i))}
              placeholder={t("e.g. Salbutamol inhaler")}
              onAdd={(name) => setMeds([...meds, { name }])}
            />
          </YesNo>

          <YesNo title={t("Conditions")} has={hasConditions} setHas={setHasConditions}>
            <ItemEditor
              items={conditions}
              onRemove={(i) => setConditions(conditions.filter((_, j) => j !== i))}
              placeholder={t("e.g. Asthma, diabetes, epilepsy")}
              onAdd={(name) => setConditions([...conditions, name])}
            />
          </YesNo>

          {/* Health data needs explicit consent (Albanian data-protection law, GDPR-style). */}
          <Pressable
            style={styles.consentRow}
            onPress={() => setConsent(c => !c)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
          >
            <View style={[styles.consentBox, consent && styles.consentBoxOn]}>
              {consent ? <Check size={16} color="#fff" /> : null}
            </View>
            <Text style={styles.consentText}>
              {t('I agree that Vitalis stores my health information and shows it to responders and dispatchers when I send an SOS.')}{' '}
              <Text style={styles.consentLink} onPress={() => void Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                {t('Privacy policy')}
              </Text>
            </Text>
          </Pressable>
        </>
      ),
      cta: <Button size="lg" style={styles.primaryButton} onPress={register} loading={busy} disabled={!passportDone}>{t("Create account")}</Button>,
    },
    email: {
      title: t('Sign in with email'),
      subtitle: t('For accounts created with an email address.'),
      body: (
        <>
          <Field label={t("Email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" />
          <Field label={t("Password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        </>
      ),
      cta: <Button size="lg" style={styles.primaryButton} onPress={emailSignIn} loading={busy} disabled={!email.trim() || !password}>{t("Sign in")}</Button>,
    },
  };
  const s = screens[step];
  const signingUp = step === 'about' || step === 'passport';

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
            <Pressable onPress={back} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('Back')}>
              <ArrowLeft size={18} color="#fff" />
            </Pressable>
            <View style={styles.brandPill}>
              <Logo size={18} />
              <Text style={styles.brandPillText}>VITALIS</Text>
            </View>
            <View style={styles.headerSpacer} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(60).duration(360)} style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{signingUp ? t('Guided registration') : t('Secure sign in')}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.subtitle}>{s.subtitle}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(380)} style={styles.card}>
            {step === 'phone' || step === 'email' ? (
              <View style={styles.modeSwitch}>
                {(['phone', 'email'] as const).map((entry) => {
                  const active = step === entry;
                  return (
                    <Pressable key={entry} onPress={() => setStep(entry)} style={[styles.modeChip, active && styles.modeChipActive]}>
                      <Text style={[styles.modeChipText, active && styles.modeChipTextActive]}>
                        {entry === 'phone' ? t('Phone') : t('Email')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {signingUp ? (
              <View style={styles.stepper}>
                {(['about', 'passport'] as const).map((entry, i) => {
                  const active = step === entry;
                  const done = step === 'passport' && entry === 'about';
                  return (
                    <View key={entry} style={styles.stepperItem}>
                      <View style={[styles.stepDot, active && styles.stepDotActive, done && styles.stepDotDone]}>
                        {done ? <Check size={12} color="#fff" /> : <Text style={[styles.stepDotText, active && styles.stepDotTextActive]}>{i + 1}</Text>}
                      </View>
                      <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>
                        {entry === 'about' ? t('About you') : t('Bio Passport')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.form}>
              {s.body}
              <View style={styles.actions}>
                {s.cta}
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

/** `grow` only for fields laid out side by side in a row. */
function Field({ label, hideLabel, grow, ...props }: { label: string; hideLabel?: boolean; grow?: number } & TextInputProps) {
  return (
    <View style={[styles.field, grow ? { flex: grow } : null]}>
      {hideLabel ? null : <Label>{label}</Label>}
      <Input accessibilityLabel={label} {...props} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choiceChip, active && styles.choiceChipActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.choiceChipText, active && styles.choiceChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.groupTitle}>{title}</Text>
      {children}
    </View>
  );
}

function YesNo({ title, has, setHas, children }: { title: string; has: boolean | null; setHas: (v: boolean) => void; children: ReactNode }) {
  return (
    <Question title={title}>
      <View style={styles.chipWrap}>
        <Chip label={t('None')} active={has === false} onPress={() => setHas(false)} />
        <Chip label={t('Yes')} active={has === true} onPress={() => setHas(true)} />
      </View>
      {has ? children : null}
    </Question>
  );
}

function ItemEditor({ items, onRemove, onAdd, placeholder, withSeverity }: {
  items: string[];
  onRemove: (i: number) => void;
  onAdd: (text: string, severity?: Severity) => void;
  placeholder: string;
  withSeverity?: boolean;
}) {
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState<Severity | null>(null);
  const ready = text.trim() && (!withSeverity || severity);
  const add = () => {
    if (!ready) return;
    onAdd(text.trim(), severity ?? undefined);
    setText('');
    setSeverity(null);
  };
  return (
    <View style={{ gap: 10 }}>
      {items.length ? (
        <View style={styles.chipWrap}>
          {items.map((item, i) => (
            <Pressable key={`${item}-${i}`} onPress={() => onRemove(i)} style={styles.tokenChip} accessibilityRole="button" accessibilityLabel={t('Remove {item}', { item })}>
              <Text style={styles.tokenChipText}>{item}</Text>
              <X size={12} color={colors.primaryStrong} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <Input value={text} onChangeText={setText} placeholder={placeholder} onSubmitEditing={add} returnKeyType="done" accessibilityLabel={placeholder} />
      {withSeverity && text.trim() ? (
        <View style={styles.chipWrap}>
          {SEVERITIES.map((sv) => (
            <Chip key={sv} label={severityLabels[sv]} active={severity === sv} onPress={() => setSeverity(sv)} />
          ))}
        </View>
      ) : null}
      <Button variant="outline" onPress={add} disabled={!ready}>{items.length ? t('Add another') : t('Add')}</Button>
    </View>
  );
}

const styles = StyleSheet.create({
  // New sign-in steps (phone code, validation lines) in the same look.
  label: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  hint: { color: colors.mutedForeground, fontSize: 13, marginTop: -8 },
  error: { color: colors.destructive, fontSize: 13 },
  codeInput: { height: 64, fontSize: 30, letterSpacing: 12, textAlign: 'center', fontVariant: ['tabular-nums'] },
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
  consentRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 },
  consentBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, marginTop: 1,
  },
  consentBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  consentText: { flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 20 },
  consentLink: { color: colors.primaryStrong, fontWeight: '700', textDecorationLine: 'underline' },
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
  primaryButton: {
    alignSelf: 'stretch',
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
