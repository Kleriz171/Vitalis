import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft, FileText, Stethoscope, Upload } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

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
      toast.error('Please complete every field');
      return;
    }
    if (!pdf) {
      toast.error('Attach your specialty certification PDF');
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
      toast.success('Application submitted', { description: 'An admin will review and let you know.' });
      router.back();
    } catch (e: any) {
      toast.error('Submission failed', { description: e.response?.data?.error ?? 'Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen
        tone="info"
        eyebrow="Care providers"
        title="Apply to join as a doctor"
        subtitle="Submit your credentials. An administrator reviews every application."
        icon={<Stethoscope size={22} color="#fff" />}
        action={
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={16} color="#fff" />
          </Pressable>
        }
      >
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 32 }}>
          <Card style={styles.card}>
            <View style={styles.field}><Label>Full name</Label><Input value={fullName} onChangeText={setFullName} placeholder="Dr. Jane Doe" /></View>
            <View style={styles.field}><Label>Email</Label><Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" /></View>
            <View style={styles.field}><Label>Phone (with country code, used for WhatsApp)</Label><Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+355691234567" /></View>
            <View style={styles.field}><Label>Specialty</Label><Input value={specialty} onChangeText={setSpecialty} placeholder="Cardiology" /></View>
            <View style={styles.field}><Label>Years of experience</Label><Input value={yearsExperience} onChangeText={setYearsExperience} keyboardType="number-pad" placeholder="8" /></View>
            <View style={styles.field}><Label>Bio</Label><Input value={bio} onChangeText={setBio} multiline placeholder="Tell us about your practice, training, focus areas." style={styles.textarea} /></View>
          </Card>

          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Specialty certification (PDF, required)</Text>
            <Pressable onPress={pickPdf} style={styles.uploadBox}>
              {pdf ? (
                <>
                  <FileText size={20} color={colors.success} />
                  <Text style={styles.uploadName}>{pdf.name}</Text>
                  <Text style={styles.uploadHint}>Tap to choose a different file</Text>
                </>
              ) : (
                <>
                  <Upload size={20} color={colors.info} />
                  <Text style={styles.uploadName}>Tap to attach PDF</Text>
                  <Text style={styles.uploadHint}>Max 10 MB</Text>
                </>
              )}
            </Pressable>
          </Card>

          <Button onPress={submit} loading={submitting}>Submit application</Button>
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
