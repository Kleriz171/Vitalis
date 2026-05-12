import { ReactNode } from 'react';

type Tone = 'cyan' | 'pink' | 'amber' | 'emerald' | 'violet' | 'slate';

const tones: Record<Tone, string> = {
  cyan: 'bg-neon-cyan/15 text-neon-cyan ring-1 ring-neon-cyan/30',
  pink: 'bg-neon-pink/15 text-neon-pink ring-1 ring-neon-pink/30',
  amber: 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30',
  emerald: 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30',
  violet: 'bg-violet-400/15 text-violet-300 ring-1 ring-violet-400/30',
  slate: 'bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/30',
};

const statusToTone: Record<string, Tone> = {
  pending: 'amber',
  assigned: 'cyan',
  en_route: 'violet',
  on_scene: 'pink',
  resolved: 'emerald',
  cancelled: 'slate',
};

export const Badge = ({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}>
    {children}
  </span>
);

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={statusToTone[status] ?? 'slate'}>{status.replace('_', ' ')}</Badge>
);
