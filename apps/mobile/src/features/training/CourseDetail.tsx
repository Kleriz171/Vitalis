import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Check, Clock3, PlayCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { resolveLessonTutorial, type TrainingCourseDetail, type TrainingLesson } from './shared';

interface CourseDetail extends TrainingCourseDetail {
 shortDescription: string;
 heroEmoji: string;
 passingScore: number;
 estimatedMinutes: number;
 lessons: TrainingLesson[];
}
interface Enrollment { id: string; courseId: string; completedLessonIds: string[] }

export const CourseDetail = () => {
 const { slug } = useParams<{ slug: string }>();
 const nav = useNavigate();
 const [course, setCourse] = useState<CourseDetail | null>(null);
 const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
 const [busy, setBusy] = useState(false);
 const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
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

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  if (!course) return <div className="px-4 pt-6 text-sm text-muted-foreground">Course unavailable.</div>;

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
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                <BookOpen size={12} /> {course.lessons.length} lessons
              </Badge>
              <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                <Clock3 size={12} /> {course.estimatedMinutes} min
              </Badge>
              <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                <Sparkles size={12} /> {course.passingScore}% to pass
              </Badge>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>{progress}% complete</span>
            <span>{completed.size}/{course.lessons.length} lessons done</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/20 [&_[data-slot=progress-indicator]]:bg-white" />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={18} className="text-primary" />
          <div className="font-bold">Lessons</div>
        </div>
        <div className="space-y-3">
          {course.lessons.map((lesson, idx) => {
            const done = completed.has(lesson.id);
            const tutorial = resolveLessonTutorial(course.slug, lesson.videoUrl);
            return (
              <button
                key={lesson.id}
                onClick={() => startLesson(lesson.id)}
                disabled={busy}
                className="w-full rounded-2xl border bg-background px-4 py-4 text-left transition hover:bg-muted/20 disabled:opacity-70"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl grid place-items-center text-xs font-bold shrink-0 ${done ? 'bg-success text-white' : 'bg-muted text-foreground'}`}>
                    {done ? <Check size={16} /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{lesson.title}</div>
                        {lesson.summary && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {lesson.summary}
                          </div>
                        )}
                      </div>
                      <PlayCircle size={20} className="text-primary shrink-0 mt-0.5" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        <Clock3 size={10} /> {lesson.durationMin} min
                      </Badge>
                      {tutorial && (
                        <Badge variant="outline" className="text-[10px]">
                          Video tutorial
                        </Badge>
                      )}
                      <Badge variant={done ? 'secondary' : 'outline'} className="text-[10px]">
                        {done ? 'Completed' : idx === 0 && progress === 0 ? 'Start here' : 'Open lesson'}
                      </Badge>
                    </div>
                  </div>
                </div>
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
