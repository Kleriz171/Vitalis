import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

interface LessonView {
  id: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  durationMin: number;
}

interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  badgeLabel: string;
  lessons: LessonView[];
}

export default function LessonViewer() {
  const { slug, lessonId } = useLocalSearchParams<{ slug: string; lessonId?: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get<CourseDetail>(`/training/courses/${slug}`);
    setCourse(data);
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const { lesson, isLast, nextLesson } = useMemo(() => {
    if (!course) return { lesson: null, isLast: false, nextLesson: null };
    const idx = course.lessons.findIndex((l) => l.id === lessonId) ?? 0;
    const safeIdx = idx >= 0 ? idx : 0;
    return {
      lesson: course.lessons[safeIdx] ?? null,
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
      }
    } catch (err: any) {
      toast.error('Could not save progress', { description: err.response?.data?.error ?? 'Try again.' });
    } finally {
      setCompleting(false);
    }
  };

  if (!course || !lesson) {
    return (
      <AppScreen tone="primary" title="Loading lesson" action={<BackBtn />}>
        <Card style={{ padding: 18 }}><Text>Loading…</Text></Card>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="primary"
      eyebrow={course.badgeLabel}
      title={lesson.title}
      subtitle={lesson.summary}
      icon={<BookOpen size={22} color="#fff" />}
      action={<BackBtn />}
      footer={
        <View style={styles.footerRow}>
          <Button variant="outline" onPress={() => markComplete(false)} loading={completing}>
            <Check size={16} color={colors.primary} />
            Mark complete
          </Button>
          <Button onPress={() => markComplete(true)} loading={completing}>
            {isLast ? 'Finish' : 'Next lesson'}
            <ArrowRight size={16} color="#fff" />
          </Button>
        </View>
      }
    >
      <Card style={styles.bodyCard}>
        <Text style={styles.duration}>~{lesson.durationMin} min</Text>
        <ScrollView style={{ maxHeight: 520 }}>
          <Text style={styles.body}>{lesson.body}</Text>
        </ScrollView>
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
  backBtn: {
    width: 40, height: 40, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bodyCard: { padding: 20, gap: 16 },
  duration: { color: colors.primary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  body: { color: colors.foreground, fontSize: 15, lineHeight: 24 },
  footerRow: { flexDirection: 'row', gap: 10 },
});
