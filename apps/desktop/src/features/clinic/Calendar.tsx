import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDots, CaretLeft, CaretRight, ClockCountdown, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader } from '../../components/layout/CommandShell';
import { Panel } from '../../components/ui/list';
import { Button } from '../../components/ui/button';
import { pushToast } from '../../components/toast/toast';
import { cn } from '../../lib/utils';
import { exportPdf } from '../../lib/exportPdf';

export interface Booking {
  id: string;
  patient: { id: string; name?: string };
  type: { id: string; name: string; minutes: number; online: boolean };
  price: number;
  startsAt: string;
  endsAt: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled' | 'declined';
  reason?: string;
  shareRecord: boolean;
  summary?: { observations?: string; recommendations?: string; summary?: string; writtenAt?: string };
  followUpOf?: string;
  history: { at: string; action: string; note?: string }[];
}

type View = 'day' | 'week' | 'month';
const TZ = 'Europe/Tirane';
const STATUS: Record<Booking['status'], string> = {
  requested: 'Request', confirmed: 'Confirmed', completed: 'Done', cancelled: 'Cancelled', declined: 'Declined',
};
const TONE: Record<Booking['status'], string> = {
  requested: 'bg-[hsl(var(--warn)/0.14)] border-[hsl(var(--warn)/0.6)] text-amber-900',
  confirmed: 'bg-[hsl(173_55%_92%)] border-primary/50 text-primary',
  completed: 'bg-muted border-border text-muted-foreground',
  cancelled: 'bg-muted/50 border-border text-muted-foreground line-through',
  declined: 'bg-muted/50 border-border text-muted-foreground line-through',
};
const HOURS = { from: 7, to: 21 };
const HOUR_PX = 56;

// Calendar days are Tirana days; all arithmetic happens on YYYY-MM-DD strings at noon UTC.
const tiranaDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const tiranaMinutes = (iso: string) => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).split(':').map(Number);
  return h * 60 + m;
};
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const startOfWeek = (date: string) => addDays(date, -((weekday(date) + 6) % 7)); // Monday
const fmt = (date: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));

/** Clinician workspace: consultations by day, week or month, the request queue, one booking at a time. */
export const ClinicCalendar = () => {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState(tiranaDate(new Date()));
  const [items, setItems] = useState<Booking[]>([]);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [hasClinic, setHasClinic] = useState<boolean | null>(null);

  const range = useMemo(() => {
    if (view === 'day') return { from: anchor, days: 1 };
    if (view === 'week') return { from: startOfWeek(anchor), days: 7 };
    const first = `${anchor.slice(0, 8)}01`;
    return { from: startOfWeek(first), days: 42 };
  }, [view, anchor]);

  const load = useCallback(async () => {
    const from = new Date(`${range.from}T00:00:00Z`).getTime() - 2 * 3600_000; // Tirana is ahead of UTC
    const to = new Date(`${addDays(range.from, range.days)}T00:00:00Z`).getTime();
    const [b, r, me] = await Promise.all([
      api.get<Booking[]>('/clinic/bookings', { params: { from: new Date(from).toISOString(), to: new Date(to).toISOString() } }),
      api.get<Booking[]>('/clinic/requests'),
      api.get('/clinic/me'),
    ]);
    setItems(b.data);
    setRequests(r.data);
    setHasClinic(!!me.data);
    setSelected(s => (s ? [...b.data, ...r.data].find(x => x.id === s.id) ?? s : s));
  }, [range]);
  useEffect(() => { load().catch(() => pushToast({ tone: 'error', title: 'Could not load the calendar' })); }, [load]);

  const step = (n: number) => setAnchor(a => (view === 'month'
    ? (() => { const d = new Date(`${a.slice(0, 8)}15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); })()
    : addDays(a, n * (view === 'week' ? 7 : 1))));
  const title = view === 'month' ? fmt(anchor, { month: 'long', year: 'numeric' })
    : view === 'week' ? `${fmt(range.from, { day: 'numeric', month: 'short' })} – ${fmt(addDays(range.from, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long' });
  const byDate = (date: string) => items.filter(b => tiranaDate(new Date(b.startsAt)) === date);
  const today = tiranaDate(new Date());

  return (
    <>
      <PageHeader noPrint icon={CalendarDots} title="Consultations" subtitle="Your calendar, requests waiting for an answer, and each patient’s booking." />
      <div className="p-6 grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4 min-w-0 print:hidden">
          {hasClinic === false && (
            <Panel><p className="px-5 py-4 text-[14px]">Patients cannot book you yet. <Link to="/command/clinic/settings" className="font-semibold text-primary underline underline-offset-2">Set your hours and fees</Link> first.</p></Panel>
          )}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
            <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1" role="tablist">
              {(['day', 'week', 'month'] as View[]).map(v => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={cn('px-3.5 py-1.5 text-sm rounded-lg capitalize transition-colors', view === v ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>{v}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="rounded-lg" onClick={() => step(-1)} aria-label="Previous"><CaretLeft size={16} /></Button>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setAnchor(today)}>Today</Button>
              <Button size="icon" variant="outline" className="rounded-lg" onClick={() => step(1)} aria-label="Next"><CaretRight size={16} /></Button>
            </div>
            <h2 className="text-[18px] font-extrabold tracking-[-0.01em]">{title}</h2>
          </div>

          {view === 'month' ? (
            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-7 border-b border-border text-[12px] font-semibold text-muted-foreground">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="px-3 py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: 42 }, (_, i) => addDays(range.from, i)).map(date => {
                  const day = byDate(date).filter(b => b.status !== 'cancelled' && b.status !== 'declined');
                  return (
                    <button key={date} onClick={() => { setAnchor(date); setView('day'); }}
                      className={cn('min-h-[104px] flex flex-col items-stretch justify-start border-b border-r border-border p-2 text-left hover:bg-muted/40 transition-colors', date.slice(0, 7) !== anchor.slice(0, 7) && 'bg-muted/30 text-muted-foreground')}>
                      <div className={cn('num text-[13px] font-semibold w-6 h-6 grid place-items-center rounded-md', date === today && 'bg-primary text-primary-foreground')}>{Number(date.slice(8))}</div>
                      <div className="mt-1 space-y-0.5">
                        {day.slice(0, 3).map(b => <div key={b.id} className={cn('truncate rounded px-1.5 text-[12px] border', TONE[b.status])}>{clock(b.startsAt)} {b.patient.name}</div>)}
                        {day.length > 3 && <div className="text-[12px] text-muted-foreground">+{day.length - 3} more</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="grid" style={{ gridTemplateColumns: `56px repeat(${range.days}, minmax(0, 1fr))` }}>
                <div className="border-b border-border" />
                {Array.from({ length: range.days }, (_, i) => addDays(range.from, i)).map(date => (
                  <div key={date} className={cn('border-b border-l border-border px-2 py-2 text-[13px]', date === today && 'bg-[hsl(173_55%_96%)]')}>
                    <span className="text-muted-foreground">{fmt(date, { weekday: 'short' })}</span> <span className="num font-semibold">{Number(date.slice(8))}</span>
                  </div>
                ))}
                <div className="relative" style={{ height: (HOURS.to - HOURS.from) * HOUR_PX }}>
                  {Array.from({ length: HOURS.to - HOURS.from }, (_, i) => (
                    <div key={i} className="absolute right-2 num text-[11px] text-muted-foreground" style={{ top: i * HOUR_PX - 6 }}>{String(HOURS.from + i).padStart(2, '0')}:00</div>
                  ))}
                </div>
                {Array.from({ length: range.days }, (_, i) => addDays(range.from, i)).map(date => (
                  <div key={date} className="relative border-l border-border" style={{ height: (HOURS.to - HOURS.from) * HOUR_PX }}>
                    {Array.from({ length: HOURS.to - HOURS.from }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: h * HOUR_PX }} />)}
                    {byDate(date).map(b => {
                      const top = (tiranaMinutes(b.startsAt) - HOURS.from * 60) / 60 * HOUR_PX;
                      const height = Math.max(22, b.type.minutes / 60 * HOUR_PX - 2);
                      return (
                        <button key={b.id} onClick={() => setSelected(b)}
                          className={cn('absolute inset-x-1 rounded-md border px-2 py-1 text-left text-[12px] leading-tight overflow-hidden hover:shadow-md transition-shadow', TONE[b.status], selected?.id === b.id && 'ring-2 ring-primary')}
                          style={{ top, height }}>
                          <div className="font-semibold truncate">{b.patient.name}</div>
                          {height > 30 && <div className="truncate opacity-80">{clock(b.startsAt)} · {b.type.name}</div>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {selected ? <BookingPanel booking={selected} onClose={() => setSelected(null)} onChanged={load} />
            : (
              <Panel title="Waiting for your answer" aside={<span className="num text-[13px] text-muted-foreground">{requests.length}</span>}>
                {requests.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">No requests. New ones appear here first.</p>}
                {requests.map(b => (
                  <button key={b.id} onClick={() => setSelected(b)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/50 transition-colors">
                    <ClockCountdown size={20} weight="duotone" className="text-[hsl(var(--warn))] shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">{b.patient.name}</span>
                      <span className="block text-[13px] text-muted-foreground">{fmt(tiranaDate(new Date(b.startsAt)), { weekday: 'short', day: 'numeric', month: 'short' })} · {clock(b.startsAt)} · {b.type.name}</span>
                    </span>
                  </button>
                ))}
              </Panel>
            )}
        </aside>
      </div>
    </>
  );
};

type Slots = { date: string; times: string[] }[];
type ClinicType = { id: string; name: string; minutes: number; active: boolean };
interface PatientRecord {
  patient: { name?: string; age?: number; gender?: string; bloodType?: string };
  allergies: { allergen: string; severity: string }[];
  medications: string[];
  conditions: string[];
  disabilities: string[];
  timeline: { kind: 'consultation' | 'emergency'; at: string; title: string; detail?: { summary?: string; recommendations?: string }; reports?: { author: string; notes?: string; cprPerformed: boolean; aedUsed: boolean }[] }[];
  accessNote: string;
}

/** Free times as buttons, grouped by day. */
const SlotPicker = ({ slots, busy, onPick }: { slots: Slots | null; busy: boolean; onPick: (iso: string) => void }) => (
  <div className="rounded-xl border border-border p-3 max-h-64 overflow-auto space-y-2">
    {!slots ? <p className="text-sm text-muted-foreground">Loading free times…</p>
      : !slots.some(d => d.times.length) ? <p className="text-sm text-muted-foreground">No free times in the next two weeks.</p>
      : slots.filter(d => d.times.length).map(d => (
        <div key={d.date}>
          <div className="text-[12px] font-semibold text-muted-foreground">{fmt(d.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {d.times.map(t => <button key={t} disabled={busy} onClick={() => onPick(t)} className="num rounded-md border border-border px-2 py-1 text-[12px] hover:bg-accent">{clock(t)}</button>)}
          </div>
        </div>
      ))}
  </div>
);

const TEXTAREA = 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm';

/** One booking: who, when, why, the shared record, the summary and what the clinician can do next. */
const BookingPanel = ({ booking: b, onClose, onChanged }: { booking: Booking; onClose: () => void; onChanged: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<null | 'move' | 'record' | 'summary' | 'followup'>(null);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [types, setTypes] = useState<ClinicType[]>([]);
  const [followType, setFollowType] = useState<string | null>(null);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ observations: '', recommendations: '', summary: '' });
  const open = b.status === 'requested' || b.status === 'confirmed';
  const started = Date.parse(b.startsAt) <= Date.now() + 3600_000;
  const canWrite = (b.status === 'confirmed' && started) || (b.status === 'completed' && !!b.summary?.writtenAt && Date.now() - Date.parse(b.summary.writtenAt) < 7 * 86_400_000);

  useEffect(() => {
    setMode(null); setSlots(null); setRecord(null); setRecordError(null);
    setDraft({ observations: b.summary?.observations ?? '', recommendations: b.summary?.recommendations ?? '', summary: b.summary?.summary ?? '' });
  }, [b.id, b.summary]);
  useEffect(() => {
    const type = mode === 'move' ? b.type.id : mode === 'followup' ? followType : null;
    setSlots(null);
    if (type) api.get('/clinic/slots', { params: { type, days: 14, ...(mode === 'followup' ? {} : {}) } }).then(r => setSlots(r.data)).catch(() => setSlots([]));
  }, [mode, followType, b.type.id]);
  useEffect(() => {
    if (mode === 'followup' && !types.length) api.get('/clinic/me').then(r => setTypes((r.data?.consultationTypes ?? []).filter((t: ClinicType) => t.active))).catch(() => {});
    if (mode === 'record' && !record) api.get(`/clinic/bookings/${b.id}/record`).then(r => setRecord(r.data)).catch(err => setRecordError(err?.response?.data?.error ?? 'Could not open the record'));
  }, [mode, types.length, record, b.id]);

  const act = async (request: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await request();
      pushToast({ tone: 'success', title: done });
      setMode(null);
      await onChanged();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };
  const post = (path: string, body: object, done: string) => act(() => api.post(`/clinic/bookings/${b.id}/${path}`, body), done);
  const toggle = (m: typeof mode) => setMode(cur => (cur === m ? null : m));

  return (
    <Panel title={b.patient.name} aside={<Button size="icon" variant="ghost" onClick={onClose} aria-label="Close"><X size={16} /></Button>}>
      <div className="px-5 py-4 space-y-3 text-[14px] print:hidden">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-md border px-2 py-0.5 text-[12px] font-semibold', TONE[b.status])}>{STATUS[b.status]}</span>
          <span className="text-muted-foreground">{fmt(tiranaDate(new Date(b.startsAt)), { weekday: 'long', day: 'numeric', month: 'short' })}, {clock(b.startsAt)}–{clock(b.endsAt)}</span>
        </div>
        <dl className="grid grid-cols-[92px_1fr] gap-y-1.5">
          <dt className="text-muted-foreground">Type</dt><dd>{b.type.name}{b.type.online ? ' (online)' : ''}</dd>
          <dt className="text-muted-foreground">Price</dt><dd>{b.price.toLocaleString('en-GB')} lekë <span className="text-muted-foreground">as booked</span></dd>
          <dt className="text-muted-foreground">Reason</dt><dd>{b.reason || 'Not given'}</dd>
          <dt className="text-muted-foreground">Records</dt><dd>{b.shareRecord ? 'Shared with you for this consultation' : 'Not shared'}</dd>
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          {b.status === 'requested' && <Button size="sm" className="rounded-lg" disabled={busy} onClick={() => post('confirm', {}, 'Confirmed')}>Confirm</Button>}
          {b.status === 'requested' && <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => post('decline', {}, 'Declined')}>Decline</Button>}
          {b.shareRecord && b.status !== 'cancelled' && b.status !== 'declined' && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle('record')}>Patient record</Button>}
          {canWrite && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle('summary')}>{b.summary?.summary ? 'Edit summary' : 'Write summary'}</Button>}
          {(b.status === 'confirmed' || b.status === 'completed') && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => toggle('followup')}>Follow-up</Button>}
          {open && <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => toggle('move')}>Reschedule</Button>}
          {b.status === 'confirmed' && <Button size="sm" variant="ghost" className="rounded-lg text-muted-foreground" disabled={busy} onClick={() => { if (window.confirm('Cancel this consultation? The patient is told in the app.')) void post('cancel', {}, 'Cancelled'); }}>Cancel</Button>}
        </div>

        {mode === 'move' && <SlotPicker slots={slots} busy={busy} onPick={t => post('reschedule', { startsAt: t }, 'Moved')} />}

        {mode === 'followup' && (
          <div className="space-y-2">
            <select value={followType ?? ''} onChange={e => setFollowType(e.target.value || null)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" aria-label="Consultation type">
              <option value="">Choose the type of follow-up</option>
              {types.map(t => <option key={t.id} value={t.id}>{t.name} · {t.minutes} min</option>)}
            </select>
            {followType && <SlotPicker slots={slots} busy={busy} onPick={t => post('follow-up', { typeId: followType, startsAt: t }, 'Follow-up booked and confirmed')} />}
          </div>
        )}

        {mode === 'record' && (
          <div className="rounded-xl border border-border p-3 space-y-3 max-h-[420px] overflow-auto">
            {recordError ? <p className="text-sm text-muted-foreground">{recordError}</p>
              : !record ? <p className="text-sm text-muted-foreground">Opening…</p>
              : (
                <>
                  <p className="text-[12px] text-muted-foreground">{record.accessNote}</p>
                  <dl className="grid grid-cols-[96px_1fr] gap-y-1.5">
                    <dt className="text-muted-foreground">Patient</dt><dd>{[record.patient.age != null && `${record.patient.age} years`, record.patient.gender, record.patient.bloodType && `blood ${record.patient.bloodType}`].filter(Boolean).join(', ') || 'No details'}</dd>
                    <dt className="text-muted-foreground">Allergies</dt><dd>{record.allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') || 'None recorded'}</dd>
                    <dt className="text-muted-foreground">Medication</dt><dd>{record.medications.join(', ') || 'None recorded'}</dd>
                    <dt className="text-muted-foreground">Conditions</dt><dd>{record.conditions.join(', ') || 'None recorded'}</dd>
                    {record.disabilities.length > 0 && (<><dt className="text-muted-foreground">Disabilities</dt><dd>{record.disabilities.join(', ')}</dd></>)}
                  </dl>
                  <ol className="space-y-2 border-t border-border pt-3">
                    {record.timeline.length === 0 && <li className="text-sm text-muted-foreground">No earlier consultations or emergencies on Vitalis.</li>}
                    {record.timeline.map((t, i) => (
                      <li key={i}>
                        <div className="text-[12px] text-muted-foreground num">{new Date(t.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })}</div>
                        <div className="font-semibold">{t.title}</div>
                        {t.detail?.summary && <div>{t.detail.summary}</div>}
                        {t.reports?.map((r, j) => <div key={j} className="text-muted-foreground">Responder {r.author}: {[r.cprPerformed && 'CPR', r.aedUsed && 'defibrillator'].filter(Boolean).join(', ') || 'no interventions'}{r.notes ? `. “${r.notes}”` : ''}</div>)}
                      </li>
                    ))}
                  </ol>
                </>
              )}
          </div>
        )}

        {mode === 'summary' && (
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); void act(() => api.put(`/clinic/bookings/${b.id}/summary`, {
            summary: draft.summary.trim(),
            ...(draft.observations.trim() ? { observations: draft.observations.trim() } : {}),
            ...(draft.recommendations.trim() ? { recommendations: draft.recommendations.trim() } : {}),
          }), 'Summary saved. The patient sees it in the app.'); }}>
            <textarea value={draft.observations} onChange={e => setDraft({ ...draft, observations: e.target.value })} rows={3} maxLength={4000} placeholder="Observations" className={TEXTAREA} aria-label="Observations" />
            <textarea value={draft.recommendations} onChange={e => setDraft({ ...draft, recommendations: e.target.value })} rows={3} maxLength={4000} placeholder="Recommendations" className={TEXTAREA} aria-label="Recommendations" />
            <textarea value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} rows={3} maxLength={4000} required placeholder="Summary for the patient" className={TEXTAREA} aria-label="Summary" />
            <p className="text-[12px] text-muted-foreground">Saving completes the consultation. Not a prescription, a sick note or a signed medical document.</p>
            <Button type="submit" size="sm" className="rounded-lg" disabled={busy || draft.summary.trim().length < 3}>Save summary</Button>
          </form>
        )}

        {b.summary?.summary && mode !== 'summary' && (
          <div className="rounded-xl bg-muted/60 px-4 py-3 space-y-1">
            <div className="font-semibold">Summary</div>
            <div>{b.summary.summary}</div>
            {b.summary.recommendations && <div className="text-muted-foreground">Recommendations: {b.summary.recommendations}</div>}
            <Button size="sm" variant="ghost" className="rounded-lg -ml-2" onClick={() => exportPdf(`consultation summary ${b.patient.name ?? ''}`)}>Export PDF</Button>
          </div>
        )}
      </div>

      {/* What "Export PDF" prints: the summary as a plain document. */}
      {b.summary?.summary && (
        <div className="hidden print:block p-10 text-[11pt] text-black">
          <h1 className="text-[18pt] font-bold">Consultation summary</h1>
          <p className="mt-1">{b.patient.name} · {b.type.name} · {fmt(tiranaDate(new Date(b.startsAt)), { day: 'numeric', month: 'long', year: 'numeric' })}, {clock(b.startsAt)}</p>
          {b.summary.observations && <><h2 className="mt-6 font-bold">Observations</h2><p className="whitespace-pre-wrap">{b.summary.observations}</p></>}
          {b.summary.recommendations && <><h2 className="mt-4 font-bold">Recommendations</h2><p className="whitespace-pre-wrap">{b.summary.recommendations}</p></>}
          <h2 className="mt-4 font-bold">Summary</h2><p className="whitespace-pre-wrap">{b.summary.summary}</p>
          <p className="mt-8 text-[9pt]">Written on Vitalis. Not a prescription, a sick note or a signed medical document.</p>
        </div>
      )}
    </Panel>
  );
};
