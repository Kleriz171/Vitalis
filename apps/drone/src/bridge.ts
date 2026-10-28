/**
 * Vitalis drone bridge: runs on the laptop (or Raspberry Pi) that is joined to the
 * drone's Wi-Fi, and stays online to the Vitalis API over a second connection
 * (USB Wi-Fi dongle, Ethernet or USB tethering).
 *
 *   API_URL=http://<api-host>:4000 DRONE_BRIDGE_KEY=... npm start -w @vitalis/drone
 *   DRONE_TYPE=cooingdv ... npm start -w @vitalis/drone   # a Wi-Fi toy drone (see README)
 *   npm run sim -w @vitalis/drone                          # simulated Tello, no hardware needed
 *
 * Safety rules enforced here, independent of the console:
 *   - no takeoff without a live link to the drone, or below MIN_BATTERY when it reports one
 *   - lose the server link while flying → land
 *   - lose the drone's link while flying a mission → abort
 *   - manual sticks are a dead-man switch: no input for RC_DEADMAN_MS → hover
 *   - hovering with no operator input for IDLE_LAND_MS → land
 *   - drones whose take off and land are one button (drone.oneKey) are only ever landed
 *     by the operator; the automatic cases above centre the sticks instead
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import type { Drone } from './drone';
import { TelloDrone } from './tello';
import { Turbodrone } from './turbodrone';
import { simCamera, startSimulator } from './sim';
import { handleMedia } from './media';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const KEY = process.env.DRONE_BRIDGE_KEY ?? '';
// "tello", or one of the turbodrone families: cooingdv, cooingdv_jieli, s2x, wifi_uav, wifi_cam, x69_lg, debug.
const DRONE_TYPE = (process.env.DRONE_TYPE ?? 'tello').toLowerCase();
const DRONE_ID = process.env.DRONE_ID ?? `${DRONE_TYPE.replace(/_/g, '-')}-1`;
const SIM = process.env.SIM === '1';
const TELLO_HOST = process.env.TELLO_HOST ?? (SIM ? '127.0.0.1' : '192.168.10.1');
const VIDEO_PORT = Number(process.env.VIDEO_PORT ?? 8090);

// Calibration knobs: real batteries sag and real links drop. Tune on the field.
const MIN_BATTERY = Number(process.env.MIN_BATTERY ?? 30);
const RC_DEADMAN_MS = 400;
const IDLE_LAND_MS = Number(process.env.IDLE_LAND_MS ?? 60_000);

if (!KEY) {
  console.error('DRONE_BRIDGE_KEY is required (same value as the API).');
  process.exit(1);
}
if (SIM && DRONE_TYPE !== 'tello') {
  console.error('SIM=1 simulates a Tello. For a toy drone without hardware use DRONE_TYPE=debug (the laptop webcam stands in for the camera).');
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
// ponytail: the last camera asked for, not read back from the drone; a restarted bridge says 1 until the next switch.
let camera: 1 | 2 = 1;

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

// A sleeping laptop is a drone with nobody at the controls: keep this Mac awake while the bridge runs.
// ponytail: macOS only (caffeinate); on Windows set the power plan to never sleep while flying.
if (process.platform === 'darwin') spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }).on('error', () => {}).unref();

const stopSim = SIM ? startSimulator() : null;
const drone: Drone = DRONE_TYPE === 'tello' ? new TelloDrone(TELLO_HOST, !SIM) : new Turbodrone(DRONE_TYPE);
if (SIM) drone.video = simCamera();
// auth is re-read on every reconnect, so the API learns which photos and videos are still on their way.
const socket = io(`${API_URL}/drones`, {
  auth: cb => cb({ key: KEY, droneId: DRONE_ID, info: drone.info, activeMedia: [...media.active] }),
  reconnectionDelay: 1000,
});
const media = handleMedia(socket, {
  apiUrl: API_URL,
  key: KEY,
  droneId: DRONE_ID,
  feed: () => (drone.video && drone.linkOk() ? `http://127.0.0.1:${VIDEO_PORT}/video.mjpg` : undefined),
  log: (...a) => log(...a),
});

const battery = () => drone.readings().battery;

const progress = (status: string, step?: number, reason?: string) =>
  mission && socket.emit('mission:progress', { missionId: mission.id, status, step, reason });

const OPERATOR = 'Operator';

async function land(reason: string) {
  if (!airborne || mode === 'landing') return;
  // We can't see whether a one-key drone already set itself down (flat battery), and
  // "land" would launch it again. Only the operator lands it; until then it hovers.
  if (drone.oneKey && reason !== OPERATOR) {
    log(`not landing automatically (${reason}): take off and land are one button on this drone. Sticks centred.`);
    drone.rc(0, 0, 0, 0);
    lastInput = Date.now();
    return;
  }
  log('landing:', reason);
  mode = 'landing';
  if (mission) mission.abortReason ??= reason;
  try {
    await drone.land();
  } catch (e) {
    log('land failed, retrying', (e as Error).message);
    await drone.land().catch(() => log('LAND FAILED TWICE: take manual control of the drone'));
  }
  airborne = false;
  mode = 'idle';
}

async function takeoff() {
  if (airborne) return;
  if (!drone.linkOk()) throw new Error('No link to the drone. Is the bridge on its Wi-Fi?');
  const b = battery();
  if (b !== undefined && b < MIN_BATTERY) throw new Error(`Battery ${b}% is below ${MIN_BATTERY}%`);
  await drone.takeoff();
  airborne = true;
  lastInput = Date.now();
}

async function runMission(id: string, steps: string[]) {
  if (mission) return socket.emit('mission:progress', { missionId: id, status: 'aborted', reason: 'Another mission is running' });
  if (!drone.info.routes) return socket.emit('mission:progress', { missionId: id, status: 'aborted', reason: 'This drone can only be flown by hand' });
  mission = { id, abortReason: null };
  mode = 'mission';
  try {
    if (!drone.linkOk()) throw new Error('No state from the drone. Is the bridge on its Wi-Fi?');
    await takeoff();
    progress('launched', -1);
    for (let i = 0; i < steps.length; i++) {
      if (mission.abortReason) throw new Error(mission.abortReason);
      if (!drone.linkOk()) throw new Error('Lost state stream from drone');
      progress('in_flight', i);
      log(`step ${i + 1}/${steps.length}: ${steps[i]}`);
      await drone.move(steps[i]).catch(() => drone.move(steps[i])); // one retry, then give up
    }
    await drone.land();
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
socket.on('connect_error', e => {
  log('api connection failed:', e.message);
  // A refusal from the API (wrong key, API restarting) stops socket.io's own retries: keep trying.
  if (!socket.active) setTimeout(() => socket.connect(), 5_000);
});
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
      drone.emergency();
      if (mission) mission.abortReason ??= 'Emergency stop';
      airborne = false;
      mode = 'idle';
    } else if (action === 'land') {
      await land(OPERATOR);
    } else if (action === 'abort') {
      if (mission) mission.abortReason ??= 'Aborted by operator';
    } else if (action === 'takeoff') {
      mode = 'manual';
      await takeoff();
    } else if ((action === 'camera_front' || action === 'camera_down') && drone.camera) {
      const index = action === 'camera_front' ? 1 : 2;
      drone.camera(index);
      camera = index;
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
  drone.rc(lr, fb, ud, yaw);
});

// Watchdog: dead-man, idle landing, keep-alive (Tello lands itself after 15 s of silence).
setInterval(() => {
  if (!airborne) return;
  const now = Date.now();
  if (rcActive && now - lastRc > RC_DEADMAN_MS) {
    rcActive = false;
    drone.rc(0, 0, 0, 0);
  }
  if (mode !== 'mission' && mode !== 'landing' && now - lastInput > IDLE_LAND_MS) {
    void land('No operator input');
    return;
  }
  if (!rcActive && mode === 'manual' && now - lastKeepalive > 2_000) {
    lastKeepalive = now;
    drone.rc(0, 0, 0, 0);
  }
  const b = battery();
  if (b !== undefined && b > 0 && b < 15) void land(`Battery critical (${b}%)`);
}, 200);

// Telemetry to the console at 2 Hz.
setInterval(() => {
  socket.emit('telemetry', {
    ...drone.readings(),
    airborne,
    mode,
    linkOk: drone.linkOk(),
    videoUrl: drone.video ? videoUrl : undefined,
    camera: drone.camera ? camera : undefined,
  });
}, 500);

// Live video for the console at http://<bridge>:VIDEO_PORT/video.mjpg, whichever driver feeds it.
http.createServer((req, res) => {
  if (req.url !== '/video.mjpg' || !drone.video) { res.writeHead(404).end(); return; }
  drone.video(req, res);
}).on('error', e => log(`video server on :${VIDEO_PORT} failed (${e.message}): no video in the console`))
  .listen(VIDEO_PORT, () => {
    videoUrl = `http://${process.env.VIDEO_HOST ?? 'localhost'}:${VIDEO_PORT}/video.mjpg`;
  });

const shutdown = async () => {
  log('shutting down');
  if (airborne) await land('Bridge stopped');
  await media.flush(15_000);
  socket.close();
  drone.close();
  stopSim?.();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown); // its Terminal window was closed
// A stray error must not kill the bridge while a drone is in the air: its rules are the safety net.
process.on('unhandledRejection', e => log('unexpected error, bridge keeps running:', e));

drone.open().catch(e => {
  console.error(e);
  process.exit(1);
});
