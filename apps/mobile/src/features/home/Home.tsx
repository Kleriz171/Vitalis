import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { RootState, logout } from '../../store';
import { BioPassport } from '../passport/BioPassport';
import { MedicineRadar } from '../medicine/MedicineRadar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { pushToast } from '../../components/toast/toast';
import { formatEta } from '../../lib/format';

type Tab = 'home' | 'medicine' | 'passport';
type SOSState = 'idle' | 'pulsing' | 'pending' | 'matched' | 'resolved';

export const Home = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('home');
  const [sos, setSos] = useState<SOSState>('idle');
  const [eta, setEta] = useState<number | null>(null);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);

  useEffect(() => {
    const onAssigned = (e: any) => {
      setSos('matched');
      setEta(e.etaSeconds);
      pushToast({ tone: 'success', title: 'Responder en route', body: `ETA ${formatEta(e.etaSeconds)}` });
    };
    const onStatus = (e: any) => {
      if (e.status === 'resolved') {
        setSos('resolved');
        pushToast({ tone: 'success', title: 'Incident resolved' });
      }
    };
    socket.on('emergency:assigned', onAssigned);
    socket.on('emergency:status', onStatus);
    return () => {
      socket.off('emergency:assigned', onAssigned);
      socket.off('emergency:status', onStatus);
    };
  }, []);

  useEffect(() => {
    if (sos !== 'matched' || eta == null) return;
    const t = setInterval(() => setEta(v => (v != null && v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [sos, eta]);

  const triggerSOS = () => {
    if (sos !== 'idle' && sos !== 'resolved') return;
    setSos('pulsing');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { data } = await api.post('/emergencies', {
            type: 'medical',
            priority: 1,
            description: 'Citizen SOS',
            coordinates: [pos.coords.longitude, pos.coords.latitude],
          });
          setEmergencyId(data.emergency._id);
          setSos('pending');
          socket.emit('emergency:join', data.emergency._id);
          pushToast({
            tone: 'info',
            title: 'SOS broadcast',
            body: `${data.nearbyCount} responder${data.nearbyCount === 1 ? '' : 's'} nearby`,
          });
        } catch (e: any) {
          setSos('idle');
          pushToast({ tone: 'error', title: 'SOS failed', body: e.response?.data?.error ?? 'try again' });
        }
      },
      () => {
        setSos('idle');
        pushToast({ tone: 'error', title: 'Location denied', body: 'Allow GPS access to send an SOS.' });
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const cancelSOS = async () => {
    if (!emergencyId) return;
    try {
      await api.patch(`/emergencies/${emergencyId}/status`, { status: 'cancelled' });
      setSos('idle'); setEmergencyId(null); setEta(null);
      pushToast({ tone: 'warn', title: 'SOS cancelled' });
    } catch {}
  };

  return (
    <div className="min-h-screen pb-24">
      <header className="px-5 pt-6 pb-3 flex items-center justify-between sticky top-0 z-10 backdrop-blur-xl bg-ink-900/60 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-pink shadow-glow" />
          <div>
            <div className="font-bold tracking-wider neon-text text-sm">VITALIS</div>
            <div className="text-[10px] text-slate-400 -mt-0.5">Hi, {user?.name?.split(' ')[0] ?? 'Citizen'}</div>
          </div>
        </div>
        <button
          onClick={() => { dispatch(logout()); nav('/login'); }}
          className="text-xs text-slate-400 hover:text-neon-pink"
        >
          Sign out
        </button>
      </header>

      <main className="px-5 py-6 max-w-md mx-auto space-y-5">
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <SOSHero state={sos} eta={eta} onTrigger={triggerSOS} onCancel={cancelSOS} />
              <QuickTiles onSelect={setTab} />
            </motion.div>
          )}

          {tab === 'medicine' && (
            <motion.div key="med" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <MedicineRadar />
            </motion.div>
          )}

          {tab === 'passport' && (
            <motion.div key="pass" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <BioPassport />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav tab={tab} onChange={setTab} />
    </div>
  );
};

const SOSHero = ({ state, eta, onTrigger, onCancel }: {
  state: SOSState; eta: number | null; onTrigger: () => void; onCancel: () => void;
}) => {
  const isActive = state !== 'idle' && state !== 'resolved';
  return (
    <Card tone="strong" className="relative overflow-hidden p-6">
      <div className="absolute inset-0 opacity-30 bg-grid pointer-events-none" />
      <div className="relative flex flex-col items-center text-center gap-4">
        {state !== 'idle' && state !== 'resolved' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-pink animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-slate-400">
                {state === 'pulsing' ? 'Broadcasting' : state === 'pending' ? 'Awaiting responder' : 'Responder en route'}
              </span>
            </div>
            {state === 'matched' && eta != null && (
              <div className="text-5xl font-bold neon-text font-mono">{formatEta(eta)}</div>
            )}
          </motion.div>
        )}

        <motion.button
          onClick={onTrigger}
          disabled={isActive}
          whileTap={{ scale: 0.94 }}
          className={`relative w-48 h-48 rounded-full grid place-items-center text-2xl font-extrabold tracking-widest text-white transition select-none
            ${isActive
              ? 'bg-gradient-to-br from-neon-cyan to-neon-violet pointer-events-none'
              : 'bg-gradient-to-br from-neon-pink to-red-600 cursor-pointer'
            }`}
        >
          {!isActive && <span className="absolute inset-0 rounded-full pulse-ring" />}
          <span className="relative z-10">
            {state === 'idle' ? 'SOS' :
             state === 'pulsing' ? '...' :
             state === 'pending' ? 'SENT' :
             state === 'matched' ? 'LIVE' : 'DONE'}
          </span>
        </motion.button>

        <p className="text-xs text-slate-400 max-w-[18rem]">
          {state === 'idle' || state === 'resolved'
            ? 'Hold for 1 second to broadcast an emergency to nearby responders.'
            : state === 'pending'
            ? 'Your signal is live. Hang tight — a responder will accept any moment.'
            : 'Help is on the way. Stay where you are.'}
        </p>

        {isActive && (
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel SOS</Button>
        )}
      </div>
    </Card>
  );
};

const QuickTiles = ({ onSelect }: { onSelect: (t: Tab) => void }) => (
  <div className="grid grid-cols-2 gap-3">
    <Tile label="Medicine Radar" desc="Find nearby pharmacies" tone="cyan" onClick={() => onSelect('medicine')} />
    <Tile label="Bio Passport" desc="QR medical profile" tone="pink" onClick={() => onSelect('passport')} />
    <Tile label="Wearable" desc="Pair smartwatch" tone="violet" disabled />
    <Tile label="Live-Link" desc="Video consultation" tone="lime" disabled />
  </div>
);

const Tile = ({ label, desc, tone, onClick, disabled }: {
  label: string; desc: string; tone: 'cyan' | 'pink' | 'violet' | 'lime';
  onClick?: () => void; disabled?: boolean;
}) => {
  const tones = {
    cyan: 'from-neon-cyan/30 to-transparent',
    pink: 'from-neon-pink/30 to-transparent',
    violet: 'from-neon-violet/30 to-transparent',
    lime: 'from-neon-lime/30 to-transparent',
  } as const;
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { y: -2 } : undefined}
      whileTap={!disabled ? { scale: 0.97 } : undefined}
      className={`relative text-left p-4 rounded-2xl border border-white/10 bg-gradient-to-br ${tones[tone]} bg-white/[0.03] overflow-hidden ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/20'}`}
    >
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-[11px] text-slate-400 mt-1">{desc}</div>
      {disabled && <span className="absolute top-2 right-2 text-[9px] uppercase text-slate-500">Soon</span>}
    </motion.button>
  );
};

const BottomNav = ({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) => {
  const items: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'medicine', label: 'Medicine' },
    { id: 'passport', label: 'Passport' },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 px-4 pb-4 pt-2 z-20">
      <div className="max-w-md mx-auto glass-strong p-1 flex gap-1">
        {items.map(i => (
          <button
            key={i.id}
            onClick={() => onChange(i.id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold relative transition ${
              tab === i.id ? 'text-ink-900' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {tab === i.id && (
              <motion.div layoutId="tabBg" className="absolute inset-0 bg-neon-cyan rounded-xl -z-10" />
            )}
            {i.label}
          </button>
        ))}
      </div>
    </nav>
  );
};
