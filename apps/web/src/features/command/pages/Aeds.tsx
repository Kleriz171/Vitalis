import { BatteryWarning, Clock, Lightning, MagnifyingGlass, ShieldCheck, ShieldWarning, Trash } from '@phosphor-icons/react';
import { KPI } from '../../../components/widgets/KPI';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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

type Filter = 'all' | 'unverified' | 'expiring' | '24h';
const FILTERS: [Filter, string][] = [['all', 'All'], ['unverified', 'Needs review'], ['expiring', 'Pads expiring'], ['24h', 'Open 24 h']];
const MapView = lazy(() => import('../../../components/map/MapView'));

const ACCESS: Record<Aed['access'], string> = { '24h': '24 hours', business_hours: 'Business hours', restricted: 'Staff access' };

export const Aeds = () => {
  const [items, setItems] = useState<Aed[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<Aed | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/aeds').then(r => setItems(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const soon = (iso?: string) => !!iso && new Date(iso).getTime() - Date.now() < 60 * 86400000;
  const counts = {
    all: items.length,
    unverified: items.filter(a => !a.verified).length,
    expiring: items.filter(a => soon(a.padsExpireAt)).length,
    '24h': items.filter(a => a.access === '24h').length,
  };
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter(a => filter === 'all' || (filter === 'unverified' ? !a.verified : filter === 'expiring' ? soon(a.padsExpireAt) : a.access === '24h'))
      .filter(a => !q || `${a.name} ${a.placement ?? ''}`.toLowerCase().includes(q));
  }, [items, filter, query]);

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

  return (
    <>
      <PageHeader icon={Lightning} title="Defibrillators" subtitle="Public defibrillators. Helpers are only sent to fetch the ones listed here." />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI icon={Lightning} iconTone="deep" label="Registered defibrillators" value={counts.all} />
          <KPI icon={Clock} iconTone="teal" label="Open 24 hours" value={counts['24h']} />
          <KPI icon={ShieldWarning} iconTone={counts.unverified ? 'sos' : 'teal'} label="Waiting for review" value={counts.unverified} tone={counts.unverified ? 'rose' : 'teal'} />
          <KPI icon={BatteryWarning} iconTone={counts.expiring ? 'sos' : 'mint'} label="Pads expire within 60 days" value={counts.expiring} tone={counts.expiring ? 'rose' : 'teal'} />
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
              {query ? `Nothing matches “${query}”.` : filter === 'unverified' ? 'Nothing to review. Citizen reports appear here.' : filter === 'expiring' ? 'No pads expire in the next 60 days.' : 'No defibrillators here yet.'}
            </div>
          )}
          {shown.map(a => (
            <Row
              key={a.id}
              icon={Lightning}
              tone={a.verified ? 'teal' : 'sos'}
              onClick={() => setFocus(a)}
              active={focus?.id === a.id}
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
          {/* Where they are: sticks beside the list; picking a row flies here. */}
          <div className="xl:sticky xl:top-6 h-[min(64vh,640px)] rounded-[22px] border border-border bg-card overflow-hidden shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
            <Suspense fallback={<Skeleton className="w-full h-full" />}>
              <MapView legend="aeds" incidents={[]} aeds={shown.map(a => ({ id: a.id, name: a.name, placement: a.placement, verified: a.verified, coordinates: a.coordinates }))} focus={focus?.coordinates ?? null} />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
};
