import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

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

export const Quiz = () => {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [course, setCourse] = useState<CourseQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    api.get<CourseQuiz>(`/training/courses/${slug}`).then((r) => setCourse(r.data)).catch(() => {});
  }, [slug]);

  if (!course) return <div className="px-4 pt-6">Loading…</div>;

  const allAnswered = course.quiz.every((q) => answers[q.id] !== undefined);

  const submit = async () => {
    try {
      setSubmitting(true);
      const { data } = await api.post<QuizResult>(`/training/enrollments/${course.id}/quiz`, {
        answers: course.quiz.map((q) => ({ questionId: q.id, choiceIndex: answers[q.id] })),
      });
      setResult(data);
      if (data.passed) toast.success(`Earned ${course.badgeLabel}!`);
      else toast(`Score ${data.score}%. Try again to pass.`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Could not submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="px-4 pt-4 pb-8 space-y-4">
        <Card className={`p-5 border-0 ${result.passed ? 'bg-success text-white' : 'bg-destructive text-white'}`}>
          <button onClick={() => nav(`/app/training/${course.slug}`)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center mb-3">
            <ArrowLeft size={16} />
          </button>
          <Award size={28} className="mb-2" />
          <div className="text-[10px] tracking-widest font-bold opacity-80">{result.passed ? 'PASSED' : 'TRY AGAIN'}</div>
          <div className="text-4xl font-black">{result.score}%</div>
          <div className="text-sm opacity-90 mt-1">
            {result.passed ? `You earned ${course.badgeLabel}.` : `You need ${result.passingScore}% to pass.`}
          </div>
        </Card>

        {course.quiz.map((q, idx) => {
          const review = result.review.find((r) => r.questionId === q.id);
          const userAnswer = answers[q.id];
          const right = review?.correct;
          return (
            <Card key={q.id} className="p-4 space-y-2">
              <div className="text-sm font-bold">{idx + 1}. {q.prompt}</div>
              <div className={`flex items-center gap-2 text-sm font-semibold ${right ? 'text-success' : 'text-destructive'}`}>
                {right ? <Check size={16} /> : <X size={16} />}
                Your answer: {q.choices[userAnswer]}
              </div>
              {!right && <div className="text-sm text-success font-semibold">Correct: {q.choices[review?.correctIndex ?? 0]}</div>}
              {review?.explanation && <div className="text-xs italic text-muted-foreground">{review.explanation}</div>}
            </Card>
          );
        })}

        <div className="flex gap-2">
          {result.passed && result.certification ? (
            <Button className="flex-1" onClick={() => nav(`/app/training/certificate/${result.certification!.id}`)}>
              View certificate
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => { setResult(null); setAnswers({}); }}>Retry quiz</Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => nav(`/app/training/${course.slug}`)}>
            Back to course
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <Card className="p-5 bg-primary text-primary-foreground border-0">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center mb-3">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[10px] tracking-widest font-bold opacity-80">{course.badgeLabel.toUpperCase()}</div>
        <div className="text-xl font-extrabold">Final quiz</div>
        <div className="text-sm opacity-90">Pass with {course.passingScore}% or higher.</div>
      </Card>

      {course.quiz.map((q, idx) => (
        <Card key={q.id} className="p-4 space-y-3">
          <div className="text-sm font-bold">{idx + 1}. {q.prompt}</div>
          <div className="space-y-2">
            {q.choices.map((choice, ci) => {
              const active = answers[q.id] === ci;
              return (
                <button
                  key={ci}
                  onClick={() => setAnswers((s) => ({ ...s, [q.id]: ci }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition ${active ? 'bg-accent' : 'bg-muted/40 hover:bg-muted/70'}`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 grid place-items-center ${active ? 'border-primary' : 'border-border'}`}>
                    {active && <span className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </span>
                  <span className={`text-sm flex-1 ${active ? 'font-semibold' : ''}`}>{choice}</span>
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <div className="max-w-md mx-auto">
          <Button className="w-full" onClick={submit} disabled={!allAnswered || submitting}>
            {allAnswered ? 'Submit answers' : 'Answer every question'}
          </Button>
        </div>
      </div>
    </div>
  );
};
