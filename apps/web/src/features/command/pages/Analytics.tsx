import { ChartBar } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { api } from '../../../api/client';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { KPI } from '../../../components/widgets/KPI';
import { PageHeader } from '../../../components/layout/CommandShell';

interface Kpis { total: number; active: number; resolvedToday: number; byType: { _id: string; count: number }[]; }
interface TimePoint { date: string; count: number; resolved: number; }
interface Performance { total: number; resolved: number; resolutionRate: number; avgEtaSeconds: number; }
interface TopCaller { userId: string; name: string; email: string; count: number; }

const TYPE_COLORS = ['#0C5D57', '#14A897', '#E07A10', '#7C8DB5', '#D92D2D', '#9BC9A7'];
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
      <PageHeader icon={ChartBar} title="Analytics" subtitle="Operational KPIs and trends" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI label="Total incidents" value={kpis?.total ?? 0} />
          <KPI label="Active now" value={kpis?.active ?? 0} tone={kpis?.active ? 'rose' : 'teal'} />
          <KPI label="Resolved in 24 h" value={kpis?.resolvedToday ?? 0} />
          <KPI label="Resolution rate" value={`${perf?.resolutionRate ?? 0}%`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="px-5 py-4 border-b">
              <div className="font-semibold">Incidents — last 14 days</div>
              <div className="text-xs text-muted-foreground">Triggered vs resolved</div>
            </CardHeader>
            <CardContent className="p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 14% 87%)" />
                  <XAxis dataKey="date" tickFormatter={fmtShortDate} fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    labelFormatter={(v) => fmtShortDate(String(v))}
                    contentStyle={TOOLTIP}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" name="Triggered" stroke="#0C5D57" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#14A897" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0">
            <CardHeader className="px-5 py-4 border-b">
              <div className="font-semibold">By type</div>
              <div className="text-xs text-muted-foreground">All-time distribution</div>
            </CardHeader>
            <CardContent className="p-4 h-72">
              {kpis?.byType?.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kpis.byType.map((t) => ({ name: t._id.replace('_', ' '), value: t.count }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {kpis.byType.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-12">No incidents yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="gap-0 py-0">
            <CardHeader className="px-5 py-4 border-b">
              <div className="font-semibold">Response performance</div>
              <div className="text-xs text-muted-foreground">Average across resolved incidents</div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="text-[11px] text-muted-foreground">Avg responder ETA</div>
                <div className="text-3xl font-bold mt-1">{fmtEta(perf?.avgEtaSeconds ?? 0)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Resolved / Total</div>
                <div className="text-3xl font-bold mt-1">
                  <span className="text-emerald-600">{perf?.resolved ?? 0}</span>
                  <span className="text-muted-foreground"> / {perf?.total ?? 0}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${perf?.resolutionRate ?? 0}%` }} />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 lg:col-span-2">
            <CardHeader className="px-5 py-4 border-b">
              <div className="font-semibold">Top SOS callers — last 90 days</div>
              <div className="text-xs text-muted-foreground">Who has triggered the most emergencies</div>
            </CardHeader>
            <CardContent className="p-4 h-72">
              {top.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(40 14% 87%)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip contentStyle={TOOLTIP} />
                    <Bar dataKey="count" name="Incidents" fill="#0d9488" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-12">No SOS history yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};
