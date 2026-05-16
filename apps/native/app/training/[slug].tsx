import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Check, Clock3, GraduationCap, PlayCircle, Sparkles } from 'lucide-react-native';
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
import { resolveLessonVideoUrl, type TrainingLessonView } from './shared';

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
  const remainingLessons = Math.max(course.lessons.length - completedIds.size, 0);

  return (
    <AppScreen
      tone="primary"
      eyebrow={course.badgeLabel}
      title={course.title}
      subtitle={course.shortDescription}
      icon={<Text style={styles.heroEmoji}>{course.heroEmoji}</Text>}
      action={<BackBtn />}
      contentContainerStyle={{ paddingBottom: 96 }}
      headerContent={
        <View style={styles.progressWrap}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <BookOpen size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>{course.lessons.length} lessons</Text>
            </View>
            <View style={styles.heroBadge}>
              <Clock3 size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>{course.estimatedMinutes} min</Text>
            </View>
            <View style={styles.heroBadge}>
              <Sparkles size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>{course.passingScore}% to pass</Text>
            </View>
          </View>
          <Text style={styles.progressText}>{progressPct}% complete • {completedIds.size}/{course.lessons.length} lessons done</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <View style={styles.heroQuizCard}>
            <Text style={styles.heroQuizTitle}>Final quiz</Text>
            <Text style={styles.heroQuizCopy}>
              {allLessonsDone
                ? `You unlocked the ${course.badgeLabel} quiz.`
                : `${remainingLessons} lesson${remainingLessons === 1 ? '' : 's'} left before you can start.`}
            </Text>
            <Button
              onPress={() => router.push({ pathname: '/training/quiz/[slug]', params: { slug: course.slug } } as never)}
              disabled={!allLessonsDone || enrolling}
              loading={enrolling}
              style={styles.heroQuizButton}
            >
              {allLessonsDone ? 'Take the quiz' : 'Finish all lessons first'}
            </Button>
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
          const hasVideo = Boolean(resolveLessonVideoUrl(course.slug, lesson.title, lesson.videoUrl));
          return (
            <Animated.View key={lesson.id} entering={FadeInDown.delay(idx * 40).duration(260)}>
              <Pressable onPress={() => handleStart(lesson.id)} style={styles.lessonRow}>
                <View style={[styles.lessonDot, done && styles.lessonDotDone]}>
                  {done ? <Check size={16} color="#fff" /> : <Text style={styles.lessonDotText}>{idx + 1}</Text>}
                </View>
                <View style={styles.lessonMain}>
                  <View style={styles.lessonTitleRow}>
                    <Text style={styles.lessonTitle}>{lesson.title}</Text>
                    <PlayCircle size={20} color={colors.primary} />
                  </View>
                  {lesson.summary ? <Text style={styles.lessonSummary}>{lesson.summary}</Text> : null}
                  <View style={styles.lessonBadgeRow}>
                    <View style={styles.lessonBadge}>
                      <Clock3 size={10} color={colors.foreground} />
                      <Text style={styles.lessonBadgeText}>{lesson.durationMin} min</Text>
                    </View>
                    {hasVideo ? (
                      <View style={styles.lessonBadge}>
                        <Text style={styles.lessonBadgeText}>Video tutorial</Text>
                      </View>
                    ) : null}
                    <View style={[styles.lessonBadge, done && styles.lessonBadgeDone]}>
                      <Text style={[styles.lessonBadgeText, done && styles.lessonBadgeDoneText]}>
                        {done ? 'Completed' : 'Open lesson'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
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
  heroBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: radius.full },
  heroQuizCard: {
    gap: 10,
    marginTop: 6,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroQuizTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  heroQuizCopy: { color: 'rgba(255,255,255,0.84)', fontSize: 12, lineHeight: 18 },
  heroQuizButton: { backgroundColor: colors.card },
  outlineCard: { padding: 18, gap: 14 },
  outlineHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outlineTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  lessonRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
  },
  lessonDot: {
    width: 36, height: 36, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  lessonDotDone: { backgroundColor: colors.success },
  lessonDotText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  lessonMain: { flex: 1, gap: 8 },
  lessonTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  lessonTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  lessonSummary: { color: colors.mutedForeground, fontSize: 12, marginTop: 2 },
  lessonBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  lessonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 30,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
  },
  lessonBadgeText: { color: colors.foreground, fontSize: 10.5, fontWeight: '700', textTransform: 'none', letterSpacing: 0 },
  lessonBadgeDone: { backgroundColor: colors.successSoft, borderColor: colors.successSoft },
  lessonBadgeDoneText: { color: colors.success },
});
