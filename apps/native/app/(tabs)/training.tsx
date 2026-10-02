import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { Award, GraduationCap } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { SvgXml } from 'react-native-svg';
import { courseArt } from '@/lib/courseArt';

import { AppScreen } from '@/components/AppScreen';
import { Badge } from '@/components/ui/Badge';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { api } from '@/lib/api';
import {
  RootState,
  setTraining,
  TrainingCertification,
  TrainingEnrollment,
} from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import { apiError, locale, t, tn } from '@/lib/i18n';

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  heroEmoji: string;
  estimatedMinutes: number;
  level: string;
  lessonCount: number;
  badgeLabel: string;
}

const LEVEL_LABEL: Record<string, string> = { intro: t('Intro'), standard: t('Standard'), advanced: t('Advanced') };

export default function Training() {
  const dispatch = useDispatch();
  const router = useRouter();
  const trainingState = useSelector((s: RootState) => s.training);

  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [coursesRes, enrollmentsRes, certsRes] = await Promise.all([
      api.get<CourseSummary[]>('/training/courses'),
      api.get<TrainingEnrollment[]>('/training/enrollments'),
      api.get<TrainingCertification[]>('/training/certifications'),
    ]);
    setCourses(coursesRes.data ?? []);
    dispatch(setTraining({ enrollments: enrollmentsRes.data ?? [], certifications: certsRes.data ?? [] }));
  }, [dispatch]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await load();
      } catch (err: any) {
        toast.error(t('Could not load training'), { description: apiError(err, 'Try again shortly.') });
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const enrollmentByCourse = useMemo(() => {
    const map = new Map<string, TrainingEnrollment>();
    for (const e of trainingState.enrollments) map.set(e.courseId, e);
    return map;
  }, [trainingState.enrollments]);

  const certByCourse = useMemo(() => {
    const map = new Map<string, TrainingCertification>();
    for (const c of trainingState.certifications) map.set(c.courseId, c);
    return map;
  }, [trainingState.certifications]);

  const [now] = useState(Date.now);
  const activeCerts = useMemo(
    () => trainingState.certifications.filter((c) => new Date(c.expiresAt).getTime() > now),
    [trainingState.certifications, now]
  );

  return (
    <AppScreen
      tone="primary"
      title={t('Training')}
      subtitle={t('Educational. Not a replacement for in-person training.')}
      icon={<GraduationCap size={20} color="#fff" />}
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
    >
      {activeCerts.length ? (
        <Group title={t('Your certifications')}>
          {activeCerts.map((cert, index) => (
            <Row
              key={cert.id}
              first={index === 0}
              icon={<Award size={18} color="#fff" />}
              tint={colors.primary}
              title={cert.badgeLabel}
              summary={t('Valid until {date}', { date: new Date(cert.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
              onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
            />
          ))}
        </Group>
      ) : null}

      {loading ? (
        <Group>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={styles.skeletonRow}>
              <Skeleton style={{ width: 44, height: 44, borderRadius: 22 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton style={{ height: 14, width: 160 }} />
                <Skeleton style={{ height: 12, width: '70%' }} />
              </View>
            </View>
          ))}
        </Group>
      ) : !courses.length ? (
        <Group>
          <Empty icon={GraduationCap} title={t('No courses yet')} description={t('Training content will appear once the seed runs.')} />
        </Group>
      ) : (
        <Group title={t('Courses')}>
          {courses.map((course, index) => {
            const enrollment = enrollmentByCourse.get(course.id);
            const cert = certByCourse.get(course.id);
            const completedLessons = enrollment?.completedLessonIds.length ?? 0;
            const progress = course.lessonCount ? Math.round((completedLessons / course.lessonCount) * 100) : 0;
            const art = courseArt(course.slug);
            return (
              <Row
                key={course.id}
                first={index === 0}
                icon={art ? <SvgXml xml={art} width={44} height={44} /> : <Text style={styles.emoji}>{course.heroEmoji}</Text>}
                tint="transparent"
                title={course.title}
                summary={[t('{n} min', { n: course.estimatedMinutes }), tn(course.lessonCount, '1 lesson', '{n} lessons'), LEVEL_LABEL[course.level] ?? course.level].join(' · ')}
                right={cert ? <Badge>{t('Certified')}</Badge> : undefined}
                onPress={() => router.push({ pathname: '/training/[slug]', params: { slug: course.slug } } as never)}
              >
                {progress > 0 && !cert ? (
                  <View style={styles.progressTrack} accessibilityLabel={`${t('Progress')} ${progress}%`}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                ) : null}
              </Row>
            );
          })}
        </Group>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  emoji: { fontSize: 26 },
  progressTrack: {
    height: 7, backgroundColor: colors.muted, borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
