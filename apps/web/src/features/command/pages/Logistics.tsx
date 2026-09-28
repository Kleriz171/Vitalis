import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Award, X, Zap } from 'lucide-react';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { KPI } from '../../../components/widgets/KPI';
import { pushToast } from '../../../components/toast/toast';
import { timeAgo, shortId, formatEta } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import type { MapAed, MapResponder } from '../../../components/map/MapView';
import { TYPE_LABEL } from '../../../components/map/MapView';

const MapView = lazy(() => import('../../../components/map/MapView'));

const ACTIVE = ['pending', 'assigned', 'en_route', 'on_scene'];
// Past this with nobody accepting, the dispatcher should intervene.
const ESCALATE_AFTER_S = 60;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting responder',
  assigned: 'Responder accepted',
  en_route: 'Responder on the way',
  on_scene: 'Responder on scene',
  resolved: 'Closed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-red-50 text-red-700 ring-red-200',
  assigned: 'bg-amber-50 text-amber-800 ring-amber-200',
  en_route: 'bg-sky-50 text-sky-800 ring-sky-200',
  on_scene: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  resolved: 'bg-muted text-muted-foreground ring-border',
  cancelled: 'bg-muted text-muted-foreground ring-border',
};

type Person = { _id: string; name: string; role: string } | string | null | undefined;

interface Emergency {
  _id: string;
  type: string;
  priority: number;
  status: string;
  createdAt: string;
  etaSeconds?: number;
  description?: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  responder?: Person;
  aedRunner?: Person;
  aedStatus?: 'to_aed' | 'has_aed' | 'delivered';
  timeline?: { status: string; at: string }[];
  callerCertifications?: { badgeLabel: string; courseSlug: string; expiresAt: string }[];
}

interface Kpis {
  active?: number;
  pending?: number;
  onDuty?: number;
  medianAcceptSeconds?: number | null;
}

const nameOf = (p: Person) => (p && typeof p === 'object' ? p.name : null);
const secondsSince = (iso: string) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);

export const StatusPill = ({ status }: { status: string }) => (
  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE[status] ?? STATUS_TONE.resolved)}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

export const Logistics = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [aeds, setAeds] = useState<MapAed[]>([]);
  const [responders, setResponders] = useState<Record<string, MapResponder>>({});
  const [kpis, setKpis] = useState<Kpis>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);
  const [live, setLive] = useState(socket.connected);

  const loadKpis = useCallback(() => api.get('/analytics/kpis').then(r => setKpis(r.data)).catch(() => {}), []);

  useEffect(() => {
    const onEmergency = (e: Emergency) => {
      setEmergencies(prev => {
        const existing = prev.find(x => x._id === e._id);
        if (!existing) {
          pushToast({
            tone: e.priority === 1 ? 'error' : 'warn',
            title: `${TYPE_LABEL[e.type] ?? 'Emergency'} · priority ${e.priority}`,
            body: 'New SOS awaiting a responder',
          });
        }
        // Socket payloads carry ids, the list carries populated names: keep the richer one.
        const merged = existing
          ? { ...existing, ...e, responder: typeof e.responder === 'string' && typeof existing.responder === 'object' && existing.responder?._id === e.responder ? existing.responder : e.responder }
          : e;
        return [merged, ...prev.filter(x => x._id !== e._id)].slice(0, 100);
      });
      void loadKpis();
    };
    const onLocation = (p: { userId: string; coordinates: [number, number] }) =>
      setResponders(prev => ({ ...prev, [p.userId]: p }));

    const onUp = () => setLive(true);
    const onDown = () => setLive(false);
    socket.on('connect', onUp);
    socket.on('disconnect', onDown);
    socket.on('dashboard:emergency', onEmergency);
    socket.on('responder:location', onLocation);
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/aeds').then(r => setAeds(r.data)).catch(() => {});
    void loadKpis();
    const kpiTimer = setInterval(loadKpis, 15_000);
    // Re-render every 10 s so "waiting 1 min" escalations appear without new events.
    const clock = setInterval(() => tick(t => t + 1), 10_000);
    return () => {
      socket.off('connect', onUp);
      socket.off('disconnect', onDown);
      socket.off('dashboard:emergency', onEmergency);
      socket.off('responder:location', onLocation);
      clearInterval(kpiTimer);
      clearInterval(clock);
    };
  }, [loadKpis]);

  const active = useMemo(
    () => emergencies
      .filter(e => ACTIVE.includes(e.status))
      .sort((a, b) => a.priority - b.priority || +new Date(a.createdAt) - +new Date(b.createdAt)),
    [emergencies],
  );
  const closed = useMemo(() => emergencies.filter(e => !ACTIVE.includes(e.status)).slice(0, 10), [emergencies]);
  const selected = emergencies.find(e => e._id === selectedId) ?? null;

  const updateEmergency = (e: Emergency) => setEmergencies(prev => prev.map(x => (x._id === e._id ? { ...x, ...e, responder: x.responder, aedRunner: x.aedRunner } : x)));

  return (
    <>
      <PageHeader
        title="Live operations"
        subtitle="SOS calls, responders and defibrillators in real time"
        actions={
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span className={cn('w-2 h-2 rounded-full', live ? 'bg-emerald-500' : 'bg-amber-500')} />
            {live ? 'Live' : 'Connecting…'}
          </div>
        }
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <KPI label="Active calls" value={kpis.active ?? '—'} />
          <KPI label="Awaiting a responder" value={kpis.pending ?? '—'} tone={kpis.pending ? 'rose' : 'teal'} />
          <KPI label="Responders on duty" value={kpis.onDuty ?? '—'} tone="emerald" />
          <KPI label="Median time to accept (24 h)" value={kpis.medianAcceptSeconds != null ? formatEta(kpis.medianAcceptSeconds) : '—'} tone="blue" />
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-4">
          <Card className="p-1.5 h-[min(68vh,720px)] gap-0 py-1.5">
            <Suspense fallback={<Skeleton className="w-full h-full rounded-xl" />}>
              <MapView
                incidents={active}
                aeds={aeds}
                responders={Object.values(responders)}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Suspense>
          </Card>

          <Card className="flex flex-col h-[min(68vh,720px)] gap-0 py-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
              <h2 className="font-semibold">Active calls</h2>
              <span className="text-sm text-muted-foreground tabular-nums">{active.length}</span>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-1.5">
              {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              {!loading && active.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <p className="font-medium">No active calls</p>
                  <p className="text-sm text-muted-foreground mt-1">New SOS alerts appear here instantly, with a sound-free toast.</p>
                </div>
              )}
              {active.map(e => {
                const waiting = e.status === 'pending' && secondsSince(e.createdAt) > ESCALATE_AFTER_S;
                return (
                  <button
                    key={e._id}
                    onClick={() => setSelectedId(e._id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selectedId === e._id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('font-medium', e.priority === 1 && 'text-red-700')}>{TYPE_LABEL[e.type] ?? 'Emergency'}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{timeAgo(e.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <StatusPill status={e.status} />
                      {nameOf(e.responder) && <span className="text-sm text-muted-foreground truncate">{nameOf(e.responder)}</span>}
                    </div>
                    {e.type === 'cardiac' && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Zap size={14} className={e.aedRunner ? 'text-green-700' : 'text-muted-foreground'} />
                        {e.aedStatus === 'delivered' ? 'AED at patient' : e.aedStatus === 'has_aed' ? 'AED on the way' : e.aedRunner ? 'Runner fetching AED' : 'No AED runner yet'}
                      </div>
                    )}
                    {waiting && (
                      <div className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
                        <AlertTriangle size={14} /> No responder after 1 min. Dispatch an ambulance.
                      </div>
                    )}
                  </button>
                );
              })}
              {closed.length > 0 && (
                <details className="pt-2">
                  <summary className="px-2 py-1.5 text-sm text-muted-foreground cursor-pointer select-none">Recently closed ({closed.length})</summary>
                  <div className="space-y-1 mt-1">
                    {closed.map(e => (
                      <button key={e._id} onClick={() => setSelectedId(e._id)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 flex justify-between text-sm">
                        <span>{TYPE_LABEL[e.type] ?? 'Emergency'} · {STATUS_LABEL[e.status]}</span>
                        <span className="text-muted-foreground tabular-nums">{timeAgo(e.createdAt)}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </Card>
        </div>
      </div>

      {selected && <IncidentPanel incident={selected} onClose={() => setSelectedId(null)} onChanged={updateEmergency} />}
    </>
  );
};

interface Handover {
  metrics: { secondsToAssign: number | null; secondsToScene: number | null; secondsToAed: number | null };
  patient: {
    name: string; age?: number; gender?: string; bloodType?: string;
    allergies: { allergen: string; severity: string }[];
    medications: string[]; conditions: string[];
    emergencyContact?: { name?: string; phone?: string };
  } | null;
  responder?: { name: string; role: string };
  aedRunner?: { name: string; role: string };
  aed?: { name: string; placement?: string; status?: string };
  timeline: { status: string; at: string; by: string | null }[];
}

const STEP: Record<string, string> = {
  pending: 'SOS received',
  assigned: 'Responder accepted',
  aed_runner_assigned: 'AED runner accepted',
  en_route: 'Responder on the way',
  on_scene: 'Responder on scene',
  aed_has_aed: 'AED collected',
  aed_delivered: 'AED at patient',
  resolved: 'Closed',
  cancelled: 'Cancelled',
};

const IncidentPanel = ({ incident, onClose, onChanged }: { incident: Emergency; onClose: () => void; onChanged: (e: Emergency) => void }) => {
  const [h, setH] = useState<Handover | null>(null);
  const [busy, setBusy] = useState(false);
  const isActive = ACTIVE.includes(incident.status);

  useEffect(() => {
    setH(null);
    api.get(`/emergencies/${incident._id}/handover`).then(r => setH(r.data)).catch(() => {});
  }, [incident._id, incident.status, incident.aedStatus]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setStatus = async (status: 'resolved' | 'cancelled') => {
    const verb = status === 'resolved' ? 'Close' : 'Cancel';
    if (!window.confirm(`${verb} this call? Responders will be notified.`)) return;
    setBusy(true);
    try {
      const { data } = await api.patch(`/emergencies/${incident._id}/status`, { status });
      onChanged(data);
      pushToast({ tone: 'success', title: status === 'resolved' ? 'Call closed' : 'Call cancelled' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Update failed', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };

  const p = h?.patient;
  const severe = p?.allergies.filter(a => a.severity === 'severe') ?? [];

  return (
    <aside
      role="dialog"
      aria-label="Call details"
      className="fixed right-0 top-0 bottom-0 z-30 w-[min(440px,100vw)] bg-card border-l border-border shadow-xl overflow-auto animate-in slide-in-from-right duration-200"
    >
      <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{TYPE_LABEL[incident.type] ?? 'Emergency'}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <StatusPill status={incident.status} /> <span className="tabular-nums">#{shortId(incident._id)}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X size={18} /></Button>
      </div>

      <div className="p-6 space-y-6">
        {!h ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <>
            <section>
              <h3 className="text-sm font-medium text-muted-foreground">Patient</h3>
              <p className="mt-1 text-xl font-semibold">{p?.name ?? 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">
                {[p?.age != null ? `${p.age} years` : null, p?.bloodType ? `Blood ${p.bloodType}` : null].filter(Boolean).join(' · ') || 'No profile details'}
              </p>
              {severe.length > 0 && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                  Severe allergy: {severe.map(a => a.allergen).join(', ')}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">Allergies</dt><dd>{p?.allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') || 'None recorded'}</dd>
                <dt className="text-muted-foreground">Medication</dt><dd>{p?.medications.join(', ') || 'None recorded'}</dd>
                <dt className="text-muted-foreground">Conditions</dt><dd>{p?.conditions.join(', ') || 'None recorded'}</dd>
                {p?.emergencyContact?.phone && (<><dt className="text-muted-foreground">Contact</dt><dd>{p.emergencyContact.name} · <a className="text-primary underline-offset-2 hover:underline" href={`tel:${p.emergencyContact.phone}`}>{p.emergencyContact.phone}</a></dd></>)}
              </dl>
            </section>

            {incident.callerCertifications && incident.callerCertifications.length > 0 && (
              <section className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <Award size={16} className="mt-0.5 shrink-0" />
                Caller holds {incident.callerCertifications.map(c => c.badgeLabel).join(', ')}. They may start care before help arrives.
              </section>
            )}

            <section>
              <h3 className="text-sm font-medium text-muted-foreground">Responders</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                <li>{h.responder ? <><span className="font-medium">{h.responder.name}</span> · <span className="capitalize">{h.responder.role.replace('_', ' ')}</span></> : 'No responder yet'}</li>
                {incident.type === 'cardiac' && (
                  <li>{h.aedRunner ? <><span className="font-medium">{h.aedRunner.name}</span> fetching AED{h.aed ? ` from ${h.aed.name}` : ''}</> : 'No AED runner yet'}</li>
                )}
              </ul>
            </section>

            <section className="grid grid-cols-3 gap-2">
              {[['To accept', h.metrics.secondsToAssign], ['To scene', h.metrics.secondsToScene], ['To AED', h.metrics.secondsToAed]].map(([label, v]) => (
                <div key={label as string} className="rounded-lg border border-border p-3">
                  <div className="text-lg font-semibold tabular-nums">{v != null ? formatEta(v as number) : '—'}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </section>

            <section>
              <h3 className="text-sm font-medium text-muted-foreground">Timeline</h3>
              <ol className="mt-2 space-y-2">
                {h.timeline.map((t, i) => (
                  <li key={i} className="grid grid-cols-[70px_1fr] gap-3 text-sm">
                    <span className="text-muted-foreground tabular-nums">{new Date(t.at).toLocaleTimeString([], { hourCycle: 'h23' })}</span>
                    <span>{STEP[t.status] ?? t.status}{t.by ? ` · ${t.by}` : ''}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {isActive && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button className="flex-1" disabled={busy} onClick={() => setStatus('resolved')}>Close call</Button>
            <Button className="flex-1" variant="outline" disabled={busy} onClick={() => setStatus('cancelled')}>Cancel call</Button>
          </div>
        )}
      </div>
    </aside>
  );
};
