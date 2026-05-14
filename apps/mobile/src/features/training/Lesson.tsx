import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface Lesson {
  id: string;
  title: string;
  summary?: string;
  body: string;
  durationMin: number;
}
interface CourseDetail {
  id: string;
  slug: string;
  title: string;
  badgeLabel: string;
  lessons: Lesson[];
}

export const LessonPage = () => {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const nav = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<CourseDetail>(`/training/courses/${slug}`).then((r) => setCourse(r.data)).catch(() => {});
  }, [slug]);

  const { lesson, nextLesson, isLast } = useMemo(() => {
    if (!course) return { lesson: null, nextLesson: null, isLast: false };
    const idx = course.lessons.findIndex((l) => l.id === lessonId);
    const safe = idx >= 0 ? idx : 0;
    return {
      lesson: course.lessons[safe] ?? null,
      nextLesson: course.lessons[safe + 1] ?? null,
      isLast: safe === course.lessons.length - 1,
    };
  }, [course, lessonId]);

  const advance = async (move: boolean) => {
    if (!course || !lesson) return;
    try {
      setBusy(true);
      await api.post(`/training/enrollments/${course.id}/lessons/complete`, { lessonId: lesson.id });
      if (move && nextLesson) nav(`/app/training/lesson/${course.slug}/${nextLesson.id}`, { replace: true });
      else if (move) nav(`/app/training/${course.slug}`, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Could not save progress');
    } finally {
      setBusy(false);
    }
  };

  if (!course || !lesson) return <div className="px-4 pt-6">Loading…</div>;

  return (
    <div className="px-4 pt-4 pb-32 space-y-4">
      <Card className="p-5 bg-primary text-primary-foreground border-0">
        <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center mb-3">
          <ArrowLeft size={16} />
        </button>
        <div className="text-[10px] tracking-widest font-bold opacity-80">{course.badgeLabel.toUpperCase()}</div>
        <div className="text-xl font-extrabold">{lesson.title}</div>
        {lesson.summary && <div className="text-sm opacity-90 mt-1">{lesson.summary}</div>}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="text-xs font-bold uppercase tracking-wide text-primary">~{lesson.durationMin} min</div>
        <p className="text-sm leading-relaxed whitespace-pre-line">{lesson.body}</p>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <div className="flex gap-2 max-w-md mx-auto">
          <Button variant="outline" onClick={() => advance(false)} disabled={busy} className="flex-1">
            <Check size={16} /> Mark complete
          </Button>
          <Button onClick={() => advance(true)} disabled={busy} className="flex-1">
            {isLast ? 'Finish' : 'Next lesson'} <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};
