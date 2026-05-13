import { lazy, Suspense, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge, StatusBadge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { KPI } from '../../../components/widgets/KPI';
import { pushToast } from '../../../components/toast/toast';
import { timeAgo, shortId, formatEta } from '../../../lib/format';
import { cn } from '../../../lib/utils';

const MapView = lazy(() => import('../../../components/map/MapView'));

const MapFallback = () => (
  <div className="w-full h-full min-h-[60vh] rounded-2xl grid place-items-center text-muted-foreground text-sm animate-pulse">
    Loading map…
  </div>
);

interface Emergency {
  _id: string;
  type: string;
  priority: number;
  status: string;
  createdAt: string;
  etaSeconds?: number;
  description?: string;
  timeline?: { status: string; at: string }[];
}

export const Logistics = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [selected, setSelected] = useState<Emergency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit('dispatcher:join');

    const onEmergency = (e: Emergency) => {
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
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {}).finally(() => setLoading(false));
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-muted-foreground">Live · {emergencies.length} active</span>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Active" value={kpis.active ?? '—'} tone="teal" />
          <KPI label="Resolved 24h" value={kpis.resolvedToday ?? '—'} tone="emerald" />
          <KPI label="Total" value={kpis.total ?? '—'} tone="violet" />
          <KPI label="Types" value={(kpis.byType ?? []).length || '—'} tone="rose" />
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 p-2 overflow-hidden">
            <Suspense fallback={<MapFallback />}>
              <MapView emergencies={emergencies} />
            </Suspense>
          </Card>

          <Card className="flex flex-col max-h-[70vh] gap-0 py-0">
            <CardHeader className="px-5 py-4 border-b">
              <div className="font-semibold">Live incident feed</div>
              <div className="text-xs text-muted-foreground">Newest first</div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto px-3 py-3 space-y-2">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
              {!loading && emergencies.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-12">Waiting for incidents…</p>
              )}
              {emergencies.map(e => (
                <button
                  key={e._id}
                  onClick={() => setSelected(e)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl border transition hover:bg-muted/40',
                    selected?._id === e._id ? 'border-primary/60 bg-primary/5' : 'border-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-muted-foreground">#{shortId(e._id)}</span>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm capitalize">{e.type.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground font-mono">P{e.priority}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(e.createdAt)}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {selected && <IncidentDrawer incident={selected} onClose={() => setSelected(null)} />}
    </>
  );
};

const IncidentDrawer = ({ incident, onClose }: { incident: Emergency; onClose: () => void }) => (
  <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose}>
    <aside
      onClick={e => e.stopPropagation()}
      className="absolute right-0 top-0 bottom-0 w-[min(440px,100vw)] bg-card border-l border-border p-6 overflow-auto animate-in slide-in-from-right duration-200"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Incident</div>
          <div className="font-mono text-lg">#{shortId(incident._id)}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X size={18} />
        </Button>
      </div>

      <div className="space-y-4">
        <Row label="Type" value={incident.type.replace('_', ' ')} />
        <Row label="Status" value={<StatusBadge status={incident.status} />} />
        <Row label="Priority" value={`P${incident.priority}`} mono />
        {incident.etaSeconds != null && <Row label="ETA" value={formatEta(incident.etaSeconds)} mono />}
        <Row label="Created" value={new Date(incident.createdAt).toLocaleString()} />
        {incident.description && <Row label="Description" value={incident.description} />}

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Timeline</div>
          <ol className="space-y-2">
            {(incident.timeline ?? []).map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm capitalize">{t.status.replace('_', ' ')}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{new Date(t.at).toLocaleTimeString()}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </aside>
  </div>
);

const Row = ({ label, value, mono }: { label: string; value: any; mono?: boolean }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn('text-sm mt-0.5', mono && 'font-mono')}>{value}</div>
  </div>
);

// Badge is imported but unused if no usage — keep both names available for clean re-exports
void Badge;
