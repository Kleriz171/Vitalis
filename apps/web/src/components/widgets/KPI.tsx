import { cn } from '../../lib/utils';

type Tone = 'teal' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

interface KPIProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
}

/**
 * One reading in a situation strip (a row of these sits in one panel, divided by hairlines).
 * Colour only when the value needs attention.
 */
export const KPI = ({ label, value, tone = 'teal', hint }: KPIProps) => (
  <div className="px-6 py-4 first:pl-6 border-l border-border first:border-l-0 min-w-0">
    <div className={cn('num text-[30px] leading-none font-semibold tracking-[-0.02em]', tone === 'rose' ? 'text-[hsl(var(--sos))]' : tone === 'amber' ? 'text-[hsl(var(--warn))]' : 'text-foreground')}>
      {value}
    </div>
    <div className="mt-2 text-[13px] text-muted-foreground truncate">{label}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </div>
);
