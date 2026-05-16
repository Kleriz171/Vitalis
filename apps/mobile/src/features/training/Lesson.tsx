import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, ListChecks, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { resolveLessonTutorial, type TrainingCourseDetail, type TrainingLesson } from './shared';

interface CourseDetail extends TrainingCourseDetail {
  lessons: TrainingLesson[];
}

export const LessonPage = () => {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const nav = useNavigate();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CourseDetail>(`/training/courses/${slug}`)
      .then((r) => setCourse(r.data))
      .catch((err: any) => {
        toast.error(err.response?.data?.error ?? 'Could not load lesson');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const { lesson, lessonIndex, nextLesson, isLast } = useMemo(() => {
    if (!course) return { lesson: null, lessonIndex: 0, nextLesson: null, isLast: false };
    const idx = course.lessons.findIndex((l) => l.id === lessonId);
    const safe = idx >= 0 ? idx : 0;
    return {
      lesson: course.lessons[safe] ?? null,
      lessonIndex: safe,
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

  if (loading) {
    return (
      <div className="px-4 pt-4 space-y-3">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!course || !lesson) {
    return <div className="px-4 pt-6 text-sm text-muted-foreground">Lesson unavailable.</div>;
  }

  const tutorial = resolveLessonTutorial(course.slug, lesson.videoUrl);
  const progress = course.lessons.length
    ? Math.round(((lessonIndex + 1) / course.lessons.length) * 100)
    : 0;

  return (
    <div className="px-4 pt-4 pb-36 space-y-4">
      <Card className="p-5 bg-primary text-primary-foreground border-0">
        <div className="flex items-start gap-3">
          <button onClick={() => nav(-1)} className="w-9 h-9 rounded-full bg-white/15 grid place-items-center">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <div className="text-[10px] tracking-widest font-bold opacity-80">{course.badgeLabel.toUpperCase()}</div>
            <div className="text-xl font-extrabold">{lesson.title}</div>
            {lesson.summary && <div className="text-sm opacity-90 mt-1">{lesson.summary}</div>}
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                <BookOpen size={12} /> Lesson {lessonIndex + 1} of {course.lessons.length}
              </Badge>
              <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                <Clock3 size={12} /> {lesson.durationMin} min
              </Badge>
              {tutorial && (
                <Badge variant="secondary" className="bg-white/15 text-white border-transparent">
                  <PlayCircle size={12} /> Tutorial video
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Course progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-white/20 [&_[data-slot=progress-indicator]]:bg-white" />
        </div>
      </Card>

      {tutorial && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PlayCircle size={18} className="text-primary" />
            <div className="font-bold">Watch the tutorial</div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-black aspect-video">
            {tutorial.kind === 'embed' ? (
              <iframe
                src={tutorial.url}
                title={`${lesson.title} tutorial`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <video
                src={tutorial.url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full"
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Watch first, then use the written steps below as a quick refresher.
          </p>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ListChecks size={18} className="text-primary" />
          <div className="font-bold">What to do</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Read-through guide
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            Practical refresher
          </Badge>
        </div>
        <p className="text-sm leading-7 whitespace-pre-line">{lesson.body}</p>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          <div className="font-bold">Course outline</div>
        </div>
        <div className="space-y-2">
          {course.lessons.map((item, index) => {
            const active = item.id === lesson.id;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${active ? 'bg-accent text-accent-foreground' : 'bg-muted/40'}`}
              >
                <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${active ? 'bg-primary text-primary-foreground' : 'bg-background'}`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{item.title}</div>
                  {item.summary && <div className="text-[11px] text-muted-foreground truncate">{item.summary}</div>}
                </div>
                {active && <Badge variant="secondary" className="text-[10px]">Current</Badge>}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="fixed bottom-20 left-0 right-0 px-4 z-30">
        <Card className="max-w-md mx-auto p-3 flex-row gap-2 bg-card/95 backdrop-blur">
          <Button variant="outline" onClick={() => advance(false)} disabled={busy} className="flex-1">
            <Check size={16} /> Mark complete
          </Button>
          <Button onClick={() => advance(true)} disabled={busy} className="flex-1">
            {isLast ? 'Finish' : 'Next lesson'} <ArrowRight size={16} />
          </Button>
        </Card>
      </div>
    </div>
  );
};
