import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Battery, Gamepad2, Octagon, PlaneLanding, PlaneTakeoff, RotateCcw, RotateCw, Send, Video } from 'lucide-react';
import { api } from '../../../api/client';
import { socket } from '../../../realtime/socket';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';
import { timeAgo } from '../../../lib/format';
import { cn } from '../../../lib/utils';
import { TYPE_LABEL } from '../../../components/map/MapView';

interface Telemetry {
  battery?: number;
  heightCm?: number;
  tempC?: number;
  flightTimeS?: number;
  speedCms?: number;
  airborne?: boolean;
  mode?: 'idle' | 'mission' | 'manual' | 'landing';
  linkOk?: boolean;
  videoUrl?: string;
  at?: number;
}
interface FleetEntry { droneId: string; online: boolean; telemetry: Telemetry | null }
interface Route { id: string; name: string; steps: string[] }
interface Mission {
  _id: string;
  droneId: string;
  status: 'queued' | 'launched' | 'in_flight' | 'delivered' | 'aborted';
  routeName?: string;
  steps?: string[];
  currentStep?: number;
  abortReason?: string;
  emergency?: string;
  createdAt: string;
}
interface ActiveEmergency { _id: string; type: string; status: string; createdAt: string }

const MISSION_LABEL: Record<Mission['status'], string> = {
  queued: 'Queued', launched: 'Taking off', in_flight: 'In flight', delivered: 'Completed', aborted: 'Aborted',
};
const MODE_LABEL: Record<string, string> = { idle: 'On the ground', mission: 'Flying a route', manual: 'Manual control', landing: 'Landing' };

// Keyboard map for manual flight. Values are multiplied by the speed setting.
const KEYS: Record<string, Partial<Record<'lr' | 'fb' | 'ud' | 'yaw', number>>> = {
  w: { fb: 1 }, s: { fb: -1 }, a: { lr: -1 }, d: { lr: 1 },
  arrowup: { ud: 1 }, arrowdown: { ud: -1 }, arrowleft: { yaw: -1 }, arrowright: { yaw: 1 },
};

export const Drones = () => {
  const [fleet, setFleet] = useState<FleetEntry[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [emergencies, setEmergencies] = useState<ActiveEmergency[]>([]);

  useEffect(() => {
    api.get('/drones/fleet').then(r => setFleet(r.data)).catch(() => setFleet([]));
    api.get('/drones/routes').then(r => setRoutes(r.data)).catch(() => {});
    api.get('/drones').then(r => setMissions(r.data)).catch(() => {});
    api.get('/emergencies').then(r => setEmergencies(r.data.filter((e: ActiveEmergency) => ['pending', 'assigned', 'en_route', 'on_scene'].includes(e.status)))).catch(() => {});

    const onFleet = (f: FleetEntry[]) => setFleet(prev => f.map(d => ({ ...d, telemetry: d.telemetry ?? prev?.find(p => p.droneId === d.droneId)?.telemetry ?? null })));
    const onTelemetry = ({ droneId, ...t }: Telemetry & { droneId: string }) =>
      setFleet(prev => (prev ?? []).map(d => (d.droneId === droneId ? { ...d, telemetry: t } : d)));
    const onMission = (m: Mission) => setMissions(prev => [m, ...prev.filter(x => x._id !== m._id)].slice(0, 50));
    socket.on('drone:fleet', onFleet);
    socket.on('drone:telemetry', onTelemetry);
    socket.on('drone:mission', onMission);
    socket.on('drone:update', onMission);
    return () => {
      socket.off('drone:fleet', onFleet);
      socket.off('drone:telemetry', onTelemetry);
      socket.off('drone:mission', onMission);
      socket.off('drone:update', onMission);
    };
  }, []);

  return (
    <>
      <PageHeader title="Drones" subtitle="Autonomous dispatch and manual flight for connected drones" />
      <div className="p-6 space-y-6">
        {fleet === null ? (
          <Skeleton className="h-80 rounded-xl" />
        ) : fleet.length === 0 ? (
          <SetupGuide />
        ) : (
          fleet.map(d => (
            <DroneConsole
              key={d.droneId}
              drone={d}
              routes={routes}
              emergencies={emergencies}
              mission={missions.find(m => m.droneId === d.droneId && ['queued', 'launched', 'in_flight'].includes(m.status))}
            />
          ))
        )}

        <Card className="py-0 gap-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold">Mission history</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Drone</th>
                <th className="px-4 py-2 font-medium">Route</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {missions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No missions flown yet.</td></tr>
              )}
              {missions.map(m => (
                <tr key={m._id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium">{m.droneId}</td>
                  <td className="px-4 py-2.5">{m.routeName ?? '—'}{m.emergency ? ' · for an SOS' : ''}</td>
                  <td className={cn('px-4 py-2.5', m.status === 'aborted' && 'text-red-300', m.status === 'delivered' && 'text-emerald-300')}>
                    {MISSION_LABEL[m.status]}{m.abortReason ? `: ${m.abortReason}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{timeAgo(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
};

const SetupGuide = () => (
  <Card className="p-6 gap-4 max-w-2xl">
    <h2 className="text-lg font-semibold">No drone connected</h2>
    <p className="text-muted-foreground">A drone appears here as soon as its bridge is running. For a DJI Tello:</p>
    <ol className="list-decimal pl-5 space-y-2 text-sm">
      <li>Switch the Tello on and join its Wi-Fi (<code>TELLO-XXXXXX</code>) from the bridge laptop.</li>
      <li>Keep the laptop online through a second link: a USB Wi-Fi adapter, Ethernet, or a phone over USB.</li>
      <li>Run <code className="rounded bg-muted px-1.5 py-0.5">DRONE_BRIDGE_KEY=… API_URL=… npm start -w @vitalis/drone</code></li>
      <li>No drone to hand? <code className="rounded bg-muted px-1.5 py-0.5">npm run sim -w @vitalis/drone</code> flies a simulated one.</li>
    </ol>
  </Card>
);

const DroneConsole = ({ drone, routes, emergencies, mission }: { drone: FleetEntry; routes: Route[]; emergencies: ActiveEmergency[]; mission?: Mission }) => {
  const t = drone.telemetry ?? {};
  const [routeId, setRouteId] = useState('');
  const [emergencyId, setEmergencyId] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [speed, setSpeed] = useState(40);
  const [confirmStop, setConfirmStop] = useState(false);
  const held = useRef(new Set<string>());
  const stale = !t.at || Date.now() - t.at > 3000;

  useEffect(() => { if (!routeId && routes[0]) setRouteId(routes[0].id); }, [routes, routeId]);

  const command = useCallback((action: 'takeoff' | 'land' | 'emergency' | 'abort') =>
    new Promise<void>(resolve => {
      socket.emit('drone:command', { droneId: drone.droneId, action }, (r: { ok: boolean; error?: string }) => {
        if (!r?.ok) pushToast({ tone: 'error', title: 'Command failed', body: r?.error });
        resolve();
      });
    }), [drone.droneId]);

  const dispatch = async () => {
    setBusy(true);
    try {
      await api.post(`/drones/${drone.droneId}/dispatch`, { routeId, ...(emergencyId ? { emergencyId } : {}) });
      pushToast({ tone: 'success', title: 'Drone dispatched', body: routes.find(r => r.id === routeId)?.name });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Dispatch failed', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };

  // Manual flight: stick values stream at 10 Hz while keys/buttons are held.
  // Releasing everything (or leaving the tab) sends zeros; the bridge also hovers
  // on its own if input stops for 400 ms.
  const axes = useCallback(() => {
    const out = { lr: 0, fb: 0, ud: 0, yaw: 0 };
    held.current.forEach(k => Object.entries(KEYS[k] ?? {}).forEach(([axis, v]) => { out[axis as keyof typeof out] += (v ?? 0) * speed; }));
    return out;
  }, [speed]);

  useEffect(() => {
    if (!manual) return;
    const send = () => socket.volatile.emit('drone:rc', { droneId: drone.droneId, ...axes() });
    const timer = setInterval(() => { if (held.current.size) send(); }, 100);
    const typing = (e: KeyboardEvent) => ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (typing(e) || !KEYS[k]) return;
      e.preventDefault();
      held.current.add(k);
      send();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!held.current.delete(k)) return;
      send();
    };
    const release = () => { held.current.clear(); send(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      clearInterval(timer);
      release();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, [manual, drone.droneId, axes]);

  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); held.current.add(k); socket.volatile.emit('drone:rc', { droneId: drone.droneId, ...axes() }); },
    onPointerUp: () => { held.current.delete(k); socket.volatile.emit('drone:rc', { droneId: drone.droneId, ...axes() }); },
    onPointerCancel: () => { held.current.delete(k); socket.volatile.emit('drone:rc', { droneId: drone.droneId, ...axes() }); },
  });

  const battery = t.battery ?? 0;
  const lowBattery = battery > 0 && battery < 30;
  const steps = mission?.steps ?? [];

  return (
    <div className="grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
      <Card className="py-0 gap-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cn('w-2.5 h-2.5 rounded-full', stale ? 'bg-amber-500' : t.linkOk ? 'bg-emerald-500' : 'bg-red-600')} aria-hidden />
            <h2 className="font-semibold">{drone.droneId}</h2>
            <span className="text-sm text-muted-foreground">
              {stale ? 'Waiting for telemetry' : t.linkOk ? MODE_LABEL[t.mode ?? 'idle'] : 'Bridge can\'t reach the drone'}
            </span>
          </div>
          <span className={cn('flex items-center gap-1.5 text-sm tabular-nums', lowBattery ? 'text-red-300 font-semibold' : 'text-muted-foreground')}>
            <Battery size={16} /> {t.battery != null ? `${battery}%` : '—'}
          </span>
        </div>

        <div className="aspect-video bg-[hsl(193_47%_10%)] grid place-items-center text-white/70">
          {t.videoUrl ? (
            <img src={t.videoUrl} alt={`Live camera from ${drone.droneId}`} className="w-full h-full object-contain" />
          ) : (
            <div className="text-center px-6">
              <Video className="mx-auto mb-2" size={28} aria-hidden />
              <p className="text-sm">No video. Install ffmpeg on the bridge computer to stream the camera.</p>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-4 divide-x divide-border border-t border-border text-sm">
          {[
            ['Height', t.heightCm != null ? `${(t.heightCm / 100).toFixed(1)} m` : '—'],
            ['Speed', t.speedCms != null ? `${(t.speedCms / 100).toFixed(1)} m/s` : '—'],
            ['Flight time', t.flightTimeS != null ? `${Math.floor(t.flightTimeS / 60)}:${String(t.flightTimeS % 60).padStart(2, '0')}` : '—'],
            ['Temperature', t.tempC != null ? `${t.tempC} °C` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="px-4 py-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="space-y-4">
        <Card className="p-4 gap-3">
          <h3 className="font-semibold">Autonomous dispatch</h3>
          {mission ? (
            <>
              <p className="text-sm">{mission.routeName} · <span className="font-medium">{MISSION_LABEL[mission.status]}</span></p>
              <ol className="space-y-1 text-sm">
                {['takeoff', ...steps, 'land'].map((s, i) => {
                  const idx = i - 1;
                  const cur = mission.currentStep ?? -1;
                  const done = mission.status !== 'queued' && (idx < cur || (idx === -1 && cur >= 0));
                  const now = idx === cur && mission.status !== 'queued';
                  return (
                    <li key={i} className={cn('flex items-center gap-2', done ? 'text-muted-foreground line-through' : now ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', now ? 'bg-primary' : 'bg-border')} />{s}
                    </li>
                  );
                })}
              </ol>
              <Button variant="outline" onClick={() => command('abort')}>Stop route and land</Button>
            </>
          ) : (
            <>
              <label className="text-sm font-medium" htmlFor={`route-${drone.droneId}`}>Route</label>
              <select
                id={`route-${drone.droneId}`}
                value={routeId}
                onChange={e => setRouteId(e.target.value)}
                className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              >
                {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <label className="text-sm font-medium" htmlFor={`sos-${drone.droneId}`}>For SOS call (optional)</label>
              <select
                id={`sos-${drone.droneId}`}
                value={emergencyId}
                onChange={e => setEmergencyId(e.target.value)}
                className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              >
                <option value="">Not linked to a call</option>
                {emergencies.map(e => <option key={e._id} value={e._id}>{TYPE_LABEL[e.type] ?? 'Emergency'} · {timeAgo(e.createdAt)}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                Tello has no GPS: routes are measured moves from the take-off spot. Clear the area first.
              </p>
              <Button onClick={dispatch} disabled={busy || !routeId || !t.linkOk || lowBattery || t.airborne}>
                <Send size={16} /> Dispatch
              </Button>
              {lowBattery && <p className="text-sm text-red-300">Battery below 30%. Charge before flying.</p>}
            </>
          )}
        </Card>

        <Card className="p-4 gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Manual flight</h3>
            <Button size="sm" variant={manual ? 'default' : 'outline'} onClick={() => setManual(v => !v)} aria-pressed={manual}>
              <Gamepad2 size={16} /> {manual ? 'Controls armed' : 'Arm controls'}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!t.linkOk || t.airborne || lowBattery} onClick={() => command('takeoff')}><PlaneTakeoff size={16} /> Take off</Button>
            <Button disabled={!t.airborne} onClick={() => command('land')}><PlaneLanding size={16} /> Land</Button>
          </div>

          {manual && (
            <>
              <div className="flex gap-6 justify-center py-2 select-none touch-none">
                <Pad label="Height and turn" keys={[['arrowup', <ArrowUp key="u" size={18} />, 'Up'], ['arrowleft', <RotateCcw key="l" size={18} />, 'Turn left'], ['arrowright', <RotateCw key="r" size={18} />, 'Turn right'], ['arrowdown', <ArrowDown key="d" size={18} />, 'Down']]} hold={hold} />
                <Pad label="Move" keys={[['w', <ArrowUp key="f" size={18} />, 'Forward'], ['a', <ArrowLeft key="l" size={18} />, 'Left'], ['d', <ArrowRight key="r" size={18} />, 'Right'], ['s', <ArrowDown key="b" size={18} />, 'Back']]} hold={hold} />
              </div>
              <p className="text-xs text-muted-foreground text-center">Keyboard: W A S D to move, arrow keys for height and turning. Let go to hover.</p>
              <label className="flex items-center gap-3 text-sm">
                Speed
                <input type="range" min={20} max={80} step={10} value={speed} onChange={e => setSpeed(+e.target.value)} className="flex-1 accent-[hsl(var(--primary))]" />
                <span className="tabular-nums w-8 text-right">{speed}</span>
              </label>
            </>
          )}

          <div className="pt-3 border-t border-border">
            {confirmStop ? (
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={() => { command('emergency'); setConfirmStop(false); }}>
                  Cut motors now
                </Button>
                <Button variant="outline" onClick={() => setConfirmStop(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full text-red-300 border-red-500/30 hover:bg-red-500/10" disabled={!t.airborne} onClick={() => setConfirmStop(true)}>
                <Octagon size={16} /> Emergency stop
              </Button>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Emergency stop drops the drone. Use Land unless it is about to hit someone.</p>
          </div>
        </Card>
      </div>
    </div>
  );
};

const Pad = ({ label, keys, hold }: { label: string; keys: [string, React.ReactNode, string][]; hold: (k: string) => Record<string, unknown> }) => (
  <div className="text-center">
    <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[132px]" role="group" aria-label={label}>
      {keys.map(([k, icon, name], i) => (
        <button
          key={k}
          type="button"
          aria-label={name}
          {...hold(k)}
          className={cn(
            'w-10 h-10 rounded-md border border-border bg-card grid place-items-center active:bg-primary active:text-primary-foreground transition-colors',
            ['col-start-2 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-2 row-start-3'][i],
          )}
        >
          {icon}
        </button>
      ))}
    </div>
    <div className="mt-1 text-xs text-muted-foreground">{label}</div>
  </div>
);
