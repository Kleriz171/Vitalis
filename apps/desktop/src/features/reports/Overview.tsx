import { ChartLineUp, ChartPieSlice, CheckCircle, Gauge, PersonSimpleRun, Pulse, Siren, Timer, UsersThree, type Icon } from '@phosphor-icons/react';
import { Tile } from '../../components/ui/tile';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { api } from '../../api/client';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { KPI } from '../../components/widgets/KPI';
import { ExportPdfButton, PageHeader } from '../../components/layout/CommandShell';
import { Bars, Empty, Meter, Note, RankList, Report, REPORT_COLORS, Ring, Section, ShareBar, Stat } from '../../components/print/Report';
import { TYPE_LABEL } from '../../components/map/MapView';

interface Kpis { total: number; active: number; resolvedToday: number; byType: { _id: string; count: number }[]; medianAcceptSeconds: number | null; acceptedUnderMinutePct: number | null; acceptedCount: number; }
interface TimePoint { date: string; count: number; resolved: number; }
interface Performance { total: number; resolved: number; resolutionRate: number; avgEtaSeconds: number; }
interface TopCaller { userId: string; name: string; email: string; count: number; }

const TYPE_COLORS = ['#0C5D57', '#14A897', '#7FD3C6', '#3F8F86', '#B9E4DD', '#D92D2D'];
// Chart tooltips in the console's dark panel style.
const TOOLTIP = { fontSize: 12, borderRadius: 10, background: '#fff', border: '1px solid hsl(40 14% 85%)', color: 'hsl(176 25% 10%)' };

const fmtEta = (s: number) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
};

const fmtShortDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const ReportsOverview = () => {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [series, setSeries] = useState<TimePoint[]>([]);
  const [perf, setPerf] = useState<Performance | null>(null);
  const [top, setTop] = useState<TopCaller[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Kpis>('/analytics/kpis'),
      api.get<TimePoint[]>('/analytics/timeseries'),
      api.get<Performance>('/analytics/performance'),
      api.get<TopCaller[]>('/analytics/top-callers'),
    ]).then(([k, s, p, t]) => {
      setKpis(k.data);
      setSeries(s.data);
      setPerf(p.data);
      setTop(t.data);
    }).catch(() => {});
  }, []);

  return (
    <>
      <div className="print:hidden">
      <PageHeader icon={ChartLineUp} title="Reports" subtitle="How many calls came in, and how fast help arrived." actions={<ExportPdfButton name="report" />} />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI icon={Siren} iconTone="deep" label="Calls, all time" value={kpis?.total ?? 0} />
          <KPI icon={Pulse} iconTone={kpis?.active ? 'sos' : 'teal'} label="Active now" value={kpis?.active ?? 0} tone={kpis?.active ? 'rose' : 'teal'} />
          <KPI icon={CheckCircle} iconTone="teal" label="Closed in the last 24 h" value={kpis?.resolvedToday ?? 0} />
          <KPI icon={Gauge} iconTone="mint" label="Calls closed" value={`${perf?.resolutionRate ?? 0}%`} />
        </div>

        <div className="grid xl:grid-cols-3 gap-5 stagger" style={{ ['--base' as string]: '120ms' }}>
          <ChartPanel icon={ChartLineUp} title="Calls, last 14 days" note="Received and closed per day" className="xl:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14A897" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#14A897" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(40 14% 89%)" />
                <XAxis dataKey="date" tickFormatter={fmtShortDate} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip labelFormatter={(v) => fmtShortDate(String(v))} contentStyle={TOOLTIP} />
                <Area type="monotone" dataKey="count" name="Received" stroke="#14A897" strokeWidth={2.5} fill="url(#fillCalls)" animationDuration={900} />
                <Area type="monotone" dataKey="resolved" name="Closed" stroke="#0C5D57" strokeWidth={2} strokeDasharray="5 4" fill="transparent" animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel icon={ChartPieSlice} title="By type" note="All calls so far">
            {kpis?.byType?.length ? (
              <div className="h-full flex flex-col">
                <div className="relative flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={kpis.byType.map((t) => ({ name: t._id.replace('_', ' '), value: t.count }))} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius="62%" outerRadius="88%" paddingAngle={3} stroke="none" animationDuration={900}>
                        {kpis.byType.map((_, i) => <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div><div className="num text-[26px] font-extrabold leading-none">{(kpis?.byType ?? []).reduce((n, t) => n + t.count, 0)}</div><div className="text-[12px] text-muted-foreground mt-1">calls</div></div>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {kpis.byType.map((t, i) => (
                    <li key={t._id} className="flex items-center gap-2 text-[13px]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                      <span className="capitalize">{t._id.replace('_', ' ')}</span>
                      <span className="num ml-auto font-semibold">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No calls yet.</p>}
          </ChartPanel>
        </div>

        <div className="grid xl:grid-cols-3 gap-5 stagger" style={{ ['--base' as string]: '240ms' }}>
          <ChartPanel icon={Timer} title="Arrival time" note="Across closed calls">
            <div className="h-full flex flex-col justify-center gap-5">
              <div>
                <div className="num text-[34px] font-extrabold leading-none tracking-[-0.03em]">{fmtEta(perf?.avgEtaSeconds ?? 0)}</div>
                <div className="text-[13px] text-muted-foreground mt-1.5">Average responder arrival estimate</div>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-[13px]">
                  <span className="text-muted-foreground">Closed</span>
                  <span className="num font-semibold">{perf?.resolved ?? 0} of {perf?.total ?? 0}</span>
                </div>
                <div className="mt-2 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-[hsl(var(--teal))] transition-[width] duration-700" style={{ width: `${perf?.resolutionRate ?? 0}%` }} />
                </div>
              </div>
            </div>
          </ChartPanel>

          <ChartPanel icon={UsersThree} title="Most calls, last 90 days" note="People who sent the most SOS calls" className="xl:col-span-2">
            {top.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke="hsl(40 14% 89%)" />
                  <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'hsl(173 55% 92% / 0.6)' }} />
                  <Bar dataKey="count" name="Calls" fill="#14A897" radius={[0, 8, 8, 0]} barSize={18} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-muted-foreground text-center py-12">No SOS history yet.</p>}
          </ChartPanel>
        </div>
      </div>
      </div>
      <AnalyticsReport kpis={kpis} series={series} perf={perf} top={top} />
    </>
  );
};

/** A chart panel: icon tile, bold title, one line under it, the chart filling the rest. */
const ChartPanel = ({ icon, title, note, className, children }: { icon: Icon; title: string; note: string; className?: string; children: React.ReactNode }) => (
  <section className={`flex flex-col h-[330px] rounded-[22px] border border-border bg-card shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)] ${className ?? ''}`}>
    <header className="flex items-center gap-3 px-5 pt-4 pb-3">
      <Tile icon={icon} tone="teal" size="sm" />
      <div>
        <h2 className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</h2>
        <p className="text-[12px] text-muted-foreground">{note}</p>
      </div>
    </header>
    <div className="flex-1 min-h-0 px-4 pb-4">{children}</div>
  </section>
);

/** Export PDF: the same figures as a designed report (components/print/Report.tsx). */
const AnalyticsReport = ({ kpis, series, perf, top }: { kpis: Kpis | null; series: TimePoint[]; perf: Performance | null; top: TopCaller[] }) => {
  const day = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-GB', o);
  const received = series.reduce((n, p) => n + p.count, 0);
  const closed = series.reduce((n, p) => n + p.resolved, 0);
  const busiest = series.reduce<TimePoint | null>((b, p) => (p.count > (b?.count ?? 0) ? p : b), null);
  const quiet = series.filter(p => !p.count).length;
  const period = series.length
    ? `${day(series[0].date, { day: 'numeric', month: 'short' })} – ${day(series[series.length - 1].date, { day: 'numeric', month: 'short', year: 'numeric' })} · last ${series.length} days`
    : 'Last 14 days';
  const bars = series.map(p => ({ label: day(p.date, { day: 'numeric', month: 'short' }), value: p.count }));
  const accept = kpis?.medianAcceptSeconds != null ? fmtEta(kpis.medianAcceptSeconds) : '—';
  return (
    <Report title="Operations report" period={period}>
      <Section n={1} title="At a glance" lead={received
        ? `${received} ${received === 1 ? 'call' : 'calls'} in ${series.length} days, ${closed} closed.${kpis?.medianAcceptSeconds != null ? ` Responders accepted in a median of ${accept} over the last day.` : ''}`
        : `No calls in the last ${series.length} days.`}>
        <div className="grid grid-cols-3 gap-3">
          <Stat dark className="col-span-2" icon={Siren} label="Calls in this period" value={received} sub={`Over ${series.length} days, from every part of the network`}>
            <div className="grid grid-cols-3 gap-4 border-t border-white/15 pt-3">
              {([['Closed', closed], ['Not closed', received - closed], ['Busiest day', busiest ? `${day(busiest.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${busiest.count}` : '—']] as const).map(([k, v]) => (
                <div key={k}><div className="text-[8pt] text-white/60">{k}</div><div className="mt-0.5 text-[12pt] font-bold tabular-nums">{v}</div></div>
              ))}
            </div>
          </Stat>
          <Stat icon={CheckCircle} label="Calls closed" value={`${perf?.resolutionRate ?? 0}%`} sub={`${perf?.resolved ?? 0} of ${perf?.total ?? 0}, all time`}
            aside={<Ring pct={perf?.resolutionRate ?? 0} size={54} />} />
          <Stat icon={Timer} label="Time to accept" value={accept} sub="Median, last 24 hours" />
          <Stat icon={PersonSimpleRun} label="Arrival estimate" value={fmtEta(perf?.avgEtaSeconds ?? 0)} sub="Average, accepted calls" />
          <Stat icon={Pulse} label="Active calls" value={kpis?.active ?? 0} sub="When this was exported" />
        </div>
      </Section>


      <Section n={2} title="How fast help came" lead="From the SOS to a responder accepting, and their estimated travel time.">
        <div className="rounded-[18px] px-5 py-1" style={{ border: `1px solid ${REPORT_COLORS.line}` }}>
          <Meter label="Accepted within one minute" note={kpis?.acceptedCount ? `Of ${kpis.acceptedCount} calls accepted in the last 24 hours` : 'No calls accepted in the last 24 hours'}
            value={kpis?.acceptedUnderMinutePct != null ? `${kpis.acceptedUnderMinutePct}%` : '—'} pct={kpis?.acceptedUnderMinutePct ?? 0} />
          <Meter label="Time until a responder accepted" note="Median, last 24 hours" value={accept} />
          <Meter label="Arrival estimate" note="Average travel time estimated when responders accepted" value={fmtEta(perf?.avgEtaSeconds ?? 0)} />
          <Meter label="Calls closed" note={`${perf?.resolved ?? 0} of ${perf?.total ?? 0} calls, all time`} value={`${perf?.resolutionRate ?? 0}%`} pct={perf?.resolutionRate ?? 0} />
        </div>
      </Section>

      <Section n={3} title="Calls per day" pageBreak lead="Every SOS received in the period. The busiest day is in teal.">
        <Bars data={bars} height={130} />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat small label="Busiest day" value={busiest ? busiest.count : 0} sub={busiest ? day(busiest.date, { weekday: 'long', day: 'numeric', month: 'long' }) : 'No calls'} />
          <Stat small label="Daily average" value={(received / Math.max(series.length, 1)).toFixed(1)} sub="Calls per day" />
          <Stat small label="Quiet days" value={quiet} sub={`Days without a call, of ${series.length}`} />
        </div>
      </Section>

      <Section n={4} title="What the calls were about" lead="All calls since Vitalis started, by type.">
        {kpis?.byType?.length
          ? <ShareBar items={[...kpis.byType].sort((a, b) => b.count - a.count).map(t => ({ label: TYPE_LABEL[t._id] ?? t._id.replace('_', ' '), value: t.count }))} />
          : <Empty>No calls yet.</Empty>}
      </Section>

      <Section n={5} title="Frequent callers" lead="Last 90 days. Several calls from one person may need a follow-up.">
        {top.length ? <RankList unit="calls" items={top.map(t => ({ label: t.name, value: t.count }))} /> : <Empty>No calls in the last 90 days.</Empty>}
      </Section>

      <Note title="How to read this report">
        Figures come from Vitalis Command at the moment of export. A call is closed when a responder or operator marks it resolved.
        Time to accept runs from the SOS to the first responder accepting. The arrival estimate is the travel time estimated when a
        responder accepted; it is not a measured arrival.
      </Note>
    </Report>
  );
};
