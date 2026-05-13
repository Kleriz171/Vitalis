import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

type Tone = 'teal' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

const toneAccent: Record<Tone, string> = {
  teal: 'text-primary',
  blue: 'text-blue-600',
  emerald: 'text-emerald-600',
  rose: 'text-rose-600',
  amber: 'text-amber-600',
  violet: 'text-violet-600',
};

const toneBar: Record<Tone, string> = {
  teal: 'bg-primary/15',
  blue: 'bg-blue-100',
  emerald: 'bg-emerald-100',
  rose: 'bg-rose-100',
  amber: 'bg-amber-100',
  violet: 'bg-violet-100',
};

interface KPIProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
}

export const KPI = ({ label, value, tone = 'teal', hint }: KPIProps) => (
  <Card className="p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('text-3xl font-bold mt-1 tabular-nums', toneAccent[tone])}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </div>
      <span className={cn('w-2 h-10 rounded-full', toneBar[tone])} />
    </div>
  </Card>
);
