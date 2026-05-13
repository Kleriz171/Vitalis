import { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';
import { shortId } from '../../../lib/format';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  queued: 'outline',
  launched: 'default',
  in_flight: 'default',
  delivered: 'secondary',
  aborted: 'destructive',
};

interface Mission {
  _id: string;
  droneId: string;
  status: string;
  payload?: string;
}

export const Drones = () => {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/drones').then(r => setMissions(r.data)).catch(() => {}).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const onUpdate = () => load();
    socket.on('drone:mission', onUpdate);
    socket.on('drone:update', onUpdate);
    return () => { socket.off('drone:mission', onUpdate); socket.off('drone:update', onUpdate); };
  }, []);

  const dispatchTest = async () => {
    try {
      await api.post('/drones', {
        droneId: `DRN-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
        origin: { type: 'Point', coordinates: [19.8189, 41.3275] },
        destination: { type: 'Point', coordinates: [19.8289, 41.3375] },
        payload: 'O- blood unit',
      });
      pushToast({ tone: 'success', title: 'Drone queued' });
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Dispatch failed', body: e.response?.data?.error });
    }
  };

  return (
    <>
      <PageHeader
        title="Drone dispatch"
        subtitle="Aerial logistics command"
        actions={<Button onClick={dispatchTest}><Plane size={14} /> Dispatch test drone</Button>}
      />
      <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
        {!loading && missions.length === 0 && (
          <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">
            <Plane size={36} className="mx-auto mb-3 opacity-40" />
            No drone missions yet. Dispatch one to begin.
          </Card>
        )}
        {missions.map(m => (
          <Card key={m._id} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Drone</div>
                <div className="font-mono font-semibold">{m.droneId}</div>
              </div>
              <Badge variant={STATUS_VARIANT[m.status] ?? 'outline'} className="capitalize">
                {m.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">Payload: {m.payload ?? '—'}</div>
            <div className="text-[10px] text-muted-foreground font-mono">#{shortId(m._id)}</div>
          </Card>
        ))}
      </div>
    </>
  );
};
