import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';

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
  shortDescription: string;
  heroEmoji: string;
  badgeLabel: string;
  passingScore: number;
  estimatedMinutes: number;
  lessons: Lesson[];
}
interface Enrollment { id: string; courseId: string; completedLessonIds: string[] }

export const CourseDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, e] = await Promise.all([
          api.get<CourseDetail>(`/training/courses/${slug}`),
          api.get<Enrollment[]>('/training/enrollments'),
        ]);
        setCourse(c.data);
        setEnrollment(e.data.find((x) => x.courseId === c.data.id) ?? null);
      } catch (err: any) {
        toast.error(err.response?.data?.error ?? 'Could not load course');
      }
    })();
  }, [slug]);

  const startLesson = async (lessonId: string) => {
    if (!course) return;
    try {
      setBusy(true);
      if (!enrollment) {
        const { data } = await api.post('/training/enrollments', { courseId: course.id });
        setEnrollment(data);
      }
      nav(`/app/training/lesson/${course.slug}/${lessonId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Could not enrol');
    } finally {
      setBusy(false);
    }
  };

  if (!course) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    );
  }

  const completed = new Set(enrollment?.completedLessonIds ?? []);
  const allDone = course.lessons.every((l) => completed.has(l.id));
  const progress = course.lessons.length
    ? Math.round((completed.size / course.lessons.length) * 100)
    : 0;

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <Card className="p-5 bg-primary text-primary-foreground border-0">
        <div className="flex items-start gap-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <div className="text-[10px] tracking-widest font-bold opacity-80">{course.badgeLabel.toUpperCase()}</div>
            <div className="text-xl font-extrabold flex items-center gap-2">
              <span className="text-2xl">{course.heroEmoji}</span>
              {course.title}
            </div>
            <div className="text-sm opacity-90 mt-1">{course.shortDescription}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs font-bold mb-1">{progress}% complete · {course.estimatedMinutes} min total</div>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={18} className="text-primary" />
          <div className="font-bold">Lessons</div>
        </div>
        <div className="space-y-1">
          {course.lessons.map((lesson, idx) => {
            const done = completed.has(lesson.id);
            return (
              <button
                key={lesson.id}
                onClick={() => startLesson(lesson.id)}
                disabled={busy}
                className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/40 rounded-lg px-1"
              >
                <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${done ? 'bg-success text-white' : 'bg-muted text-foreground'}`}>
                  {done ? <Check size={14} /> : idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{lesson.title}</div>
                  {lesson.summary && <div className="text-xs text-muted-foreground">{lesson.summary}</div>}
                  <div className="text-[11px] font-bold text-primary mt-0.5">{lesson.durationMin} min</div>
                </div>
                <PlayCircle size={20} className="text-primary" />
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="font-bold">Final quiz</div>
        <p className="text-sm text-muted-foreground">
          Pass with {course.passingScore}% or higher to earn the {course.badgeLabel} badge. Valid for 12 months.
        </p>
        <Button onClick={() => nav(`/app/training/quiz/${course.slug}`)} disabled={!allDone}>
          {allDone ? 'Take the quiz' : 'Finish all lessons first'}
        </Button>
      </Card>
    </div>
  );
};
