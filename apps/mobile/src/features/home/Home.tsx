import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Heart, Droplets, Stethoscope, Users, Sparkles, ShieldCheck, ChevronRight,
  AlertCircle, LogOut, QrCode, Pill,
} from 'lucide-react';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { RootState, logout } from '../../store';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { pushToast } from '../../components/toast/toast';
import { formatEta } from '../../lib/format';
import { cn } from '@/lib/utils';

type SOSState = 'idle' | 'pulsing' | 'pending' | 'matched' | 'resolved';
type ShellContext = { openSOS: () => void };

export const Home = () => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch();
  const nav = useNavigate();
  const { openSOS } = useOutletContext<ShellContext>() ?? { openSOS: () => {} };

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
      setSos('idle');
      setEmergencyId(null);
      setEta(null);
      pushToast({ tone: 'warn', title: 'SOS cancelled' });
    } catch {
      /* swallow */
    }
  };

  const firstName = user?.name?.split(' ')[0] ?? 'friend';

  return (
    <div className="min-h-full bg-background">
      <header className="bg-gradient-to-br from-primary to-teal-700 text-primary-foreground px-5 pt-6 pb-10 rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-40 h-40 border-2 border-white rounded-full" />
          <div className="absolute -bottom-6 left-6 w-24 h-24 border border-white rounded-full" />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur grid place-items-center">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-wide">VITALIS</h1>
              <p className="text-white/80 text-xs">Your health & emergency hub</p>
            </div>
          </div>
          <button
            onClick={() => { dispatch(logout()); nav('/login'); }}
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center transition"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
        <div className="relative z-10 mt-5">
          <p className="text-white/80 text-sm">
            Hello, <span className="text-white font-semibold">{firstName}</span>
          </p>
          <p className="text-white/70 text-xs mt-0.5">How are you feeling today?</p>
        </div>
      </header>

      <div className="px-4 -mt-6 relative z-10 pb-8 space-y-4">
        <SOSHero state={sos} eta={eta} onTrigger={triggerSOS} onCancel={cancelSOS} onOpenPanel={openSOS} />

        <QuickActions onNav={nav} />

        <SafetyTip />
      </div>
    </div>
  );
};

const SOSHero = ({
  state, eta, onTrigger, onCancel, onOpenPanel,
}: {
  state: SOSState;
  eta: number | null;
  onTrigger: () => void;
  onCancel: () => void;
  onOpenPanel: () => void;
}) => {
  const isActive = state !== 'idle' && state !== 'resolved';
  return (
    <Card className="p-5 shadow-sm">
      <div className="flex flex-col items-center text-center gap-4">
        {isActive && (
          <div className="w-full">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {state === 'pulsing'
                  ? 'Broadcasting'
                  : state === 'pending'
                  ? 'Awaiting responder'
                  : 'Responder en route'}
              </span>
            </div>
            {state === 'matched' && eta != null && (
              <div className="text-4xl font-extrabold font-mono text-primary">{formatEta(eta)}</div>
            )}
          </div>
        )}

        <button
          onClick={onTrigger}
          disabled={isActive}
          className={cn(
            'relative w-44 h-44 rounded-full grid place-items-center text-xl font-extrabold tracking-widest text-white transition active:scale-95 select-none shadow-lg',
            isActive
              ? 'bg-primary pointer-events-none'
              : 'bg-destructive hover:bg-destructive/90'
          )}
        >
          {!isActive && <span className="absolute inset-0 rounded-full sos-pulse pointer-events-none" />}
          <span className="relative z-10">
            {state === 'idle' ? 'SOS' : state === 'pulsing' ? '…' : state === 'pending' ? 'SENT' : state === 'matched' ? 'LIVE' : 'DONE'}
          </span>
        </button>

        <p className="text-xs text-muted-foreground max-w-[20rem]">
          {state === 'idle' || state === 'resolved'
            ? 'Tap to broadcast an emergency to nearby responders.'
            : state === 'pending'
            ? 'Your signal is live. A responder will accept any moment.'
            : 'Help is on the way. Stay where you are.'}
        </p>

        <div className="flex gap-2 w-full">
          {isActive ? (
            <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
              Cancel SOS
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onOpenPanel} className="flex-1">
              Emergency numbers
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const QuickActions = ({ onNav }: { onNav: (path: string) => void }) => {
  const actions = [
    { icon: Droplets, label: 'Blood', tint: 'bg-destructive/10 text-destructive', path: '/app/blood' },
    { icon: Stethoscope, label: 'Doctors', tint: 'bg-blue-50 text-blue-600', path: '/app/doctors' },
    { icon: Users, label: 'Community', tint: 'bg-purple-50 text-purple-600', path: '/app/community' },
    { icon: Sparkles, label: 'AI Assist', tint: 'bg-emerald-50 text-emerald-600', path: '/app/assistant' },
  ];

  const tiles = [
    { icon: QrCode, title: 'Bio Passport', desc: 'QR medical profile', path: '/app/profile', tint: 'bg-primary/10 text-primary' },
    { icon: Pill, title: 'Medicine Radar', desc: 'Find nearby pharmacies', path: '/app/doctors', tint: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {actions.map(a => (
          <button
            key={a.label}
            onClick={() => onNav(a.path)}
            className="flex flex-col items-center gap-2 active:scale-95 transition"
          >
            <div className={cn('w-14 h-14 rounded-2xl grid place-items-center shadow-sm', a.tint)}>
              <a.icon size={24} />
            </div>
            <span className="text-[11px] font-medium text-foreground leading-tight">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3">
        {tiles.map(t => (
          <Card key={t.title} className="p-4">
            <button onClick={() => onNav(t.path)} className="flex items-center gap-3 w-full text-left">
              <div className={cn('w-12 h-12 rounded-2xl grid place-items-center', t.tint)}>
                <t.icon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.desc}</div>
              </div>
              <ChevronRight size={18} className="text-muted-foreground" />
            </button>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-destructive/10 rounded-lg grid place-items-center">
              <AlertCircle size={16} className="text-destructive" />
            </div>
            <h2 className="font-semibold text-sm">Urgent blood needs</h2>
          </div>
          <button
            onClick={() => onNav('/app/blood')}
            className="text-primary text-xs font-medium flex items-center gap-1"
          >
            See all <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'].map(type => (
            <div key={type} className="flex-shrink-0 flex flex-col items-center gap-1">
              <Badge
                variant="outline"
                className="w-11 h-11 rounded-full text-sm font-bold border-2 border-border"
              >
                {type}
              </Badge>
              <span className="text-[10px] text-muted-foreground">—</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};

const SafetyTip = () => (
  <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
    <div className="flex items-center gap-3 mb-2">
      <ShieldCheck size={22} />
      <h3 className="font-bold">Tip of the day</h3>
    </div>
    <p className="text-blue-50 text-sm leading-relaxed">
      Drink at least 8 glasses of water per day. Good hydration supports kidney function, skin, and cardiovascular health.
    </p>
  </Card>
);
