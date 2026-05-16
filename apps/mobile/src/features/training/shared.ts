export interface TrainingLesson {
  id: string;
  title: string;
  summary?: string;
  body: string;
  durationMin: number;
  videoUrl?: string | null;
}

export interface TrainingCourseDetail {
  id: string;
  slug: string;
  title: string;
  badgeLabel: string;
  lessons: TrainingLesson[];
}

const DEFAULT_TUTORIAL_VIDEO = 'https://www.youtube-nocookie.com/embed/BQNNOh8c8ks';

const COURSE_VIDEO_FALLBACKS: Record<string, string> = {
  'cpr-adult': 'https://www.youtube-nocookie.com/embed/BQNNOh8c8ks',
  'aed-use': 'https://www.youtube-nocookie.com/embed/cosVBV96E2g',
  'bleeding-control': 'https://www.youtube-nocookie.com/embed/BQNNOh8c8ks',
  'choking-adult': 'https://www.youtube-nocookie.com/embed/BQNNOh8c8ks',
  'recovery-position': 'https://www.youtube-nocookie.com/embed/cosVBV96E2g',
  'burns-first-aid': 'https://www.youtube-nocookie.com/embed/BQNNOh8c8ks',
};

const isDirectVideoFile = (url: string) => /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url);

const toEmbedUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.replace('/', '');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }

      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
      }
    }

    if (host === 'youtube-nocookie.com' && url.pathname.startsWith('/embed/')) {
      return rawUrl;
    }

    return rawUrl;
  } catch {
    return null;
  }
};

export const resolveLessonTutorial = (
  courseSlug: string,
  lessonVideoUrl?: string | null,
) => {
  const candidate = lessonVideoUrl ?? COURSE_VIDEO_FALLBACKS[courseSlug] ?? DEFAULT_TUTORIAL_VIDEO;
  const normalized = toEmbedUrl(candidate);

  if (!normalized) return null;

  if (isDirectVideoFile(normalized)) {
    return { kind: 'video' as const, url: normalized };
  }

  return { kind: 'embed' as const, url: normalized };
};
