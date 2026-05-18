import { motion } from 'framer-motion';
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
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -2 }}
  >
    <Card className="p-5 transition-shadow hover:shadow-[0_10px_30px_-12px_hsl(173_80%_40%/0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <motion.div
            key={String(value)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={cn('text-3xl font-bold mt-1 tabular-nums', toneAccent[tone])}
          >
            {value}
          </motion.div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
        </div>
        <span className={cn('w-2 h-10 rounded-full', toneBar[tone])} />
      </div>
    </Card>
  </motion.div>
);
