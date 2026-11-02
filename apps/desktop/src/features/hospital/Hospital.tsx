import { useEffect, useState } from 'react';
import { Clock, Crosshair, Hospital, MapPin, Phone, Buildings } from '@phosphor-icons/react';
import { api } from '../../api/client';
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
}

/** Hospital staff: the hospital this account belongs to, as operators and patients see it. */
export const HospitalPage = () => {
  const [h, setH] = useState<MyHospital | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<MyHospital>('/hospital/me')
      .then(r => setH(r.data))
      .catch(e => setError(e.response?.data?.error ?? 'Could not load your hospital'));
  }, []);

  return (
    <>
      <PageHeader icon={Hospital} title={h?.name ?? 'Your hospital'} subtitle="Your hospital on the Vitalis network, as operators and patients see it." />
      <div className="p-6 max-w-3xl space-y-5">
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
