import type { Icon } from '@phosphor-icons/react';
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
 * One reading in a situation strip (a row of these sits in one panel, divided by hairlines).
 * Colour only when the value needs attention.
 */
export const KPI = ({ label, value, tone = 'teal', hint, icon, iconTone = 'teal' }: KPIProps) => (
  <div className="flex items-center gap-4 px-5 py-4 border-l border-border first:border-l-0 min-w-0">
    {icon && <Tile icon={icon} tone={iconTone} size="lg" />}
    <div className="min-w-0">
      <div className={cn('num text-[28px] leading-none font-extrabold tracking-[-0.03em]', tone === 'rose' ? 'text-[hsl(var(--sos))]' : tone === 'amber' ? 'text-[hsl(var(--warn))]' : 'text-foreground')}>
        {value}
      </div>
      <div className="mt-1.5 text-[13px] text-muted-foreground truncate">{label}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  </div>
);
