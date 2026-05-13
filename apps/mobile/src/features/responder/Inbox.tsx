import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { RootState, logout } from '../../store';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { StatusBadge, Badge } from '../../components/ui/badge';
import { pushToast } from '../../components/toast/toast';
import { timeAgo, shortId, formatEta } from '../../lib/format';

export const ResponderInbox = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const [available, setAvailable] = useState(false);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);

  useEffect(() => {
    const onNew = (e: any) => {
      setIncidents(prev => [e.emergency, ...prev.filter(x => x._id !== e.emergency._id)].slice(0, 20));
      pushToast({ tone: 'warn', title: `New ${e.emergency.type}`, body: `P${e.emergency.priority} · ${e.nearby?.length ?? 0} nearby` });
    };
    const onAssigned = (e: any) => {
      if (e.responder === user?.id) setActive(e);
      setIncidents(prev => prev.filter(i => i._id !== e._id));
    };
    socket.on('emergency:new', onNew);
    socket.on('emergency:assigned', onAssigned);
    return () => { socket.off('emergency:new', onNew); socket.off('emergency:assigned', onAssigned); };
  }, [user?.id]);

  const toggleAvailable = async () => {
    if (!available) {
      // get position + set availability
      navigator.geolocation.getCurrentPosition(
        async pos => {
          try {
            await api.patch('/biopassport/me', {
              location: { type: 'Point', coordinates: [pos.coords.longitude, pos.coords.latitude] },
              available: true,
            });
            setAvailable(true);
            pushToast({ tone: 'success', title: 'On duty', body: 'You\'ll receive nearby SOS broadcasts' });
          } catch (e: any) {
            pushToast({ tone: 'error', title: 'Failed', body: e.response?.data?.error });
          }
        },
        () => pushToast({ tone: 'error', title: 'Location denied' }),
        { enableHighAccuracy: true }
      );
    } else {
      await api.patch('/biopassport/me', { available: false });
      setAvailable(false);
      pushToast({ tone: 'info', title: 'Off duty' });
    }
  };

  const accept = async (id: string) => {
    try {
      const { data } = await api.post(`/emergencies/${id}/accept`);
      setActive(data);
      setIncidents(prev => prev.filter(i => i._id !== id));
      socket.emit('emergency:join', id);
      pushToast({ tone: 'success', title: 'Accepted', body: `ETA ${formatEta(data.etaSeconds)}` });
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Accept failed', body: e.response?.data?.error });
    }
  };

  const setStatus = async (status: string) => {
    if (!active) return;
    try {
      const { data } = await api.patch(`/emergencies/${active._id}/status`, { status });
      setActive(status === 'resolved' ? null : data);
      pushToast({ tone: 'info', title: `Marked ${status}` });
    } catch {}
  };

  return (
    <div className="min-h-screen pb-10">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl bg-ink-900/60 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-violet to-neon-cyan shadow-glow" />
          <div>
            <div className="font-bold tracking-wider text-sm">RESPONDER</div>
            <div className="text-[10px] text-slate-400 -mt-0.5">{user?.name}</div>
          </div>
        </div>
        <button onClick={() => { dispatch(logout()); nav('/login'); }} className="text-xs text-slate-400 hover:text-neon-pink">
          Sign out
        </button>
      </header>

      <main className="px-5 py-5 max-w-md mx-auto space-y-5">
        <Card tone="strong" className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Duty status</h2>
              <p className="text-xs text-slate-400">Receive nearby SOS broadcasts</p>
            </div>
            <Badge tone={available ? 'emerald' : 'slate'}>{available ? 'ON DUTY' : 'OFF DUTY'}</Badge>
          </div>
          <Button
            onClick={toggleAvailable}
            variant={available ? 'ghost' : 'primary'}
            className="w-full"
          >
            {available ? 'Go off duty' : 'Go on duty'}
          </Button>
        </Card>

        {active && (
          <Card tone="strong" glow className="p-5 space-y-3 border-neon-cyan/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">Active incident</div>
                <div className="font-mono">#{shortId(active._id)}</div>
              </div>
              <StatusBadge status={active.status} />
            </div>
            <div className="text-sm capitalize">{active.type?.replace('_', ' ')} · P{active.priority}</div>
            {active.etaSeconds != null && (
              <div className="text-2xl font-mono neon-text">ETA {formatEta(active.etaSeconds)}</div>
            )}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => setStatus('en_route')}>En route</Button>
              <Button size="sm" variant="ghost" onClick={() => setStatus('on_scene')}>On scene</Button>
              <Button size="sm" variant="danger" onClick={() => setStatus('resolved')}>Resolve</Button>
            </div>
          </Card>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs uppercase tracking-wider text-slate-400">Inbox</h3>
            <span className="text-xs text-slate-500">{incidents.length} new</span>
          </div>
          {incidents.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-8">
              {available ? 'No incidents yet — stand by.' : 'Go on duty to receive incidents.'}
            </p>
          )}
          <AnimatePresence>
            {incidents.map(i => (
              <motion.div
                key={i._id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
              >
                <Card className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-[10px] text-slate-500">#{shortId(i._id)}</span>
                      <Badge tone={i.priority === 1 ? 'pink' : 'amber'}>P{i.priority}</Badge>
                    </div>
                    <div className="text-sm capitalize">{i.type?.replace('_', ' ')}</div>
                    <div className="text-[10px] text-slate-500">{timeAgo(i.createdAt)}</div>
                  </div>
                  <Button size="sm" onClick={() => accept(i._id)}>Accept</Button>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};
