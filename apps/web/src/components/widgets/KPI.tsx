import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

type Tone = 'teal' | 'blue' | 'emerald' | 'rose' | 'amber' | 'violet';

// Colour is reserved for values that need attention; everything else stays neutral.
const toneText: Record<Tone, string> = {
  teal: 'text-foreground',
  blue: 'text-foreground',
  emerald: 'text-foreground',
  rose: 'text-[hsl(var(--danger))] glow-danger',
  amber: 'text-[hsl(var(--warn))]',
  violet: 'text-foreground',
};

interface KPIProps {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  hint?: string;
}

/** A readout: small mono label, large mono number. */
export const KPI = ({ label, value, tone = 'teal', hint }: KPIProps) => (
  <Card className="px-5 py-4 gap-1.5">
    <div className="hud-label">{label}</div>
    <div className={cn('hud-num text-[32px] leading-none font-medium tracking-tight', toneText[tone])}>{value}</div>
    {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
  </Card>
);
