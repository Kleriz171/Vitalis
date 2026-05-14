import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Check, GraduationCap, PlayCircle } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { RootState, upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

interface LessonView {
  id: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  durationMin: number;
}

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
        toast.error('Could not load course', { description: err.response?.data?.error ?? 'Try again.' });
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
      toast.error('Could not enrol', { description: err.response?.data?.error ?? 'Try again.' });
    } finally {
      setEnrolling(false);
    }
  };

  if (loading || !course) {
    return (
      <AppScreen
        tone="primary"
        eyebrow="First aid training"
        title="Loading course"
        icon={<GraduationCap size={22} color="#fff" />}
        action={<BackBtn />}
      >
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 80, borderRadius: radius.lg }} />)}
      </AppScreen>
    );
  }

  const progressPct = course.lessons.length
    ? Math.round((completedIds.size / course.lessons.length) * 100)
    : 0;

  return (
    <AppScreen
      tone="primary"
      eyebrow={course.badgeLabel}
      title={course.title}
      subtitle={course.shortDescription}
      icon={<Text style={styles.heroEmoji}>{course.heroEmoji}</Text>}
      action={<BackBtn />}
      headerContent={
        <View style={styles.progressWrap}>
          <Text style={styles.progressText}>{progressPct}% complete • {course.estimatedMinutes} min total</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>
      }
    >
      <Card style={styles.outlineCard}>
        <View style={styles.outlineHeader}>
          <BookOpen size={18} color={colors.primary} />
          <Text style={styles.outlineTitle}>Lessons</Text>
        </View>
        {course.lessons.map((lesson, idx) => {
          const done = completedIds.has(lesson.id);
          return (
            <Animated.View key={lesson.id} entering={FadeInDown.delay(idx * 40).duration(260)}>
              <Pressable onPress={() => handleStart(lesson.id)} style={styles.lessonRow}>
                <View style={[styles.lessonDot, done && styles.lessonDotDone]}>
                  {done ? <Check size={14} color="#fff" /> : <Text style={styles.lessonDotText}>{idx + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  {lesson.summary ? <Text style={styles.lessonSummary}>{lesson.summary}</Text> : null}
                  <Text style={styles.lessonDuration}>{lesson.durationMin} min</Text>
                </View>
                <PlayCircle size={22} color={colors.primary} />
              </Pressable>
            </Animated.View>
          );
        })}
      </Card>

      <Card style={styles.quizCard}>
        <Text style={styles.outlineTitle}>Final quiz</Text>
        <Text style={styles.quizCopy}>
          Pass with {course.passingScore}% or higher to earn the {course.badgeLabel} badge. Valid for 12 months.
        </Text>
        <Button
          onPress={() => router.push({ pathname: '/training/quiz/[slug]', params: { slug: course.slug } } as never)}
          disabled={!allLessonsDone || enrolling}
          loading={enrolling}
        >
          {allLessonsDone ? 'Take the quiz' : 'Finish all lessons first'}
        </Button>
      </Card>
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
  heroEmoji: { fontSize: 28 },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressWrap: { gap: 8 },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: radius.full },
  outlineCard: { padding: 18, gap: 14 },
  outlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outlineTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  lessonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
  },
  lessonDot: {
    width: 32, height: 32, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  lessonDotDone: { backgroundColor: colors.success },
  lessonDotText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  lessonTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  lessonSummary: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  lessonDuration: { color: colors.primary, fontSize: 11, fontWeight: '700', marginTop: 4 },
  quizCard: { padding: 18, gap: 12 },
  quizCopy: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19 },
});
