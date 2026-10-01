import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Award, Check, GraduationCap, Lock } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner-native';
import { SvgXml } from 'react-native-svg';
import { courseArt } from '@/lib/courseArt';

import { AppScreen } from '@/components/AppScreen';
import { Group, Row, Stats } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { RootState, upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
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
  heroEmoji: string;
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
        tone="primary"
        title={t('Loading course')}
        icon={<GraduationCap size={20} color="#fff" />}
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

  const quizOpen = allLessonsDone && !enrolling;

  return (
    <AppScreen
      tone="primary"
      title={course.title}
      subtitle={course.shortDescription}
      icon={courseArt(course.slug) ? <SvgXml xml={courseArt(course.slug)!} width={36} height={36} /> : <Text style={styles.heroEmoji}>{course.heroEmoji}</Text>}
      action={<BackBtn />}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      <Stats
        items={[
          { label: tn(course.lessons.length, '1 lesson', '{n} lessons').replace(/^\d+\s*/, ''), value: course.lessons.length },
          { label: 'min', value: course.estimatedMinutes },
          { label: t('to pass'), value: `${course.passingScore}%` },
          { label: t('done'), value: `${progressPct}%` },
        ]}
      />

      <Group title={t('Lessons')}>
        {course.lessons.map((lesson, idx) => {
          const done = completedIds.has(lesson.id);
          const hasVideo = Boolean(resolveLessonVideoUrl(course.slug, lesson.title, lesson.videoUrl));
          return (
            <Row
              key={lesson.id}
              first={idx === 0}
              icon={done ? <Check size={18} color="#fff" /> : <Text style={styles.lessonNumber}>{idx + 1}</Text>}
              tint={done ? colors.primary : undefined}
              title={lesson.title}
              summary={[t('{n} min', { n: lesson.durationMin }), hasVideo ? t('Video tutorial') : null, done ? t('Completed') : null].filter(Boolean).join(' · ')}
              onPress={() => handleStart(lesson.id)}
            />
          );
        })}
      </Group>

      <Group>
        <Row
          first
          icon={quizOpen ? <Award size={18} color="#fff" /> : <Lock size={18} color={colors.mutedForeground} />}
          tint={quizOpen ? colors.primary : undefined}
          title={t('Final quiz')}
          summary={
            allLessonsDone
              ? t('You unlocked the {badge} quiz.', { badge: course.badgeLabel })
              : tn(remainingLessons, '1 lesson left before you can start.', '{n} lessons left before you can start.')
          }
          onPress={quizOpen ? () => router.push({ pathname: '/training/quiz/[slug]', params: { slug: course.slug } } as never) : undefined}
        />
      </Group>
    </AppScreen>
  );
}

function BackBtn() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.back()} style={styles.backBtn}>
      <ArrowLeft size={16} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lessonNumber: { color: colors.primaryStrong, fontSize: 14, fontWeight: '800' },
  heroEmoji: { fontSize: 28 },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
});
