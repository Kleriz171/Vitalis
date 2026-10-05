import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Award, X, Zap } from 'lucide-react';
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
  pending: 'bg-red-500/10 text-red-700 ring-red-500/30',
  assigned: 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  en_route: 'bg-sky-500/10 text-sky-700 ring-sky-500/30',
  on_scene: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
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
// mm:ss since the SOS, h:mm:ss past an hour.
const clock = (s: number) => {
  const t = Math.floor(s);
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const STEPS = ['pending', 'assigned', 'en_route', 'on_scene'];

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

    socket.on('dashboard:emergency', onEmergency);
    socket.on('responder:location', onLocation);
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/aeds').then(r => setAeds(r.data)).catch(() => {});
    void loadKpis();
    const kpiTimer = setInterval(loadKpis, 15_000);
    // Re-render every second: the call timers tick and escalations appear without new events.
    const ticker = setInterval(() => tick(t => t + 1), 1000);
    return () => {
      socket.off('dashboard:emergency', onEmergency);
      socket.off('responder:location', onLocation);
      clearInterval(kpiTimer);
      clearInterval(ticker);
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
      />

      <div className="px-6 pb-6 space-y-5">
        {/* Situation strip: four readings in one panel. */}
        <div className="grid grid-cols-2 xl:grid-cols-4 rounded-2xl border border-border bg-card">
          <KPI label="Active calls" value={kpis.active ?? '—'} />
          <KPI label="Waiting for a responder" value={kpis.pending ?? '—'} tone={kpis.pending ? 'rose' : 'teal'} />
          <KPI label="Responders on duty" value={kpis.onDuty ?? '—'} />
          <KPI label="Median time to accept, 24 h" value={kpis.medianAcceptSeconds != null ? formatEta(kpis.medianAcceptSeconds) : '—'} />
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-5">
          <div className="h-[min(70vh,760px)] rounded-2xl border border-border bg-card overflow-hidden">
            <Suspense fallback={<Skeleton className="w-full h-full" />}>
              <MapView
                incidents={active}
                aeds={aeds}
                responders={Object.values(responders)}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Suspense>
          </div>

          <section className="flex flex-col h-[min(70vh,760px)] rounded-2xl border border-border bg-card overflow-hidden" aria-label="Calls">
            <div className="px-5 h-14 shrink-0 border-b border-border flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Calls</h2>
              <span className={cn('num text-[13px] font-semibold rounded-full px-2.5 py-0.5', active.length ? 'bg-[hsl(var(--sos))] text-white' : 'bg-muted text-muted-foreground')}>
                {active.length} active
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              {loading && <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}
              {!loading && active.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto w-11 h-11 rounded-full bg-accent grid place-items-center text-primary"><Activity size={20} /></div>
                  <p className="mt-3 font-medium">All quiet</p>
                  <p className="text-sm text-muted-foreground mt-1 text-pretty">A new SOS appears here and on the map the moment it is sent.</p>
                </div>
              )}
              {active.map(e => {
                const waited = secondsSince(e.createdAt);
                const waiting = e.status === 'pending' && waited > ESCALATE_AFTER_S;
                const step = STEPS.indexOf(e.status);
                return (
                  <button
                    key={e._id}
                    onClick={() => setSelectedId(e._id)}
                    className={cn(
                      'w-full text-left px-5 py-4 border-b border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      selectedId === e._id ? 'bg-accent/70' : waiting ? 'bg-[hsl(var(--sos)/0.06)] hover:bg-[hsl(var(--sos)/0.1)]' : 'hover:bg-muted/60',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={cn('num text-[11px] font-bold rounded-md px-1.5 py-0.5', e.priority === 1 ? 'bg-[hsl(var(--sos))] text-white' : e.priority === 2 ? 'bg-[hsl(var(--warn)/0.15)] text-amber-800' : 'bg-muted text-muted-foreground')}>
                        P{e.priority}
                      </span>
                      <span className="font-semibold truncate">{TYPE_LABEL[e.type] ?? 'Emergency'}</span>
                      <span className={cn('ml-auto num text-[15px] font-semibold', waiting ? 'text-[hsl(var(--sos))]' : 'text-foreground')} title="Time since the SOS">
                        {clock(waited)}
                      </span>
                    </div>
                    {/* Progress: received, accepted, on the way, on scene. */}
                    <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
                      {STEPS.map((s, i) => (
                        <span key={s} className={cn('h-1.5 rounded-full', i <= step ? (step === 0 ? 'bg-[hsl(var(--sos))]' : 'bg-[hsl(var(--teal))]') : 'bg-muted')} />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground min-w-0">
                      <span className="text-foreground font-medium shrink-0">{STATUS_LABEL[e.status] ?? e.status}</span>
                      {nameOf(e.responder) && <span className="truncate">· {nameOf(e.responder)}</span>}
                    </div>
                    {e.type === 'cardiac' && (
                      <div className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Zap size={13} className={e.aedRunner ? 'text-[hsl(var(--teal))]' : ''} />
                        {e.aedStatus === 'delivered' ? 'Defibrillator at the patient' : e.aedStatus === 'has_aed' ? 'Defibrillator on the way' : e.aedRunner ? 'Runner fetching a defibrillator' : 'No defibrillator runner yet'}
                      </div>
                    )}
                    {waiting && (
                      <div className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold text-[hsl(var(--sos))]">
                        <AlertTriangle size={14} /> Nobody accepted for over a minute. Send an ambulance.
                      </div>
                    )}
                  </button>
                );
              })}
              {closed.length > 0 && (
                <details className="px-3 py-2">
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
          </section>
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
  released: 'Responder did not move, re-alerted',
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
      className="fixed right-0 top-14 bottom-0 z-30 w-[min(460px,100vw)] bg-card border-l border-border shadow-[-24px_0_60px_-30px_hsl(176_40%_10%/0.35)] overflow-auto animate-in slide-in-from-right duration-200"
    >
      {/* Case header: the type, its case number and where it stands. */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] text-muted-foreground">Case <span className="code text-foreground">#{shortId(incident._id)}</span></div>
            <h2 className={cn('mt-0.5 text-[22px] font-semibold tracking-[-0.015em]', incident.priority === 1 && 'text-[hsl(var(--sos))]')}>{TYPE_LABEL[incident.type] ?? 'Emergency'}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X size={18} /></Button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          <StatusPill status={incident.status} />
          <span className="num">{timeAgo(incident.createdAt)}</span>
        </div>
      </div>

      <div className="px-6 py-6 space-y-7">
        {!h ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <>
            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">Patient</h3>
              <p className="mt-1 text-[20px] font-semibold">{p?.name ?? 'Unknown'}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {p?.age != null && <span className="num rounded-md bg-muted px-2 py-0.5 text-[13px]">{p.age} years</span>}
                {p?.bloodType && <span className="rounded-md bg-primary text-primary-foreground px-2 py-0.5 text-[13px] font-semibold">Blood {p.bloodType}</span>}
                {!p?.age && !p?.bloodType && <span className="text-sm text-muted-foreground">No profile details</span>}
              </div>
              {severe.length > 0 && (
                <p className="mt-4 rounded-xl bg-[hsl(var(--sos))] px-4 py-3 text-[14px] font-semibold text-white">
                  Severe allergy: {severe.map(a => a.allergen).join(', ')}
                </p>
              )}
              <dl className="mt-4 grid grid-cols-[104px_1fr] gap-y-2.5 text-[14px]">
                <dt className="text-muted-foreground">Allergies</dt><dd>{p?.allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') || 'None recorded'}</dd>
                <dt className="text-muted-foreground">Medication</dt><dd>{p?.medications.join(', ') || 'None recorded'}</dd>
                <dt className="text-muted-foreground">Conditions</dt><dd>{p?.conditions.join(', ') || 'None recorded'}</dd>
                {p?.emergencyContact?.phone && (<><dt className="text-muted-foreground">Contact</dt><dd>{p.emergencyContact.name} · <a className="text-primary font-medium underline-offset-2 hover:underline num" href={`tel:${p.emergencyContact.phone}`}>{p.emergencyContact.phone}</a></dd></>)}
              </dl>
            </section>

            {incident.callerCertifications && incident.callerCertifications.length > 0 && (
              <section className="flex items-start gap-2.5 rounded-xl bg-accent px-4 py-3 text-[14px] text-accent-foreground">
                <Award size={16} className="mt-0.5 shrink-0" />
                Caller holds {incident.callerCertifications.map(c => c.badgeLabel).join(', ')}. They may start care before help arrives.
              </section>
            )}

            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">Responders</h3>
              <ul className="mt-2 space-y-2 text-[14px]">
                <li className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', h.responder ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />{h.responder ? <><span className="font-medium">{h.responder.name}</span><span className="text-muted-foreground capitalize">{h.responder.role.replace('_', ' ')}</span></> : 'No responder yet'}</li>
                {incident.type === 'cardiac' && (
                  <li className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', h.aedRunner ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />{h.aedRunner ? <><span className="font-medium">{h.aedRunner.name}</span><span className="text-muted-foreground">fetching a defibrillator{h.aed ? ` from ${h.aed.name}` : ''}</span></> : 'No defibrillator runner yet'}</li>
                )}
              </ul>
            </section>

            <section className="grid grid-cols-3 rounded-xl border border-border">
              {[['To accept', h.metrics.secondsToAssign], ['To scene', h.metrics.secondsToScene], ['To defibrillator', h.metrics.secondsToAed]].map(([label, v]) => (
                <div key={label as string} className="px-4 py-3 border-l border-border first:border-l-0">
                  <div className="num text-[18px] font-semibold">{v != null ? formatEta(v as number) : '—'}</div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </section>

            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">Timeline</h3>
              <ol className="mt-3 relative">
                {h.timeline.map((t, i) => (
                  <li key={i} className="relative grid grid-cols-[18px_72px_1fr] gap-2 pb-3 text-[14px]">
                    <span className="relative flex justify-center">
                      <span className={cn('mt-1.5 w-2.5 h-2.5 rounded-full border-2 border-card', i === h.timeline.length - 1 ? 'bg-[hsl(var(--teal))]' : 'bg-primary/40')} />
                      {i < h.timeline.length - 1 && <span className="absolute top-4 bottom-[-6px] w-px bg-border" />}
                    </span>
                    <span className="num text-muted-foreground">{new Date(t.at).toLocaleTimeString([], { hourCycle: 'h23' })}</span>
                    <span>{STEP[t.status] ?? t.status}{t.by ? <span className="text-muted-foreground"> · {t.by}</span> : null}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {isActive && (
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button className="flex-1 h-10 rounded-xl" disabled={busy} onClick={() => setStatus('resolved')}>Close call</Button>
            <Button className="flex-1 h-10 rounded-xl" variant="outline" disabled={busy} onClick={() => setStatus('cancelled')}>Cancel call</Button>
          </div>
        )}
      </div>
    </aside>
  );
};
