import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { Award, CheckCircle2, ChevronRight, GraduationCap } from 'lucide-react-native';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Skeleton } from '@/components/ui/Skeleton';
import { Empty } from '@/components/ui/Empty';
import { api } from '@/lib/api';
import {
  RootState,
  setTraining,
  TrainingCertification,
  TrainingEnrollment,
} from '@/lib/store';
import { courseArt } from '@/lib/courseArt';
import { colors, radius, type } from '@/lib/theme';

interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
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
      title="Learn"
      subtitle="Short first-aid courses based on Red Cross guidelines. Pass CPR or AED and Vitalis can call you to emergencies nearby."
      scrollProps={{
        refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />,
      }}
    >
      {activeCerts.length ? (
        <View style={styles.group}>
          {activeCerts.map((cert, i) => (
            <Pressable
              key={cert.id}
              onPress={() => router.push({ pathname: '/training/certificate/[id]', params: { id: cert.id } } as never)}
              style={({ pressed }) => [styles.certRow, i > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Award size={20} color={colors.primaryStrong} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{cert.badgeLabel}</Text>
                <Text style={styles.rowDetail}>Certified until {new Date(cert.expiresAt).toLocaleDateString()}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.group}>
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={[styles.row, idx > 0 && styles.divider]}>
              <Skeleton style={{ width: 64, height: 64, borderRadius: 32 }} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton style={{ height: 16, width: 160 }} />
                <Skeleton style={{ height: 12, width: '70%' }} />
              </View>
            </View>
          ))
        ) : !courses.length ? (
          <Empty icon={GraduationCap} title="No courses yet" description="Training content will appear once the seed runs." />
        ) : (
          courses.map((course, i) => {
            const enrollment = enrollmentByCourse.get(course.id);
            const cert = certByCourse.get(course.id);
            const done = enrollment?.completedLessonIds.length ?? 0;
            const progress = course.lessonCount ? done / course.lessonCount : 0;
            const xml = courseArt(course.slug);
            const status = cert
              ? 'Certified'
              : done ? `${done} of ${course.lessonCount} lessons done` : `${course.estimatedMinutes} min · ${course.lessonCount} lessons`;
            return (
              <Pressable
                key={course.id}
                onPress={() => router.push({ pathname: '/training/[slug]', params: { slug: course.slug } } as never)}
                style={({ pressed }) => [styles.row, i > 0 && styles.divider, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`${course.title}. ${status}`}
              >
                {xml ? <SvgXml xml={xml} width={64} height={64} /> : <View style={styles.artFallback} />}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{course.title}</Text>
                  <View style={styles.statusRow}>
                    {cert ? <CheckCircle2 size={14} color={colors.success} /> : null}
                    <Text style={[styles.rowDetail, cert && { color: colors.success }]}>{status}</Text>
                  </View>
                  {done && !cert ? (
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                    </View>
                  ) : null}
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Pressable>
            );
          })
        )}
      </View>

      <Text style={styles.footnote}>Educational only. It does not replace hands-on training with an instructor.</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 12 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  rowTitle: { ...type.headline, color: colors.foreground },
  rowDetail: { ...type.footnote, color: colors.mutedForeground },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  artFallback: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent },
  progressTrack: { height: 4, marginTop: 6, backgroundColor: colors.muted, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  footnote: { ...type.footnote, color: colors.mutedForeground },
});
