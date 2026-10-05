import { Lightning, ShieldCheck, Trash } from '@phosphor-icons/react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../api/client';
import { Chip, Panel, Row } from '../../../components/ui/list';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';
import { cn } from '../../../lib/utils';

interface Aed {
  id: string;
  name: string;
  placement?: string;
  access: '24h' | 'business_hours' | 'restricted';
  coordinates: [number, number];
  padsExpireAt?: string;
  verified: boolean;
}

const ACCESS: Record<Aed['access'], string> = { '24h': '24 hours', business_hours: 'Business hours', restricted: 'Staff access' };

export const Aeds = () => {
  const [items, setItems] = useState<Aed[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unverified'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/aeds').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const unverified = items.filter(a => !a.verified).length;
  const shown = useMemo(() => (filter === 'all' ? items : items.filter(a => !a.verified)), [items, filter]);

  const verify = async (a: Aed) => {
    setBusy(a.id);
    try {
      const { data } = await api.post(`/aeds/${a.id}/verify`);
      setItems(prev => prev.map(x => (x.id === a.id ? data : x)));
      pushToast({ tone: 'success', title: 'Verified', body: a.name });
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

  const soon = (iso?: string) => !!iso && new Date(iso).getTime() - Date.now() < 60 * 86400000;

  return (
    <>
      <PageHeader icon={Lightning} title="Defibrillators" subtitle="Public AED registry. AED runners are only sent to devices listed here." />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 w-fit shadow-sm" role="tablist">
          {(['all', 'unverified'] as const).map(f => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', filter === f ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}
            >
              {f === 'all' ? `All (${items.length})` : `Needs review (${unverified})`}
            </button>
          ))}
        </div>

        <Panel>
          {loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10" /></div>)}
          {!loading && shown.length === 0 && (
            <div className="px-6 py-12 text-center text-muted-foreground">
              {filter === 'unverified' ? 'Nothing to review. Citizen reports appear here.' : 'No defibrillators registered yet.'}
            </div>
          )}
          {shown.map(a => (
            <Row
              key={a.id}
              icon={Lightning}
              tone={a.verified ? 'teal' : 'amber'}
              title={a.name}
              summary={a.placement ?? 'No placement notes'}
              meta={<>
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
                {a.verified
                  ? <Chip tone="teal"><ShieldCheck size={14} weight="fill" /> Verified</Chip>
                  : <Button size="sm" className="rounded-lg" onClick={() => verify(a)} disabled={busy === a.id}>Verify</Button>}
                <Button size="icon-sm" variant="ghost" className="rounded-lg text-muted-foreground hover:text-destructive" onClick={() => remove(a)} disabled={busy === a.id} aria-label={`Remove ${a.name}`}>
                  <Trash size={17} />
                </Button>
              </>}
            />
          ))}
        </Panel>
      </div>
    </>
  );
};
