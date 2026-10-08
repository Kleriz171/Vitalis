import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { type Icon } from '@phosphor-icons/react';
import type { RootState } from '../../store';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/logo';

/**
 * The paper version of a page, shown only when printing (Export PDF): a designed report in the
 * Vitalis colours, not a screenshot. A4 portrait (index.css @page). Charts are plain SVG with a
 * viewBox, so they print sharp at any size and need no measuring.
 */
const C = { green: '#0C5D57', deep: '#083F3B', teal: '#14A897', mint: '#7FD3C6', paper: '#F7F5F0', line: '#E4E0D6', ink: '#13201F', muted: '#5C6966', sos: '#D92D2D' };

export const stamp = (d: Date) =>
  d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The cover card: brand, title, period and who exported it. Then the sections, then the footer. */
export const Report = ({ title, period, meta = [], children }: { title: string; period: string; meta?: [string, ReactNode][]; children: ReactNode }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const all: [string, ReactNode][] = [...meta, ['Exported', stamp(new Date())], ['Exported by', user?.name ?? 'Operator']];
  return (
    <article className="report hidden print:block">
      <header className="relative overflow-hidden rounded-[22px] px-8 pt-6 pb-5 text-white" style={{ background: `linear-gradient(135deg, ${C.green} 0%, ${C.deep} 100%)` }}>
        {/* The console's map-line texture and a soft teal glow, drawn so they print. */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 700 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <radialGradient id="glow" cx="85%" cy="10%" r="60%"><stop offset="0" stopColor={C.teal} stopOpacity="0.45" /><stop offset="1" stopColor={C.teal} stopOpacity="0" /></radialGradient>
          </defs>
          <rect width="700" height="260" fill="url(#glow)" />
          <g fill="none" stroke="#fff" strokeOpacity="0.07" strokeWidth="1.2">
            <circle cx="590" cy="40" r="90" /><circle cx="590" cy="40" r="160" /><circle cx="590" cy="40" r="230" />
            <path d="M0 200c160-30 300-10 460-60s180-70 240-90M80 260 560 0M380 260 700 60" />
          </g>
        </svg>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-[13pt] font-extrabold tracking-[-0.01em]">Vitalis</span>
            <span className="text-[9pt] text-white/60 ml-1">Command · Tirana</span>
          </div>
          <span className="rounded-full border border-white/25 px-3 py-1 text-[8pt] font-semibold text-white/85">Confidential · emergency services only</span>
        </div>
        <h1 className="relative mt-6 text-[30pt] leading-[1.02] font-extrabold tracking-[-0.03em]">{title}</h1>
        <p className="relative mt-2 text-[11pt] text-white/80">{period}</p>
        <dl className="relative mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/15 pt-3 text-[8.5pt]">
          {all.map(([k, v]) => (
            <div key={k}><dt className="text-white/55">{k}</dt><dd className="mt-0.5 font-semibold text-white">{v}</dd></div>
          ))}
        </dl>
      </header>

      <div className="mt-6 space-y-6">{children}</div>

      <footer className="mt-10 flex items-center justify-between border-t pt-3 text-[7.5pt]" style={{ borderColor: C.line, color: C.muted }}>
        <span className="flex items-center gap-1.5"><Logo size={12} /> Vitalis Command · {title}</span>
        <span>Generated from live data at the time of export</span>
      </footer>
    </article>
  );
};

/** A section: "01" in teal, a bold title and one line on what it shows. */
export const Section = ({ n, title, lead, keep = true, pageBreak, children }: { n: number; title: string; lead?: string; keep?: boolean; pageBreak?: boolean; children: ReactNode }) => (
  <section className={cn(keep && 'break-inside-avoid', pageBreak && 'break-before-page')}>
    <div className="break-after-avoid flex items-baseline gap-3">
      <span className="text-[9pt] font-bold tabular-nums" style={{ color: C.teal }}>{String(n).padStart(2, '0')}</span>
      <div>
        <h2 className="text-[15pt] font-extrabold tracking-[-0.02em]" style={{ color: C.ink }}>{title}</h2>
        {lead && <p className="mt-0.5 text-[9pt]" style={{ color: C.muted }}>{lead}</p>}
      </div>
    </div>
    <div className="mt-3">{children}</div>
  </section>
);

/** A bento card: small label, a big number, a line under it, and an optional picture. */
export const Stat = ({ label, value, sub, icon: I, dark, aside, small, className, children }: {
  label: string; value: ReactNode; sub?: ReactNode; icon?: Icon; dark?: boolean; aside?: ReactNode; small?: boolean; className?: string; children?: ReactNode;
}) => (
  <div className={cn('rounded-[18px] px-4 py-3.5 flex flex-col', className)}
    style={dark ? { background: C.green, color: '#fff' } : { background: C.paper, border: `1px solid ${C.line}`, color: C.ink }}>
    <div className="flex items-center gap-1.5 text-[8.5pt] font-semibold" style={{ color: dark ? 'rgba(255,255,255,.7)' : C.muted }}>
      {I && <I size={12} weight="bold" color={dark ? C.mint : C.teal} />}{label}
    </div>
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className={cn('mt-2 leading-none font-extrabold tracking-[-0.03em] tabular-nums', small ? 'text-[18pt]' : 'text-[24pt]')}>{value}</div>
        {sub && <div className="mt-1.5 text-[8.5pt]" style={{ color: dark ? 'rgba(255,255,255,.7)' : C.muted }}>{sub}</div>}
      </div>
      {aside}
    </div>
    {children && <div className="mt-auto pt-3">{children}</div>}
  </div>
);

/** Column chart with the value on every bar that has one and the tallest bar in teal. */
export const Bars = ({ data, height = 150, dark }: { data: { label: string; value: number }[]; height?: number; dark?: boolean }) => {
  const W = 680, H = height, top = 18, bottom = 22;
  const max = Math.max(1, ...data.map(d => d.value));
  const step = W / Math.max(data.length, 1), bw = Math.min(30, step * 0.62);
  const peak = data.reduce((m, d) => Math.max(m, d.value), 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke={dark ? 'rgba(255,255,255,.25)' : C.line} />
      {data.map((d, i) => {
        const h = d.value ? Math.max(4, ((H - top - bottom) * d.value) / max) : 2;
        const x = i * step + (step - bw) / 2, y = H - bottom - h;
        const hot = d.value > 0 && d.value === peak;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={Math.min(6, bw / 3)} fill={hot ? C.teal : d.value ? (dark ? C.mint : '#BFE6DF') : (dark ? 'rgba(255,255,255,.18)' : C.line)} />
            {d.value > 0 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="10" fontWeight="700" fill={dark ? '#fff' : C.ink}>{d.value}</text>}
            <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="8.5" fill={dark ? 'rgba(255,255,255,.65)' : C.muted}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

/** A ring filled to `pct` with the number in the middle. */
export const Ring = ({ pct, size = 64, label }: { pct: number; size?: number; label?: string }) => {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke={C.line} strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={C.teal} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(100, Math.max(0, pct))) / 100} ${c}`} transform="rotate(-90 32 32)" />
      {label && <text x="32" y="36" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.ink}>{label}</text>}
    </svg>
  );
};

/** One measure as a row: what it is, the value, and a bar for how full it is. */
export const Meter = ({ label, value, pct, note }: { label: string; value: ReactNode; pct?: number | null; note?: string }) => (
  <div className="py-2 border-b last:border-b-0" style={{ borderColor: C.line }}>
    <div className="flex items-baseline justify-between gap-4">
      <div>
        <div className="text-[10pt] font-semibold" style={{ color: C.ink }}>{label}</div>
        {note && <div className="text-[8pt]" style={{ color: C.muted }}>{note}</div>}
      </div>
      <div className="text-[14pt] font-extrabold tabular-nums tracking-[-0.02em]" style={{ color: C.green }}>{value}</div>
    </div>
    {pct != null && (
      <div className="mt-2 h-[7px] rounded-full overflow-hidden" style={{ background: C.line }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: `linear-gradient(90deg, ${C.teal}, ${C.green})` }} />
      </div>
    )}
  </div>
);

const SHARE_COLORS = [C.green, C.teal, C.mint, '#3F8F86', '#B9E4DD', '#9BB5B0'];

/** Parts of a whole as one rounded bar, with a legend that gives each part's count and share. */
export const ShareBar = ({ items }: { items: { label: string; value: number }[] }) => {
  const total = items.reduce((n, i) => n + i.value, 0) || 1;
  return (
    <div>
      <div className="flex h-4 rounded-full overflow-hidden gap-[3px]">
        {items.map((it, i) => <div key={it.label} style={{ width: `${(it.value / total) * 100}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }} />)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-8">
        {items.map((it, i) => (
          <div key={it.label} className="flex items-center gap-2 py-1.5 border-b text-[9.5pt]" style={{ borderColor: C.line }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
            <span style={{ color: C.ink }}>{it.label}</span>
            <span className="ml-auto font-bold tabular-nums" style={{ color: C.ink }}>{it.value}</span>
            <span className="w-10 text-right tabular-nums" style={{ color: C.muted }}>{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** A ranked list where each row carries a bar for its value. */
export const RankList = ({ items, unit }: { items: { label: string; value: number }[]; unit: string }) => {
  const max = Math.max(1, ...items.map(i => i.value));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[22px_150px_1fr_70px] items-center gap-3 text-[9.5pt]">
          <span className="tabular-nums font-bold" style={{ color: C.teal }}>{i + 1}</span>
          <span className="truncate font-semibold" style={{ color: C.ink }}>{it.label}</span>
          <div className="h-[9px] rounded-full" style={{ background: C.line }}>
            <div className="h-full rounded-full" style={{ width: `${(it.value / max) * 100}%`, background: C.teal }} />
          </div>
          <span className="text-right tabular-nums" style={{ color: C.muted }}><b style={{ color: C.ink }}>{it.value}</b> {it.value === 1 ? unit.replace(/s$/, '') : unit}</span>
        </div>
      ))}
    </div>
  );
};

/** A quiet card for definitions and caveats. */
export const Note = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="break-inside-avoid rounded-[16px] px-5 py-4 text-[8.5pt] leading-relaxed" style={{ background: C.paper, color: C.muted }}>
    <div className="mb-1 text-[9pt] font-bold" style={{ color: C.ink }}>{title}</div>
    {children}
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="rounded-[16px] border border-dashed px-5 py-6 text-center text-[9pt]" style={{ borderColor: C.line, color: C.muted }}>{children}</div>
);

export const REPORT_COLORS = C;
