import { lazy, Suspense, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/Badge';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';
import { timeAgo, shortId, formatEta } from '../../../lib/format';

const MapView = lazy(() => import('../../../components/map/MapView'));

const MapFallback = () => (
  <div className="w-full h-full min-h-[60vh] rounded-2xl grid place-items-center text-slate-500 text-sm animate-pulse">
    Loading map…
  </div>
);

export const Logistics = () => {
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    socket.emit('dispatcher:join');

    const onEmergency = (e: any) => {
      setEmergencies(prev => {
        const existing = prev.find(x => x._id === e._id);
        if (!existing) {
          pushToast({
            tone: e.priority === 1 ? 'error' : 'warn',
            title: `New ${e.type} · P${e.priority}`,
            body: `Incident ${shortId(e._id)} pending`,
          });
        }
        return [e, ...prev.filter(x => x._id !== e._id)].slice(0, 50);
      });
    };

    socket.on('dashboard:emergency', onEmergency);
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {});
    api.get('/analytics/kpis').then(r => setKpis(r.data)).catch(() => {});

    const t = setInterval(() => {
      api.get('/analytics/kpis').then(r => setKpis(r.data)).catch(() => {});
    }, 15_000);

    return () => { socket.off('dashboard:emergency', onEmergency); clearInterval(t); };
  }, []);

  return (
    <>
      <PageHeader
        title="Logistics"
        subtitle="Real-time emergency overview"
        actions={
          <div className="flex items-center gap-2 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Live · {emergencies.length} active</span>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Active" value={kpis.active ?? '—'} tone="cyan" />
          <KPI label="Resolved 24h" value={kpis.resolvedToday ?? '—'} tone="emerald" />
          <KPI label="Total" value={kpis.total ?? '—'} tone="violet" />
          <KPI label="Types" value={(kpis.byType ?? []).length || '—'} tone="pink" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-2 overflow-hidden">
            <Suspense fallback={<MapFallback />}>
              <MapView emergencies={emergencies} />
            </Suspense>
          </Card>

          <Card tone="strong" className="flex flex-col max-h-[70vh]">
            <CardHeader title="Live incident feed" subtitle="Newest first" />
            <CardBody className="flex-1 overflow-auto space-y-2 pr-3">
              {emergencies.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-12">Waiting for incidents…</p>
              )}
              <AnimatePresence initial={false}>
                {emergencies.map(e => (
                  <motion.button
                    key={e._id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    onClick={() => setSelected(e)}
                    className={`w-full text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] transition border ${
                      selected?._id === e._id ? 'border-neon-cyan/50' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] text-slate-500">#{shortId(e._id)}</span>
                      <StatusBadge status={e.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm capitalize">{e.type.replace('_', ' ')}</span>
                      <span className="text-xs text-slate-400 font-mono">P{e.priority}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{timeAgo(e.createdAt)}</div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </CardBody>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </>
  );
};

const KPI = ({ label, value, tone }: { label: string; value: any; tone: 'cyan' | 'pink' | 'emerald' | 'violet' }) => {
  const tones = {
    cyan: 'from-neon-cyan/20',
    pink: 'from-neon-pink/20',
    emerald: 'from-emerald-400/20',
    violet: 'from-neon-violet/20',
  } as const;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`relative glass-strong p-4 overflow-hidden bg-gradient-to-br ${tones[tone]} to-transparent`}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-3xl font-bold neon-text mt-1 font-mono">{value}</div>
    </motion.div>
  );
};

const IncidentDrawer = ({ incident, onClose }: { incident: any; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
    onClick={onClose}
  >
    <motion.aside
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 220 }}
      className="absolute right-0 top-0 bottom-0 w-[min(440px,100vw)] bg-ink-900 border-l border-white/10 p-6 overflow-auto"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Incident</div>
          <div className="font-mono text-lg">#{shortId(incident._id)}</div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-neon-pink text-2xl leading-none">×</button>
      </div>

      <div className="space-y-4">
        <Row label="Type" value={incident.type.replace('_', ' ')} />
        <Row label="Status" value={<StatusBadge status={incident.status} />} />
        <Row label="Priority" value={`P${incident.priority}`} mono />
        {incident.etaSeconds != null && <Row label="ETA" value={formatEta(incident.etaSeconds)} mono />}
        <Row label="Created" value={new Date(incident.createdAt).toLocaleString()} />
        {incident.description && <Row label="Description" value={incident.description} />}

        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Timeline</div>
          <ol className="space-y-2">
            {(incident.timeline ?? []).map((t: any, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-neon-cyan mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm capitalize">{t.status.replace('_', ' ')}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{new Date(t.at).toLocaleTimeString()}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </motion.aside>
  </motion.div>
);

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`text-sm text-slate-200 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>
);
