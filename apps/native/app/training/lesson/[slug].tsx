import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  ListChecks,
  PlayCircle,
} from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import {
  resolveLessonVideoMeta,
  type TrainingCourseDetailView,
} from '../shared';

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
        toast.error('Could not load lesson', { description: err.response?.data?.error ?? 'Try again.' });
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
      toast.error('Could not save progress', { description: err.response?.data?.error ?? 'Try again.' });
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <AppScreen tone="primary" title="Loading lesson" action={<BackBtn />}>
        <Skeleton style={{ height: 260, borderRadius: radius.xl }} />
        <Skeleton style={{ height: 220, borderRadius: radius.xl }} />
        <Skeleton style={{ height: 160, borderRadius: radius.xl }} />
      </AppScreen>
    );
  }

  if (!course || !lesson) {
    return (
      <AppScreen tone="primary" title="Lesson unavailable" action={<BackBtn />}>
        <Card style={{ padding: 18 }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>This lesson could not be loaded.</Text>
        </Card>
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
      toast.error('Could not open tutorial video');
    }
  };

  return (
    <AppScreen
      tone="primary"
      eyebrow={course.badgeLabel}
      title={lesson.title}
      subtitle={lesson.summary}
      icon={<BookOpen size={22} color="#fff" />}
      action={<BackBtn />}
      contentContainerStyle={{ paddingBottom: 96 }}
      headerContent={
        <View style={styles.heroContent}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroBadge}>
              <BookOpen size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>Lesson {lessonIndex + 1} of {lessonCount}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Clock3 size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>{lesson.durationMin} min</Text>
            </View>
            <View style={styles.heroBadge}>
              <PlayCircle size={13} color="#fff" />
              <Text style={styles.heroBadgeText}>Topic video</Text>
            </View>
          </View>
          <View style={styles.progressWrap}>
            <Text style={styles.progressText}>Course progress {progressPct}%</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
        </View>
      }
    >
      <Card style={styles.videoCard}>
        <View style={styles.sectionHeader}>
          <PlayCircle size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Watch the tutorial</Text>
        </View>
        <Pressable onPress={openVideo} style={({ pressed }) => [styles.videoLinkRow, pressed && styles.videoLinkRowPressed]}>
          <View style={styles.videoLinkIcon}>
            <PlayCircle size={20} color={colors.primary} />
          </View>
          <View style={styles.videoLinkCopy}>
            <Text style={styles.videoLinkTitle}>Open tutorial video</Text>
            <Text style={styles.videoLinkText}>Opens directly in YouTube or your browser.</Text>
          </View>
          <View style={styles.videoLinkCta}>
            <Text style={styles.videoLinkCtaText}>Open</Text>
          </View>
        </Pressable>
        <View style={styles.videoMetaRow}>
          <View style={styles.infoBadge}>
            <Clock3 size={10} color={colors.foreground} />
            <Text style={styles.infoBadgeText}>{lesson.durationMin} min tutorial</Text>
          </View>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>Focused on this lesson</Text>
          </View>
        </View>
        <Text style={styles.videoHint}>
          Start with the demo above, then use the written guidance below to review the exact steps.
        </Text>
      </Card>

      <Card style={styles.actionCard}>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>Ready for the next step?</Text>
          <Text style={styles.actionText}>
            Save this lesson to your progress, or continue straight into {isLast ? 'the course summary' : 'the next lesson'}.
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <Pressable
            onPress={() => markComplete(false)}
            disabled={completing}
            style={({ pressed }) => [
              styles.actionTile,
              styles.actionTileShared,
              completing && styles.actionTileDisabled,
              pressed && styles.actionTilePressed,
            ]}
          >
            <Text style={styles.actionTileLabel}>
              {completing ? 'Saving...' : 'Mark complete'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => markComplete(true)}
            disabled={completing}
            style={({ pressed }) => [
              styles.actionTile,
              styles.actionTileShared,
              completing && styles.actionTileDisabled,
              pressed && styles.actionTilePressed,
            ]}
          >
            <Text style={styles.actionTileLabel}>
              {completing ? 'Saving...' : isLast ? 'Finish course' : 'Next lesson'}
            </Text>
          </Pressable>
        </View>
      </Card>

      <Card style={styles.bodyCard}>
        <View style={styles.sectionHeader}>
          <ListChecks size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>What to do</Text>
        </View>
        <View style={styles.detailBadgeRow}>
          <View style={styles.infoBadge}>
            <Clock3 size={10} color={colors.foreground} />
            <Text style={styles.infoBadgeText}>{lesson.durationMin} min read</Text>
          </View>
          <View style={styles.infoBadge}>
            <Text style={styles.infoBadgeText}>Practical refresher</Text>
          </View>
        </View>
        <Text style={styles.body}>{lesson.body}</Text>
      </Card>

      <Card style={styles.outlineCard}>
        <View style={styles.sectionHeader}>
          <BookOpen size={18} color={colors.primary} />
          <Text style={styles.sectionTitle}>Course outline</Text>
        </View>
        <View style={styles.outlineList}>
          {course.lessons.map((item, index) => {
            const active = item.id === lesson.id;
            return (
              <View key={item.id} style={[styles.outlineItem, active && styles.outlineItemActive]}>
                <View style={[styles.outlineIndex, active && styles.outlineIndexActive]}>
                  <Text style={[styles.outlineIndexText, active && styles.outlineIndexTextActive]}>{index + 1}</Text>
                </View>
                <View style={styles.outlineTextWrap}>
                  <Text style={styles.outlineTitle}>{item.title}</Text>
                  {item.summary ? <Text style={styles.outlineSummary} numberOfLines={1}>{item.summary}</Text> : null}
                </View>
                {active ? (
                  <Badge variant="secondary" style={styles.currentBadge} textStyle={styles.currentBadgeText}>
                    Current
                  </Badge>
                ) : null}
              </View>
            );
          })}
        </View>
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
  heroContent: { gap: 10 },
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
  progressWrap: { gap: 8 },
  progressText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: radius.full },
  videoCard: { padding: 18, gap: 12 },
  actionCard: { padding: 18, gap: 14, backgroundColor: colors.accent, alignItems: 'center' },
  actionCopy: { gap: 6, alignItems: 'center', maxWidth: 320 },
  actionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  actionText: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    alignSelf: 'center',
  },
  actionTile: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 146,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  actionTileShared: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  actionTileDisabled: {
    opacity: 0.72,
  },
  actionTilePressed: {
    opacity: 0.88,
  },
  actionTileLabel: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  bodyCard: { padding: 20, gap: 14 },
  outlineCard: { padding: 18, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.foreground, fontSize: 16, fontWeight: '800' },
  videoLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.soft,
  },
  videoLinkRowPressed: {
    opacity: 0.9,
  },
  videoLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  videoLinkCopy: {
    flex: 1,
    gap: 2,
  },
  videoLinkTitle: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '800',
  },
  videoLinkText: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 17,
  },
  videoLinkCta: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoLinkCtaText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  videoMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  videoHint: { color: colors.mutedForeground, fontSize: 12, lineHeight: 18 },
  detailBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.soft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoBadgeText: { color: colors.foreground, fontSize: 11, fontWeight: '700', textTransform: 'none', letterSpacing: 0 },
  body: { color: colors.foreground, fontSize: 15, lineHeight: 24 },
  outlineList: { gap: 10 },
  outlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  outlineItemActive: {
    backgroundColor: colors.accent,
  },
  outlineIndex: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  outlineIndexActive: {
    backgroundColor: colors.primary,
  },
  outlineIndexText: { color: colors.primaryStrong, fontSize: 12, fontWeight: '800' },
  outlineIndexTextActive: { color: colors.primaryForeground },
  outlineTextWrap: { flex: 1, gap: 2 },
  outlineTitle: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  outlineSummary: { color: colors.mutedForeground, fontSize: 12 },
  currentBadge: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  currentBadgeText: { color: colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
