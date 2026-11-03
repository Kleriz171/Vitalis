import { useEffect, useState } from 'react';
import { Ambulance, Bed, Gauge as GaugeIcon, Heartbeat, Hospital, Siren, Stethoscope, UsersThree, Warning } from '@phosphor-icons/react';
import { Defibrillator } from '../../components/ui/aed-icon';
import { api } from '../../api/client';
import { PageHeader } from '../../components/layout/CommandShell';
import { KPI } from '../../components/widgets/KPI';
import { Chip, Panel, Row } from '../../components/ui/list';
import { formatEta } from '../../lib/format';

type Day = { date: string; n: number };
interface Platform {
  users: number; responders: number; clinicians: number; staff: number;
  incidents: { active: number; completed30: number; cancelled30: number; escalated30: number; unanswered30: number; medianAcceptSeconds30: number | null };
  aeds: { registered: number; ready: number }; hospitals: { total: number; participating: number }; bookings30: number;
  activity: { signups: Day[]; sos: Day[] };
}
interface Health {
  api: { status: string; since: string; version: string; node: string; demoMode: boolean };
  database: { status: string; pingMs: number };
  jobs: Record<string, { lastRunAt?: string; lastErrorAt?: string; lastError?: string; runs: number; failures: number }>;
  texts24h: Record<string, number>;
  integrations: Record<string, string>;
}
const JOB: Record<string, string> = { redispatch: 'Re-dispatch and escalation', checkins: 'Safety check-ins', booking_reminders: 'Consultation reminders' };
const INTEGRATION: Record<string, string> = { sms: 'Text messages', push: 'Push notifications', assistant: 'Assistant (Gemini)', roadEta: 'Road arrival times', aedCabinets: 'Connected AED cabinets', droneBridges: 'Drone bridges', mediaStore: 'Drone footage storage' };
const time = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-GB', { hourCycle: 'h23', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'not yet');

/** Two weeks as small bars: no chart library for 14 numbers. */
const Bars = ({ days }: { days: Day[] }) => {
  const max = Math.max(1, ...days.map(d => d.n));
  return (
    <div className="flex items-end gap-1 h-16" aria-label={days.map(d => `${d.date}: ${d.n}`).join(', ')}>
      {days.map(d => <div key={d.date} title={`${d.date}: ${d.n}`} className="flex-1 rounded-t bg-[hsl(var(--teal))]" style={{ height: `${Math.max(4, (d.n / max) * 100)}%`, opacity: d.n ? 1 : 0.25 }} />)}
    </div>
  );
};

/** Administrators: the platform in numbers, and how the system is running right now. */
export const Platform = () => {
  const [p, setP] = useState<Platform | null>(null);
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => {
    api.get('/analytics/platform').then(r => setP(r.data)).catch(() => {});
    const load = () => api.get('/admin/health').then(r => setH(r.data)).catch(() => setH(null));
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <PageHeader icon={GaugeIcon} title="Platform" subtitle="Everyone and everything on Vitalis, counted from the database, and how the system is running." />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI icon={UsersThree} iconTone="deep" label="Registered users" value={p?.users ?? 0} />
          <KPI icon={Heartbeat} iconTone="teal" label="Verified responders" value={p?.responders ?? 0} />
          <KPI icon={Stethoscope} iconTone="mint" label="Clinicians taking bookings" value={p?.clinicians ?? 0} />
          <KPI icon={Hospital} iconTone="teal" label={`Hospitals on Vitalis (of ${p?.hospitals.total ?? 0})`} value={p?.hospitals.participating ?? 0} />
          <KPI icon={Siren} iconTone={p?.incidents.active ? 'sos' : 'teal'} label="Active incidents" value={p?.incidents.active ?? 0} />
          <KPI icon={Ambulance} iconTone="deep" label="Completed, 30 days" value={p?.incidents.completed30 ?? 0} />
          <KPI icon={Warning} iconTone={p?.incidents.unanswered30 ? 'sos' : 'teal'} label="Ended unanswered, 30 days" value={p?.incidents.unanswered30 ?? 0} />
          <KPI icon={Bed} iconTone="mint" label="Median time to accept, 30 days" value={p?.incidents.medianAcceptSeconds30 != null ? formatEta(p.incidents.medianAcceptSeconds30) : '—'} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Sign-ups, last 14 days"><div className="p-5">{p && <Bars days={p.activity.signups} />}</div></Panel>
          <Panel title="SOS calls, last 14 days"><div className="p-5">{p && <Bars days={p.activity.sos} />}</div></Panel>
        </div>
        <Panel title="More" aside={<span className="text-[13px] text-muted-foreground">30 days</span>}>
          <Row icon={Defibrillator} title="Defibrillators" summary={`${p?.aeds.registered ?? 0} registered, ${p?.aeds.ready ?? 0} ready for use`} />
          <Row icon={Warning} title="Escalated to operators" summary={`${p?.incidents.escalated30 ?? 0} calls nobody accepted within a minute`} />
          <Row icon={Siren} title="Cancelled" summary={`${p?.incidents.cancelled30 ?? 0} calls`} />
          <Row icon={Stethoscope} title="Consultations booked" summary={`${p?.bookings30 ?? 0}`} />
        </Panel>

        <Panel title="System health" aside={<span className="text-[13px] text-muted-foreground">{h ? `Version ${h.api.version} · up since ${time(h.api.since)}` : 'Not reachable'}</span>}>
          {!h ? <p className="px-5 py-6 text-sm text-muted-foreground">The health endpoint did not answer.</p> : <>
            <Row icon={GaugeIcon} title="API and database" summary={`${h.api.status}, database ${h.database.status} (${h.database.pingMs} ms)${h.api.demoMode ? ' · demo mode: phone sign-in without SMS codes' : ''}`} right={<Chip tone="teal">Up</Chip>} />
            {Object.entries(JOB).map(([key, label]) => {
              const j = h.jobs[key];
              return <Row key={key} icon={GaugeIcon} title={label} summary={j ? `Last run ${time(j.lastRunAt)} · ${j.failures} failures of ${j.runs}${j.lastError ? ` · last error: ${j.lastError}` : ''}` : 'Not run yet in this process'} right={<Chip tone={!j ? 'muted' : j.lastErrorAt ? 'sos' : 'teal'}>{!j ? 'Waiting' : j.lastErrorAt ? 'Errors' : 'OK'}</Chip>} />;
            })}
            <Row icon={GaugeIcon} title="Texts, last 24 hours" summary={Object.entries(h.texts24h).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(' · ') || 'None'} right={(h.texts24h.failed ?? 0) + (h.texts24h.not_configured ?? 0) ? <Chip tone="sos">Failures</Chip> : undefined} />
            {Object.entries(h.integrations).map(([key, value]) => <Row key={key} icon={GaugeIcon} title={INTEGRATION[key] ?? key} summary={value} right={<Chip tone={/not configured/.test(value) ? 'amber' : 'muted'}>{/not configured/.test(value) ? 'Off' : 'On'}</Chip>} />)}
          </>}
        </Panel>
      </div>
    </>
  );
};
