import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { Heart } from '@phosphor-icons/react';
import type { RootState } from '../../store';
import { cn } from '../../lib/utils';

/**
 * The paper version of a page, shown only when printing (Export PDF). A document, not a screenshot:
 * letterhead, a details block, numbered sections with plain tables, A4 portrait (index.css @page).
 */
export const stamp = (d: Date) =>
  d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const Report = ({ title, details, children }: { title: string; details: [string, ReactNode][]; children: ReactNode }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  return (
    <article className="report hidden print:block">
      <header className="flex items-center justify-between pb-3 border-b-2 border-[#0C5D57]">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-[#14A897] grid place-items-center text-white"><Heart size={18} weight="fill" /></span>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-[#0C5D57]">Vitalis</div>
            <div className="text-[9pt] text-[#55635F]">Emergency response network · Tirana</div>
          </div>
        </div>
        <div className="text-right text-[9pt] text-[#55635F] leading-tight">
          <div>Vitalis Command</div>
          <div>For emergency services use</div>
        </div>
      </header>

      <h1 className="mt-6 text-[22pt] font-extrabold tracking-[-0.02em] text-[#13201F]">{title}</h1>
      <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-2 text-[9pt]">
        {[...details, ['Exported', stamp(new Date())] as [string, ReactNode], ['Exported by', user?.name ?? 'Operator'] as [string, ReactNode]].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[#55635F]">{k}</dt>
            <dd className="font-semibold text-[#13201F]">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 space-y-7">{children}</div>

      <footer className="mt-10 pt-3 border-t border-[#D9D6CE] text-[8pt] text-[#55635F] flex justify-between">
        <span>Vitalis Command · {title}</span>
        <span>Confidential · for emergency services only</span>
      </footer>
    </article>
  );
};

/** A numbered section. Short ones stay on one page (`keep`); long tables may continue on the next. */
export const ReportSection = ({ n, title, note, keep = true, children }: { n: number; title: string; note?: string; keep?: boolean; children: ReactNode }) => (
  <section className={keep ? 'break-inside-avoid' : undefined}>
    <h2 className="break-after-avoid flex items-baseline gap-2.5 text-[13pt] font-extrabold text-[#13201F]">
      <span className="text-[#14A897] tabular-nums">{n}</span>{title}
    </h2>
    {note && <p className="mt-0.5 text-[9pt] text-[#55635F]">{note}</p>}
    <div className="mt-3">{children}</div>
  </section>
);

/** Key figures in a row of quiet boxes. */
export const Figures = ({ items }: { items: [string, ReactNode][] }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
    {items.map(([label, value]) => (
      <div key={label} className="rounded-md border border-[#D9D6CE] bg-[#F7F5F0] px-3 py-2.5">
        <div className="text-[16pt] font-extrabold tabular-nums text-[#0C5D57] leading-none">{value}</div>
        <div className="mt-1.5 text-[8.5pt] text-[#55635F] leading-tight">{label}</div>
      </div>
    ))}
  </div>
);

/** A plain table; `right` lists the columns (by index) that hold numbers. Its header repeats on every page. */
export const Table = ({ head, rows, right = [], empty = 'Nothing to show.' }: { head: string[]; rows: ReactNode[][]; right?: number[]; empty?: string }) =>
  rows.length ? (
    <table className="w-full border-collapse text-[9pt]">
      <thead>
        <tr className="border-b border-[#0C5D57]">
          {head.map((h, i) => <th key={h || i} className={cn('py-1 pr-3 font-semibold text-[#0C5D57]', right.includes(i) ? 'text-right' : 'text-left')}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-[#E7E4DC] break-inside-avoid">
            {r.map((c, j) => <td key={j} className={cn('py-[3px] pr-3 align-top text-[#13201F]', right.includes(j) && 'text-right tabular-nums')}>{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ) : <p className="text-[9pt] text-[#55635F]">{empty}</p>;

export const Notes = ({ children }: { children: ReactNode }) => (
  <div className="text-[8.5pt] leading-relaxed text-[#55635F] space-y-1">{children}</div>
);
