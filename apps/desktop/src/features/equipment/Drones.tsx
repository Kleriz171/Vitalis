import { CheckCircle, Warning, AirplaneLanding, AirplaneTakeoff, AirplaneTilt, ArrowClockwise, ArrowCounterClockwise, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BatteryHigh, BatteryLow, Drone, FilmStrip, GameController, Octagon, PaperPlaneRight, VideoCamera } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { socket } from '../../realtime/socket';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { KPI } from '../../components/widgets/KPI';
import { Chip, Panel, Row } from '../../components/ui/list';
import { PageHeader } from '../../components/layout/CommandShell';
import { pushToast } from '../../components/toast/toast';
import { timeAgo } from '../../lib/format';
import { cn } from '../../lib/utils';
import { COMPASS, bearingDeg, compassPoint, distanceM, formatCoords, parseCoords } from '../../lib/geo';
import { TYPE_LABEL } from '../../components/map/MapView';
import { CaptureBar, MediaPanel, RecordingBadge, useDroneMedia, type Media } from './DroneMedia';

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
  /** Only from drones that can switch cameras: 1 front, 2 the second (looks down on most). */
  camera?: 1 | 2;
  at?: number;
}
interface DroneInfo { driver: 'tello' | 'turbodrone'; model: string; routes: boolean; timed?: boolean }
interface FleetEntry { droneId: string; online: boolean; info?: DroneInfo; telemetry: Telemetry | null }
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
interface ActiveEmergency { _id: string; type: string; status: string; createdAt: string; location?: { coordinates: [number, number] } }
type Command = 'takeoff' | 'land' | 'emergency' | 'abort' | 'camera_front' | 'camera_down';
const CAMERAS = [['camera_front', 1, 'Front'], ['camera_down', 2, 'Down']] as const;

const MISSION_LABEL: Record<Mission['status'], string> = {
  queued: 'Queued', launched: 'Taking off', in_flight: 'In flight', delivered: 'Completed', aborted: 'Aborted',
};
const MODE_LABEL: Record<string, string> = { idle: 'On the ground', mission: 'Flying a route', manual: 'Flying by hand', landing: 'Landing' };
const LOG_PREVIEW = 8;
// Same caps as the API: about a Tello's Wi-Fi range; toy drones fly by time, so less.
const MAX_ROUTE_M = { tello: 100, turbodrone: 50 };

/** A route step in words: "cw 47" → "Turn right 47°", "forward 255" → "Forward 2.55 m". */
const stepLabel = (step: string) => {
  const [dir, n] = step.split(' ');
  const v = Number(n);
  if (dir === 'cw' || dir === 'ccw') return `Turn ${dir === 'cw' ? 'right' : 'left'} ${v}°`;
  if (dir === 'up' || dir === 'down') return `${dir === 'up' ? 'Climb' : 'Descend'} ${v / 100} m`;
  return `${dir[0].toUpperCase()}${dir.slice(1)} ${v / 100} m`;
};

// Where each drone takes off and which way it faces, kept on this computer between flights.
// ponytail: per computer; move it to the API if several consoles dispatch the same drone.
const HOME_KEY = (droneId: string) => `vitalis.drone-home.${droneId}`;
const loadHome = (droneId: string): { text: string; heading: number } | null => {
  try { return JSON.parse(localStorage.getItem(HOME_KEY(droneId)) ?? 'null'); } catch { return null; }
};

const droneLabel = (info?: DroneInfo) => (info?.driver === 'turbodrone' ? `Wi-Fi toy drone · ${info.model}` : 'DJI Tello');
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** One word for the drone's state, and the colour of its dot. */
const status = (t: Telemetry) => {
  if (!t.at || Date.now() - t.at > 3000) return { text: 'Waiting for the bridge', dot: 'bg-amber-400' };
  if (!t.linkOk) return { text: 'Can\'t reach the drone', dot: 'bg-red-500' };
  if (t.airborne && t.mode === 'idle') return { text: 'Flying', dot: 'bg-emerald-400' };
  return { text: MODE_LABEL[t.mode ?? 'idle'], dot: 'bg-emerald-400' };
};

// Gamepad, standard layout ("mode 2"): left stick height and turn, right stick moves.
const PAD_DEADZONE = 0.15;
const readPad = () => {
  const pad = [...(navigator.getGamepads?.() ?? [])].find(g => g?.connected);
  if (!pad) return null;
  const axis = (i: number) => { const v = pad.axes[i] ?? 0; return Math.abs(v) < PAD_DEADZONE ? 0 : v; };
  return { lr: axis(2), fb: -axis(3), ud: -axis(1), yaw: axis(0) };
};

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllFlights, setShowAllFlights] = useState(false);
  const media = useDroneMedia();
  // Opened from a call ("Drone view"): that call is preselected for footage and routes.
  const callId = useSearchParams()[0].get('call') ?? '';

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

  // One drone on screen at a time, so the keyboard can only ever fly the one you're looking at.
  const selected = fleet?.find(d => d.droneId === selectedId) ?? fleet?.[0];
  const airborne = fleet?.filter(d => d.telemetry?.airborne).length ?? 0;
  const saved = media.filter(m => m.status === 'ready').length;
  const flights = showAllFlights ? missions : missions.slice(0, LOG_PREVIEW);

  return (
    <>
      <PageHeader icon={Drone} title="Drones" subtitle="Drones that fly a defibrillator to a call or show the scene from above. Fly one by hand here if needed." />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4 stagger">
          <KPI icon={Drone} iconTone="deep" label="Drones online" value={fleet?.length ?? 0} />
          <KPI icon={AirplaneTilt} iconTone={airborne ? 'teal' : 'mint'} label="In the air" value={airborne} />
          <KPI icon={FilmStrip} iconTone="mint" label="Photos and videos, last 30 days" value={saved} />
        </div>

        {fleet === null ? (
          <Skeleton className="h-[520px] rounded-2xl" />
        ) : !selected ? (
          <SetupGuide />
        ) : (
          <>
            {fleet.length > 1 && <FleetStrip fleet={fleet} selected={selected.droneId} onSelect={setSelectedId} />}
            <FlightDeck
              key={selected.droneId}
              drone={selected}
              routes={routes}
              emergencies={emergencies}
              callId={callId}
              mission={missions.find(m => m.droneId === selected.droneId && ['queued', 'launched', 'in_flight'].includes(m.status))}
              recording={media.find(m => m.droneId === selected.droneId && m.kind === 'video' && m.status === 'recording')}
            />
          </>
        )}

        <MediaPanel media={media} />

        <Panel
          title="Flight log"
          aside={missions.length > LOG_PREVIEW && (
            <Button size="sm" variant="ghost" onClick={() => setShowAllFlights(v => !v)}>
              {showAllFlights ? 'Show fewer' : `Show all ${missions.length}`}
            </Button>
          )}
        >
          {missions.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">No routes flown yet.</p>}
          {flights.map(m => (
            <Row
              key={m._id}
              icon={m.status === 'aborted' ? Warning : m.status === 'delivered' ? CheckCircle : Drone}
              tone={m.status === 'aborted' ? 'sos' : m.status === 'delivered' ? 'teal' : 'mint'}
              title={`${m.routeName ?? 'Manual flight'}${m.emergency ? ' · for an SOS' : ''}`}
              summary={`${MISSION_LABEL[m.status]}${m.abortReason ? `: ${m.abortReason}` : ''}`}
              right={<><Chip>{m.droneId}</Chip><span className="num text-[13px] text-muted-foreground w-20 text-right">{timeAgo(m.createdAt)}</span></>}
            />
          ))}
        </Panel>
      </div>
    </>
  );
};

const FleetStrip = ({ fleet, selected, onSelect }: { fleet: FleetEntry[]; selected: string; onSelect: (id: string) => void }) => (
  <div role="tablist" aria-label="Drones" className="flex flex-wrap gap-2">
    {fleet.map(d => {
      const t = d.telemetry ?? {};
      const s = status(t);
      const active = d.droneId === selected;
      return (
        <button
          key={d.droneId}
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(d.droneId)}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors',
            active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/60',
          )}
        >
          <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} aria-hidden />
          <span className="leading-tight">
            <span className="block font-bold">{d.droneId}</span>
            <span className={cn('block text-[12px]', active ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
              {s.text}{t.battery != null ? ` · ${t.battery}%` : ''}
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

const SetupGuide = () => (
  <Panel title="No drone connected">
    <div className="px-5 py-4 space-y-3 text-sm">
      <p className="text-muted-foreground">A drone appears here as soon as its bridge is running. On the bridge laptop:</p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Switch the drone on and join its Wi-Fi (<code>TELLO-XXXXXX</code> for a Tello; a toy drone uses the network its phone app joins).</li>
        <li>Keep the laptop online through a second link (USB Wi-Fi adapter, Ethernet or a phone over USB), unless the API runs on that laptop too.</li>
        <li>Run <code className="rounded bg-muted px-1.5 py-0.5">DRONE_BRIDGE_KEY=… API_URL=… npm start -w @vitalis/drone</code>, adding <code className="rounded bg-muted px-1.5 py-0.5">DRONE_TYPE=cooingdv</code> (or another family) for a toy drone.</li>
        <li>No drone to hand? <code className="rounded bg-muted px-1.5 py-0.5">npm run sim -w @vitalis/drone</code> flies a simulated Tello with a test camera.</li>
      </ol>
    </div>
  </Panel>
);

const FlightDeck = ({ drone, routes, emergencies, callId, mission, recording }: { drone: FleetEntry; routes: Route[]; emergencies: ActiveEmergency[]; callId: string; mission?: Mission; recording?: Media }) => {
  const t = drone.telemetry ?? {};
  const toy = drone.info?.driver === 'turbodrone';
  const s = status(t);
  const live = !!t.at && Date.now() - t.at <= 3000;
  const battery = t.battery;
  const lowBattery = battery != null && battery > 0 && battery < 30;

  const command = useCallback((action: Command) =>
    new Promise<void>(resolve => {
      socket.emit('drone:command', { droneId: drone.droneId, action }, (r: { ok: boolean; error?: string }) => {
        if (!r?.ok) pushToast({ tone: 'error', title: 'Command failed', body: r?.error });
        resolve();
      });
    }), [drone.droneId]);

  // Only what this drone measures; a toy drone reports none of these.
  const readings = [
    ['Height', t.heightCm != null ? `${(t.heightCm / 100).toFixed(1)} m` : null],
    ['Speed', t.speedCms != null ? `${(t.speedCms / 100).toFixed(1)} m/s` : null],
    ['Temperature', t.tempC != null ? `${t.tempC} °C` : null],
  ].filter((r): r is [string, string] => r[1] !== null);

  return (
    <div className="grid xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)] gap-4 items-start">
      <Card className="py-0 gap-0 overflow-hidden">
        <div className="flex items-baseline gap-3 px-5 h-14 border-b border-border min-w-0">
          <h2 className="self-center text-[16px] font-extrabold truncate">{drone.droneId}</h2>
          <span className="self-center text-[13px] text-muted-foreground truncate">{droneLabel(drone.info)}</span>
        </div>

        <div className="relative aspect-video bg-[hsl(193_47%_10%)] grid place-items-center text-white/75">
          {t.videoUrl && t.linkOk ? (
            <>
              {/* The first frame covers this; toy drones take a few seconds to start their picture. */}
              <p className="absolute text-sm">Waiting for the camera picture…</p>
              <img src={t.videoUrl} alt={`Live camera from ${drone.droneId}`} className="relative w-full h-full object-contain" />
              <span className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden>
                <span className="relative w-7 h-7">
                  <span className="absolute left-1/2 top-0 bottom-0 w-px bg-white/45" />
                  <span className="absolute top-1/2 left-0 right-0 h-px bg-white/45" />
                </span>
              </span>
            </>
          ) : (
            <div className="text-center px-6 max-w-[42ch]">
              <VideoCamera className="mx-auto mb-2" size={30} aria-hidden />
              <p className="text-sm">
                {!live ? 'The bridge has stopped sending updates. Is it still running?'
                  : !t.linkOk ? 'The bridge can\'t reach the drone. Switch it on and join its Wi-Fi from the bridge laptop.'
                    : 'No camera picture. For a Tello, install ffmpeg on the bridge laptop.'}
              </p>
            </div>
          )}

          <div className="absolute top-3 left-3 flex items-center gap-2">
            <Hud><span className={cn('w-2 h-2 rounded-full', s.dot)} aria-hidden />{s.text}</Hud>
            {recording && <RecordingBadge recording={recording} />}
          </div>
          {battery != null && (
            <Hud className={cn('absolute top-3 right-3', lowBattery && 'bg-red-600/90')}>
              {lowBattery ? <BatteryLow size={15} weight="fill" /> : <BatteryHigh size={15} weight="fill" />}{battery}%
            </Hud>
          )}
          {(t.airborne || !!t.flightTimeS) && (
            <Hud className="absolute bottom-3 left-3">Flight time <span className="tabular-nums">{clock(t.flightTimeS ?? 0)}</span></Hud>
          )}
          {t.camera && live && t.linkOk && (
            <div role="group" aria-label="Camera" className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-md bg-[hsl(176_60%_6%/0.72)] p-0.5 text-xs font-semibold text-white">
              <VideoCamera size={15} className="mx-1.5" aria-hidden />
              {CAMERAS.map(([action, index, label]) => (
                <button
                  key={action}
                  type="button"
                  aria-pressed={t.camera === index}
                  onClick={() => void command(action)}
                  className={cn('rounded px-2.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white', t.camera === index ? 'bg-white text-[hsl(176_60%_10%)]' : 'hover:bg-white/15')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <CaptureBar droneId={drone.droneId} ready={!!t.videoUrl && !!t.linkOk} recording={recording} emergencies={emergencies} initialCall={callId} />

        {readings.length > 0 && (
          <dl className="grid divide-x divide-border border-t border-border text-sm" style={{ gridTemplateColumns: `repeat(${readings.length}, minmax(0, 1fr))` }}>
            {readings.map(([k, v]) => (
              <div key={k} className="px-5 py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <div className="space-y-4">
        {drone.info?.routes === false ? <HandFlownNote /> : (
          <DispatchCard drone={drone} routes={routes} emergencies={emergencies} initialCall={callId} mission={mission} lowBattery={lowBattery} onAbort={() => command('abort')} />
        )}
        <ControlsCard drone={drone} toy={toy} lowBattery={lowBattery} live={live} command={command} />
      </div>
    </div>
  );
};

// Facts laid over the live picture. Solid, not blurred: a filter over live video costs every frame.
const Hud = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-md bg-[hsl(176_60%_6%/0.72)] px-2 py-1 text-xs font-semibold text-white', className)}>{children}</span>
);

const HandFlownNote = () => (
  <Card className="p-5 gap-2">
    <h3 className="font-bold">Flown by hand</h3>
    <p className="text-sm text-muted-foreground">
      This drone&apos;s bridge can&apos;t send it to a point yet. Update the bridge and start it again.
    </p>
  </Card>
);

const DispatchCard = ({ drone, routes, emergencies, initialCall, mission, lowBattery, onAbort }: { drone: FleetEntry; routes: Route[]; emergencies: ActiveEmergency[]; initialCall: string; mission?: Mission; lowBattery: boolean; onAbort: () => void }) => {
  const t = drone.telemetry ?? {};
  const [tab, setTab] = useState<'point' | 'route'>('point');
  const [emergencyId, setEmergencyId] = useState(initialCall);
  const [targetText, setTargetText] = useState('');
  const [homeText, setHomeText] = useState(() => loadHome(drone.droneId)?.text ?? '');
  const [heading, setHeading] = useState(() => loadHome(drone.droneId)?.heading ?? 0);
  const [routeId, setRouteId] = useState('');
  const [busy, setBusy] = useState(false);
  const callCoords = (id: string) => emergencies.find(e => e._id === id)?.location?.coordinates;
  useEffect(() => { if (!routeId && routes[0]) setRouteId(routes[0].id); }, [routes, routeId]);
  // Opened from a call: its location becomes the target once the calls have loaded.
  useEffect(() => {
    const c = callCoords(initialCall);
    if (c) setTargetText(prev => prev || formatCoords(c));
  }, [emergencies, initialCall]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { localStorage.setItem(HOME_KEY(drone.droneId), JSON.stringify({ text: homeText, heading })); } catch { /* private window */ }
  }, [drone.droneId, homeText, heading]);

  const target = parseCoords(targetText);
  const home = parseCoords(homeText);
  const max = MAX_ROUTE_M[drone.info?.driver ?? 'tello'];
  const metres = target && home ? Math.round(distanceM(home, target)) : null;
  const bearing = target && home ? Math.round(bearingDeg(home, target)) % 360 : 0;
  const turn = Math.round(((((bearing - heading) % 360) + 540) % 360) - 180);
  const canFly = !!t.linkOk && !t.airborne && !lowBattery;

  const send = async (body: object, title: string) => {
    setBusy(true);
    try {
      await api.post(`/drones/${drone.droneId}/dispatch`, { ...body, ...(emergencyId ? { emergencyId } : {}) });
      pushToast({ tone: 'success', title: 'Drone dispatched', body: title });
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Dispatch failed', body: err?.response?.data?.error ?? 'Try again' });
    } finally {
      setBusy(false);
    }
  };

  if (mission) {
    const steps = ['Take off', ...(mission.steps ?? []).map(stepLabel), 'Land'];
    const cur = mission.currentStep ?? -1;
    return (
      <Card className="p-5 gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">{mission.routeName}</h3>
          <Chip tone="teal">{MISSION_LABEL[mission.status]}</Chip>
        </div>
        <ol className="space-y-1.5 text-sm">
          {steps.map((step, i) => {
            const idx = i - 1; // -1 is take-off
            const started = mission.status !== 'queued';
            const done = started && (idx < cur || (idx === -1 && cur >= 0));
            const now = started && idx === cur;
            return (
              <li key={i} className={cn('flex items-center gap-2.5', done ? 'text-muted-foreground line-through' : now ? 'font-semibold' : 'text-muted-foreground')}>
                <span className={cn('w-2 h-2 rounded-full', now ? 'bg-primary' : done ? 'bg-primary/40' : 'bg-border')} />{step}
              </li>
            );
          })}
        </ol>
        <Button variant="outline" onClick={onAbort}>Stop route and land</Button>
      </Card>
    );
  }

  const id = drone.droneId;
  const calls = emergencies.filter(e => e.location?.coordinates);
  return (
    <Card className="p-5 gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">Send the drone</h3>
        <div role="tablist" aria-label="How to send it" className="flex rounded-lg bg-muted p-0.5 text-[13px]">
          {([['point', 'To a location'], ['route', 'Practice route']] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md px-2.5 py-1 transition-colors', tab === k ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
          ))}
        </div>
      </div>

      {tab === 'point' ? (
        <>
          <label className="text-sm font-medium" htmlFor={`to-${id}`}>Where to</label>
          <input id={`to-${id}`} value={targetText} onChange={e => setTargetText(e.target.value)} placeholder="Paste coordinates, e.g. 41.32750, 19.81870" className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm" />
          <select aria-label="Use a call's location" value={emergencyId} onChange={e => { setEmergencyId(e.target.value); const c = callCoords(e.target.value); if (c) setTargetText(formatCoords(c)); }} className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm">
            <option value="">{calls.length ? 'Or use a call\'s location' : 'No live calls with a location'}</option>
            {calls.map(e => <option key={e._id} value={e._id}>{TYPE_LABEL[e.type] ?? 'Emergency'} · {timeAgo(e.createdAt)} · {formatCoords(e.location!.coordinates)}</option>)}
          </select>
          {targetText && !target && <p className="text-sm text-red-700">Can&apos;t read those coordinates. Paste them as 41.32750, 19.81870.</p>}

          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2 items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor={`home-${id}`}>Take-off point</label>
              <input id={`home-${id}`} value={homeText} onChange={e => setHomeText(e.target.value)} placeholder="Where the drone sits now" className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor={`nose-${id}`}>Nose to</label>
              <select id={`nose-${id}`} value={heading} onChange={e => setHeading(+e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm">
                {COMPASS.map((c, i) => <option key={c} value={i * 45}>{c}</option>)}
              </select>
            </div>
          </div>
          {homeText && !home && <p className="text-sm text-red-700">Can&apos;t read the take-off point. Paste it as 41.32750, 19.81870.</p>}

          {metres != null && (metres > max ? (
            <p className="text-sm text-red-700">That&apos;s {metres} m away. This drone flies at most {max} m from where it takes off.</p>
          ) : metres < 1 ? (
            <p className="text-sm text-red-700">That&apos;s where the drone already is.</p>
          ) : (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="font-semibold num">{metres} m {compassPoint(bearing)}</span> <span className="text-muted-foreground num">({bearing}°)</span>.{' '}
              Climbs 1 m, {turn > 0 ? `turns right ${turn}°` : turn < 0 ? `turns left ${-turn}°` : 'keeps its heading'}, flies straight there and lands.
            </p>
          ))}
          <p className="text-xs text-muted-foreground">
            {drone.info?.timed
              ? 'No GPS: it flies there by time, at the speed measured for it on the bridge, so it can land metres off. Keep it in sight.'
              : 'No GPS: it flies there as measured moves from the take-off point. Clear the area first.'}
            {' '}Before take-off, set where it sits and which way its nose points.
          </p>
          <Button onClick={() => send({ target, home, heading }, `${metres} m ${compassPoint(bearing)}`)} disabled={busy || !canFly || metres == null || metres < 1 || metres > max}>
            <PaperPlaneRight size={16} /> Send drone
          </Button>
        </>
      ) : (
        <>
          <label className="text-sm font-medium" htmlFor={`route-${id}`}>Route</label>
          <select id={`route-${id}`} value={routeId} onChange={e => setRouteId(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm">
            {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <label className="text-sm font-medium" htmlFor={`sos-${id}`}>For an SOS call (optional)</label>
          <select id={`sos-${id}`} value={emergencyId} onChange={e => setEmergencyId(e.target.value)} className="h-10 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm">
            <option value="">Not linked to a call</option>
            {emergencies.map(e => <option key={e._id} value={e._id}>{TYPE_LABEL[e.type] ?? 'Emergency'} · {timeAgo(e.createdAt)}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Short fixed routes for practice and demos. Clear the area first.</p>
          <Button onClick={() => send({ routeId }, routes.find(r => r.id === routeId)?.name ?? '')} disabled={busy || !routeId || !canFly}>
            <PaperPlaneRight size={16} /> Dispatch
          </Button>
        </>
      )}
      {lowBattery && <p className="text-sm text-red-700">Battery below 30%. Charge before flying.</p>}
    </Card>
  );
};

const ControlsCard = ({ drone, toy, lowBattery, live, command }: { drone: FleetEntry; toy: boolean; lowBattery: boolean; live: boolean; command: (a: Command) => Promise<void> }) => {
  const t = drone.telemetry ?? {};
  const [manual, setManual] = useState(false);
  const [speed, setSpeed] = useState(40);
  const [confirmStop, setConfirmStop] = useState(false);
  const [padName, setPadName] = useState<string | null>(null);
  const held = useRef(new Set<string>());
  const [pressed, setPressed] = useState<string[]>([]); // what's held, for the pads to light up
  const sync = () => setPressed([...held.current]);

  // The browser only reveals a gamepad after its first button press or stick move.
  useEffect(() => {
    const update = () => setPadName([...(navigator.getGamepads?.() ?? [])].find(g => g?.connected)?.id ?? null);
    update();
    window.addEventListener('gamepadconnected', update);
    window.addEventListener('gamepaddisconnected', update);
    return () => {
      window.removeEventListener('gamepadconnected', update);
      window.removeEventListener('gamepaddisconnected', update);
    };
  }, []);

  // Manual flight: stick values stream at 10 Hz while keys/buttons are held or a
  // gamepad stick is off-centre. Releasing everything (or leaving the window) sends zeros;
  // the bridge also hovers on its own if input stops for 400 ms.
  const axes = useCallback(() => {
    const out = { lr: 0, fb: 0, ud: 0, yaw: 0 };
    held.current.forEach(k => Object.entries(KEYS[k] ?? {}).forEach(([axis, v]) => { out[axis as keyof typeof out] += (v ?? 0) * speed; }));
    const pad = readPad();
    if (pad) (Object.keys(out) as (keyof typeof out)[]).forEach(a => { out[a] += pad[a] * speed; });
    (Object.keys(out) as (keyof typeof out)[]).forEach(a => { out[a] = Math.max(-100, Math.min(100, Math.round(out[a]))); });
    return out;
  }, [speed]);
  const send = useCallback(() => socket.volatile.emit('drone:rc', { droneId: drone.droneId, ...axes() }), [drone.droneId, axes]);

  useEffect(() => {
    if (!manual) return;
    let padMoving = false;
    const timer = setInterval(() => {
      const pad = readPad();
      const moving = !!pad && Object.values(pad).some(v => v !== 0);
      if (held.current.size || moving || padMoving) send(); // one last zero when the sticks return
      padMoving = moving;
    }, 100);
    const typing = (e: KeyboardEvent) => ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (typing(e) || !KEYS[k]) return;
      e.preventDefault();
      if (held.current.has(k)) return; // key repeat
      held.current.add(k);
      sync();
      send();
    };
    const up = (e: KeyboardEvent) => {
      if (!held.current.delete(e.key.toLowerCase())) return;
      sync();
      send();
    };
    const release = () => { held.current.clear(); sync(); send(); };
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
  }, [manual, send]);

  const hold = (k: string) => {
    const off = () => { held.current.delete(k); sync(); send(); };
    return {
      onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); held.current.add(k); sync(); send(); },
      onPointerUp: off,
      onPointerCancel: off,
    };
  };

  return (
    <Card className="p-5 gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold">Flight controls</h3>
        <Button size="sm" variant={manual ? 'default' : 'outline'} onClick={() => setManual(v => !v)} aria-pressed={manual}>
          <GameController size={16} /> {manual ? 'Controls armed' : 'Arm controls'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant={t.airborne ? 'outline' : 'default'} disabled={!t.linkOk || !!t.airborne || lowBattery} onClick={() => command('takeoff')}>
          <AirplaneTakeoff size={16} /> Take off
        </Button>
        <Button variant={t.airborne ? 'default' : 'outline'} disabled={!t.airborne} onClick={() => command('land')}>
          <AirplaneLanding size={16} /> Land
        </Button>
      </div>
      {toy && <p className="text-xs text-muted-foreground">No battery reading. If it sets itself down, don&apos;t press Land: on some models that button takes off.</p>}

      {manual ? (
        <div className="space-y-3">
          <div className="flex gap-8 justify-center py-1 select-none touch-none">
            <Pad label="Height and turn" pressed={pressed} hold={hold} keys={[['arrowup', <ArrowUp key="u" size={18} />, 'Up'], ['arrowleft', <ArrowCounterClockwise key="l" size={18} />, 'Turn left'], ['arrowright', <ArrowClockwise key="r" size={18} />, 'Turn right'], ['arrowdown', <ArrowDown key="d" size={18} />, 'Down']]} />
            <Pad label="Move" pressed={pressed} hold={hold} keys={[['w', <ArrowUp key="f" size={18} />, 'Forward'], ['a', <ArrowLeft key="l" size={18} />, 'Left'], ['d', <ArrowRight key="r" size={18} />, 'Right'], ['s', <ArrowDown key="b" size={18} />, 'Back']]} />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            W A S D to move, arrow keys for height and turning. Let go to hover.
            <br />
            {padName ? 'Gamepad: left stick for height and turning, right stick to move.' : 'Gamepad: press any button on it to connect.'}
          </p>
          {padName && <p className="text-center"><Chip tone="teal">Gamepad connected</Chip></p>}
          <label className="flex items-center gap-3 text-sm">
            Speed
            <input type="range" min={20} max={80} step={10} value={speed} onChange={e => setSpeed(+e.target.value)} className="flex-1 accent-[hsl(var(--primary))]" />
            <span className="tabular-nums w-8 text-right">{speed}</span>
          </label>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Arm the controls to steer with the keyboard or a gamepad, or to take over from a route.</p>
      )}

      <div className="pt-4 border-t border-border">
        {confirmStop ? (
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" onClick={() => { void command('emergency'); setConfirmStop(false); }}>
              Cut motors now
            </Button>
            <Button variant="outline" onClick={() => setConfirmStop(false)}>Cancel</Button>
          </div>
        ) : (
          // Always there while the drone answers: the console may not know it's flying (after a bridge restart, say).
          <Button variant="outline" className="w-full text-red-700 border-red-500/30 hover:bg-red-500/10" disabled={!live || !t.linkOk} onClick={() => setConfirmStop(true)}>
            <Octagon size={16} /> Emergency stop
          </Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Emergency stop cuts the motors and the drone drops. Use Land unless it&apos;s about to hit someone.</p>
      </div>
    </Card>
  );
};

const Pad = ({ label, keys, hold, pressed }: { label: string; keys: [string, React.ReactNode, string][]; hold: (k: string) => Record<string, unknown>; pressed: string[] }) => (
  <div className="text-center">
    <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[132px]" role="group" aria-label={label}>
      {keys.map(([k, icon, name], i) => (
        <button
          key={k}
          type="button"
          aria-label={name}
          aria-pressed={pressed.includes(k)}
          {...hold(k)}
          className={cn(
            'w-10 h-10 rounded-md border grid place-items-center transition-colors',
            pressed.includes(k) ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card hover:bg-muted/60',
            ['col-start-2 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-2 row-start-3'][i],
          )}
        >
          {icon}
        </button>
      ))}
    </div>
    <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
  </div>
);
