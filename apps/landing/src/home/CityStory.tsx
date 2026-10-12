import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n';
import { StoreBadges } from '../components/StoreBadges';
import LABELS from './city-labels.json';

/**
 * The hero and "how it works" in one: the real centre of Tirana, rendered in Blender
 * (scripts/city/ at the repo root), played frame by frame as the visitor scrolls.
 * Text beats crossfade over it; HTML labels follow the SOS, the defibrillator and the runners.
 */
const FRAMES = 96;
// Frame ranges that match the Blender timeline: SOS appears ~14, responder 28→66, runner 44→88.
const BEATS: [number, number][] = [[1, 12], [12, 28], [28, 48], [48, 78], [78, 96]];
type LabelKey = 'sos' | 'aed' | 'r1' | 'r2';
// When each label is worth showing (frame ranges).
const LABEL_RANGE: Record<LabelKey, [number, number]> = { sos: [18, 96], r1: [30, 65], aed: [47, 96], r2: [50, 86] };
const labels = LABELS as Record<LabelKey, [number, number, number]>[];
const PRIORITY: LabelKey[] = ['sos', 'r1', 'r2', 'aed'];

const src = (width: number, n: number) => `/city/${width}/f-${String(n).padStart(3, '0')}.webp`;
// Load a sparse set first so scrubbing works at once, then fill in.
const LOAD_ORDER = (() => {
  const seen = new Set<number>(), order: number[] = [];
  for (const step of [16, 8, 4, 2, 1]) for (let n = 1; n <= FRAMES; n += step) if (!seen.has(n)) { seen.add(n); order.push(n); }
  if (!seen.has(FRAMES)) order.push(FRAMES);
  return order;
})();

export const CityStory = () => {
  const { t } = useLang();
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const beatEls = useRef<(HTMLDivElement | null)[]>([]);
  const labelEls = useRef<Partial<Record<LabelKey, HTMLSpanElement | null>>>({});
  const [beat, setBeat] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sec = section.current!, st = stage.current!, cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const narrow = window.innerWidth < 900;
    // Pick the frame set that covers the screen's real pixels (Retina desktops need the 2560 set).
    const need = (narrow ? window.innerWidth * 1.6 : window.innerWidth) * Math.min(devicePixelRatio, 2);
    const width = need > 1800 ? 2560 : need > 1100 ? 1600 : 1000;
    const images: (HTMLImageElement | undefined)[] = [];
    let cancelled = false, lastDrawn = -1, lastBeat = -1, raf = 0;

    // Progressive loading, two at a time; Save-Data only gets the sparse set.
    // Phones get every second frame (half the data, same story); Save-Data only the sparse set.
    const queue = LOAD_ORDER.filter((n, i) => (!conn?.saveData || i < 7) && (!narrow || n % 2 === 1 || n === FRAMES));
    const next = () => {
      const n = queue.shift();
      if (n === undefined || cancelled) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { images[n] = img; if (n === 1) setReady(true); lastDrawn = -1; schedule(); next(); };
      img.onerror = next;
      img.src = src(width, n);
    };
    next(); next();

    const nearest = (f: number) => {
      for (let d = 0; d < FRAMES; d++) {
        if (images[f - d]) return f - d;
        if (images[f + d]) return f + d;
      }
      return -1;
    };

    // Cover-fit with a focal point, so phones keep the action in view.
    const fit = () => {
      const cw = st.clientWidth, ch = st.clientHeight;
      const s = Math.max(cw / 16, ch / 10), dw = 16 * s, dh = 10 * s;   // frames are 16:10 at every size
      const fx = narrow ? 0.64 : 0.5;
      const ox = Math.min(0, Math.max(cw - dw, cw / 2 - fx * dw)), oy = (ch - dh) / 2;
      return { cw, ch, dw, dh, ox, oy };
    };

    const draw = () => {
      raf = 0;
      const r = sec.getBoundingClientRect();
      const span = sec.offsetHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      let frame = 1 + p * (FRAMES - 1);
      const b = BEATS.findIndex(([, to], i) => frame < to || i === BEATS.length - 1);
      if (reduce.matches) frame = BEATS[b][1];            // stills, no scrubbing
      const f = Math.round(frame);

      if (b !== lastBeat) { lastBeat = b; setBeat(b); }
      // Beat text: fade across a few frames around each boundary.
      beatEls.current.forEach((el, i) => {
        if (!el) return;
        const [from, to] = BEATS[i];
        // Sequential, never overlapping: out over the last frames of a beat, in over the first of the next.
        const edge = 2.5;
        const fadeIn = i === 0 ? 1 : (frame - from) / edge;
        const fadeOut = i === BEATS.length - 1 ? 1 : (to - frame) / edge;
        const vis = reduce.matches ? Number(i === b) : Math.min(1, Math.max(0, Math.min(fadeIn, fadeOut)));
        el.style.opacity = String(vis);
        el.style.transform = reduce.matches ? '' : `translateY(${(1 - vis) * (frame < (from + to) / 2 ? 18 : -18)}px)`;
        el.style.visibility = vis < 0.01 ? 'hidden' : 'visible';
      });

      const { cw, ch, dw, dh, ox, oy } = fit();
      const dpr = Math.min(devicePixelRatio, 2);
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
        cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); lastDrawn = -1;
      }
      const have = nearest(f);
      if (have > 0 && have !== lastDrawn) {
        lastDrawn = have;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(images[have]!, ox, oy, dw, dh);
      }

      // Labels follow the 3D points (positions exported from Blender per frame).
      const row = labels[Math.min(FRAMES, Math.max(1, f)) - 1];
      const placed: DOMRect[] = [];
      // In priority order: a label that would cover a more important one steps aside.
      PRIORITY.forEach((k) => {
        const el = labelEls.current[k];
        if (!el) return;
        const [u, v, s] = row[k];
        const [a, z] = LABEL_RANGE[k];
        const x = ox + u * dw, y = oy + v * dh;
        // Keep labels clear of the text column (large screens), the progress rail and the nav.
        const minX = narrow ? 24 : cw * 0.46;
        let on = s > 0 && f >= a && f <= z && x > minX && x < cw - 72 && y > 96 && y < ch - 24;
        const w = el.offsetWidth, h = el.offsetHeight;
        const box = new DOMRect(x - w / 2 - 4, y - h - 14, w + 8, h + 8);
        if (on && placed.some((p) => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top)) on = false;
        if (on) placed.push(box);
        el.style.opacity = on ? '1' : '0';
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - 10px))`;
      });
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduce.addEventListener('change', schedule);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, []);

  const [, ...story] = BEATS;
  return (
    <section ref={section} className="relative bg-page text-white h-[560vh]" aria-label={t.hero.title}>
      <div className="sticky top-0 h-svh overflow-hidden flex flex-col lg:block">
        {/* The city. The first frame is a plain image, so the hero paints before any script runs. */}
        <div ref={stage} className="relative flex-1 min-h-0 lg:absolute lg:inset-0" aria-hidden>
          <img
            src={src(1600, 1)}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover object-[64%_50%] lg:object-center transition-opacity duration-700 ${ready ? 'opacity-0' : 'opacity-100'}`}
            fetchPriority="high"
          />
          <canvas ref={canvas} className="city-in absolute inset-0 h-full w-full" />
          {/* Keeps the headline readable on large screens without hiding the city. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] bg-gradient-to-r from-page via-page/80 to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-page to-transparent lg:hidden" />
          {/* Labels: HTML, so they stay sharp and speak the visitor's language. */}
          {(Object.keys(LABEL_RANGE) as LabelKey[]).map((k) => (
            <span
              key={k}
              ref={(el) => { labelEls.current[k] = el; }}
              className={`city-label absolute left-0 top-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold shadow-lg transition-opacity duration-300 ${
                k === 'sos' ? 'bg-sos text-white' : k === 'r1' ? 'bg-white text-ink' : 'bg-amber text-ink'}`}
              style={{ opacity: 0 }}
            >
              {t.story.labels[k]}
            </span>
          ))}
        </div>

        {/* Text */}
        <div className="relative shrink-0 h-[44svh] lg:absolute lg:inset-0 lg:h-auto">
          <div className="mx-auto h-full max-w-7xl px-5 sm:px-8 relative">
            <div ref={(el) => { beatEls.current[0] = el; }} className="beat lg:top-[18svh]">
              <h1 className="hero-title rise">{t.hero.title}</h1>
              <p className="rise rise-2 mt-5 lg:mt-7 max-w-[40ch] text-lg lg:text-xl text-mist leading-relaxed">{t.hero.lead}</p>
              <div className="rise rise-3 mt-7 lg:mt-10">
                <StoreBadges dark />
                <p className="mt-3 text-sm text-mist">{t.hero.note}</p>
              </div>
            </div>
            {story.map((_, i) => (
              <div key={i} ref={(el) => { beatEls.current[i + 1] = el; }} className="beat lg:top-[30svh]" style={{ opacity: 0, visibility: 'hidden' }}>
                <h2 className="beat-title">{t.story.beats[i].title}</h2>
                <p className="mt-4 lg:mt-6 max-w-[42ch] text-base lg:text-xl text-mist leading-relaxed">{t.story.beats[i].body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Where you are in the story */}
        <ol className="absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col gap-3 lg:flex" aria-hidden>
          {BEATS.map((_, i) => (
            <li key={i} className={`h-8 w-[3px] rounded-full transition-colors duration-300 ${i <= beat ? 'bg-white' : 'bg-white/20'}`} />
          ))}
        </ol>
        <p className={`absolute bottom-5 left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2 text-sm text-mist transition-opacity duration-500 ${beat === 0 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="scroll-cue" aria-hidden />{t.hero.cue}
        </p>
        <p className="absolute bottom-4 right-5 hidden text-xs text-mist/70 lg:block">{t.story.credit}</p>
      </div>
    </section>
  );
};
