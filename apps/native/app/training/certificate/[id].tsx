import { useEffect, useState } from 'react';
import { Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, ArrowLeft, Download, Share2 } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { useSelector } from 'react-redux';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { colors, radius } from '@/lib/theme';
import { apiError, t } from '@/lib/i18n';
import { shareCertificatePdf } from '@/lib/certificatePdf';
import type { RootState } from '@/lib/store';

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
  number: string;
  revoked: boolean;
}

export default function CertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [cert, setCert] = useState<CertificateView | null>(null);
  const [making, setMaking] = useState(false);
  const user = useSelector((s: RootState) => s.auth.user);
  const holder = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || '';

  useEffect(() => {
    api.get<CertificateView>(`/training/certifications/${id}`)
      .then(({ data }) => setCert(data))
      .catch((err) => toast.error(t('Could not load certificate'), { description: apiError(err, 'Try again.') }));
  }, [id]);

  const share = async () => {
    if (!cert) return;
    try {
      await Share.share({
        message: t("I'm certified in {badge} via Vitalis. Verify: {url}", { badge: cert.badgeLabel, url: cert.verifyUrl }),
        url: cert.verifyUrl,
      });
    } catch {}
  };

  const download = async () => {
    if (!cert) return;
    setMaking(true);
    try {
      await shareCertificatePdf({ ...cert, holder });
    } catch {
      toast.error(t('Could not create the PDF'), { description: t('Try again.') });
    } finally {
      setMaking(false);
    }
  };

  return (
    <AppScreen
      tone="success"
      eyebrow={t('First aid certified')}
      title={cert?.badgeLabel ?? t('Certificate')}
      subtitle={cert ? t('Scored {n}%', { n: cert.score }) : t('Loading certificate')}
      icon={<Award size={22} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
      footer={cert?.revoked ? undefined : (
        <View style={styles.actions}>
          <Button onPress={download} disabled={!cert} loading={making} style={styles.action}>
            <Download size={16} color="#fff" />
            {t('Download PDF')}
          </Button>
          <Button variant="outline" onPress={share} disabled={!cert} style={styles.action}>
            <Share2 size={16} color={colors.primary} />
            {t('Share link')}
          </Button>
        </View>
      )}
    >
      {!cert ? (
        <Skeleton style={{ height: 320, borderRadius: radius.xl }} />
      ) : (
        <Card style={styles.cert}>
          <Logo size={48} />
          <Text style={styles.brand}>{t('VITALIS · FIRST AID TRAINING')}</Text>
          {cert.revoked ? (
            <Text style={styles.revoked} accessibilityRole="alert">{t('This certificate was revoked and is no longer valid.')}</Text>
          ) : null}
          {holder ? <Text style={styles.holder}>{holder}</Text> : null}
          <Text style={styles.title}>{t('This certifies completion of')}</Text>
          <Text style={styles.badge}>{cert.badgeLabel}</Text>
          <Text style={styles.score}>{t('Score {n}%', { n: cert.score })}</Text>
          <Text style={styles.number}>{t('Certificate number')} · {cert.number}</Text>

          {cert.qr ? <Image source={{ uri: cert.qr }} style={styles.qr} /> : null}
          <Text style={styles.verify}>{cert.verifyUrl}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t('Issued')}</Text>
              <Text style={styles.metaValue}>{new Date(cert.issuedAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>{t('Valid until')}</Text>
              <Text style={styles.metaValue}>{new Date(cert.expiresAt).toLocaleDateString()}</Text>
            </View>
          </View>

          <Text style={styles.disclaimer}>
            {t('Based on Red Cross / ERC guidelines. Educational use only — not a substitute for in-person certified training.')}
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
  brand: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  title: { color: colors.mutedForeground, fontSize: 13 },
  badge: { color: colors.foreground, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  score: { color: colors.success, fontSize: 14, fontWeight: '700' },
  qr: { width: 200, height: 200, borderRadius: radius.lg, backgroundColor: '#fff' },
  verify: { color: colors.primary, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 24, marginTop: 6 },
  metaItem: { alignItems: 'center', gap: 4 },
  metaLabel: { color: colors.mutedForeground, fontSize: 10, fontWeight: '700' },
  metaValue: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  holder: { color: colors.foreground, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  number: { color: colors.mutedForeground, fontSize: 12, fontWeight: '600' },
  revoked: {
    color: colors.destructive, fontSize: 13, fontWeight: '700', textAlign: 'center',
    backgroundColor: colors.destructiveSoft, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12,
  },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  disclaimer: { color: colors.mutedForeground, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8 },
});
