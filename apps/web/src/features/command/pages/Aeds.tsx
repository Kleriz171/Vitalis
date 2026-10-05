import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../../api/client';
import { Card } from '../../../components/ui/card';
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
      <PageHeader title="Defibrillators" subtitle="Public AED registry. AED runners are only sent to devices listed here." />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit" role="tablist">
          {(['all', 'unverified'] as const).map(f => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 text-sm rounded-md transition-colors', filter === f ? 'bg-card shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground')}
            >
              {f === 'all' ? `All (${items.length})` : `Needs review (${unverified})`}
            </button>
          ))}
        </div>

        <Card className="py-0 gap-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Access</th>
                <th className="px-4 py-2.5 font-medium">Pads expire</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-t border-border"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5" /></td></tr>
              ))}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {filter === 'unverified' ? 'Nothing to review. Citizen reports will appear here.' : 'No defibrillators registered yet.'}
                </td></tr>
              )}
              {shown.map(a => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.name}</div>
                    {a.placement && <div className="text-muted-foreground">{a.placement}</div>}
                    <a
                      className="text-xs text-primary hover:underline underline-offset-2"
                      href={`https://www.openstreetmap.org/?mlat=${a.coordinates[1]}&mlon=${a.coordinates[0]}#map=19/${a.coordinates[1]}/${a.coordinates[0]}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {a.coordinates[1].toFixed(5)}, {a.coordinates[0].toFixed(5)}
                    </a>
                  </td>
                  <td className="px-4 py-3">{ACCESS[a.access]}</td>
                  <td className={cn('px-4 py-3 tabular-nums', soon(a.padsExpireAt) && 'text-red-300 font-medium')}>
                    {a.padsExpireAt ? new Date(a.padsExpireAt).toLocaleDateString() : 'Unknown'}
                  </td>
                  <td className="px-4 py-3">
                    {a.verified
                      ? <span className="inline-flex items-center gap-1 text-emerald-300"><ShieldCheck size={14} /> Verified</span>
                      : <span className="text-amber-300">Unverified</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {!a.verified && <Button size="sm" onClick={() => verify(a)} disabled={busy === a.id}>Verify</Button>}
                      <Button size="sm" variant="ghost" onClick={() => remove(a)} disabled={busy === a.id} aria-label={`Remove ${a.name}`}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};
