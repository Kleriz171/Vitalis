import { useEffect, useRef } from 'react';
import { animate } from 'framer-motion';
import type { Icon } from '@phosphor-icons/react';
import { EASE } from '../../lib/motion';
import { Tile, type TileTone } from '../ui/tile';
import { cn } from '../../lib/utils';

type Tone = 'teal' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

interface KPIProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
  icon?: Icon;
  iconTone?: TileTone;
}

/**
 * One reading. A row of these sits in a grid.
 * Colour only when the value needs attention.
 */
export const KPI = ({ label, value, tone = 'teal', hint, icon, iconTone = 'teal' }: KPIProps) => (
  // A raised reading card: round icon, big number, plain label.
  <div className="flex items-center gap-4 rounded-2xl bg-card border border-border px-5 py-4 min-w-0 shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
    {icon && <Tile icon={icon} tone={iconTone} size="lg" round />}
    <div className="min-w-0">
      <div className={cn('num text-[28px] leading-none font-extrabold tracking-[-0.03em]', tone === 'rose' ? 'text-[hsl(var(--sos))]' : tone === 'amber' ? 'text-[hsl(var(--warn))]' : 'text-foreground')}>
        {typeof value === 'number' ? <CountTo value={value} /> : value}
      </div>
      <div className="mt-1.5 text-[13px] text-muted-foreground truncate">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  </div>
);

/** Numbers glide to their new value instead of snapping. */
const CountTo = ({ value }: { value: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(from.current, value, {
      duration: 0.6,
      ease: EASE,
      onUpdate: v => { el.textContent = String(Math.round(v)); },
    });
    from.current = value;
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{value}</span>;
};
