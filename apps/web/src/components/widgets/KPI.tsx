import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

type Tone = 'teal' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

const toneText: Record<Tone, string> = {
  teal: 'text-foreground',
  blue: 'text-foreground',
  emerald: 'text-foreground',
  rose: 'text-red-700',
  amber: 'text-amber-700',
  violet: 'text-foreground',
};

interface KPIProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
}

// Color is reserved for values that need attention; everything else stays neutral.
export const KPI = ({ label, value, tone = 'teal', hint }: KPIProps) => (
  <Card className="px-5 py-4 gap-1">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className={cn('text-3xl font-semibold tabular-nums tracking-tight', toneText[tone])}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </Card>
);
