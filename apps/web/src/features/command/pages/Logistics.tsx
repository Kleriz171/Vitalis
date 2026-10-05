import { LockSimple, LockSimpleOpen, MagnifyingGlass, Ambulance, Bandaids, Certificate, Drop, FirstAid, Heartbeat, Hourglass, Lightning, Pill, Pulse, Siren, Timer, UsersThree, Warning, X, type Icon } from '@phosphor-icons/react';
import { Tile, type TileTone } from '../../../components/ui/tile';
import { Digits } from '../../../components/ui/digits';
import { NotchedPanel } from '../../../components/widgets/NotchedPanel';
import { Gauge } from '../../../components/widgets/Gauge';
import { AnimatePresence, motion } from 'framer-motion';
import { EASE, FAST as FAST_T } from '../../../lib/motion';
import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNow } from '../../../lib/useNow';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
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
const STEPS = ['pending', 'assigned', 'en_route', 'on_scene'];
// The phone app's habit: every kind of call has its own icon and tint.
const TYPE_ICON: Record<string, [Icon, TileTone]> = {
  cardiac: [Heartbeat, 'sos'],
  medical: [FirstAid, 'amber'],
  trauma: [Bandaids, 'violet'],
  blood_needed: [Drop, 'sos'],
  rare_medicine: [Pill, 'blue'],
  other: [Siren, 'slate'],
};
const typeTile = (type: string) => TYPE_ICON[type] ?? TYPE_ICON.other;

export const StatusPill = ({ status }: { status: string }) => (
  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', STATUS_TONE[status] ?? STATUS_TONE.resolved)}>
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
  const waiting = e.status === 'pending' && waited > ESCALATE_AFTER_S;
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
              P{e.priority}
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
      {/* Progress: received, accepted, on the way, on scene. */}
      <div className="mt-3 ml-[52px] grid grid-cols-4 gap-1" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn('h-1.5 rounded-full transition-colors duration-500', i <= step ? (step === 0 ? 'bg-[hsl(var(--sos))]' : 'bg-[hsl(var(--teal))]') : 'bg-muted')} />
        ))}
      </div>
      {e.type === 'cardiac' && (
        <div className="mt-2 ml-[52px] flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Lightning size={14} weight="duotone" className={e.aedRunner ? 'text-[hsl(var(--teal))]' : ''} />
          {e.aedStatus === 'delivered' ? 'Defibrillator at the patient' : e.aedStatus === 'has_aed' ? 'Defibrillator on the way' : e.aedRunner ? 'Runner fetching a defibrillator' : 'No defibrillator runner yet'}
        </div>
      )}
      {waiting && (
        <div className="mt-3 ml-[52px] flex items-start gap-2 rounded-lg bg-[hsl(var(--sos))] text-white px-3 py-2 text-[13px] font-semibold">
          <Ambulance size={18} weight="fill" className="shrink-0" /> Nobody accepted for over a minute. Send an ambulance.
        </div>
      )}
    </motion.button>
  );
});

export const Logistics = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [aeds, setAeds] = useState<MapAed[]>([]);
  const [responders, setResponders] = useState<Record<string, MapResponder>>({});
  const [kpis, setKpis] = useState<Kpis>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(false);
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

    socket.on('dashboard:emergency', onEmergency);
    socket.on('responder:location', onLocation);
    api.get('/emergencies').then(r => setEmergencies(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/aeds').then(r => setAeds(r.data)).catch(() => {});
    void loadKpis();
    const kpiTimer = setInterval(loadKpis, 15_000);
    return () => {
      socket.off('dashboard:emergency', onEmergency);
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
  const shownActive = active.filter(matches);
  const shownClosed = closed.filter(matches);

  return (
    <>
      {/* The band: a big live clock beside the title, search on the right. */}
      <header className="page-band frame-texture flex items-center gap-8 px-6 pt-6 pb-[4.75rem]">
        <HeroClock />
        <div className="h-14 w-px bg-white/15" />
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-white">Live operations</h1>
          <p className="mt-1 text-[14px] text-white/75">SOS calls, responders and defibrillators in real time</p>
        </div>
        <label className="relative z-10 ml-auto w-[min(340px,30vw)]">
          <span className="sr-only">Search calls</span>
          <MagnifyingGlass size={18} weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search calls, case numbers, responders"
            className="w-full h-11 rounded-full bg-white/[0.12] pl-10 pr-4 text-[14px] text-white placeholder:text-white/55 outline-none border border-white/10 focus:bg-white/[0.18] focus:border-white/30 transition-colors"
          />
        </label>
      </header>

      <div className="px-6 pb-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger" style={{ ['--base' as string]: '60ms' }}>
          <KPI icon={Siren} iconTone="sos" label="Active calls" value={kpis.active ?? '—'} />
          <KPI icon={Hourglass} iconTone={kpis.pending ? 'sos' : 'amber'} label="Waiting for a responder" value={kpis.pending ?? '—'} tone={kpis.pending ? 'rose' : 'teal'} />
          <KPI icon={UsersThree} iconTone="teal" label="Responders on duty" value={kpis.onDuty ?? '—'} />
          <KPI icon={Timer} iconTone="blue" label="Median time to accept, 24 h" value={kpis.medianAcceptSeconds != null ? formatEta(kpis.medianAcceptSeconds) : '—'} />
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
            <div className="flex-1 overflow-auto">
              {loading && <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>}
              {!loading && shownActive.length === 0 && (
                <div className="px-6 py-10 text-center border-b border-border">
                  <Tile icon={q ? MagnifyingGlass : Pulse} tone="teal" size="lg" round className="mx-auto" />
                  <p className="mt-3 font-bold">{q ? 'No calls match' : 'All quiet'}</p>
                  <p className="text-sm text-muted-foreground mt-1 text-pretty">{q ? `Nothing active matches “${query}”.` : 'A new SOS appears here and on the map the moment it is sent.'}</p>
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
                    <Digits value={new Date(t.at).toLocaleTimeString('en-GB', { hourCycle: 'h23' })} className="text-muted-foreground" />
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
      </motion.div>
    </motion.aside>
  );
};
