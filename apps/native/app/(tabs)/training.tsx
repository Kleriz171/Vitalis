import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { Award, GraduationCap, Heart, ShieldCheck } from 'lucide-react-native';
import { toast } from 'sonner-native';

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
        toast.error('Could not load training', { description: err.response?.data?.error ?? 'Try again shortly.' });
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
      eyebrow="First aid training"
      title="Become a life-saver."
      subtitle="Quick lessons based on Red Cross guidelines — certify yourself in minutes."
      icon={<GraduationCap size={24} color="#fff" />}
      headerContent={
        <View style={styles.heroChips}>
          <View style={styles.heroChip}>
            <Award size={14} color="#fff" />
            <Text style={styles.heroChipText}>{activeCerts.length} active certs</Text>
          </View>
          <View style={styles.heroChip}>
            <ShieldCheck size={14} color="#fff" />
            <Text style={styles.heroChipText}>Educational • not a replacement for in-person training</Text>
          </View>
        </View>
      }
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />,
      }}
    >
      {activeCerts.length ? (
        <Card style={styles.certCard}>
          <View style={styles.certHeader}>
            <Heart size={18} color={colors.primary} fill={colors.primary} />
            <Text style={styles.certTitle}>Your certifications</Text>
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
          <Empty icon={GraduationCap} title="No courses yet" description="Training content will appear once the seed runs." />
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
                  <View style={styles.emojiBadge}>
                    <Text style={styles.emoji}>{course.heroEmoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.courseTitle}>{course.title}</Text>
                      {cert ? <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>Certified</Text></View> : null}
                    </View>
                    <Text style={styles.courseDesc} numberOfLines={2}>{course.shortDescription}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{course.estimatedMinutes} min</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{course.lessonCount} lessons</Text>
                      <Text style={styles.metaDot}>•</Text>
                      <Text style={styles.metaText}>{course.level}</Text>
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
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
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
  miniBadgeText: { color: colors.success, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  courseDesc: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: colors.primary, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  metaDot: { color: colors.mutedForeground, fontSize: 11 },
  progressTrack: {
    height: 6, backgroundColor: colors.muted, borderRadius: radius.full, overflow: 'hidden', marginTop: 4,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
