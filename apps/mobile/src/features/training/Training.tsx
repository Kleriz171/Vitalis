import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, GraduationCap, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { Badge } from '../../components/ui/badge';

interface CourseSummary {
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
}

interface Enrollment {
  id: string;
  courseId: string;
  completedLessonIds: string[];
}

interface Certification {
  id: string;
  courseId: string;
  badgeLabel: string;
  expiresAt: string;
}

export const Training = () => {
  const nav = useNavigate();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, e, cert] = await Promise.all([
          api.get<CourseSummary[]>('/training/courses'),
          api.get<Enrollment[]>('/training/enrollments'),
          api.get<Certification[]>('/training/certifications'),
        ]);
        setCourses(c.data ?? []);
        setEnrollments(e.data ?? []);
        setCerts(cert.data ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCerts = certs.filter((c) => new Date(c.expiresAt).getTime() > Date.now());
  const enrollMap = new Map(enrollments.map((e) => [e.courseId, e]));
  const certMap = new Map(activeCerts.map((c) => [c.courseId, c]));

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <Card className="p-5 bg-primary text-primary-foreground border-0">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-white/20 grid place-items-center">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="text-[10px] tracking-widest font-bold opacity-80">FIRST AID TRAINING</div>
            <div className="text-xl font-extrabold">Become a life-saver.</div>
          </div>
        </div>
        <p className="text-sm opacity-90">Quick lessons based on Red Cross guidelines.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
            <Award size={12} /> {activeCerts.length} active certs
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/15 px-2.5 py-1 rounded-full">
            <ShieldCheck size={12} /> Educational use
          </span>
        </div>
      </Card>

      {activeCerts.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-bold mb-2">Your certifications</div>
          <div className="flex flex-wrap gap-2">
            {activeCerts.map((c) => (
              <button
                key={c.id}
                onClick={() => nav(`/app/training/certificate/${c.id}`)}
                className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-bold"
              >
                {c.badgeLabel}
              </button>
            ))}
          </div>
        </Card>
      )}

      {loading
        ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        : courses.map((course) => {
            const enrollment = enrollMap.get(course.id);
            const cert = certMap.get(course.id);
            const progress = course.lessonCount
              ? Math.round(((enrollment?.completedLessonIds.length ?? 0) / course.lessonCount) * 100)
              : 0;
            return (
              <button
                key={course.id}
                onClick={() => nav(`/app/training/${course.slug}`)}
                className="w-full text-left"
              >
                <Card className="p-4 flex flex-row items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent grid place-items-center text-2xl shrink-0">
                    {course.heroEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-sm">{course.title}</div>
                      {cert && <Badge variant="secondary" className="text-[10px] uppercase">Certified</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{course.shortDescription}</div>
                    <div className="text-[11px] font-bold text-primary mt-1 uppercase tracking-wide">
                      {course.estimatedMinutes} min · {course.lessonCount} lessons · {course.level}
                    </div>
                    <div className="h-1.5 mt-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
    </div>
  );
};
