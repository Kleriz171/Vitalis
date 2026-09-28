import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, FileText, Stethoscope, Upload } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen, HeaderButton } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';

export default function DoctorApplication() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [bio, setBio] = useState('');
  const [pdf, setPdf] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPdf({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType });
  };

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim() || !specialty.trim() || !yearsExperience.trim() || !bio.trim()) {
      toast.error(t('Please complete every field'));
      return;
    }
    if (!pdf) {
      toast.error(t('Attach your specialty certification PDF'));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('fullName', fullName);
      form.append('email', email);
      form.append('phone', phone);
      form.append('specialty', specialty);
      form.append('yearsExperience', yearsExperience);
      form.append('bio', bio);
      form.append('certificate', {
        uri: pdf.uri,
        name: pdf.name,
        type: pdf.mimeType ?? 'application/pdf',
      } as unknown as Blob);
      await api.post('/doctor-applications', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('Application submitted'), { description: t('An admin will review and let you know.') });
      router.back();
    } catch (e: any) {
      toast.error(t('Submission failed'), { description: apiError(e, 'Try again.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen
        title={t('Apply to join as a doctor')}
        subtitle={t('Submit your credentials. An administrator reviews every application.')}
        action={<HeaderButton icon={ArrowLeft} onPress={() => router.back()} label={t('Back')} />}
      >
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
          <Card style={styles.card}>
            <View style={styles.field}><Label>{t('Full name')}</Label><Input value={fullName} onChangeText={setFullName} placeholder={t('Dr. Jane Doe')} /></View>
            <View style={styles.field}><Label>{t('Email')}</Label><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder={t('you@example.com')} /></View>
            <View style={styles.field}><Label>{t('Phone (with country code, used for WhatsApp)')}</Label><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+355691234567" /></View>
            <View style={styles.field}><Label>{t('Specialty')}</Label><Input value={specialty} onChangeText={setSpecialty} placeholder={t('Cardiology')} /></View>
            <View style={styles.field}><Label>{t('Years of experience')}</Label><Input value={yearsExperience} onChangeText={setYearsExperience} keyboardType="number-pad" placeholder="8" /></View>
            <View style={styles.field}><Label>{t('Bio')}</Label><Input value={bio} onChangeText={setBio} multiline placeholder={t('Tell us about your practice, training, focus areas.')} style={styles.textarea} /></View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>{t('Specialty certification (PDF, required)')}</Text>
            <Pressable onPress={pickPdf} style={styles.uploadBox}>
              {pdf ? (
                <>
                  <FileText size={20} color={colors.success} />
                  <Text style={styles.uploadName}>{pdf.name}</Text>
                  <Text style={styles.uploadHint}>{t('Tap to choose a different file')}</Text>
                </>
              ) : (
                <>
                  <Upload size={20} color={colors.info} />
                  <Text style={styles.uploadName}>{t('Tap to attach PDF')}</Text>
                  <Text style={styles.uploadHint}>{t('Max 10 MB')}</Text>
                </>
              )}
            </Pressable>
          </Card>

          <Button onPress={submit} loading={submitting}>{t('Submit application')}</Button>
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  card: { padding: 16, gap: 12 },
  field: { gap: 8 },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  uploadBox: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    padding: 24, borderRadius: radius.lg, alignItems: 'center', gap: 8, backgroundColor: colors.background,
  },
  uploadName: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  uploadHint: { color: colors.mutedForeground, fontSize: 12 },
});
