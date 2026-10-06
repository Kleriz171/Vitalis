import { ChartLineUp, ChartPieSlice, CheckCircle, Gauge, Pulse, Siren, Timer, UsersThree, type Icon } from '@phosphor-icons/react';
import { Tile } from '../../../components/ui/tile';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { api } from '../../../api/client';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { KPI } from '../../../components/widgets/KPI';
import { ExportPdfButton, PageHeader } from '../../../components/layout/CommandShell';
import { Figures, Notes, Report, ReportSection, Table } from '../../../components/print/Report';
import { TYPE_LABEL } from '../../../components/map/MapView';

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

export const Analytics = () => {
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

/** Export PDF: the same figures as a report document. Charts have a fixed size so they fit the A4 page. */
const AnalyticsReport = ({ kpis, series, perf, top }: { kpis: Kpis | null; series: TimePoint[]; perf: Performance | null; top: TopCaller[] }) => {
  const byTypeTotal = (kpis?.byType ?? []).reduce((n, t) => n + t.count, 0);
  const sum = (k: 'count' | 'resolved') => series.reduce((n, p) => n + p[k], 0);
  const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <Report title="Operations report" details={[['Period', series.length ? `${longDate(series[0].date)} to ${longDate(series[series.length - 1].date)}` : 'Last 14 days']]}>
      <ReportSection n={1} title="Summary">
        <Figures items={[
          ['Calls, all time', kpis?.total ?? 0],
          ['Active when exported', kpis?.active ?? 0],
          ['Closed in the last 24 hours', kpis?.resolvedToday ?? 0],
          ['Calls closed', `${perf?.resolutionRate ?? 0}%`],
          ['Average arrival time', fmtEta(perf?.avgEtaSeconds ?? 0)],
        ]} />
      </ReportSection>

      <ReportSection n={2} title="Calls per day" note="SOS calls received and closed on each of the last 14 days." keep={false}>
        <AreaChart width={660} height={150} data={series} margin={{ top: 6, right: 22, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E7E4DC" />
          <XAxis dataKey="date" tickFormatter={fmtShortDate} tick={{ fontSize: 9, fill: '#55635F' }} tickLine={false} axisLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: '#55635F' }} tickLine={false} axisLine={false} />
          <Area type="monotone" dataKey="count" name="Received" stroke="#14A897" strokeWidth={2} fill="#14A897" fillOpacity={0.12} isAnimationActive={false} />
          <Area type="monotone" dataKey="resolved" name="Closed" stroke="#0C5D57" strokeWidth={1.5} strokeDasharray="4 3" fill="transparent" isAnimationActive={false} />
        </AreaChart>
        <div className="mt-1 mb-3 flex gap-5 text-[8.5pt] text-[#55635F]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#14A897]" />Received</span>
          <span className="flex items-center gap-1.5"><span className="w-3 border-t-[1.5px] border-dashed border-[#0C5D57]" />Closed</span>
        </div>
        <Table head={['Day', 'Received', 'Closed']} right={[1, 2]}
          rows={[...series.map(p => [longDate(p.date), p.count, p.resolved]), [<b key="t">Total</b>, <b key="c">{sum('count')}</b>, <b key="r">{sum('resolved')}</b>]]} />
      </ReportSection>

      <ReportSection n={3} title="Calls by type" note="All calls since Vitalis started.">
        <Table head={['Type', 'Calls', 'Share']} right={[1, 2]} empty="No calls yet."
          rows={(kpis?.byType ?? []).map(t => [TYPE_LABEL[t._id] ?? t._id.replace('_', ' '), t.count, `${Math.round((t.count / Math.max(byTypeTotal, 1)) * 100)}%`])} />
      </ReportSection>

      <ReportSection n={4} title="Response">
        <Table head={['Measure', 'Value']} right={[1]} rows={[
          ['Time until a responder accepted, median (last 24 hours)', kpis?.medianAcceptSeconds != null ? fmtEta(kpis.medianAcceptSeconds) : 'No accepted calls'],
          ['Accepted within one minute (last 24 hours)', kpis?.acceptedUnderMinutePct != null ? `${kpis.acceptedUnderMinutePct}% of ${kpis.acceptedCount}` : 'No accepted calls'],
          ['Average arrival time (all accepted calls)', fmtEta(perf?.avgEtaSeconds ?? 0)],
          ['Calls closed (all time)', `${perf?.resolved ?? 0} of ${perf?.total ?? 0} (${perf?.resolutionRate ?? 0}%)`],
        ]} />
      </ReportSection>

      <ReportSection n={5} title="People with the most calls" note="Last 90 days. Repeated calls from one person may need a follow-up.">
        <Table head={['#', 'Name', 'Calls']} right={[2]} empty="No calls in the last 90 days."
          rows={top.map((t, i) => [i + 1, t.name, t.count])} />
      </ReportSection>

      <Notes>
        <p><b>How to read this report.</b> Figures come from Vitalis Command at the moment of export. A call is closed when a responder or operator marks it resolved.</p>
        <p>Arrival time is the responder&apos;s estimated travel time at the moment they accepted, averaged over all accepted calls; it is an estimate, not a measured arrival. Time until accepted runs from the SOS to the first responder accepting.</p>
      </Notes>
    </Report>
  );
};
