import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { ArrowLeft, Award, BadgeCheck, GraduationCap } from 'lucide-react-native';
import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { roleLabel } from '@/lib/roles';
import { RootState } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { locale, t } from '@/lib/i18n';

type Cert = { id: string; badgeLabel: string; number?: string; issuedAt: string; expiresAt: string; revoked?: boolean };
type Application = { profession: string; specialty: string; status: 'pending' | 'approved' | 'rejected'; reviewedAt?: string };

// A refresher is due this long before a certificate expires.
const REFRESH_MS = 60 * 86_400_000;
const date = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

/** What makes this person a responder: role, verification, certificates and when to refresh them. */
export default function Credentials() {
  const router = useRouter();
  const user = useSelector((s: RootState) => s.auth.user);
  const [certs, setCerts] = useState<Cert[] | null>(null);
  const [apps, setApps] = useState<Application[]>([]);

  useEffect(() => {
    api.get<Cert[]>('/training/certifications').then(r => setCerts(r.data)).catch(() => setCerts([]));
    api.get<Application[]>('/doctor-applications/mine').then(r => setApps(r.data)).catch(() => {});
  }, []);

  const approved = apps.find(a => a.status === 'approved');
  const now = Date.now();
  const state = (c: Cert) => c.revoked ? { label: t('Revoked'), variant: 'outline' as const, note: t('Revoked by Vitalis. Passing the course again does not restore it.') }
    : Date.parse(c.expiresAt) < now ? { label: t('Expired'), variant: 'outline' as const, note: t('Expired on {date}. Retake the course to go on duty again.', { date: date(c.expiresAt) }) }
    : Date.parse(c.expiresAt) - now < REFRESH_MS ? { label: t('Refresher due'), variant: 'secondary' as const, note: t('Valid until {date}. Retake the course before then.', { date: date(c.expiresAt) }) }
    : { label: t('Valid'), variant: 'default' as const, note: t('Valid until {date}. Refresher from {from}.', { date: date(c.expiresAt), from: date(new Date(Date.parse(c.expiresAt) - REFRESH_MS).toISOString()) }) };

  return (
    <AppScreen
      tone="dark"
      title={t('My credentials')}
      subtitle={roleLabel(user?.role)}
      icon={<BadgeCheck size={20} color="#fff" />}
      action={
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel={t('Back')}>
          <ArrowLeft size={16} color="#fff" />
        </Pressable>
      }
    >
      {approved ? (
        <Group title={t('Verified by Vitalis')}>
          <Row first icon={<BadgeCheck size={18} color={colors.primary} />} title={`${roleLabel(approved.profession)} · ${t(approved.specialty)}`} summary={approved.reviewedAt ? t('Documents checked on {date}', { date: date(approved.reviewedAt) }) : undefined} />
        </Group>
      ) : null}
      <Group title={t('Training certificates')}>
        {!certs ? <Skeleton style={{ height: 70, borderRadius: radius.md, marginVertical: 12 }} />
          : !certs.length ? <Text style={styles.empty}>{t('No certificates yet. The CPR and defibrillator courses are free in the Training tab.')}</Text>
          : certs.map((c, i) => {
            const s = state(c);
            return <Row key={c.id} first={i === 0} icon={<Award size={18} color={colors.primary} />} title={c.badgeLabel} summary={`${c.number ? `${c.number} · ` : ''}${s.note}`} right={<Badge variant={s.variant}>{s.label}</Badge>} />;
          })}
      </Group>
      <Group>
        <Row first icon={<GraduationCap size={18} color={colors.info} />} title={t('Training')} summary={t('Courses, quizzes and refreshers')} onPress={() => router.push('/(tabs)/training' as never)} />
      </Group>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  back: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  empty: { color: colors.mutedForeground, fontSize: 14, paddingVertical: 14 },
});
