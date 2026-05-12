import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../api/client';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/layout/CommandShell';

export const Analytics = () => {
  const [kpis, setKpis] = useState<any>({});

  useEffect(() => {
    api.get('/analytics/kpis').then(r => setKpis(r.data)).catch(() => {});
  }, []);

  const types = kpis.byType ?? [];
  const max = Math.max(1, ...types.map((t: any) => t.count));

  return (
    <>
      <PageHeader title="Analytics" subtitle="Operational KPIs and trends" />
      <div className="p-6 grid lg:grid-cols-2 gap-4">
        <Card tone="strong" className="p-5">
          <CardHeader title="Volume" subtitle="All-time totals" />
          <CardBody className="grid grid-cols-3 gap-3">
            <Metric label="Total" value={kpis.total} accent="cyan" />
            <Metric label="Active" value={kpis.active} accent="pink" />
            <Metric label="Resolved 24h" value={kpis.resolvedToday} accent="emerald" />
          </CardBody>
        </Card>

        <Card tone="strong" className="p-5">
          <CardHeader title="By type" subtitle="Distribution across incident kinds" />
          <CardBody className="space-y-2">
            {types.length === 0 && <p className="text-xs text-slate-500">No data yet.</p>}
            {types.map((t: any, i: number) => (
              <motion.div
                key={t._id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="capitalize">{t._id.replace('_', ' ')}</span>
                  <span className="font-mono text-slate-400">{t.count}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(t.count / max) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    className="h-full bg-gradient-to-r from-neon-cyan to-neon-violet"
                  />
                </div>
              </motion.div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
};

const Metric = ({ label, value, accent }: { label: string; value: any; accent: 'cyan' | 'pink' | 'emerald' }) => {
  const colors = {
    cyan: 'text-neon-cyan',
    pink: 'text-neon-pink',
    emerald: 'text-emerald-300',
  } as const;
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold font-mono ${colors[accent]}`}>{value ?? '—'}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{label}</div>
    </div>
  );
};
