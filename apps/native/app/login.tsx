import { ReactNode, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInputProps, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { ArrowLeft, X } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { AppScreen, HeaderButton } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { setSession } from '@/lib/store';
import { apiError, t } from '@/lib/i18n';
import { colors, radius, type } from '@/lib/theme';

type Step = 'phone' | 'code' | 'about' | 'passport' | 'email';
type Severity = 'mild' | 'moderate' | 'severe';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const SEVERITIES: Severity[] = ['mild', 'moderate', 'severe'];
const severityLabels: Record<Severity, string> = { mild: t('Mild'), moderate: t('Moderate'), severe: t('Severe') };
const RESEND_SECONDS = 30;

/** Local Albanian formats (069…, 69…, 355…) and 00-prefixed numbers → E.164. */
const toE164 = (raw: string) => {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (d.startsWith('+')) return d;
  if (d.startsWith('355')) return `+${d}`;
  return `+355${d.replace(/^0/, '')}`;
};
const isE164 = (p: string) => /^\+[1-9]\d{7,14}$/.test(p);

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
  const [busy, setBusy] = useState(false);

  const [phoneRaw, setPhoneRaw] = useState('');
  const phone = toE164(phoneRaw);
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
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
    });
    signedIn(data);
  });

  const emailSignIn = () => run(async () => {
    const { data } = await api.post('/auth/login', { email: email.trim(), password });
    if (data.user.role === 'admin' || data.user.role === 'dispatcher') {
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
  const passportDone = bloodType !== null
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
          <Button variant="ghost" onPress={() => setStep('email')}>{t("Sign in with email instead")}</Button>
        </>
      ),
      cta: <Button size="lg" onPress={sendCode} loading={busy} disabled={!isE164(phone)}>{t("Send code")}</Button>,
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
      cta: <Button size="lg" onPress={() => verify()} loading={busy} disabled={code.length !== 6}>{t("Continue")}</Button>,
    },
    about: {
      title: t('About you'),
      subtitle: t('Paramedics see this when you call for help. Step 1 of 2.'),
      body: (
        <>
          <View style={styles.pair}>
            <Field grow={1} label={t("First name")} value={firstName} onChangeText={setFirstName} autoComplete="given-name" textContentType="givenName" />
            <Field grow={1} label={t("Last name")} value={lastName} onChangeText={setLastName} autoComplete="family-name" textContentType="familyName" />
          </View>
          <Text style={styles.label}>{t("Date of birth")}</Text>
          <View style={styles.pair}>
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
      cta: <Button size="lg" onPress={() => setStep('passport')} disabled={!aboutDone}>{t("Continue")}</Button>,
    },
    passport: {
      title: t('Your Bio Passport'),
      subtitle: t('Answer each question. “I don’t know” and “None” are good answers; a guess is not. Step 2 of 2.'),
      body: (
        <>
          <Question title={t("Blood type")}>
            <View style={styles.chips}>
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
        </>
      ),
      cta: <Button size="lg" onPress={register} loading={busy} disabled={!passportDone}>{t("Create account")}</Button>,
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
      cta: <Button size="lg" onPress={emailSignIn} loading={busy} disabled={!email.trim() || !password}>{t("Sign in")}</Button>,
    },
  };
  const s = screens[step];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen
        title={s.title}
        subtitle={s.subtitle}
        action={<HeaderButton icon={ArrowLeft} label={t("Back")} onPress={back} />}
        footer={s.cta}
        scrollProps={{ keyboardShouldPersistTaps: 'handled' }}
      >
        {s.body}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

/** `grow` only for fields laid out side by side in a row. */
function Field({ label, hideLabel, grow, ...props }: { label: string; hideLabel?: boolean; grow?: number } & TextInputProps) {
  return (
    <View style={[{ gap: 6 }, grow ? { flex: grow } : null]}>
      {hideLabel ? null : <Text style={styles.label}>{label}</Text>}
      <Input accessibilityLabel={label} {...props} />
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function YesNo({ title, has, setHas, children }: { title: string; has: boolean | null; setHas: (v: boolean) => void; children: ReactNode }) {
  return (
    <Question title={title}>
      <View style={styles.chips}>
        <Chip label={t("None")} active={has === false} onPress={() => setHas(false)} />
        <Chip label={t("Yes")} active={has === true} onPress={() => setHas(true)} />
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
      {items.map((item, i) => (
        <View key={`${item}-${i}`} style={styles.item}>
          <Text style={styles.itemText}>{item}</Text>
          <Pressable onPress={() => onRemove(i)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('Remove {item}', { item })}>
            <X size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}
      <Input value={text} onChangeText={setText} placeholder={placeholder} onSubmitEditing={add} returnKeyType="done" accessibilityLabel={placeholder} />
      {withSeverity && text.trim() ? (
        <View style={styles.chips}>
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
  label: { ...type.footnote, fontWeight: '600', color: colors.mutedForeground },
  hint: { ...type.footnote, color: colors.mutedForeground, marginTop: -8 },
  error: { ...type.footnote, color: colors.destructive },
  pair: { flexDirection: 'row', gap: 10 },
  codeInput: { height: 64, fontSize: 30, letterSpacing: 12, textAlign: 'center', fontVariant: ['tabular-nums'] },
  question: { gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  questionTitle: { ...type.headline, color: colors.foreground },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primarySurface, borderColor: colors.primarySurface },
  chipText: { ...type.callout, fontWeight: '600', color: colors.foreground },
  chipTextActive: { color: '#fff' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemText: { ...type.callout, flex: 1, color: colors.foreground },
});
