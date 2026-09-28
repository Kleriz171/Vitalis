import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronRight } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen, HeaderButton } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { RootState, upsertEnrollment } from '@/lib/store';
import { courseArt } from '@/lib/courseArt';
import { colors, radius, type } from '@/lib/theme';
import { resolveLessonVideoUrl, type TrainingLessonView } from './shared';
import { apiError, t, tn } from '@/lib/i18n';

interface LessonView extends TrainingLessonView {}

interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  category: string;
  shortDescription: string;
  estimatedMinutes: number;
  level: string;
  lessonCount: number;
  badgeLabel: string;
  passingScore: number;
  lessons: LessonView[];
  quiz: QuizQuestion[];
}

export default function CourseDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const enrollments = useSelector((s: RootState) => s.training.enrollments);

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get<CourseDetail>(`/training/courses/${slug}`);
    setCourse(data);
  }, [slug]);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await load();
      } catch (err: any) {
        toast.error(t('Could not load course'), { description: apiError(err, 'Try again.') });
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const enrollment = course ? enrollments.find((e) => e.courseId === course.id) : undefined;
  const completedIds = new Set(enrollment?.completedLessonIds ?? []);
  const allLessonsDone = course ? course.lessons.every((l) => completedIds.has(l.id)) : false;

  const handleStart = async (lessonId: string) => {
    if (!course) return;
    try {
      if (!enrollment) {
        setEnrolling(true);
        const { data } = await api.post('/training/enrollments', { courseId: course.id });
        dispatch(upsertEnrollment(data));
      }
      router.push({ pathname: '/training/lesson/[slug]', params: { slug: course.slug, lessonId } } as never);
    } catch (err: any) {
      toast.error(t('Could not enrol'), { description: apiError(err, 'Try again.') });
    } finally {
      setEnrolling(false);
    }
  };

  if (loading || !course) {
    return (
      <AppScreen
        title={t('Loading course')}
        action={<BackBtn />}
      >
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 80, borderRadius: radius.lg }} />)}
      </AppScreen>
    );
  }

  const progressPct = course.lessons.length
    ? Math.round((completedIds.size / course.lessons.length) * 100)
    : 0;
  const remainingLessons = Math.max(course.lessons.length - completedIds.size, 0);

  const xml = courseArt(course.slug);

  return (
    <AppScreen title={course.title} action={<BackBtn />} contentContainerStyle={{ paddingBottom: 96 }}>
      <View style={styles.intro}>
        {xml ? <SvgXml xml={xml} width={88} height={88} /> : null}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.introBody}>{course.shortDescription}</Text>
          <Text style={styles.meta}>
            {[t('{n} min', { n: course.estimatedMinutes }), tn(course.lessons.length, '1 lesson', '{n} lessons'), t('{n}% to pass', { n: course.passingScore })].join(' · ')}
          </Text>
        </View>
      </View>

      {completedIds.size ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.meta}>{t('{done} of {total} lessons done', { done: completedIds.size, total: course.lessons.length })}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      ) : null}

      <View style={styles.group}>
        {course.lessons.map((lesson, idx) => {
          const done = completedIds.has(lesson.id);
          const hasVideo = Boolean(resolveLessonVideoUrl(course.slug, lesson.title, lesson.videoUrl));
          return (
            <Pressable
              key={lesson.id}
              onPress={() => handleStart(lesson.id)}
              style={({ pressed }) => [styles.row, idx > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={done ? t('Lesson {n}: {title}, completed', { n: idx + 1, title: lesson.title }) : t('Lesson {n}: {title}', { n: idx + 1, title: lesson.title })}
            >
              <View style={[styles.step, done && styles.stepDone]}>
                {done ? <Check size={16} color="#fff" /> : <Text style={styles.stepText}>{idx + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{lesson.title}</Text>
                <Text style={styles.meta}>{t('{n} min', { n: lesson.durationMin })}{hasVideo ? ` · ${t('Video')}` : ''}</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
      </View>

      <Button
        onPress={() => router.push({ pathname: '/training/quiz/[slug]', params: { slug: course.slug } } as never)}
        disabled={!allLessonsDone || enrolling}
        loading={enrolling}
      >
        {t('Take the final quiz')}
      </Button>
      <Text style={[styles.meta, { textAlign: 'center' }]}>
        {allLessonsDone
          ? t('Pass it to earn {badge}.', { badge: course.badgeLabel })
          : t('Unlocks after the last lesson. {n} to go.', { n: remainingLessons })}
      </Text>
    </AppScreen>
  );
}

function BackBtn() {
  const router = useRouter();
  return (
    <HeaderButton icon={ArrowLeft} onPress={() => router.back()} label={t('Back')} />
  );
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  introBody: { ...type.callout, color: colors.foreground },
  meta: { ...type.footnote, color: colors.mutedForeground },
  progressTrack: { height: 4, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  group: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 64 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.muted },
  rowTitle: { ...type.headline, color: colors.foreground },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.success, borderColor: colors.success },
  stepText: { ...type.footnote, fontWeight: '700', color: colors.foreground },
});
