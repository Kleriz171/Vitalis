export interface TrainingLessonView {
  id: string;
  title: string;
  summary?: string;
  body: string;
  imageUrl?: string;
  videoUrl?: string | null;
  durationMin: number;
}

export interface TrainingCourseDetailView {
  id: string;
  slug: string;
  title: string;
  badgeLabel: string;
  lessons: TrainingLessonView[];
}

const DEFAULT_TUTORIAL_VIDEO = 'https://www.youtube.com/embed/BQNNOh8c8ks';

const LESSON_VIDEO_URLS: Record<string, Record<string, string>> = {
  'cpr-adult': {
    'Recognising cardiac arrest': 'https://www.youtube.com/watch?v=YDFQCUCqFHA',
    'Calling for help': 'https://www.youtube.com/watch?v=9xT3GTSdO-0',
    'Quality chest compressions': 'https://www.youtube.com/watch?v=O9T25SMyz3A',
    'Using an AED': 'https://www.youtube.com/watch?v=yFjTnKzK4xg',
    'When to stop': 'https://www.youtube.com/watch?v=O9T25SMyz3A',
  },
  'aed-use': {
    'What an AED actually does': 'https://www.youtube.com/watch?v=yFjTnKzK4xg',
    'Pad placement': 'https://www.youtube.com/watch?v=yFjTnKzK4xg&t=1m40s',
    'Special situations': 'https://www.youtube.com/watch?v=yFjTnKzK4xg&t=2m35s',
    'CPR + AED rhythm': 'https://www.youtube.com/watch?v=yFjTnKzK4xg&t=3m35s',
  },
  'bleeding-control': {
    'Spot life-threatening bleeding': 'https://www.youtube.com/watch?v=8BZBFFGu5KY',
    'Direct pressure': 'https://www.youtube.com/watch?v=8BZBFFGu5KY',
    'Wound packing': 'https://www.youtube.com/watch?v=pRr3eLTd3I0',
    'Tourniquets': 'https://www.youtube.com/watch?v=pRr3eLTd3I0&t=2m17s',
  },
  'choking-adult': {
    'Mild vs severe obstruction': 'https://www.youtube.com/watch?v=0ti8Xq7-c_4',
    'Back blows': 'https://www.youtube.com/watch?v=0ti8Xq7-c_4',
    'Abdominal thrusts': 'https://www.youtube.com/watch?v=0ti8Xq7-c_4',
    'When they collapse': 'https://www.youtube.com/watch?v=O9T25SMyz3A',
  },
  'recovery-position': {
    'Who needs the recovery position': 'https://www.youtube.com/watch?v=GmqXqwSV3bo',
    'Step-by-step placement': 'https://www.youtube.com/watch?v=GmqXqwSV3bo',
    'Monitor and reposition': 'https://www.youtube.com/watch?v=3L8-IzZ5kAw',
  },
  'burns-first-aid': {
    'Stop the burning': 'https://www.youtube.com/watch?v=A5MOCywfb8c',
    'Cool with running water': 'https://www.youtube.com/watch?v=A5MOCywfb8c',
    'Cover and protect': 'https://www.youtube.com/watch?v=A5MOCywfb8c',
    'When to seek hospital care': 'https://www.youtube.com/watch?v=A5MOCywfb8c',
  },
};

const toEmbedUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = url.pathname.replace('/', '');
      return id ? `https://www.youtube.com/embed/${id}` : rawUrl;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        const id = url.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : rawUrl;
      }

      if (url.pathname.startsWith('/embed/')) {
        const id = url.pathname.split('/').filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : rawUrl;
      }
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
};

export const resolveLessonVideoUrl = (
  courseSlug: string,
  lessonTitle: string,
  lessonVideoUrl?: string | null,
) =>
  toEmbedUrl(
    LESSON_VIDEO_URLS[courseSlug]?.[lessonTitle]
      ?? lessonVideoUrl
      ?? DEFAULT_TUTORIAL_VIDEO
  );

const extractYouTubeId = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return url.pathname.replace('/', '') || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/').filter(Boolean)[1] ?? null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

export const resolveLessonVideoMeta = (
  courseSlug: string,
  lessonTitle: string,
  lessonVideoUrl?: string | null,
) => {
  const embedUrl = resolveLessonVideoUrl(courseSlug, lessonTitle, lessonVideoUrl);
  const youtubeId = extractYouTubeId(embedUrl);
  const watchUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : embedUrl;
  const thumbnailUrl = youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;

  return {
    embedUrl,
    watchUrl,
    thumbnailUrl,
  };
};
