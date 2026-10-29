/**
 * End-to-end toy-drone check: API + bridge driving the vendored turbodrone server,
 * which flies a fake CooingDV drone that this script plays on 127.0.0.1:7099.
 *   API:    DRONE_BRIDGE_KEY=k npm run dev -w @vitalis/api
 *   Bridge: DRONE_BRIDGE_KEY=k DRONE_TYPE=cooingdv DRONE_IP=127.0.0.1 TURBODRONE_TOKEN=t \
 *           TURBODRONE_PORT=8765 TOY_TAKEOFF_MS=300 TOY_LAND_MS=300 AXES_DEADMAN_MS=600 npm start -w @vitalis/drone
 *   Check:  TURBODRONE_TOKEN=t TURBODRONE_PORT=8765 npx tsx apps/api/scripts/toy-drone-check.ts
 */
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { io, Socket } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const DRONE = 'cooingdv-1';
const TD = `127.0.0.1:${process.env.TURBODRONE_PORT ?? 8765}`;
const TOKEN = process.env.TURBODRONE_TOKEN ?? '';
const CENTRE = 128;
const HOME = [19.8187, 41.3275];

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const login = async (email: string, password: string) => (await call('POST', '/auth/login', undefined, { email, password })).data.accessToken as string;
const connect = (token: string) => new Promise<Socket>((ok, bad) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => ok(s));
  s.on('connect_error', bad);
});
const until = <T>(s: Socket, event: string, pred: (p: T) => boolean, ms = 20_000) =>
  new Promise<T>((ok, bad) => {
    const t = setTimeout(() => { s.off(event, h); bad(new Error(`timeout waiting for ${event}`)); }, ms);
    const h = (p: T) => { if (pred(p)) { clearTimeout(t); s.off(event, h); ok(p); } };
    s.on(event, h);
  });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (m: string) => console.log(`  ✓ ${m}`);

// The fake drone: answers every packet with a TC telemetry byte (so the link reads as up)
// and keeps the control packets ("03 66 roll pitch throttle yaw flags xor 99").
type Ctl = { pitch: number; flags: number; at: number };
const packets: Ctl[] = [];
const cameraPackets: number[] = []; // "06 01" / "06 02"
const drone = dgram.createSocket('udp4');
drone.on('message', (msg, rinfo) => {
  drone.send(Buffer.from([5]), rinfo.port, rinfo.address);
  if (msg.length === 9 && msg[0] === 0x03 && msg[1] === 0x66 && msg[8] === 0x99) packets.push({ pitch: msg[3], flags: msg[6], at: Date.now() });
  if (msg.length === 2 && msg[0] === 0x06) cameraPackets.push(msg[1]);
});
const packet = async (pred: (p: Ctl) => boolean, what: string, since = Date.now(), ms = 5_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const p = packets.find(x => x.at >= since && pred(x));
    if (p) return p;
    await sleep(20);
  }
  throw new Error(`drone never received ${what}`);
};

const turbodroneSocket = (token: string) => new Promise<WebSocket>((resolve, reject) => {
  const ws = new WebSocket(`ws://${TD}/ws?token=${token}`);
  ws.onopen = () => resolve(ws);
  ws.onclose = () => reject(new Error('closed'));
});

async function main() {
  assert.ok(TOKEN, 'set TURBODRONE_TOKEN to the value the bridge was started with');
  await new Promise<void>(r => drone.bind(7099, '127.0.0.1', r));
  const disp = await login('aleks@vitalis.com', 'AlexNo11$');

  // turbodrone imports OpenCV on start, so give the bridge time to come online.
  let entry: any;
  for (let i = 0; i < 60 && !entry; i++) {
    entry = (await call('GET', '/drones/fleet', disp)).data.find((d: any) => d.droneId === DRONE);
    if (!entry) await sleep(1000);
  }
  assert.ok(entry, `${DRONE} online (start the bridge with DRONE_TYPE=cooingdv)`);
  assert.deepEqual(entry.info, { driver: 'turbodrone', model: 'cooingdv', routes: true, timed: true });
  ok('toy drone online; its routes are flown by time');

  const ds = await connect(disp);
  const tel = await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.linkOk, 15_000);
  assert.equal(tel.battery, undefined);
  assert.equal(tel.heightCm, undefined);
  ok('link reads as up from drone replies; no invented battery or height');

  const tooFar = await call('POST', `/drones/${DRONE}/dispatch`, disp, { target: [19.8187, 41.3281], home: HOME }); // ~67 m
  assert.equal(tooFar.status, 400);
  assert.match(tooFar.data.error, /at most 50 m/);
  ok('a toy drone is never sent more than 50 m');

  // The turbodrone server only answers to the bridge's token.
  assert.equal((await fetch(`http://${TD}/status`)).status, 401);
  assert.equal((await fetch(`http://${TD}/mjpeg?token=wrong`)).status, 401);
  await assert.rejects(turbodroneSocket('wrong'));
  ok('turbodrone rejects requests without the token');

  // Dead-man inside turbodrone, tested from the ground so the bridge stays quiet:
  // a stick that isn't re-sent centres after AXES_DEADMAN_MS…
  const ws = await turbodroneSocket(TOKEN);
  const pushed = Date.now();
  ws.send(JSON.stringify({ type: 'axes', mode: 'abs', throttle: 0, yaw: 0, pitch: 1, roll: 0 }));
  await packet(p => p.pitch === 200, 'full forward', pushed);
  await packet(p => p.pitch === CENTRE, 'centred sticks', pushed + 400);
  // …and centres at once when the steering socket closes.
  ws.send(JSON.stringify({ type: 'axes', mode: 'abs', throttle: 0, yaw: 0, pitch: 1, roll: 0 }));
  await packet(p => p.pitch === 200, 'full forward');
  const closed = Date.now();
  ws.close();
  const centred = await packet(p => p.pitch === CENTRE, 'centred sticks after close', closed);
  assert.ok(centred.at - closed < 450, `centred ${centred.at - closed} ms after close, sooner than the dead-man`);
  ok('sticks centre when input stops and when the controller disconnects');

  // Console path: take off, steer, let go, land.
  const cmd = (action: string) => new Promise<any>(r => ds.emit('drone:command', { droneId: DRONE, action }, r));
  let t0 = Date.now();
  assert.equal((await cmd('takeoff')).ok, true);
  await packet(p => (p.flags & 0x01) !== 0, 'the takeoff flag', t0);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.airborne);
  ok('takeoff reaches the drone');

  t0 = Date.now();
  ds.emit('drone:rc', { droneId: DRONE, lr: 0, fb: 60, ud: 0, yaw: 0 });
  await packet(p => p.pitch > CENTRE + 20, 'forward stick', t0);
  t0 = Date.now();
  await packet(p => p.pitch === CENTRE, 'hover after letting go', t0); // bridge dead-man, 400 ms
  ok('manual sticks reach the drone and centre when the operator lets go');

  t0 = Date.now();
  ds.emit('drone:command', { droneId: DRONE, action: 'land' }, () => {});
  await packet(p => (p.flags & 0x02) !== 0, 'the land flag', t0);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && !t.airborne);
  ok('landing reaches the drone');

  await cmd('takeoff');
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.airborne);
  t0 = Date.now();
  ds.emit('drone:command', { droneId: DRONE, action: 'emergency' }, () => {});
  await packet(p => (p.flags & 0x04) !== 0, 'the motor stop flag', t0);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && !t.airborne);
  ok('emergency stop reaches the drone');

  // Timed route to a point 3 m east with the nose already east: take off, climb, forward, land.
  t0 = Date.now();
  const route = await call('POST', `/drones/${DRONE}/dispatch`, disp, { target: [19.81874, 41.3275], home: HOME, heading: 90 });
  assert.equal(route.status, 201, JSON.stringify(route.data));
  assert.deepEqual(route.data.steps.map((s: string) => s.split(' ')[0]), ['up', 'forward']);
  await packet(p => (p.flags & 0x01) !== 0, 'the takeoff flag', t0);
  await packet(p => p.pitch > CENTRE + 20, 'forward stick on the timed leg', t0, 10_000);
  const flown = await until<any>(ds, 'drone:update', u => u._id === route.data._id && ['delivered', 'aborted'].includes(u.status));
  assert.equal(flown.status, 'delivered', flown.abortReason);
  await packet(p => (p.flags & 0x02) !== 0, 'the land flag', t0);
  ok('timed route to coordinates: takes off, flies forward for its time, lands');

  // The operator grabs the sticks early in a 20 s leg: the timed move stops at once.
  const long = await call('POST', `/drones/${DRONE}/dispatch`, disp, { target: [19.8187, 41.32768], home: HOME, heading: 0 }); // ~20 m north
  assert.equal(long.status, 201, JSON.stringify(long.data));
  await packet(p => p.pitch > CENTRE + 20, 'forward stick on the long leg', Date.now(), 10_000);
  ds.emit('drone:rc', { droneId: DRONE, lr: 60, fb: 0, ud: 0, yaw: 0 });
  const taken = await until<any>(ds, 'drone:update', u => u._id === long.data._id && u.status === 'aborted', 2_000);
  assert.match(taken.abortReason, /manual/i);
  const takenAt = Date.now();
  await sleep(600);
  assert.ok(packets.filter(p => p.at > takenAt + 200).every(p => p.pitch === CENTRE), 'no forward stick after the operator took over');
  ds.emit('drone:command', { droneId: DRONE, action: 'land' }, () => {});
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && !t.airborne);
  ok('operator sticks stop a timed leg at once; the drone hovers until landed');

  // Camera switch: reaches the drone as the apps' "06 02" / "06 01", and the console sees which is on.
  assert.equal((await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE)).camera, 1);
  assert.equal((await cmd('camera_down')).ok, true);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.camera === 2);
  assert.equal((await cmd('camera_front')).ok, true);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.camera === 1);
  assert.deepEqual(cameraPackets, [2, 1]);
  assert.equal((await cmd('camera_sideways')).ok, false);
  const log = (await call('GET', '/blockchain', disp)).data as any[];
  assert.ok(!log.some(b => b.payload?.entity === 'drone' && String(b.payload.action).startsWith('camera')), 'camera switches stay out of the call log');
  ok('camera switch reaches the drone and shows in the console');

  ds.close();
  drone.close();
  console.log('\nAll toy-drone checks passed.');
  process.exit(0);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
