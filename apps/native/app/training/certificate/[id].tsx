import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, ArrowLeft, Share2 } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';

interface CertificateView {
  id: string;
  courseSlug: string;
  badgeLabel: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  shareToken: string;
  qr: string;
  verifyUrl: string;
}

export default function CertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cert, setCert] = useState<CertificateView | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<CertificateView>(`/training/certifications/${id}`);
      setCert(data);
    } catch (err: any) {
      toast.error('Could not load certificate', { description: err.response?.data?.error ?? 'Try again.' });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const share = async () => {
    if (!cert) return;
    try {
      await Share.share({
        message: `I'm certified in ${cert.badgeLabel} via Vitalis. Verify: ${cert.verifyUrl}`,
        url: cert.verifyUrl,
      });
    } catch {}
  };

  return (
    <AppScreen
      tone="success"
      eyebrow="First aid certified"
      title={cert?.badgeLabel ?? 'Certificate'}
      subtitle={cert ? `Scored ${cert.score}%` : 'Loading certificate'}
      icon={<Award size={22} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
      footer={
        <Button onPress={share} disabled={!cert}>
          <Share2 size={16} color="#fff" />
          Share certificate
        </Button>
      }
    >
      {!cert ? (
        <Skeleton style={{ height: 320, borderRadius: radius.xl }} />
      ) : (
        <Card style={styles.cert}>
          <Text style={styles.brand}>VITALIS · FIRST AID TRAINING</Text>
          <Text style={styles.title}>This certifies completion of</Text>
          <Text style={styles.badge}>{cert.badgeLabel}</Text>
          <Text style={styles.score}>Score {cert.score}%</Text>

          {cert.qr ? <Image source={{ uri: cert.qr }} style={styles.qr} /> : null}
          <Text style={styles.verify}>{cert.verifyUrl}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{new Date(cert.issuedAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>{new Date(cert.expiresAt).toLocaleDateString()}</Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            Based on Red Cross / ERC guidelines. Educational use only — not a substitute for in-person certified training.
          </Text>
        </Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  cert: {
    padding: 22, gap: 12,
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  brand: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.mutedForeground, fontSize: 13 },
  badge: { color: colors.foreground, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  score: { color: colors.success, fontSize: 14, fontWeight: '700' },
  qr: { width: 200, height: 200, borderRadius: radius.lg, backgroundColor: '#fff' },
  verify: { color: colors.primary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 24, marginTop: 6 },
  metaItem: { alignItems: 'center', gap: 4 },
  metaLabel: { color: colors.mutedForeground, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  metaValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  disclaimer: { color: colors.mutedForeground, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },
});
