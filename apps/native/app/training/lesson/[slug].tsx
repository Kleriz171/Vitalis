import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, PlayCircle } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Button } from '@/components/ui/Button';
import { Group, Row } from '@/components/ui/List';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import {
  resolveLessonVideoMeta,
  type TrainingCourseDetailView,
} from '../shared';
import { apiError, t } from '@/lib/i18n';

interface CourseDetail extends TrainingCourseDetailView {}

export default function LessonViewer() {
  const { slug, lessonId } = useLocalSearchParams<{ slug: string; lessonId?: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);

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
        toast.error(t('Could not load lesson'), { description: apiError(err, 'Try again.') });
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const { lesson, lessonIndex, isLast, nextLesson } = useMemo(() => {
    if (!course) return { lesson: null, lessonIndex: 0, isLast: false, nextLesson: null };
    const idx = course.lessons.findIndex((l) => l.id === lessonId);
    const safeIdx = idx >= 0 ? idx : 0;
    return {
      lesson: course.lessons[safeIdx] ?? null,
      lessonIndex: safeIdx,
      isLast: safeIdx === course.lessons.length - 1,
      nextLesson: course.lessons[safeIdx + 1] ?? null,
    };
  }, [course, lessonId]);

  const markComplete = async (advance: boolean) => {
    if (!course || !lesson) return;
    try {
      setCompleting(true);
      const { data } = await api.post(`/training/enrollments/${course.id}/lessons/complete`, { lessonId: lesson.id });
      dispatch(upsertEnrollment(data));
      if (advance && nextLesson) {
        router.replace({ pathname: '/training/lesson/[slug]', params: { slug: course.slug, lessonId: nextLesson.id } } as never);
      } else if (advance) {
        router.replace({ pathname: '/training/[slug]', params: { slug: course.slug } } as never);
      } else {
        router.replace({ pathname: '/training/[slug]', params: { slug: course.slug } } as never);
      }
    } catch (err: any) {
      toast.error(t('Could not save progress'), { description: apiError(err, 'Try again.') });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppScreen tone="primary" title={t('Loading lesson')} action={<BackBtn />}>
        <Skeleton style={{ height: 260, borderRadius: radius.xl }} />
        <Skeleton style={{ height: 220, borderRadius: radius.xl }} />
        <Skeleton style={{ height: 160, borderRadius: radius.xl }} />
      </AppScreen>
    );
  }

  if (!course || !lesson) {
    return (
      <AppScreen tone="primary" title={t('Lesson unavailable')} action={<BackBtn />}>
        <Group>
          <Text style={[styles.body, { color: colors.mutedForeground, paddingTop: 16 }]}>{t('This lesson could not be loaded.')}</Text>
        </Group>
      </AppScreen>
    );
  }

  const lessonCount = course.lessons.length;
  const progressPct = lessonCount ? Math.round(((lessonIndex + 1) / lessonCount) * 100) : 0;
  const video = resolveLessonVideoMeta(course.slug, lesson.title, lesson.videoUrl);

  const openVideo = async () => {
    try {
      await Linking.openURL(video.watchUrl);
    } catch {
      toast.error(t('Could not open tutorial video'));
    }
  };

  return (
    <AppScreen
      tone="primary"
      title={lesson.title}
      subtitle={`${t('Lesson {n} of {total}', { n: lessonIndex + 1, total: lessonCount })} · ${t('{n} min', { n: lesson.durationMin })}`}
      icon={<BookOpen size={20} color="#fff" />}
      action={<BackBtn />}
      contentContainerStyle={{ paddingBottom: 96 }}
    >
      <View style={styles.progressTrack} accessibilityLabel={t('Course progress {n}%', { n: progressPct })}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <Group title={t('What to do')}>
        <Text style={styles.body}>{lesson.body}</Text>
      </Group>

      <Group>
        <Row
          first
          icon={<PlayCircle size={18} color="#fff" />}
          tint={colors.primary}
          title={t('Open tutorial video')}
          summary={t('Opens directly in YouTube or your browser.')}
          onPress={() => void openVideo()}
        />
      </Group>

      <View style={styles.actions}>
        <Button variant="outline" style={styles.action} onPress={() => markComplete(false)} disabled={completing}>
          {completing ? t('Saving...') : t('Mark complete')}
        </Button>
        <Button style={styles.action} onPress={() => markComplete(true)} disabled={completing}>
          {completing ? t('Saving...') : isLast ? t('Finish course') : t('Next lesson')}
        </Button>
      </View>

      <Group title={t('Course outline')}>
        {course.lessons.map((item, index) => {
          const active = item.id === lesson.id;
          return (
            <Row
              key={item.id}
              first={index === 0}
              icon={<Text style={[styles.number, active && styles.numberActive]}>{index + 1}</Text>}
              tint={active ? colors.primary : undefined}
              title={item.title}
              summary={active ? t('Current') : item.summary}
            />
          );
        })}
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
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  progressTrack: { height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  body: { color: colors.foreground, fontSize: 16, lineHeight: 25, paddingBottom: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
  number: { color: colors.primaryStrong, fontSize: 14, fontWeight: '800' },
  numberActive: { color: '#fff' },
});
