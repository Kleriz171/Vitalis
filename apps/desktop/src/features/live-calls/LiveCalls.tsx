import { Check, Copy, LockSimple, LockSimpleOpen, MagnifyingGlass, Ambulance, Drone, Bandaids, Certificate, Drop, FirstAid, Heartbeat, Hourglass, Pill, Pulse, Siren, PersonSimpleRun, Timer, Warning, X, type Icon } from '@phosphor-icons/react';
import { Defibrillator } from '../../components/ui/aed-icon';
import { Tile, type TileTone } from '../../components/ui/tile';
import { Digits } from '../../components/ui/digits';
import { NotchedPanel } from '../../components/widgets/NotchedPanel';
import { Gauge } from '../../components/widgets/Gauge';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, FAST as FAST_T } from '../../lib/motion';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '../../lib/useNow';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { KPI } from '../../components/widgets/KPI';
import { pushToast } from '../../components/toast/toast';
import { timeAgo, shortId, formatEta } from '../../lib/format';
import { cn } from '../../lib/utils';
import { HANDOVER_STATUS, type Handover as HospitalHandover } from '../hospital/Incoming';
import { Chip } from '../../components/ui/list';
import { formatCoords } from '../../lib/geo';
import type { MapAed, MapResponder } from '../../components/map/MapView';
import { TYPE_LABEL } from '../../components/map/MapView';
import { roleLabel } from '../../lib/roles';

const MapView = lazy(() => import('../../components/map/MapView'));

const ACTIVE = ['pending', 'assigned', 'en_route', 'on_scene', 'assistance', 'handed_over'];
// Past this with nobody accepting, the dispatcher should intervene (the API escalates at the same point).
const ESCALATE_AFTER_S = 60;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting responder',
  assigned: 'Responder accepted',
  en_route: 'Responder on the way',
  on_scene: 'Responder on scene',
  assistance: 'Responder helping',
  handed_over: 'Patient handed over',
  resolved: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-red-500/10 text-red-700 ring-red-500/30',
  assigned: 'bg-amber-500/10 text-amber-700 ring-amber-500/30',
  en_route: 'bg-sky-500/10 text-sky-700 ring-sky-500/30',
  on_scene: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
  assistance: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
  handed_over: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/30',
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
  timeline?: { status: string; at: string; note?: string }[];
  escalatedAt?: string;
  escalationAckAt?: string;
  callerCertifications?: { badgeLabel: string; courseSlug: string; expiresAt: string }[];
}

interface Kpis {
  active?: number;
  pending?: number;
  onDuty?: number;
  medianAcceptSeconds?: number | null;
  acceptedUnderMinutePct?: number | null;
}

const nameOf = (p: Person) => (p && typeof p === 'object' ? p.name : null);
// mm:ss since the SOS, h:mm:ss past an hour.
const clock = (s: number) => {
  const t = Math.floor(s);
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(t % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
const STEPS = ['pending', 'assigned', 'en_route', 'on_scene', 'assistance', 'handed_over'];
// Status queues over the open calls. Escalated = nobody accepted within a minute and no operator has acknowledged it yet.
type Queue = 'all' | 'waiting' | 'escalated' | 'responding' | 'handed_over';
const QUEUES: [Queue, string, (e: Emergency) => boolean][] = [
  ['all', 'All', () => true],
  ['waiting', 'Waiting', e => e.status === 'pending'],
  ['escalated', 'Escalated', e => e.status === 'pending' && !!e.escalatedAt && !e.escalationAckAt],
  ['responding', 'Responding', e => ['assigned', 'en_route', 'on_scene', 'assistance'].includes(e.status)],
  ['handed_over', 'Handed over', e => e.status === 'handed_over'],
];
// The phone app's habit: every kind of call has its own icon and tint.
const TYPE_ICON: Record<string, [Icon, TileTone]> = {
  cardiac: [Heartbeat, 'sos'],
  medical: [FirstAid, 'teal'],
  trauma: [Bandaids, 'teal'],
  blood_needed: [Drop, 'sos'],
  rare_medicine: [Pill, 'mint'],
  other: [Siren, 'teal'],
};
const typeTile = (type: string) => TYPE_ICON[type] ?? TYPE_ICON.other;

export const StatusPill = ({ status }: { status: string }) => (
  <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE[status] ?? STATUS_TONE.resolved)}>
    {STATUS_LABEL[status] ?? status}
  </span>
);

/** The dashboard's big clock: Tirana time, with UTC and the link state under it. */
const HeroClock = () => {
  const now = new Date(useNow());
  const [live, setLive] = useState(socket.connected);
  useEffect(() => {
    const up = () => setLive(true);
    const down = () => setLive(false);
    socket.on('connect', up);
    socket.on('disconnect', down);
    setLive(socket.connected);
    return () => { socket.off('connect', up); socket.off('disconnect', down); };
  }, []);
  const fmt = (timeZone: string, seconds = true) => now.toLocaleTimeString('en-GB', { hourCycle: 'h23', timeZone, ...(seconds ? {} : { hour: '2-digit', minute: '2-digit' }) });
  return (
    <div className="shrink-0">
      <div className="flex items-center gap-3">
        <Digits value={fmt('Europe/Tirane')} className="text-[44px] leading-none font-extrabold tracking-[-0.03em] text-white" />
        <span className={cn('w-3 h-3 rounded-full', live ? 'bg-[hsl(173_79%_55%)] animate-live shadow-[0_0_0_4px_hsl(173_79%_55%/0.2)]' : 'bg-[hsl(var(--warn))]')} />
      </div>
      <div className="mt-1.5 text-[13px] text-white/70">
        Tirana · <Digits value={fmt('UTC', false)} /> UTC · <span className={live ? 'text-[hsl(173_79%_65%)] font-semibold' : 'text-[hsl(var(--warn))] font-semibold'}>{live ? 'Live' : 'Reconnecting'}</span>
      </div>
    </div>
  );
};

/**
 * One call in the list. It keeps its own once-a-second timer (the shared useNow tick), so the
 * page around it never re-renders just because a clock moved.
 */
const CallRow = memo(({ e, selected, onSelect, delay }: { e: Emergency; selected: boolean; onSelect: (id: string) => void; delay: number }) => {
  const now = useNow();
  const waited = Math.max(0, (now - new Date(e.createdAt).getTime()) / 1000);
  const waiting = e.status === 'pending' && (!!e.escalatedAt || waited > ESCALATE_AFTER_S);
  const step = STEPS.indexOf(e.status);
  return (
    <motion.button
        layout="position"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: FAST_T }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      onClick={() => onSelect(e._id)}
      className={cn(
        'w-full text-left px-5 py-4 border-b border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        selected ? 'bg-accent/70' : waiting ? 'bg-[hsl(var(--sos)/0.06)] hover:bg-[hsl(var(--sos)/0.1)]' : 'hover:bg-muted/60',
      )}
    >
      <div className="flex items-center gap-3">
        <Tile icon={typeTile(e.type)[0]} tone={typeTile(e.type)[1]} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold truncate">{TYPE_LABEL[e.type] ?? 'Emergency'}</span>
            <span className={cn('num text-[11px] font-bold rounded-md px-1.5 py-px', e.priority === 1 ? 'bg-[hsl(var(--sos))] text-white' : e.priority === 2 ? 'bg-[hsl(var(--warn)/0.15)] text-amber-800' : 'bg-muted text-muted-foreground')}>
              Priority {e.priority}
            </span>
          </div>
          <div className="text-[13px] text-muted-foreground truncate">
            {STATUS_LABEL[e.status] ?? e.status}{nameOf(e.responder) ? ` · ${nameOf(e.responder)}` : ''}
          </div>
        </div>
        <span title="Time since the SOS">
          <Digits value={clock(waited)} className={cn('text-[17px] font-extrabold tracking-[-0.02em]', waiting ? 'text-[hsl(var(--sos))]' : 'text-foreground')} />
        </span>
      </div>
      {/* Progress: received, accepted, on the way, on scene, helping, handed over. */}
      <div className="mt-3 ml-[52px] grid grid-cols-6 gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn('h-1.5 rounded-full transition-colors duration-500', i <= step ? (step === 0 ? 'bg-[hsl(var(--sos))]' : 'bg-[hsl(var(--teal))]') : 'bg-muted')} />
        ))}
      </div>
      {e.type === 'cardiac' && (
        <div className="mt-2 ml-[52px] flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Defibrillator size={14} weight="duotone" className={e.aedRunner ? 'text-[hsl(var(--teal))]' : ''} />
          {e.aedStatus === 'delivered' ? 'Defibrillator at the patient' : e.aedStatus === 'has_aed' ? 'Defibrillator on the way' : e.aedRunner ? 'Runner fetching a defibrillator' : 'No defibrillator runner yet'}
        </div>
      )}
      {waiting && (
        <div className="mt-3 ml-[52px] flex items-start gap-2 rounded-lg bg-[hsl(var(--sos))] text-white px-3 py-2 text-[13px] font-semibold">
          <Ambulance size={18} weight="fill" className="shrink-0" /> {e.escalationAckAt ? 'Still unanswered. An operator is handling it.' : 'Nobody accepted for over a minute. Send an ambulance.'}
        </div>
      )}
    </motion.button>
  );
});

export const LiveCalls = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [aeds, setAeds] = useState<MapAed[]>([]);
  const [responders, setResponders] = useState<Record<string, MapResponder>>({});
  const [kpis, setKpis] = useState<Kpis>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(false);
  const [queue, setQueue] = useState<Queue>('all');
  // Calls already there when the page opens enter one after another; later ones just slide in.
  const firstReveal = useRef(true);
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => { firstReveal.current = false; }, 1500);
    return () => clearTimeout(t);
  }, [loading]);

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

    const onEscalation = () => pushToast({ tone: 'error', title: 'SOS unanswered', body: 'Nobody has accepted a call for a minute. Open it and acknowledge.', ttl: 30_000 });
    socket.on('dashboard:emergency', onEmergency);
    socket.on('dashboard:escalation', onEscalation);
    socket.on('responder:location', onLocation);
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/aeds').then(r => setAeds(r.data)).catch(() => {});
    void loadKpis();
    const kpiTimer = setInterval(loadKpis, 15_000);
    return () => {
      socket.off('dashboard:emergency', onEmergency);
      socket.off('dashboard:escalation', onEscalation);
      socket.off('responder:location', onLocation);
      clearInterval(kpiTimer);
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

  // Filter calls by what an operator would type: type, status, case number or responder.
  const q = query.trim().toLowerCase();
  const matches = (e: Emergency) => !q || [TYPE_LABEL[e.type], STATUS_LABEL[e.status], shortId(e._id), nameOf(e.responder) ?? '']
    .some(v => (v ?? '').toLowerCase().includes(q));
  const inQueue = (e: Emergency, k: Queue) => k === 'all' || QUEUES.find(x => x[0] === k)![2](e);
  const shownActive = active.filter(e => matches(e) && inQueue(e, queue));
  const shownClosed = closed.filter(matches);

  return (
    <>
      {/* The band: a big live clock beside the title, search on the right. */}
      <header className="page-band frame-texture flex items-center gap-8 px-6 pt-6 pb-[4.75rem]">
        <HeroClock />
        <div className="h-14 w-px bg-white/15" />
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white">Live calls</h1>
          <p className="mt-1 text-[14px] text-white/75">Every SOS happening right now. Click a call to see who is on the way.</p>
        </div>
        <label className="relative z-10 ml-auto w-[min(340px,30vw)]">
          <span className="sr-only">Search calls</span>
          <MagnifyingGlass size={18} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search calls, case numbers, responders"
            className="w-full h-11 rounded-xl bg-white/[0.12] pl-10 pr-4 text-[14px] text-white placeholder:text-white/55 outline-none border border-white/10 focus:bg-white/[0.18] focus:border-white/30 transition-colors"
          />
        </label>
      </header>

      <div className="px-6 pb-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger" style={{ ['--base' as string]: '60ms' }}>
          <KPI icon={Siren} iconTone={kpis.active ? 'sos' : 'teal'} label="Active calls" value={kpis.active ?? '—'} />
          <KPI icon={Hourglass} iconTone={kpis.pending ? 'sos' : 'teal'} label="Waiting for a responder" value={kpis.pending ?? '—'} tone={kpis.pending ? 'rose' : 'teal'} />
          <KPI icon={PersonSimpleRun} iconTone="mint" label="Responders on duty" value={kpis.onDuty ?? '—'} />
          <KPI icon={Timer} iconTone="deep" label="Median time to accept, 24 h" value={kpis.medianAcceptSeconds != null ? formatEta(kpis.medianAcceptSeconds) : '—'} />
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-5 stagger" style={{ ['--base' as string]: '60ms' }}>
          <NotchedPanel
            className="h-[min(70vh,760px)]"
            notchWidth={124}
            notchHeight={260}
            notch={<>
              <button
                onClick={() => setFollow(f => !f)}
                aria-pressed={follow}
                title={follow ? 'Following: every active call stays in view' : 'Follow: keep every active call in view'}
                className={cn(
                  'w-[84px] h-[84px] rounded-full grid place-items-center content-center gap-1 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  follow
                    ? 'bg-primary text-primary-foreground shadow-[0_10px_22px_-8px_hsl(175_77%_21%/0.7)]'
                    : 'bg-card text-foreground shadow-[0_8px_20px_-8px_hsl(176_30%_10%/0.25),inset_0_0_0_1px_hsl(var(--border))] hover:bg-accent/50',
                )}
              >
                {follow ? <LockSimple size={22} weight="fill" /> : <LockSimpleOpen size={22} weight="duotone" />}
                {follow ? 'Following' : 'Follow'}
              </button>
              <Gauge value={kpis.acceptedUnderMinutePct ?? null} label="accepted in 1 min" />
            </>}
          >
            <Suspense fallback={<Skeleton className="w-full h-full" />}>
              <MapView
                incidents={shownActive}
                aeds={aeds}
                responders={Object.values(responders)}
                selectedId={selectedId}
                onSelect={setSelectedId}
                follow={follow}
              />
            </Suspense>
          </NotchedPanel>

          <section className="flex flex-col h-[min(70vh,760px)] rounded-[22px] border border-border bg-card overflow-hidden shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]" aria-label="Calls">
            <div className="px-5 h-14 shrink-0 bg-muted/60 border-b border-border flex items-center justify-between">
              <h2 className="text-[16px] font-extrabold tracking-[-0.01em]">Calls</h2>
              <span className={cn('num text-[13px] font-semibold rounded-full px-2.5 py-0.5', active.length ? 'bg-[hsl(var(--sos))] text-white' : 'bg-[hsl(173_55%_92%)] text-primary')}>
                {active.length} active
              </span>
            </div>
            <div className="shrink-0 flex flex-wrap gap-1 px-3 py-2 border-b border-border" role="tablist" aria-label="Call queues">
              {QUEUES.map(([k, label]) => {
                const n = active.filter(e => inQueue(e, k)).length;
                return (
                  <button key={k} role="tab" aria-selected={queue === k} onClick={() => setQueue(k)}
                    className={cn('px-2.5 py-1 text-[13px] rounded-lg transition-colors', queue === k ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted', k === 'escalated' && n > 0 && queue !== k && 'text-[hsl(var(--sos))] font-semibold')}>
                    {label} <span className="num opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-auto">
              {loading && <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}
              {!loading && shownActive.length === 0 && (
                <div className="px-6 py-10 text-center border-b border-border">
                  <Tile icon={q ? MagnifyingGlass : Pulse} tone="teal" size="lg" round className="mx-auto" />
                  <p className="mt-3 font-bold">{q ? 'No calls match' : queue !== 'all' && active.length ? 'None in this queue' : 'All quiet'}</p>
                  <p className="text-sm text-muted-foreground mt-1 text-pretty">{q ? `Nothing active matches “${query}”.` : queue !== 'all' && active.length ? 'Other queues have open calls.' : 'A new SOS appears here and on the map the moment it is sent.'}</p>
                </div>
              )}
              <AnimatePresence>
              {shownActive.map((e, i) => (
                <CallRow key={e._id} e={e} selected={selectedId === e._id} onSelect={setSelectedId} delay={firstReveal.current ? 0.42 + Math.min(i, 8) * 0.06 : 0} />
              ))}
              </AnimatePresence>
              {shownClosed.length > 0 && (
                <div className="py-2">
                  <div className="px-5 pt-2 pb-1 text-[13px] font-semibold text-muted-foreground">Recently closed</div>
                  {shownClosed.map(e => (
                    <button key={e._id} onClick={() => setSelectedId(e._id)} className="w-full text-left px-5 py-2 hover:bg-muted/60 flex items-center gap-3 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      <span className={cn('w-2 h-2 rounded-full shrink-0', e.status === 'resolved' ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />
                      <span className="truncate"><span className="code text-muted-foreground">#{shortId(e._id)}</span> · {TYPE_LABEL[e.type] ?? 'Emergency'} · {STATUS_LABEL[e.status]}</span>
                      <Digits value={new Date(e.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} className="ml-auto text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <AnimatePresence>
        {selected && <IncidentPanel key="call-panel" incident={selected} onClose={() => setSelectedId(null)} onChanged={updateEmergency} />}
      </AnimatePresence>
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
  timeline: { status: string; at: string; by: string | null; note?: string }[];
}

interface QuickReport {
  _id: string;
  author: { name: string; role: string };
  arrivedAt?: string;
  conscious: string;
  breathing: string;
  cprPerformed: boolean;
  aedUsed: boolean;
  shocks?: number;
  actions: string[];
  notes?: string;
  handover: string;
  updatedAt: string;
}

const STEP: Record<string, string> = {
  pending: 'SOS received',
  assigned: 'Responder accepted',
  aed_runner_assigned: 'AED runner accepted',
  released: 'Responder did not move, re-alerted',
  en_route: 'Responder on the way',
  on_scene: 'Responder on scene',
  assistance: 'Responder helping the patient',
  handed_over: 'Patient handed over',
  aed_has_aed: 'AED collected',
  aed_delivered: 'AED at patient',
  escalated: 'Unanswered, escalated to operators',
  escalation_acknowledged: 'Escalation acknowledged',
  action_called_caller: 'Operator called the caller',
  action_called_ambulance: 'Operator called the ambulance (127)',
  action_called_contact: 'Operator called the emergency contact',
  action_note: 'Operator note',
  resolved: 'Completed',
  cancelled: 'Cancelled',
};

const REPORT_ACTION: Record<string, string> = {
  cpr: 'CPR', aed_shock: 'Defibrillator shock', recovery_position: 'Recovery position', bleeding_control: 'Bleeding controlled',
  airway: 'Airway cleared', reassurance: 'Stayed and reassured', called_ambulance: 'Called the ambulance',
};
const REPORT_HANDOVER: Record<string, string> = {
  ambulance: 'Handed to the ambulance crew', hospital: 'Taken to a hospital', stayed_on_scene: 'Stayed at home or on scene',
  refused_care: 'Refused help', none: 'Not handed over',
};
const BREATHING: Record<string, string> = { normal: 'normal', abnormal: 'abnormal', none: 'not breathing', unknown: 'not recorded' };
const CONSCIOUS: Record<string, string> = { yes: 'conscious', no: 'unconscious', unknown: 'consciousness not recorded' };

/** Manual operator actions: what the operator did by phone, recorded on the call. Vitalis places none of these calls. */
const MANUAL_ACTIONS: [string, string][] = [['called_caller', 'Called the caller'], ['called_ambulance', 'Called 127'], ['called_contact', 'Called the contact']];

const IncidentPanel = ({ incident, onClose, onChanged }: { incident: Emergency; onClose: () => void; onChanged: (e: Emergency) => void }) => {
  const [h, setH] = useState<Handover | null>(null);
  const [reports, setReports] = useState<QuickReport[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isActive = ACTIVE.includes(incident.status);
  const steps = incident.timeline?.length ?? 0;

  useEffect(() => {
    api.get(`/emergencies/${incident._id}/handover`).then(r => setH(r.data)).catch(() => {});
  }, [incident._id, incident.status, incident.aedStatus, steps]);
  useEffect(() => { setH(null); setNote(''); }, [incident._id]);

  useEffect(() => {
    const load = () => api.get(`/emergencies/${incident._id}/reports`).then(r => setReports(r.data)).catch(() => setReports([]));
    void load();
    const onReport = (m: { emergencyId: string }) => { if (m.emergencyId === incident._id) void load(); };
    socket.on('emergency:report', onReport);
    return () => { socket.off('emergency:report', onReport); };
  }, [incident._id]);

  const act = async (path: string, body: object | undefined, done: string) => {
    setBusy(true);
    try {
      const { data } = await api.post(`/emergencies/${incident._id}/${path}`, body);
      onChanged(data);
      pushToast({ tone: 'success', title: done });
      return true;
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' });
      return false;
    } finally {
      setBusy(false);
    }
  };

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
    <motion.aside
      role="dialog"
      aria-label="Call details"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ duration: 0.38, ease: EASE }}
      className="fixed right-0 top-14 bottom-0 z-30 w-[min(460px,100vw)] bg-card border-l border-border shadow-[-24px_0_60px_-30px_hsl(176_40%_10%/0.35)] overflow-auto"
    >
      {/* Case header: the type, its case number and where it stands. */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <Tile icon={typeTile(incident.type)[0]} tone={typeTile(incident.type)[1]} size="lg" />
            <div className="min-w-0">
            <div className="text-[13px] text-muted-foreground">Case <span className="code text-foreground">#{shortId(incident._id)}</span></div>
            <h2 className={cn('mt-0.5 text-[22px] font-extrabold tracking-[-0.02em]', incident.priority === 1 && 'text-[hsl(var(--sos))]')}>{TYPE_LABEL[incident.type] ?? 'Emergency'}</h2>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close details"><X size={18} /></Button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          <StatusPill status={incident.status} />
          <span className="num">{timeAgo(incident.createdAt)}</span>
          {incident.location?.coordinates && <CopyCoords coordinates={incident.location.coordinates} />}
        </div>
      </div>

      <motion.div key={incident._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={FAST_T} className="px-6 py-6 space-y-7">
        {!h ? (
          <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div>
        ) : (
          <>
            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">Patient</h3>
              <p className="mt-1 text-[21px] font-extrabold tracking-[-0.02em]">{p?.name ?? 'Unknown'}</p>
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
                <Certificate size={20} weight="duotone" className="shrink-0" />
                Caller holds {incident.callerCertifications.map(c => c.badgeLabel).join(', ')}. They may start care before help arrives.
              </section>
            )}

            <section>
              <h3 className="text-[13px] font-medium text-muted-foreground">Responders</h3>
              <ul className="mt-2 space-y-2 text-[14px]">
                <li className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', h.responder ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />{h.responder ? <><span className="font-medium">{h.responder.name}</span><span className="text-muted-foreground">{roleLabel(h.responder.role)}</span></> : 'No responder yet'}</li>
                {incident.type === 'cardiac' && (
                  <li className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', h.aedRunner ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />{h.aedRunner ? <><span className="font-medium">{h.aedRunner.name}</span><span className="text-muted-foreground">fetching a defibrillator{h.aed ? ` from ${h.aed.name}` : ''}</span></> : 'No defibrillator runner yet'}</li>
                )}
                <DroneLink emergencyId={incident._id} />
                <CircleAlerts emergencyId={incident._id} />
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
                    <Digits value={new Date(t.at).toLocaleTimeString('en-GB', { hourCycle: 'h23' })} className="text-muted-foreground" />
                    <span>{STEP[t.status] ?? t.status}{t.by ? <span className="text-muted-foreground"> · {t.by}</span> : null}{t.note ? <span className="block text-muted-foreground">“{t.note}”</span> : null}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {reports.length > 0 && (
          <section>
            <h3 className="text-[13px] font-medium text-muted-foreground">Responder reports</h3>
            {reports.map(r => (
              <div key={r._id} className="mt-3 rounded-xl border border-border px-4 py-3 text-[14px] space-y-1.5">
                <div className="font-semibold">{r.author.name} <span className="font-normal text-muted-foreground">{roleLabel(r.author.role)}{r.arrivedAt ? ` · arrived ${new Date(r.arrivedAt).toLocaleTimeString('en-GB', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })}` : ''}</span></div>
                <div>On arrival: {CONSCIOUS[r.conscious] ?? r.conscious}, breathing {BREATHING[r.breathing] ?? r.breathing}.</div>
                <div>{[r.cprPerformed && 'CPR performed', r.aedUsed && `Defibrillator used${r.shocks != null ? ` (${r.shocks} shock${r.shocks === 1 ? '' : 's'})` : ''}`, ...r.actions.filter(a => !(a === 'cpr' && r.cprPerformed) && !(a === 'aed_shock' && r.aedUsed)).map(a => REPORT_ACTION[a] ?? a)].filter(Boolean).join(' · ') || 'No interventions recorded.'}</div>
                <div className="text-muted-foreground">{REPORT_HANDOVER[r.handover] ?? r.handover}</div>
                {r.notes && <div className="text-muted-foreground">“{r.notes}”</div>}
              </div>
            ))}
          </section>
        )}

        {h && <HospitalHandoverSection incident={incident} reportCount={reports.length} />}

        {isActive && (
          <section className={cn('rounded-xl border px-4 py-3', incident.escalatedAt && !incident.escalationAckAt ? 'border-[hsl(var(--sos)/0.4)] bg-[hsl(var(--sos)/0.06)]' : 'border-border')}>
            {incident.escalatedAt && !incident.escalationAckAt ? (
              <div className="flex items-center gap-3">
                <Warning size={20} weight="fill" className="shrink-0 text-[hsl(var(--sos))]" />
                <p className="flex-1 text-[14px] font-semibold">Nobody accepted this SOS. Acknowledge it, then call the caller or 127.</p>
                <Button size="sm" className="rounded-lg" disabled={busy} onClick={() => act('escalation/ack', undefined, 'Escalation acknowledged')}>Acknowledge</Button>
              </div>
            ) : (
              <h3 className="text-[13px] font-medium text-muted-foreground">What you did by phone</h3>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {MANUAL_ACTIONS.map(([kind, label]) => (
                <Button key={kind} size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => act('actions', { kind }, 'Recorded on the call')}>{label}</Button>
              ))}
            </div>
            <form className="mt-2 flex gap-2" onSubmit={async ev => { ev.preventDefault(); if (note.trim() && await act('actions', { kind: 'note', note: note.trim() }, 'Note added')) setNote(''); }}>
              <input value={note} onChange={ev => setNote(ev.target.value)} maxLength={500} placeholder="Add a note to the call" aria-label="Note" className="flex-1 h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20" />
              <Button type="submit" size="sm" variant="outline" className="rounded-lg h-9" disabled={busy || !note.trim()}>Add</Button>
            </form>
            <p className="mt-2 text-[12px] text-muted-foreground">Recorded on the call’s timeline. Vitalis does not place these calls for you.</p>
          </section>
        )}

        {isActive && (
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button className="flex-1 h-10 rounded-xl" disabled={busy} onClick={() => setStatus('resolved')}>Complete call</Button>
            <Button className="flex-1 h-10 rounded-xl" variant="outline" disabled={busy} onClick={() => setStatus('cancelled')}>Cancel call</Button>
          </div>
        )}
      </motion.div>
    </motion.aside>
  );
};

type DirectoryHospital = { id: string; name: string; address?: string; distanceKm?: number | null; capacity: { status: string; updatedAt: string } | null };
const CAPACITY_LABEL: Record<string, [string, 'teal' | 'amber' | 'sos']> = {
  accepting: ['Accepting', 'teal'], limited: ['Limited capacity', 'amber'], unavailable: ['Temporarily unavailable', 'sos'],
};
// A responder has taken the call (or it ended within the day): the API checks the same.
const SENDABLE = ['assigned', 'en_route', 'on_scene', 'assistance', 'handed_over', 'resolved'];
const hhmm = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }) : '');

/**
 * Digital handover to a participating hospital. The operator chooses the hospital (nearest first,
 * with the capacity the hospital itself reported); Vitalis never chooses one.
 */
const HospitalHandoverSection = ({ incident, reportCount }: { incident: Emergency; reportCount: number }) => {
  const [items, setItems] = useState<HospitalHandover[]>([]);
  const [picking, setPicking] = useState(false);
  const [directory, setDirectory] = useState<DirectoryHospital[] | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get<HospitalHandover[]>('/hospital/handovers', { params: { emergencyId: incident._id } }).then(r => setItems(r.data)).catch(() => {}), [incident._id]);
  const loadDirectory = useCallback(() => {
    const [lng, lat] = incident.location?.coordinates ?? [];
    api.get<DirectoryHospital[]>('/hospital/directory', { params: lng != null ? { lng, lat } : {} }).then(r => setDirectory(r.data)).catch(() => setDirectory([]));
  }, [incident.location]);

  useEffect(() => {
    void load();
    setPicking(false);
    setChoice(null);
    const onHandover = (m: { emergencyId: string }) => { if (m.emergencyId === incident._id) void load(); };
    socket.on('dashboard:handover', onHandover);
    return () => { socket.off('dashboard:handover', onHandover); };
  }, [incident._id, load]);
  useEffect(() => {
    if (!picking) return;
    loadDirectory();
    socket.on('hospital:capacity', loadDirectory);
    return () => { socket.off('hospital:capacity', loadDirectory); };
  }, [picking, loadDirectory]);

  const send = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      const { data } = await api.post<HospitalHandover>('/hospital/handovers', { emergencyId: incident._id, hospitalId: choice });
      pushToast({ tone: 'success', title: 'Handover sent', body: data.deliveredLive ? 'The hospital has Vitalis open and sees it now.' : 'Nobody at the hospital has Vitalis open. They will see it when they do: consider calling them.' });
      setPicking(false);
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not sent', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async (id: string) => {
    if (!window.confirm('Withdraw this handover? The hospital is told at once.')) return;
    setBusy(true);
    try {
      await api.post(`/hospital/handovers/${id}/withdraw`);
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not withdrawn', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };

  const open = items.find(h => ['sent', 'acknowledged', 'arrived'].includes(h.status));
  const past = items.filter(h => h !== open);
  if (!open && !past.length && !SENDABLE.includes(incident.status)) return null;

  return (
    <section>
      <h3 className="text-[13px] font-medium text-muted-foreground">Hospital handover</h3>
      {open ? (
        <div className={cn('mt-2 rounded-xl border px-4 py-3 text-[14px] space-y-1', open.status === 'sent' ? 'border-[hsl(var(--warn)/0.5)]' : 'border-border')}>
          <div className="flex items-center gap-2">
            <span className="font-semibold flex-1">{open.hospital.name}</span>
            <Chip tone={open.status === 'sent' ? 'amber' : 'teal'}>{HANDOVER_STATUS[open.status]}</Chip>
          </div>
          <div className="text-muted-foreground">Sent {hhmm(open.sentAt)}{open.deliveredLive ? ', seen live at the hospital' : ', nobody at the hospital had Vitalis open'}</div>
          {open.acknowledgedAt && <div>Acknowledged {hhmm(open.acknowledgedAt)}{open.acknowledgedBy ? ` by ${open.acknowledgedBy}` : ''}</div>}
          {open.arrivedAt && <div>Patient checked in {hhmm(open.arrivedAt)}{open.intake && open.intake !== 'arrived' ? ` · ${open.intake.replace('_', ' ')}` : ''}</div>}
          {open.status !== 'arrived' && (
            <Button size="sm" variant="ghost" className="rounded-lg -ml-2 text-muted-foreground" disabled={busy} onClick={() => withdraw(open.id)}>Withdraw</Button>
          )}
        </div>
      ) : SENDABLE.includes(incident.status) && !picking ? (
        <Button size="sm" variant="outline" className="mt-2 rounded-lg" onClick={() => setPicking(true)}>Send to a hospital</Button>
      ) : null}

      {picking && !open && (
        <div className="mt-2 rounded-xl border border-border">
          {!directory ? <p className="px-4 py-3 text-sm text-muted-foreground">Loading hospitals…</p>
            : directory.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">No hospital is on Vitalis yet. Call the hospital instead.</p>
            : directory.map(h => {
              const cap = h.capacity ? CAPACITY_LABEL[h.capacity.status] : null;
              return (
                <label key={h.id} className={cn('flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 cursor-pointer', choice === h.id && 'bg-accent/60')}>
                  <input type="radio" name={`hospital-${incident._id}`} checked={choice === h.id} onChange={() => setChoice(h.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{h.name}</span>
                    <span className="block text-[12px] text-muted-foreground">{h.distanceKm != null ? `${h.distanceKm} km · ` : ''}{h.capacity ? `reported ${timeAgo(h.capacity.updatedAt)}` : 'capacity not reported'}</span>
                  </span>
                  {cap && <Chip tone={cap[1]}>{cap[0]}</Chip>}
                </label>
              );
            })}
          <div className="px-4 py-3 border-t border-border bg-muted/30 text-[13px] text-muted-foreground space-y-2">
            <p>The hospital receives the patient details shown above (without contact numbers), the responders, {reportCount === 1 ? 'one responder report' : `${reportCount} responder reports`} and the timeline, as they are now.</p>
            <div className="flex gap-2">
              <Button size="sm" className="rounded-lg" disabled={!choice || busy} onClick={send}>Send handover</Button>
              <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => setPicking(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {past.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
          {past.map(h => <li key={h.id}>{h.hospital.name}: {HANDOVER_STATUS[h.status].toLowerCase()} ({hhmm(h.sentAt)})</li>)}
        </ul>
      )}
    </section>
  );
};

const ALERT_LABEL: Record<string, string> = {
  sending: 'sending…', sent: 'texted', simulated: 'not sent (test server)', failed: 'text failed', not_configured: 'not sent (no SMS provider)',
  skipped_recent: 'already texted minutes ago', skipped_no_consent: 'not texted (caller’s choice)',
};

/** Who in the caller's emergency circle was texted about this call. */
const CircleAlerts = ({ emergencyId }: { emergencyId: string }) => {
  const [alerts, setAlerts] = useState<{ name?: string; phone: string; status: string }[]>([]);
  useEffect(() => { api.get(`/emergencies/${emergencyId}/alerts`).then(r => setAlerts(r.data)).catch(() => setAlerts([])); }, [emergencyId]);
  if (!alerts.length) return null;
  const bad = alerts.some(a => a.status === 'failed' || a.status === 'not_configured');
  return (
    <li className="flex items-start gap-2">
      <span className={cn('mt-1.5 w-2 h-2 rounded-full shrink-0', bad ? 'bg-[hsl(var(--sos))]' : 'bg-[hsl(var(--teal))]')} />
      <span>Caller’s circle: <span className="text-muted-foreground">{alerts.map(a => `${a.name ?? a.phone} ${ALERT_LABEL[a.status] ?? a.status}`).join(' · ')}</span></span>
    </li>
  );
};

/** The caller's position as text: copy it here, paste it into a drone's "Where to". */
const CopyCoords = ({ coordinates }: { coordinates: [number, number] }) => {
  const [copied, setCopied] = useState(false);
  const text = formatCoords(coordinates);
  const copy = () => navigator.clipboard.writeText(text)
    .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
    .catch(() => pushToast({ tone: 'error', title: 'Could not copy', body: text }));
  return (
    <button type="button" onClick={copy} title="Copy the caller's coordinates" className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="num">{text}</span>
      {copied ? <Check size={14} weight="bold" className="text-[hsl(var(--teal))]" /> : <Copy size={14} />}
      <span className="sr-only">{copied ? 'Copied' : 'Copy coordinates'}</span>
    </button>
  );
};

/** Drones that could help with this call; opens the flight view with the call already linked. */
const DroneLink = ({ emergencyId }: { emergencyId: string }) => {
  const [drones, setDrones] = useState<{ droneId: string; telemetry: { linkOk?: boolean } | null }[]>([]);
  const nav = useNavigate();
  useEffect(() => {
    api.get('/drones/fleet').then(r => setDrones(r.data)).catch(() => {});
    socket.on('drone:fleet', setDrones);
    return () => { socket.off('drone:fleet', setDrones); };
  }, []);
  const ready = drones.filter(d => d.telemetry?.linkOk);
  return (
    <li className="flex items-center gap-2">
      <span className={cn('w-2 h-2 rounded-full', ready.length ? 'bg-[hsl(var(--teal))]' : 'bg-muted-foreground/40')} />
      {drones.length === 0 ? 'No drone online' : (
        <>
          <Drone size={16} className="text-muted-foreground" aria-hidden />
          <span className="font-medium">{ready.length ? ready.map(d => d.droneId).join(', ') : drones.map(d => d.droneId).join(', ')}</span>
          <span className="text-muted-foreground">{ready.length ? 'ready' : 'not reaching its drone'}</span>
          <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => nav(`/command/drones?call=${emergencyId}`)}>Drone view</Button>
        </>
      )}
    </li>
  );
};
