import { useCallback, useEffect, useState } from 'react';
import { Ambulance, ArrowsMerge, Bed, CheckCircle, ClockCountdown, FirstAid, Heartbeat, Warning } from '@phosphor-icons/react';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { PageHeader } from '../../components/layout/CommandShell';
import { KPI } from '../../components/widgets/KPI';
import { Chip, Panel } from '../../components/ui/list';
import { Tile } from '../../components/ui/tile';
import { Button } from '../../components/ui/button';
import { pushToast } from '../../components/toast/toast';
import { timeAgo } from '../../lib/format';
import { roleLabel } from '../../lib/roles';
import { cn } from '../../lib/utils';

export interface HandoverSummary {
  reference: string;
  type: string;
  priority: number;
  reportedAt: string;
  patient: {
    name: string; age?: number; gender?: string; bloodType?: string;
    allergies: { allergen: string; severity: string }[]; medications: string[]; conditions: string[];
  } | null;
  responders: { name: string; role: string }[];
  aed?: { name: string; status?: string } | null;
  reports: {
    author: string; role: string; arrivedAt?: string; conscious: string; breathing: string; cprPerformed: boolean;
    aedUsed: boolean; shocks?: number; actions: string[]; notes?: string; handover: string;
  }[];
}

export interface Handover {
  id: string;
  emergency: string;
  hospital: { id: string; name?: string };
  sentAt: string;
  sentBy: string | null;
  deliveredLive: boolean;
  summary: HandoverSummary;
  status: 'sent' | 'acknowledged' | 'arrived' | 'withdrawn' | 'duplicate';
  acknowledgedAt?: string;
  acknowledgedBy?: string | null;
  arrivedAt?: string;
  hospitalRef?: string;
  intake?: string;
  possibleDuplicates?: string[];
}

export const TYPE_LABEL: Record<string, string> = {
  cardiac: 'Cardiac arrest', medical: 'Medical emergency', trauma: 'Injury', blood_needed: 'Blood needed', rare_medicine: 'Medicine needed', other: 'Emergency',
};
export const HANDOVER_STATUS: Record<Handover['status'], string> = {
  sent: 'Waiting for acknowledgment', acknowledged: 'Acknowledged', arrived: 'Arrived', withdrawn: 'Withdrawn by the operator', duplicate: 'Closed as a duplicate',
};
const INTAKE: [string, string][] = [['arrived', 'Arrived'], ['in_treatment', 'In treatment'], ['admitted', 'Admitted'], ['discharged', 'Discharged'], ['transferred', 'Transferred']];
const ACTION: Record<string, string> = {
  cpr: 'CPR', aed_shock: 'Defibrillator shock', recovery_position: 'Recovery position', bleeding_control: 'Bleeding controlled',
  airway: 'Airway cleared', reassurance: 'Stayed and reassured', called_ambulance: 'Called the ambulance',
};
const BREATHING: Record<string, string> = { normal: 'breathing normally', abnormal: 'breathing abnormally', none: 'not breathing', unknown: 'breathing not recorded' };
const CONSCIOUS: Record<string, string> = { yes: 'Conscious', no: 'Unconscious', unknown: 'Consciousness not recorded' };

type Filter = 'open' | 'arrived' | 'all';
const FILTERS: [Filter, string][] = [['open', 'On the way'], ['arrived', 'Arrived'], ['all', 'All']];
const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();

/** What the hospital receives: the patient, the responders and their reports. Read only. */
export const HandoverDetails = ({ s }: { s: HandoverSummary }) => {
  const p = s.patient;
  const severe = p?.allergies.filter(a => a.severity === 'severe') ?? [];
  return (
    <div className="space-y-3 text-[14px]">
      <div>
        <div className="text-[19px] font-extrabold tracking-[-0.02em]">{p?.name ?? 'Patient not identified'}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {p?.age != null && <Chip>{p.age} years</Chip>}
          {p?.bloodType && <Chip tone="teal">Blood {p.bloodType}</Chip>}
          <Chip>{TYPE_LABEL[s.type] ?? 'Emergency'} · priority {s.priority}</Chip>
        </div>
      </div>
      {severe.length > 0 && (
        <p className="rounded-xl bg-[hsl(var(--sos))] px-4 py-2.5 font-semibold text-white">Severe allergy: {severe.map(a => a.allergen).join(', ')}</p>
      )}
      {p && (
        <dl className="grid grid-cols-[104px_1fr] gap-y-1.5">
          <dt className="text-muted-foreground">Allergies</dt><dd>{p.allergies.map(a => `${a.allergen} (${a.severity})`).join(', ') || 'None recorded'}</dd>
          <dt className="text-muted-foreground">Medication</dt><dd>{p.medications.join(', ') || 'None recorded'}</dd>
          <dt className="text-muted-foreground">Conditions</dt><dd>{p.conditions.join(', ') || 'None recorded'}</dd>
          <dt className="text-muted-foreground">Responders</dt><dd>{s.responders.map(r => `${r.name} (${roleLabel(r.role)})`).join(', ') || 'None'}</dd>
        </dl>
      )}
      {s.reports.map((r, i) => (
        <div key={i} className="rounded-xl bg-muted/60 px-4 py-3 space-y-1">
          <div className="font-semibold">Report from {r.author} <span className="font-normal text-muted-foreground">{roleLabel(r.role)}</span></div>
          <div>{CONSCIOUS[r.conscious] ?? r.conscious}, {BREATHING[r.breathing] ?? r.breathing} on arrival.</div>
          <div>{[r.cprPerformed && 'CPR performed', r.aedUsed && `Defibrillator used${r.shocks != null ? ` (${r.shocks} shock${r.shocks === 1 ? '' : 's'})` : ''}`,
            ...r.actions.filter(a => !(a === 'cpr' && r.cprPerformed) && !(a === 'aed_shock' && r.aedUsed)).map(a => ACTION[a] ?? a)].filter(Boolean).join(' · ') || 'No interventions recorded.'}</div>
          {r.notes && <div className="text-muted-foreground">“{r.notes}”</div>}
        </div>
      ))}
      {s.reports.length === 0 && <p className="text-muted-foreground">No responder report yet.</p>}
    </div>
  );
};

/** Hospital staff: patients operators are sending here, from acknowledgment to intake. */
export const Incoming = () => {
  const [items, setItems] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('open');
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api.get<Handover[]>('/hospital/handovers')
    .then(r => setItems(r.data))
    .catch(err => pushToast({ tone: 'error', title: 'Could not load', body: err?.response?.data?.error ?? 'Try again' }))
    .finally(() => setLoading(false)), []);

  useEffect(() => {
    void load();
    const onHandover = (h: Handover) => {
      if (h.status === 'sent') pushToast({ tone: 'warn', title: 'New patient on the way', body: `${TYPE_LABEL[h.summary.type] ?? 'Emergency'} · ${h.summary.patient?.name ?? 'patient'}`, ttl: 20_000 });
      void load();
    };
    socket.on('hospital:handover', onHandover);
    return () => { socket.off('hospital:handover', onHandover); };
  }, [load]);

  const act = async (id: string, request: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await request();
      pushToast({ tone: 'success', title: done });
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(null);
    }
  };

  const open = items.filter(h => h.status === 'sent' || h.status === 'acknowledged');
  const shown = filter === 'open' ? open : filter === 'arrived' ? items.filter(h => h.status === 'arrived') : items;
  const refOf = (id: string) => items.find(h => h.id === id)?.summary.reference;

  return (
    <>
      <PageHeader icon={Ambulance} title="Incoming patients" subtitle="Patients Vitalis operators are sending here. Acknowledge them, then check them in when they arrive." />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4 stagger">
          <KPI icon={ClockCountdown} iconTone={items.some(h => h.status === 'sent') ? 'sos' : 'teal'} label="Waiting for acknowledgment" value={items.filter(h => h.status === 'sent').length} tone={items.some(h => h.status === 'sent') ? 'rose' : 'teal'} />
          <KPI icon={Ambulance} iconTone="deep" label="Acknowledged, on the way" value={items.filter(h => h.status === 'acknowledged').length} />
          <KPI icon={Bed} iconTone="mint" label="Arrived today" value={items.filter(h => h.status === 'arrived' && isToday(h.arrivedAt)).length} />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm w-fit" role="tablist">
          {FILTERS.map(([f, label]) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', filter === f ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>
              {label} <span className="num opacity-70">{f === 'open' ? open.length : f === 'arrived' ? items.filter(h => h.status === 'arrived').length : items.length}</span>
            </button>
          ))}
        </div>

        {loading && <Panel><p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p></Panel>}
        {!loading && shown.length === 0 && (
          <Panel><p className="px-5 py-10 text-center text-muted-foreground">{filter === 'open' ? 'No patients on the way. New handovers appear here the moment an operator sends them.' : 'Nothing here yet.'}</p></Panel>
        )}

        <div className="grid gap-4 xl:grid-cols-2 stagger">
          {shown.map(h => (
            <section key={h.id} className={cn('rounded-2xl border bg-card overflow-hidden', h.status === 'sent' ? 'border-[hsl(var(--sos)/0.45)]' : 'border-border')}>
              <header className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <Tile icon={h.summary.type === 'cardiac' ? Heartbeat : FirstAid} tone={h.summary.type === 'cardiac' ? 'sos' : 'teal'} />
                <div className="min-w-0 flex-1">
                  <div className="font-bold">Case <span className="code">#{h.summary.reference}</span></div>
                  <div className="text-[13px] text-muted-foreground">Sent {timeAgo(h.sentAt)}{h.sentBy ? ` by ${h.sentBy}` : ''}</div>
                </div>
                <Chip tone={h.status === 'sent' ? 'sos' : h.status === 'arrived' || h.status === 'acknowledged' ? 'teal' : 'muted'}>{HANDOVER_STATUS[h.status]}</Chip>
              </header>
              <div className="px-5 py-4 space-y-4">
                {(h.possibleDuplicates?.length ?? 0) > 0 && (
                  <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--warn)/0.5)] bg-[hsl(var(--warn)/0.08)] px-4 py-3 text-[14px]">
                    <Warning size={18} weight="fill" className="mt-0.5 shrink-0 text-[hsl(var(--warn))]" />
                    <div className="flex-1">Same person as case #{refOf(h.possibleDuplicates![0])}, sent within a day. If it is one patient, keep the other record.</div>
                    <Button size="sm" variant="outline" className="rounded-lg" disabled={busy === h.id}
                      onClick={() => act(h.id, () => api.post(`/hospital/handovers/${h.id}/duplicate`, { of: h.possibleDuplicates![0] }), 'Closed as a duplicate')}>
                      <ArrowsMerge size={16} /> Keep the other
                    </Button>
                  </div>
                )}
                <HandoverDetails s={h.summary} />
                {h.status === 'arrived' && (
                  <div className="text-[13px] text-muted-foreground">Checked in {new Date(h.arrivedAt!).toLocaleTimeString('en-GB', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit' })}{h.hospitalRef ? ` · record ${h.hospitalRef}` : ''}</div>
                )}
              </div>
              {(h.status === 'sent' || h.status === 'acknowledged' || h.status === 'arrived') && (
                <footer className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border bg-muted/30">
                  {h.status === 'sent' && (
                    <Button size="sm" className="rounded-lg" disabled={busy === h.id} onClick={() => act(h.id, () => api.post(`/hospital/handovers/${h.id}/acknowledge`), 'Acknowledged')}>
                      <CheckCircle size={16} weight="bold" /> Acknowledge
                    </Button>
                  )}
                  {(h.status === 'sent' || h.status === 'acknowledged') && (
                    <form className="flex items-center gap-2" onSubmit={ev => { ev.preventDefault(); void act(h.id, () => api.post(`/hospital/handovers/${h.id}/arrive`, refs[h.id]?.trim() ? { hospitalRef: refs[h.id].trim() } : {}), 'Patient checked in'); }}>
                      <input value={refs[h.id] ?? ''} onChange={ev => setRefs(r => ({ ...r, [h.id]: ev.target.value }))} maxLength={60} placeholder="Hospital record no. (optional)" aria-label="Hospital record number"
                        className="h-8 w-56 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20" />
                      <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={busy === h.id}>Check in</Button>
                    </form>
                  )}
                  {h.status === 'arrived' && (
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Intake</span>
                      <select value={h.intake ?? 'arrived'} disabled={busy === h.id} onChange={ev => act(h.id, () => api.patch(`/hospital/handovers/${h.id}/intake`, { intake: ev.target.value }), 'Intake updated')}
                        className="h-8 rounded-lg border border-border bg-card px-2 text-sm">
                        {INTAKE.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </label>
                  )}
                </footer>
              )}
            </section>
          ))}
        </div>
      </div>
    </>
  );
};
