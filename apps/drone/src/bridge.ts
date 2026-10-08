/**
 * Vitalis drone bridge: runs on the laptop (or Raspberry Pi) that is joined to the
 * Tello's Wi-Fi, and stays online to the Vitalis API over a second connection
 * (USB Wi-Fi dongle, Ethernet or USB tethering).
 *
 *   API_URL=http://<api-host>:4000 DRONE_BRIDGE_KEY=... npm start -w @vitalis/drone
 *   npm run sim -w @vitalis/drone          # simulated Tello, no hardware needed
 *
 * Safety rules enforced here, independent of the console:
 *   - no takeoff below MIN_BATTERY
 *   - lose the server link while flying → land
 *   - lose the drone's state stream while flying a mission → abort
 *   - manual sticks are a dead-man switch: no input for RC_DEADMAN_MS → hover
 *   - hovering with no operator input for IDLE_LAND_MS → land
 */
import http from 'node:http';
import { spawn, ChildProcess } from 'node:child_process';
import { io } from 'socket.io-client';
import { Tello } from './tello';
import { startSimulator } from './sim';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const KEY = process.env.DRONE_BRIDGE_KEY ?? '';
const DRONE_ID = process.env.DRONE_ID ?? 'tello-1';
const SIM = process.env.SIM === '1';
const TELLO_HOST = process.env.TELLO_HOST ?? (SIM ? '127.0.0.1' : '192.168.10.1');
const VIDEO_PORT = Number(process.env.VIDEO_PORT ?? 8090);

// Calibration knobs: real batteries sag and real links drop. Tune on the field.
const MIN_BATTERY = Number(process.env.MIN_BATTERY ?? 30);
const RC_DEADMAN_MS = 400;
const IDLE_LAND_MS = Number(process.env.IDLE_LAND_MS ?? 60_000);
const STATE_STALE_MS = 3_000;

if (!KEY) {
  console.error('DRONE_BRIDGE_KEY is required (same value as the API).');
  process.exit(1);
}

type Mode = 'idle' | 'mission' | 'manual' | 'landing';
let mode: Mode = 'idle';
let airborne = false;
let lastInput = Date.now();
let lastRc = 0;
let rcActive = false;
let lastKeepalive = 0;
let mission: { id: string; abortReason: string | null } | null = null;
let videoUrl: string | undefined;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const stopSim = SIM ? startSimulator() : null;
const tello = new Tello(TELLO_HOST);
const socket = io(`${API_URL}/drones`, { auth: { key: KEY, droneId: DRONE_ID }, reconnectionDelay: 1000 });

const battery = () => tello.state.bat ?? 0;
const linkOk = () => Date.now() - tello.lastStateAt < STATE_STALE_MS;

const progress = (status: string, step?: number, reason?: string) =>
  mission && socket.emit('mission:progress', { missionId: mission.id, status, step, reason });

async function land(reason: string) {
  if (!airborne || mode === 'landing') return;
  log('landing:', reason);
  mode = 'landing';
  if (mission) mission.abortReason ??= reason;
  try {
    await tello.send('land');
  } catch (e) {
    log('land failed, retrying', (e as Error).message);
    await tello.send('land').catch(() => log('LAND FAILED TWICE: take manual control of the drone'));
  }
  airborne = false;
  mode = 'idle';
}

async function takeoff() {
  if (airborne) return;
  if (battery() < MIN_BATTERY) throw new Error(`Battery ${battery()}% is below ${MIN_BATTERY}%`);
  await tello.send('takeoff');
  airborne = true;
  lastInput = Date.now();
}

async function runMission(id: string, steps: string[]) {
  if (mission) return socket.emit('mission:progress', { missionId: id, status: 'aborted', reason: 'Another mission is running' });
  mission = { id, abortReason: null };
  mode = 'mission';
  try {
    if (!linkOk()) throw new Error('No state from the drone. Is the bridge on the Tello Wi-Fi?');
    await takeoff();
    progress('launched', -1);
    for (let i = 0; i < steps.length; i++) {
      if (mission.abortReason) throw new Error(mission.abortReason);
      if (!linkOk()) throw new Error('Lost state stream from drone');
      progress('in_flight', i);
      log(`step ${i + 1}/${steps.length}: ${steps[i]}`);
      await tello.send(steps[i]).catch(() => tello.send(steps[i])); // one retry, then give up
    }
    await tello.send('land');
    airborne = false;
    progress('delivered', steps.length);
    log('mission delivered');
  } catch (e) {
    const reason = (e as Error).message;
    log('mission aborted:', reason);
    progress('aborted', undefined, reason);
    // Operator took the sticks: hover and hand over. Otherwise land where we are.
    if ((mode as Mode) !== 'manual') await land(reason); // mode changes in other handlers while we await
  } finally {
    mission = null;
    if ((mode as Mode) === 'mission') mode = 'idle';
  }
}

socket.on('connect', () => log(`connected to ${API_URL} as ${DRONE_ID}`));
socket.on('connect_error', e => log('api connection failed:', e.message));
socket.on('disconnect', () => {
  log('lost API link');
  if (airborne) void land('Lost connection to Vitalis');
});

socket.on('mission:start', ({ missionId, steps }: { missionId: string; steps: string[] }) => {
  lastInput = Date.now();
  void runMission(missionId, steps);
});

socket.on('command', async ({ action }: { action: string }) => {
  lastInput = Date.now();
  log('command:', action);
  try {
    if (action === 'emergency') {
      // Kills the motors mid-air. The console asks for confirmation before sending this.
      tello.now('emergency');
      if (mission) mission.abortReason ??= 'Emergency stop';
      airborne = false;
      mode = 'idle';
    } else if (action === 'land') {
      await land('Operator');
    } else if (action === 'abort') {
      if (mission) mission.abortReason ??= 'Aborted by operator';
    } else if (action === 'takeoff') {
      mode = 'manual';
      await takeoff();
    }
  } catch (e) {
    log(`${action} failed:`, (e as Error).message);
  }
});

// Manual control: any stick input takes over from the autopilot.
socket.on('rc', ({ lr, fb, ud, yaw }: { lr: number; fb: number; ud: number; yaw: number }) => {
  if (!airborne) return;
  if (mission) mission.abortReason ??= 'Operator took manual control';
  mode = 'manual';
  lastInput = lastRc = Date.now();
  rcActive = lr !== 0 || fb !== 0 || ud !== 0 || yaw !== 0;
  tello.now(`rc ${lr} ${fb} ${ud} ${yaw}`);
});

// Watchdog: dead-man, idle landing, keep-alive (Tello lands itself after 15 s of silence).
setInterval(() => {
  if (!airborne) return;
  const now = Date.now();
  if (rcActive && now - lastRc > RC_DEADMAN_MS) {
    rcActive = false;
    tello.now('rc 0 0 0 0');
  }
  if (mode !== 'mission' && mode !== 'landing' && now - lastInput > IDLE_LAND_MS) {
    void land('No operator input');
    return;
  }
  if (!rcActive && mode === 'manual' && now - lastKeepalive > 2_000) {
    lastKeepalive = now;
    tello.now('rc 0 0 0 0');
  }
  if (battery() > 0 && battery() < 15) void land(`Battery critical (${battery()}%)`);
}, 200);

// Telemetry to the console at 2 Hz.
setInterval(() => {
  const s = tello.state;
  socket.emit('telemetry', {
    battery: s.bat,
    heightCm: s.h,
    tempC: s.templ !== undefined ? Math.round((s.templ + s.temph) / 2) : undefined,
    flightTimeS: s.time,
    speedCms: Math.round(Math.hypot(s.vgx ?? 0, s.vgy ?? 0) * 10),
    airborne,
    mode,
    linkOk: linkOk(),
    videoUrl,
  });
}, 500);

/**
 * Optional live video: Tello streams raw H.264 to :11111. With ffmpeg installed we
 * transcode to MJPEG and serve it at http://<bridge>:VIDEO_PORT/video.mjpg for the console.
 * ponytail: one ffmpeg per bridge, fine for one drone; use WebRTC if many viewers need it.
 */
function startVideo() {
  let ff: ChildProcess;
  try {
    ff = spawn('ffmpeg', ['-loglevel', 'error', '-i', 'udp://0.0.0.0:11111', '-f', 'mjpeg', '-q:v', '6', '-r', '12', 'pipe:1']);
  } catch {
    return log('ffmpeg not found: video disabled (brew install ffmpeg)');
  }
  ff.on('error', () => log('ffmpeg not found: video disabled (brew install ffmpeg)'));
  const clients = new Set<http.ServerResponse>();
  let buf = Buffer.alloc(0);
  ff.stdout?.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    let end;
    while ((end = buf.indexOf(Buffer.from([0xff, 0xd9]))) !== -1) {
      const start = buf.indexOf(Buffer.from([0xff, 0xd8]));
      const frame = start !== -1 && start < end ? buf.subarray(start, end + 2) : null;
      buf = buf.subarray(end + 2);
      if (!frame) continue;
      for (const res of clients) {
        res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`);
        res.write(frame);
        res.write('\r\n');
      }
    }
    if (buf.length > 4_000_000) buf = Buffer.alloc(0);
  });
  http.createServer((req, res) => {
    if (req.url !== '/video.mjpg') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-store' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }).listen(VIDEO_PORT, () => {
    videoUrl = `http://${process.env.VIDEO_HOST ?? 'localhost'}:${VIDEO_PORT}/video.mjpg`;
    log(`video at ${videoUrl}`);
  });
}

async function main() {
  await tello.open();
  // Enter SDK mode; keep trying until the laptop is on the Tello's Wi-Fi.
  for (;;) {
    try {
      await tello.send('command');
      break;
    } catch {
      log(`no answer from Tello at ${TELLO_HOST}. Join its Wi-Fi (TELLO-XXXXXX). Retrying…`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  log(`Tello ready, battery ${await tello.send('battery?').catch(() => '?')}%`);
  if (!SIM) {
    await tello.send('streamon').catch(() => log('streamon failed: video unavailable'));
    startVideo();
  }
}

const shutdown = async () => {
  log('shutting down');
  if (airborne) await land('Bridge stopped');
  socket.close();
  tello.close();
  stopSim?.();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch(e => {
  console.error(e);
  process.exit(1);
});
