import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';
import { shortId } from '../../../lib/format';

const statusTone: Record<string, any> = {
  queued: 'slate',
  launched: 'cyan',
  in_flight: 'violet',
  delivered: 'emerald',
  aborted: 'pink',
};

export const Drones = () => {
  const [missions, setMissions] = useState<any[]>([]);

  const load = () => api.get('/drones').then(r => setMissions(r.data)).catch(() => {});

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
        origin: { type: 'Point', coordinates: [23.7275, 37.9838] },
        destination: { type: 'Point', coordinates: [23.7400, 37.9900] },
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
        title="Drone Dispatch"
        subtitle="Aerial logistics command"
        actions={<Button onClick={dispatchTest}>Dispatch test drone</Button>}
      />
      <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {missions.length === 0 && (
          <Card className="col-span-full p-12 text-center text-sm text-slate-500">
            No drone missions yet. Dispatch one to begin.
          </Card>
        )}
        <AnimatePresence>
          {missions.map(m => (
            <motion.div
              key={m._id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card tone="strong" className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500">Drone</div>
                    <div className="font-mono">{m.droneId}</div>
                  </div>
                  <Badge tone={statusTone[m.status] ?? 'slate'}>{m.status.replace('_', ' ')}</Badge>
                </div>
                <div className="text-xs text-slate-400">Payload: {m.payload ?? '—'}</div>
                <div className="text-[10px] text-slate-500 font-mono">#{shortId(m._id)}</div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
};
