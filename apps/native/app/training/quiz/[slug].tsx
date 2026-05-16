import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Award, Check, CircleHelp, ClipboardCheck, X } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { toast } from 'sonner-native';

import { AppScreen } from '@/components/AppScreen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { upsertCertification, upsertEnrollment } from '@/lib/store';
import { colors, radius } from '@/lib/theme';

interface Question {
  id: string;
  prompt: string;
  choices: string[];
}

interface CourseQuiz {
  id: string;
  slug: string;
  title: string;
  badgeLabel: string;
  passingScore: number;
  quiz: Question[];
}

interface ReviewEntry {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation?: string;
}

interface QuizResult {
  score: number;
  passed: boolean;
  passingScore: number;
  review: ReviewEntry[];
  certification: { id: string } | null;
}

export default function Quiz() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const dispatch = useDispatch();
  const [course, setCourse] = useState<CourseQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  const load = useCallback(async () => {
    const { data } = await api.get<CourseQuiz>(`/training/courses/${slug}`);
    setCourse(data);
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  if (!course) {
    return (
      <AppScreen tone="primary" title="Loading quiz" action={<BackBtn />}>
        <Skeleton style={{ height: 150, borderRadius: radius.xl }} />
        <Skeleton style={{ height: 240, borderRadius: radius.xl }} />
      </AppScreen>
    );
  }

  const allAnswered = course.quiz.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    try {
      setSubmitting(true);
      const payload = {
        answers: course.quiz.map((q) => ({ questionId: q.id, choiceIndex: answers[q.id] })),
      };
      const { data } = await api.post<QuizResult & { enrollment: any; certification: any }>(
        `/training/enrollments/${course.id}/quiz`,
        payload
      );
      setResult(data);
      if (data.enrollment) dispatch(upsertEnrollment(data.enrollment));
      if (data.certification) {
        dispatch(upsertCertification(data.certification));
        toast.success(`Earned ${course.badgeLabel}!`);
      } else {
        toast(`Score ${data.score}%. Try again to pass.`);
      }
    } catch (err: any) {
      toast.error('Could not submit', { description: err.response?.data?.error ?? 'Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <AppScreen
        tone={result.passed ? 'success' : 'critical'}
        eyebrow={result.passed ? 'Passed' : 'Try again'}
        title={`${result.score}%`}
        subtitle={result.passed ? `You earned ${course.badgeLabel}.` : `You need ${result.passingScore}% to pass.`}
        icon={<Award size={22} color="#fff" />}
        action={<BackBtn />}
        footer={
          <View style={styles.footerColumn}>
            {result.passed && result.certification ? (
              <Button onPress={() => router.replace({ pathname: '/training/certificate/[id]', params: { id: result.certification!.id } } as never)}>
                View certificate
              </Button>
            ) : (
              <Button onPress={() => { setResult(null); setAnswers({}); }}>Retry quiz</Button>
            )}
            <Button variant="outline" onPress={() => router.replace({ pathname: '/training/[slug]', params: { slug: course.slug } } as never)}>
              Back to course
            </Button>
          </View>
        }
      >
        {course.quiz.map((q, idx) => {
          const userAnswer = answers[q.id];
          const review = result.review.find((r) => r.questionId === q.id);
          const right = review?.correct;
          return (
            <Card key={q.id} style={styles.reviewCard}>
              <Text style={styles.reviewQ}>{idx + 1}. {q.prompt}</Text>
              <View style={styles.reviewRow}>
                {right ? <Check size={16} color={colors.success} /> : <X size={16} color={colors.destructive} />}
                <Text style={[styles.reviewText, { color: right ? colors.success : colors.destructive }]}>
                  Your answer: {q.choices[userAnswer]}
                </Text>
              </View>
              {!right ? (
                <Text style={styles.reviewCorrect}>Correct: {q.choices[review?.correctIndex ?? 0]}</Text>
              ) : null}
              {review?.explanation ? <Text style={styles.reviewExplain}>{review.explanation}</Text> : null}
            </Card>
          );
        })}
      </AppScreen>
    );
  }

  return (
    <AppScreen
      tone="primary"
      eyebrow={course.badgeLabel}
      title="Final quiz"
      subtitle={`Pass with ${course.passingScore}% or higher.`}
      icon={<Award size={22} color="#fff" />}
      action={<BackBtn />}
      headerContent={
        <View style={styles.heroContent}>
          <View style={styles.heroChip}>
            <ClipboardCheck size={14} color="#fff" />
            <Text style={styles.heroChipText}>{course.quiz.length} questions</Text>
          </View>
          <View style={styles.heroChip}>
            <CircleHelp size={14} color="#fff" />
            <Text style={styles.heroChipText}>One answer per question</Text>
          </View>
        </View>
      }
      footer={
        <Button onPress={submit} loading={submitting} disabled={!allAnswered}>
          {allAnswered ? 'Submit answers' : 'Answer every question'}
        </Button>
      }
    >
      {course.quiz.map((q, idx) => (
        <Card key={q.id} style={styles.qCard}>
          <View style={styles.questionHeader}>
            <Badge variant="outline" style={styles.indexBadge} textStyle={styles.indexBadgeText}>
              Question {idx + 1}
            </Badge>
          </View>
          <Text style={styles.qPrompt}>{q.prompt}</Text>
          <View style={styles.choiceList}>
            {q.choices.map((choice, choiceIdx) => {
              const active = answers[q.id] === choiceIdx;
              return (
                <Pressable
                  key={choiceIdx}
                  onPress={() => setAnswers((current) => ({ ...current, [q.id]: choiceIdx }))}
                  style={[styles.choice, active && styles.choiceActive]}
                >
                  <View style={[styles.choiceDot, active && styles.choiceDotActive]}>
                    {active ? <View style={styles.choiceDotInner} /> : null}
                  </View>
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
      ))}
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
  heroContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  qCard: { padding: 18, gap: 14, marginBottom: 12 },
  questionHeader: { flexDirection: 'row', justifyContent: 'flex-start' },
  indexBadge: { backgroundColor: colors.soft, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  indexBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  qPrompt: { color: colors.foreground, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  choiceList: { gap: 10 },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: radius.lg,
    backgroundColor: colors.soft,
  },
  choiceActive: { backgroundColor: colors.accent },
  choiceDot: {
    width: 22, height: 22, borderRadius: radius.full,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  choiceDotActive: { borderColor: colors.primary },
  choiceDotInner: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  choiceText: { color: colors.foreground, fontSize: 14, flex: 1 },
  choiceTextActive: { fontWeight: '700' },
  reviewCard: { padding: 16, gap: 8, marginBottom: 12 },
  reviewQ: { color: colors.foreground, fontSize: 14, fontWeight: '700' },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewText: { fontSize: 13, fontWeight: '700', flex: 1 },
  reviewCorrect: { color: colors.success, fontSize: 12, fontWeight: '700' },
  reviewExplain: { color: colors.mutedForeground, fontSize: 12, fontStyle: 'italic' },
  footerColumn: { flexDirection: 'column', gap: 10 },
});
