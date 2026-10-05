import type { ReactNode } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { Tile, type TileTone } from './tile';
import { cn } from '../../lib/utils';

/**
 * The phone app's list language (apps/native/components/ui/List.tsx) on the desktop: one white
 * panel, rows with an icon tile, a bold title, one summary line and whatever sits on the right.
 */
export const Panel = ({ title, aside, children, className }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={cn('rounded-2xl border border-border bg-card overflow-hidden', className)}>
    {title && (
      <div className="flex items-center justify-between gap-3 px-5 h-14 border-b border-border">
        <h2 className="text-[16px] font-extrabold tracking-[-0.01em]">{title}</h2>
        {aside}
      </div>
    )}
    <div className="divide-y divide-border stagger" style={{ ['--base' as string]: '180ms' }}>{children}</div>
  </section>
);

export const Row = ({
  icon, tone = 'teal', title, summary, meta, right, className,
}: {
  icon: Icon;
  tone?: TileTone;
  title: ReactNode;
  summary?: ReactNode;
  /** Small chips or facts under the summary. */
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex items-center gap-4 px-5 py-3.5', className)}>
    <Tile icon={icon} tone={tone} />
    <div className="min-w-0 flex-1">
      <div className="font-bold truncate">{title}</div>
      {summary && <div className="text-[13px] text-muted-foreground truncate">{summary}</div>}
      {meta && <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{meta}</div>}
    </div>
    {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
  </div>
);

/** A small fact chip: "24 hours", "Pads 11/2027". */
export const Chip = ({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'teal' | 'sos' | 'amber' }) => (
  <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium', {
    muted: 'bg-muted text-muted-foreground',
    teal: 'bg-[hsl(173_55%_92%)] text-[hsl(175_77%_24%)]',
    sos: 'bg-[hsl(0_80%_95%)] text-[hsl(0_72%_45%)]',
    amber: 'bg-[hsl(36_95%_92%)] text-[hsl(30_90%_33%)]',
  }[tone])}>
    {children}
  </span>
);
