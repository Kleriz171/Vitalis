import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { BookOpen, Clock3, GraduationCap, Heart } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { SvgXml } from 'react-native-svg';
import { courseArt } from '@/lib/courseArt';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
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
import { apiError, t, tn } from '@/lib/i18n';

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

  const activeCerts = useMemo(
    () => trainingState.certifications.filter((c) => new Date(c.expiresAt).getTime() > Date.now()),
    [trainingState.certifications]
  );

  return (
    <AppScreen
      tone="primary"
      title={t('Training')}
      subtitle={t('Educational. Not a replacement for in-person training.')}
      icon={<GraduationCap size={20} color="#fff" />}
      compact
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />,
      }}
    >
      {activeCerts.length ? (
        <Card style={styles.certCard}>
          <View style={styles.certHeader}>
            <Heart size={18} color={colors.primary} fill={colors.primary} />
            <Text style={styles.certTitle}>{t('Your certifications')}</Text>
          </View>
          <View style={styles.badgeRow}>
            {activeCerts.map((cert) => (
              <Pressable
                key={cert.id}
                onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
                style={styles.badgePill}
              >
                <Text style={styles.badgePillText}>{cert.badgeLabel}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      ) : null}

      {loading ? (
        Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx} style={styles.courseCard}>
            <Skeleton style={{ width: 52, height: 52, borderRadius: radius.lg }} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton style={{ height: 16, width: 160 }} />
              <Skeleton style={{ height: 12, width: '90%' }} />
            </View>
          </Card>
        ))
      ) : !courses.length ? (
        <Card style={styles.courseCard}>
          <Empty icon={GraduationCap} title={t('No courses yet')} description={t('Training content will appear once the seed runs.')} />
        </Card>
      ) : (
        courses.map((course, index) => {
          const enrollment = enrollmentByCourse.get(course.id);
          const cert = certByCourse.get(course.id);
          const completedLessons = enrollment?.completedLessonIds.length ?? 0;
          const progress = course.lessonCount
            ? Math.round((completedLessons / course.lessonCount) * 100)
            : 0;
          return (
            <Animated.View key={course.id} entering={FadeInDown.delay(40 * index).duration(280)}>
              <Pressable onPress={() => router.push({ pathname: '/training/[slug]', params: { slug: course.slug } } as never)}>
                <Card style={styles.courseCard}>
                  <View style={styles.courseTop}>
                    {courseArt(course.slug) ? (
                      <SvgXml xml={courseArt(course.slug)!} width={52} height={52} />
                    ) : (
                      <View style={styles.emojiBadge}>
                        <Text style={styles.emoji}>{course.heroEmoji}</Text>
                      </View>
                    )}
                    <View style={styles.courseMain}>
                      <View style={styles.titleRow}>
                        <Text style={styles.courseTitle}>{course.title}</Text>
                        {cert ? <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>{t('Certified')}</Text></View> : null}
                      </View>
                      <Text style={styles.courseDesc} numberOfLines={2}>{course.shortDescription}</Text>
                      <View style={styles.badgeRowMeta}>
                        <View style={styles.metaBadge}>
                          <Clock3 size={11} color={colors.foreground} />
                          <Text style={styles.metaBadgeText}>{t('{n} min', { n: course.estimatedMinutes })}</Text>
                        </View>
                        <View style={styles.metaBadge}>
                          <BookOpen size={11} color={colors.foreground} />
                          <Text style={styles.metaBadgeText}>{tn(course.lessonCount, '1 lesson', '{n} lessons')}</Text>
                        </View>
                        <View style={styles.metaBadge}>
                          <Text style={styles.metaBadgeText}>{LEVEL_LABEL[course.level] ?? course.level}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                  <View style={styles.progressBlock}>
                    <View style={styles.progressHeader}>
                      <Text style={styles.progressLabel}>{progress > 0 ? t('Progress') : t('Ready to start')}</Text>
                      <Text style={styles.progressValue}>{progress}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Animated.View>
          );
        })
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  certCard: { padding: 16, gap: 12 },
  certHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  certTitle: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePill: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  badgePillText: { color: colors.accentForeground, fontSize: 12, fontWeight: '700' },
  courseCard: {
    padding: 16, gap: 14,
  },
  courseTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  courseMain: { flex: 1, gap: 8 },
  emojiBadge: {
    width: 52, height: 52, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  emoji: { fontSize: 26 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  courseTitle: { color: colors.foreground, fontSize: 15, fontWeight: '800' },
  miniBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
  },
  miniBadgeText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  courseDesc: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18 },
  badgeRowMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.soft,
    borderColor: colors.border,
  },
  metaBadgeText: { color: colors.foreground, fontSize: 11, fontWeight: '700', letterSpacing: 0, textTransform: 'capitalize' },
  progressBlock: { gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: colors.mutedForeground, fontSize: 11, fontWeight: '700' },
  progressValue: { color: colors.primary, fontSize: 11, fontWeight: '800' },
  progressTrack: {
    height: 7, backgroundColor: colors.muted, borderRadius: radius.full, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
