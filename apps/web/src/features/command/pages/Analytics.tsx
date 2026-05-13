import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { PageHeader } from '../../../components/layout/CommandShell';
import { Progress } from '../../../components/ui/progress';
import { cn } from '../../../lib/utils';

export const Analytics = () => {
  const [kpis, setKpis] = useState<any>({});

  useEffect(() => {
    api.get('/analytics/kpis').then(r => setKpis(r.data)).catch(() => {});
  }, []);

  const types = (kpis.byType ?? []) as { _id: string; count: number }[];
  const max = Math.max(1, ...types.map(t => t.count));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Operational KPIs and trends" />
      <div className="p-6 grid lg:grid-cols-2 gap-4">
        <Card className="gap-0 py-0">
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold">Volume</div>
            <div className="text-xs text-muted-foreground">All-time totals</div>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 p-5">
            <Metric label="Total" value={kpis.total} accent="text-primary" />
            <Metric label="Active" value={kpis.active} accent="text-rose-600" />
            <Metric label="Resolved 24h" value={kpis.resolvedToday} accent="text-emerald-600" />
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold">By type</div>
            <div className="text-xs text-muted-foreground">Distribution across incident kinds</div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {types.length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            {types.map(t => (
              <div key={t._id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize">{t._id.replace('_', ' ')}</span>
                  <span className="font-mono text-muted-foreground">{t.count}</span>
                </div>
                <Progress value={(t.count / max) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

const Metric = ({ label, value, accent }: { label: string; value: any; accent: string }) => (
  <div className="text-center">
    <div className={cn('text-3xl font-bold font-mono tabular-nums', accent)}>{value ?? '—'}</div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
  </div>
);
