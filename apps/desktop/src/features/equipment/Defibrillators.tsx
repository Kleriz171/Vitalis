import { BatteryWarning, CalendarX, LockKey, MagnifyingGlass, PencilSimple, ShieldCheck, ShieldWarning, Trash, Warning } from '@phosphor-icons/react';
import { Defibrillator } from '../../components/ui/aed-icon';
import { KPI } from '../../components/widgets/KPI';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api/client';
import { Chip, Panel, Row } from '../../components/ui/list';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { PageHeader } from '../../components/layout/CommandShell';
import { pushToast } from '../../components/toast/toast';
import { cn } from '../../lib/utils';
import { shortId, timeAgo } from '../../lib/format';

interface Aed {
  id: string;
  name: string;
  placement?: string;
  access: '24h' | 'business_hours' | 'restricted';
  coordinates: [number, number];
  padsExpireAt?: string;
  battery?: { percent: number; at: string; source: 'inspection' | 'device' };
  hasCode: boolean;
  verified: boolean;
  status: 'ok' | 'needs_check' | 'out_of_service' | 'in_use';
  problem?: string;
}

type Filter = 'all' | 'unverified' | 'expiring' | 'battery' | '24h';
const FILTERS: [Filter, string][] = [['all', 'All'], ['unverified', 'Needs review'], ['battery', 'Battery'], ['expiring', 'Pads expiring'], ['24h', 'Open 24 h']];
const MapView = lazy(() => import('../../components/map/MapView'));

const ACCESS: Record<Aed['access'], string> = { '24h': '24 hours', business_hours: 'Business hours', restricted: 'Staff access' };
const STATUS: Record<Aed['status'], string> = { ok: 'In service', needs_check: 'Problem reported', out_of_service: 'Out of service', in_use: 'Out with a responder' };
// Unconfirmed reports, devices with a problem and ones not back in their cabinet: dispatch sends nobody to them.
const needsReview = (a: Aed) => !a.verified || a.status !== 'ok';

// A charge below this, or a reading older than this, needs someone to go and look.
const LOW_BATTERY = 30;
const STALE_DAYS = 30;
const batteryDue = (a: Aed) => !a.battery || a.battery.percent < LOW_BATTERY || Date.now() - new Date(a.battery.at).getTime() > STALE_DAYS * 86400000;
const batteryText = (a: Aed) => (a.battery ? `Battery ${a.battery.percent}% · ${timeAgo(a.battery.at)}` : 'Battery not checked');

export const Defibrillators = () => {
  const [items, setItems] = useState<Aed[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<Aed | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Aed | null>(null);
  const [device, setDevice] = useState<Aed | null>(null);
  const replace = (a: Aed) => setItems(prev => prev.map(x => (x.id === a.id ? a : x)));

  useEffect(() => {
    api.get('/aeds').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const soon = (iso?: string) => !!iso && new Date(iso).getTime() - Date.now() < 60 * 86400000;
  const counts = {
    all: items.length,
    unverified: items.filter(needsReview).length,
    expiring: items.filter(a => soon(a.padsExpireAt)).length,
    battery: items.filter(batteryDue).length,
    '24h': items.filter(a => a.access === '24h').length,
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(a => filter === 'all' || (filter === 'unverified' ? needsReview(a) : filter === 'expiring' ? soon(a.padsExpireAt) : filter === 'battery' ? batteryDue(a) : a.access === '24h'))
      .filter(a => !q || `${a.name} ${a.placement ?? ''}`.toLowerCase().includes(q));
  }, [items, filter, query]);

  const verify = async (a: Aed) => {
    setBusy(a.id);
    try {
      const { data } = await api.post(`/aeds/${a.id}/verify`);
      setItems(prev => prev.map(x => (x.id === a.id ? data : x)));
      pushToast({ tone: 'success', title: a.status === 'in_use' ? 'Back in its cabinet' : a.verified ? 'Back in service' : 'Verified', body: a.name });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Could not verify', body: err?.response?.data?.error });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: Aed) => {
    if (!window.confirm(`Remove "${a.name}" from the registry? Responders will no longer be sent there.`)) return;
    setBusy(a.id);
    try {
      await api.delete(`/aeds/${a.id}`);
      setItems(prev => prev.filter(x => x.id !== a.id));
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Could not remove', body: err?.response?.data?.error });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader icon={Defibrillator} title="Defibrillators" subtitle="Public defibrillators. Helpers are only sent to fetch the ones listed here." />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI icon={Defibrillator} iconTone="deep" label="Registered defibrillators" value={counts.all} />
          <KPI icon={ShieldWarning} iconTone={counts.unverified ? 'sos' : 'teal'} label="Waiting for review" value={counts.unverified} tone={counts.unverified ? 'rose' : 'teal'} />
          <KPI icon={BatteryWarning} iconTone={counts.battery ? 'sos' : 'mint'} label="Battery low or unchecked" value={counts.battery} tone={counts.battery ? 'rose' : 'teal'} />
          <KPI icon={CalendarX} iconTone={counts.expiring ? 'sos' : 'mint'} label="Pads expire within 60 days" value={counts.expiring} tone={counts.expiring ? 'rose' : 'teal'} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm" role="tablist">
            {FILTERS.map(([f, label]) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', filter === f ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}
              >
                {label} <span className="num opacity-70">{counts[f]}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-[min(320px,100%)]">
            <span className="sr-only">Search defibrillators</span>
            <MagnifyingGlass size={17} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by place" className="w-full h-10 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20 transition" />
          </label>
        </div>

        <div className="grid xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
        <Panel>
          {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10" /></div>)}
          {!loading && shown.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground">
              {query ? `Nothing matches “${query}”.` : filter === 'unverified' ? 'Nothing to review. Citizen reports appear here.' : filter === 'expiring' ? 'No pads expire in the next 60 days.' : filter === 'battery' ? 'Every battery is charged and checked.' : 'No defibrillators here yet.'}
            </div>
          )}
          {shown.map(a => (
            <Row
              key={a.id}
              icon={Defibrillator}
              tone={needsReview(a) ? 'sos' : 'teal'}
              onClick={() => setFocus(a)}
              active={focus?.id === a.id}
              title={a.name}
              summary={a.placement ?? 'No placement notes'}
              meta={<>
                {a.status !== 'ok' ? <Chip tone="sos">{STATUS[a.status]}{a.problem ? `: ${a.problem}` : ''}</Chip> : null}
                <Chip tone={batteryDue(a) ? 'sos' : 'muted'}>{batteryText(a)}</Chip>
                {a.hasCode && <Chip><LockKey size={13} weight="fill" /> Locked</Chip>}
                <Chip>{ACCESS[a.access]}</Chip>
                <Chip tone={soon(a.padsExpireAt) ? 'sos' : 'muted'}>
                  Pads {a.padsExpireAt ? new Date(a.padsExpireAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'unknown'}
                </Chip>
                <a
                  className="code text-[12px] text-primary hover:underline underline-offset-2 ml-1"
                  href={`https://www.openstreetmap.org/?mlat=${a.coordinates[1]}&mlon=${a.coordinates[0]}#map=19/${a.coordinates[1]}/${a.coordinates[0]}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.coordinates[1].toFixed(5)}, {a.coordinates[0].toFixed(5)}
                </a>
              </>}
              right={<>
                {needsReview(a)
                  ? <Button size="sm" className="rounded-lg" onClick={() => verify(a)} disabled={busy === a.id}>{a.status === 'in_use' ? 'Back in its cabinet' : a.verified ? 'Back in service' : 'Verify'}</Button>
                  : <Chip tone="teal"><ShieldCheck size={14} weight="fill" /> Verified</Chip>}
                <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setDevice(a)} disabled={busy === a.id}>
                  <LockKey size={15} /> Cabinet and log
                </Button>
                <Button size="icon-sm" variant="ghost" className="rounded-lg text-muted-foreground" onClick={() => setEditing(a)} disabled={busy === a.id} aria-label={`Edit ${a.name}`}>
                  <PencilSimple size={17} />
                </Button>
                <Button size="icon-sm" variant="ghost" className="rounded-lg text-muted-foreground hover:text-destructive" onClick={() => remove(a)} disabled={busy === a.id} aria-label={`Remove ${a.name}`}>
                  <Trash size={17} />
                </Button>
              </>}
            />
          ))}
        </Panel>
          {/* Where they are: sticks beside the list; picking a row flies here. */}
          <div className="xl:sticky xl:top-6 h-[min(64vh,640px)] rounded-[22px] border border-border bg-card overflow-hidden shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
            <Suspense fallback={<Skeleton className="w-full h-full" />}>
              <MapView legend="aeds" incidents={[]} aeds={shown.map(a => ({ id: a.id, name: a.name, placement: a.placement, verified: a.verified, coordinates: a.coordinates }))} focus={focus?.coordinates ?? null} />
            </Suspense>
          </div>
        </div>
      </div>
      {editing ? <EditAed aed={editing} onClose={() => setEditing(null)} onSaved={a => { replace(a); setEditing(null); }} /> : null}
      {device ? <DeviceDialog aed={items.find(x => x.id === device.id) ?? device} onClose={() => setDevice(null)} onChanged={replace} /> : null}
    </>
  );
};

const field = 'w-full h-10 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20 transition';

/** Edit form in the browser's own modal dialog: focus trap, Escape to close, backdrop for free. */
const EditAed = ({ aed, onClose, onSaved }: { aed: Aed; onClose: () => void; onSaved: (a: Aed) => void }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({
    name: aed.name,
    placement: aed.placement ?? '',
    access: aed.access,
    padsExpireAt: aed.padsExpireAt ? aed.padsExpireAt.slice(0, 10) : '',
    status: aed.status,
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.patch(`/aeds/${aed.id}`, {
        name: form.name,
        placement: form.placement,
        access: form.access,
        ...(form.status !== aed.status ? { status: form.status } : {}),
        padsExpireAt: form.padsExpireAt ? new Date(`${form.padsExpireAt}T00:00:00Z`).toISOString() : null,
      });
      pushToast({ tone: 'success', title: 'Saved', body: data.name });
      onSaved(data);
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Could not save', body: err?.response?.data?.error });
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog ref={ref} onClose={onClose} className="w-[min(480px,92vw)] rounded-[22px] border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-[hsl(176_30%_10%/0.45)]">
      <form onSubmit={save} className="p-6 space-y-4">
        <h2 className="text-lg font-extrabold tracking-[-0.01em]">Edit defibrillator</h2>
        <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Name</span>
          <input required minLength={2} maxLength={120} value={form.name} onChange={set('name')} className={field} /></label>
        <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Where exactly it hangs</span>
          <input maxLength={240} value={form.placement} onChange={set('placement')} className={field} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Access</span>
            <select value={form.access} onChange={set('access')} className={field}>
              {Object.entries(ACCESS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Pads expire</span>
            <input type="date" value={form.padsExpireAt} onChange={set('padsExpireAt')} className={field} /></label>
        </div>
        <label className="block space-y-1.5"><span className="text-xs text-muted-foreground">Status</span>
          <select value={form.status} onChange={set('status')} className={field}>
            {Object.entries(STATUS).filter(([v]) => v !== 'in_use' || aed.status === 'in_use').map(([v, l]) => <option key={v} value={v} disabled={v === 'in_use'}>{l}</option>)}
          </select></label>
        <p className="text-xs text-muted-foreground">Helpers are only sent to verified devices that are in service with pads in date.</p>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" className="rounded-xl" onClick={() => ref.current?.close()}>Cancel</Button>
          <Button type="submit" className="rounded-xl" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </dialog>
  );
};

interface AedEvt {
  id: string;
  type: string;
  at: string;
  by: { name: string; role: string } | null;
  emergency?: string;
  detail?: string;
  alert?: boolean;
}
interface LiveCall { _id: string; type: string; status: string; createdAt: string }

const describeEvent = (e: AedEvt) => {
  const who = e.by?.name ?? 'Someone';
  switch (e.type) {
    case 'code_given': return `${who} was sent the code as the defibrillator runner`;
    case 'code_viewed': return `${who} viewed the code${e.detail ? `: ${e.detail}` : ''}`;
    case 'code_changed': return e.detail === 'Code removed' ? `${who} removed the code` : `${who} set a new code`;
    case 'picked_up': return `${who} took it from the cabinet`;
    case 'delivered': return `${who} brought it to the patient`;
    case 'returned': return `${who} put it back in its cabinet`;
    case 'verified': return `${who} verified it`;
    case 'problem': return `${who} reported a problem: ${e.detail ?? ''}`;
    case 'battery': return e.by ? `Battery ${e.detail}, checked by ${who}` : `Battery ${e.detail}, reported by the cabinet`;
    case 'door_opened': return e.alert ? 'Cabinet opened, and nobody was given the code' : 'Cabinet opened';
    case 'door_closed': return 'Cabinet closed';
    default: return e.type;
  }
};
const at = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const CODE_SHOWN_S = 30;

/** Battery, cabinet code and the device's history: who had the code, who took it, when. */
const DeviceDialog = ({ aed, onClose, onChanged }: { aed: Aed; onClose: () => void; onChanged: (a: Aed) => void }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [events, setEvents] = useState<AedEvt[] | null>(null);
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [percent, setPercent] = useState('');
  const [newCode, setNewCode] = useState('');
  const [changing, setChanging] = useState(!aed.hasCode);
  const [callId, setCallId] = useState('');
  const [reason, setReason] = useState('');
  const [shown, setShown] = useState<{ code: string; left: number } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const loadEvents = () => api.get(`/aeds/${aed.id}/events`).then(r => setEvents(r.data)).catch(() => setEvents([]));
  useEffect(() => {
    ref.current?.showModal();
    void loadEvents();
    api.get('/emergencies').then(r => setCalls(r.data.filter((c: LiveCall) => ['pending', 'assigned', 'en_route', 'on_scene'].includes(c.status)))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The code stays on screen long enough to read it out, then hides itself.
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(s => (s && s.left > 1 ? { ...s, left: s.left - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [shown]);

  /** Resolves true when it worked; failures are already on screen as a toast. */
  const run = async (what: string, fn: () => Promise<void>) => {
    setSaving(what);
    try {
      await fn();
      void loadEvents();
      return true;
    } catch (err: any) {
      pushToast({ tone: 'error', title: what === 'reveal' ? 'Could not show the code' : 'Could not save', body: err?.response?.data?.error ?? 'Try again' });
      return false;
    } finally {
      setSaving(null);
    }
  };
  const patch = (body: object, done: string) => run(done, async () => {
    const { data } = await api.patch(`/aeds/${aed.id}`, body);
    onChanged(data);
    pushToast({ tone: 'success', title: done, body: aed.name });
  });
  const reveal = () => run('reveal', async () => {
    const { data } = await api.post(`/aeds/${aed.id}/code`, { ...(callId ? { emergencyId: callId } : {}), ...(reason.trim() ? { reason: reason.trim() } : {}) });
    setShown({ code: data.code, left: CODE_SHOWN_S });
  });
  const remove = () => {
    if (!window.confirm(`Remove the code for "${aed.name}"? Only do this if the cabinet is no longer locked.`)) return;
    void patch({ cabinetCode: null }, 'Code removed');
  };

  const b = aed.battery;
  return (
    <dialog ref={ref} onClose={onClose} className="w-[min(560px,94vw)] max-h-[90vh] rounded-[22px] border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-[hsl(176_30%_10%/0.45)]">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-[-0.01em]">{aed.name}</h2>
            <p className="text-sm text-muted-foreground">{aed.placement ?? 'No placement notes'} · {STATUS[aed.status]}</p>
          </div>
          <Button variant="ghost" className="rounded-xl" onClick={() => ref.current?.close()}>Close</Button>
        </div>

        <section className="space-y-2">
          <h3 className="text-[13px] font-medium text-muted-foreground">Battery</h3>
          <p className={cn('text-sm', batteryDue(aed) && 'text-red-700')}>
            {b ? <><span className="text-[20px] font-extrabold num">{b.percent}%</span> · {b.source === 'device' ? 'reported by the cabinet' : 'checked at an inspection'} · <span className="num">{timeAgo(b.at)}</span></> : 'Not checked yet.'}
            {b && b.percent < LOW_BATTERY ? '. Low: replace or charge it.' : b && batteryDue(aed) ? `. Not checked for over ${STALE_DAYS} days.` : ''}
          </p>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void patch({ batteryPercent: Number(percent) }, 'Battery reading saved').then(ok => ok && setPercent('')); }}>
            <label className="sr-only" htmlFor="battery-reading">Battery reading, percent</label>
            <input id="battery-reading" type="number" inputMode="numeric" min={0} max={100} required value={percent} onChange={e => setPercent(e.target.value)} placeholder="Reading at inspection, %" className={cn(field, 'flex-1')} />
            <Button type="submit" variant="outline" className="rounded-xl" disabled={saving === 'Battery reading saved'}>Save reading</Button>
          </form>
        </section>

        <section className="space-y-2">
          <h3 className="text-[13px] font-medium text-muted-foreground">Cabinet code</h3>
          {shown ? (
            <div className="rounded-xl bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
              <span className="text-[28px] font-extrabold tracking-[0.3em] num">{shown.code}</span>
              <span className="text-sm opacity-80 num">Hides in {shown.left} s</span>
            </div>
          ) : aed.hasCode ? (
            <div className="space-y-2">
              <p className="text-sm">The cabinet is locked. The runner sent for it gets the code in their app. Read it out here only to someone at the cabinet: every view is logged.</p>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Which call it's for" value={callId} onChange={e => setCallId(e.target.value)} className={field}>
                  <option value="">Not for a call</option>
                  {calls.map(c => <option key={c._id} value={c._id}>Call #{shortId(c._id)} · {timeAgo(c.createdAt)}</option>)}
                </select>
                <input aria-label="Reason (optional)" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason, e.g. inspection" className={field} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-xl" onClick={reveal} disabled={saving === 'reveal'}><LockKey size={16} /> Show code</Button>
                {!changing && <Button variant="outline" className="rounded-xl" onClick={() => setChanging(true)}>Change code</Button>}
                <Button variant="ghost" className="rounded-xl text-muted-foreground" onClick={remove}>Remove code</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">No code: the cabinet isn&apos;t locked. Set the code its keypad uses.</p>
          )}
          {changing && !shown && (
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); void patch({ cabinetCode: newCode }, aed.hasCode ? 'Code changed' : 'Code set').then(ok => { if (ok) { setNewCode(''); setChanging(false); } }); }}>
              <label className="sr-only" htmlFor="cabinet-code">New cabinet code</label>
              <input id="cabinet-code" inputMode="numeric" autoComplete="off" pattern="[0-9]{4,8}" title="4 to 8 digits" required value={newCode} onChange={e => setNewCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))} placeholder="4 to 8 digits" className={cn(field, 'flex-1 num tracking-[0.2em] placeholder:tracking-normal')} />
              <Button type="submit" className="rounded-xl" disabled={!!saving}>{aed.hasCode ? 'Save new code' : 'Set code'}</Button>
              {aed.hasCode && <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setChanging(false)}>Cancel</Button>}
            </form>
          )}
        </section>

        <section>
          <h3 className="text-[13px] font-medium text-muted-foreground">Activity</h3>
          {!events ? <Skeleton className="mt-2 h-24" /> : events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Code views, pick-ups, returns and battery readings appear here.</p>
          ) : (
            <ol className="mt-2 max-h-[280px] overflow-auto divide-y divide-border rounded-xl border border-border">
              {events.map(e => (
                <li key={e.id} className={cn('grid grid-cols-[116px_1fr] gap-3 px-3 py-2 text-sm', e.alert && 'bg-red-500/10')}>
                  <span className="text-muted-foreground num whitespace-nowrap">{at(e.at)}</span>
                  <span className={cn(e.alert && 'font-semibold text-red-700')}>
                    {e.alert && <Warning size={14} weight="fill" className="inline mr-1 -mt-0.5" />}
                    {describeEvent(e)}
                    {e.emergency && <span className="text-muted-foreground"> · Call #{shortId(e.emergency)}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </dialog>
  );
};
