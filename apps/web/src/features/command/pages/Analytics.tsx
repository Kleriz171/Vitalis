import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
  BarChart, Bar,
} from 'recharts';
import { api } from '../../../api/client';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { PageHeader } from '../../../components/layout/CommandShell';

interface Kpis { total: number; active: number; resolvedToday: number; byType: { _id: string; count: number }[]; }
interface TimePoint { date: string; count: number; resolved: number; }
interface Performance { total: number; resolved: number; resolutionRate: number; avgEtaSeconds: number; }
interface TopCaller { userId: string; name: string; email: string; count: number; }

const TYPE_COLORS = ['#0d9488', '#0ea5e9', '#f97316', '#a855f7', '#ef4444', '#22c55e'];

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
      <PageHeader title="Analytics" subtitle="Operational KPIs and trends" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total incidents" value={kpis?.total ?? 0} />
          <Kpi label="Active now" value={kpis?.active ?? 0} accent="text-rose-600" />
          <Kpi label="Resolved 24h" value={kpis?.resolvedToday ?? 0} accent="text-emerald-600" />
          <Kpi label="Resolution rate" value={`${perf?.resolutionRate ?? 0}%`} accent="text-primary" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={fmtShortDate} fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip
                    labelFormatter={(v) => fmtShortDate(String(v))}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="count" name="Triggered" stroke="#0d9488" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
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
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg responder ETA</div>
                <div className="text-3xl font-bold mt-1">{fmtEta(perf?.avgEtaSeconds ?? 0)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resolved / Total</div>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} fontSize={11} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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

const Kpi = ({ label, value, accent }: { label: string; value: number | string; accent?: string }) => (
  <Card className="gap-0 py-0">
    <CardContent className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{value}</div>
    </CardContent>
  </Card>
);
