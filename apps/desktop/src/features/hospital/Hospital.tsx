import { useEffect, useState } from 'react';
import { Clock, Crosshair, Hospital, MapPin, Phone, Buildings } from '@phosphor-icons/react';
import { api } from '../../api/client';
import { pushToast } from '../../components/toast/toast';
import { cn } from '../../lib/utils';
import { PageHeader } from '../../components/layout/CommandShell';
import { Chip, Panel, Row } from '../../components/ui/list';

interface MyHospital {
  id: string;
  name: string;
  type: 'public' | 'private';
  address?: string;
  phone?: string;
  isOpen24h: boolean;
  coordinates?: [number, number];
  capacity: { status: Capacity; updatedAt: string } | null;
}

type Capacity = 'accepting' | 'limited' | 'unavailable';
const CAPACITY: [Capacity, string, string][] = [
  ['accepting', 'Accepting patients', 'Send patients as usual.'],
  ['limited', 'Limited capacity', 'Call ahead before sending anyone.'],
  ['unavailable', 'Temporarily unavailable', 'Send patients elsewhere for now.'],
];

/** Hospital staff: the hospital this account belongs to, as operators and patients see it. */
export const HospitalPage = () => {
  const [h, setH] = useState<MyHospital | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setCapacity = async (status: Capacity) => {
    setSaving(true);
    try {
      const { data } = await api.patch<MyHospital>('/hospital/me/capacity', { status });
      setH(data);
      pushToast({ tone: 'success', title: 'Status updated', body: 'Operators see it now.' });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    api.get<MyHospital>('/hospital/me')
      .then(r => setH(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Could not load your hospital'));
  }, []);

  return (
    <>
      <PageHeader icon={Hospital} title={h?.name ?? 'Your hospital'} subtitle="Your hospital on the Vitalis network, as operators and patients see it." />
      <div className="p-6 max-w-3xl space-y-5">
        {h && (
          <Panel title="Taking patients" aside={<span className="text-[13px] text-muted-foreground">{h.capacity ? `Updated ${new Date(h.capacity.updatedAt).toLocaleString('en-GB', { hourCycle: 'h23', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not reported yet'}</span>}>
            <div className="grid gap-2 p-4 sm:grid-cols-3">
              {CAPACITY.map(([status, label, hint]) => {
                const on = h.capacity?.status === status;
                return (
                  <button key={status} disabled={saving} onClick={() => setCapacity(status)} aria-pressed={on}
                    className={cn('rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60',
                      on ? (status === 'accepting' ? 'border-primary bg-[hsl(173_55%_92%)]' : status === 'limited' ? 'border-[hsl(var(--warn))] bg-[hsl(var(--warn)/0.1)]' : 'border-[hsl(var(--sos))] bg-[hsl(var(--sos)/0.08)]') : 'border-border hover:bg-muted/50')}>
                    <div className="font-bold">{label}</div>
                    <div className="text-[13px] text-muted-foreground">{hint}</div>
                  </button>
                );
              })}
            </div>
            <p className="px-5 pb-4 text-[13px] text-muted-foreground">Operators see this with the time you set it. Vitalis never picks a hospital on its own.</p>
          </Panel>
        )}
        <Panel title="Details">
          {error && <p className="px-5 py-6 text-sm text-muted-foreground">{error}</p>}
          {!h && !error && <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>}
          {h && <>
            <Row icon={MapPin} title="Address" summary={h.address ?? 'Not recorded'} />
            <Row icon={Phone} title="Phone" summary={h.phone ?? 'Not recorded'} />
            <Row icon={Clock} title="Opening hours" summary={h.isOpen24h ? 'Open 24 hours' : 'Not open around the clock'} right={h.isOpen24h ? <Chip tone="teal">24 hours</Chip> : undefined} />
            <Row icon={Buildings} title="Type" summary={h.type === 'private' ? 'Private hospital' : 'Public hospital'} />
            {h.coordinates && (
              <Row icon={Crosshair} title="Location" summary={`${h.coordinates[1].toFixed(4)}° N, ${h.coordinates[0].toFixed(4)}° E`} />
            )}
          </>}
        </Panel>
        <p className="text-[13px] text-muted-foreground">Details come from OpenStreetMap; the phone number has not been confirmed by calling.</p>
      </div>
    </>
  );
};
