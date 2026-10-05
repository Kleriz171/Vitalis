import { ReactNode, useLayoutEffect, useRef, useState } from 'react';

/**
 * A rounded panel with its top-right corner cut out, so controls can dock in the notch beside
 * the content instead of floating over it. The shape is one SVG path used twice: as the
 * content's clip-path and as its outline.
 */
export const NotchedPanel = ({ notchWidth, notchHeight, radius = 22, notch, children, className = '' }: {
  notchWidth: number;
  notchHeight: number;
  radius?: number;
  /** What sits in the notch. */
  notch: ReactNode;
  children: ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const r = radius;
  const nx = w - notchWidth; // where the notch starts
  const d = w && h
    ? [
        `M ${r} 0`, `H ${nx - r}`, `A ${r} ${r} 0 0 1 ${nx} ${r}`,
        `V ${notchHeight - r}`, `A ${r} ${r} 0 0 0 ${nx + r} ${notchHeight}`,
        `H ${w - r}`, `A ${r} ${r} 0 0 1 ${w} ${notchHeight + r}`,
        `V ${h - r}`, `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
        `H ${r}`, `A ${r} ${r} 0 0 1 0 ${h - r}`,
        `V ${r}`, `A ${r} ${r} 0 0 1 ${r} 0`, 'Z',
      ].join(' ')
    : '';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="absolute inset-0 drop-shadow-[0_10px_24px_hsl(176_30%_10%/0.10)]">
        <div className="absolute inset-0 bg-card" style={d ? { clipPath: `path('${d}')` } : { borderRadius: r }}>
          {children}
        </div>
      </div>
      {d && (
        <svg className="pointer-events-none absolute inset-0 w-full h-full z-[450]" aria-hidden>
          <path d={d} fill="none" stroke="hsl(var(--border))" strokeWidth="1.5" />
        </svg>
      )}
      <div className="absolute top-0 right-0 flex flex-col items-center justify-center gap-4 z-[460]" style={{ width: notchWidth, height: notchHeight }}>
        {notch}
      </div>
    </div>
  );
};
