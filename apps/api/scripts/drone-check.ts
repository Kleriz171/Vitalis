/**
 * End-to-end drone check: API + bridge in simulator mode.
 *   API:    DRONE_BRIDGE_KEY=k npm run dev -w @vitalis/api
 *   Bridge: DRONE_BRIDGE_KEY=k API_URL=http://localhost:4000 npm run sim -w @vitalis/drone
 *   Check:  API_URL=http://localhost:4000 npx tsx apps/api/scripts/drone-check.ts
 */
import assert from 'node:assert/strict';
import { io, Socket } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const DRONE = process.env.DRONE_ID ?? 'tello-1';

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
const ok = (m: string) => console.log(`  ✓ ${m}`);

async function main() {
  const disp = await login('dispatcher@vitalis.com', 'Dispatch1!');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');

  // Bridges need the shared key.
  const rogue = io(`${BASE}/drones`, { auth: { key: 'wrong', droneId: 'evil' }, transports: ['websocket'], reconnection: false });
  const rejected = await new Promise<string>(r => { rogue.on('connect_error', e => r(e.message)); rogue.on('connect', () => r('connected')); });
  assert.equal(rejected, 'bridge auth failed');
  rogue.close();
  ok('bridge with wrong key rejected');

  assert.equal((await call('GET', '/drones/fleet', citizen)).status, 403);
  const fleet = (await call('GET', '/drones/fleet', disp)).data;
  assert.ok(fleet.some((d: any) => d.droneId === DRONE), `${DRONE} online (start the bridge in sim mode)`);
  ok('fleet visible to operators only');

  const ds = await connect(disp);
  const cs = await connect(citizen);
  const tel = await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.linkOk);
  assert.ok(tel.battery > 30);
  ok(`telemetry streaming (battery ${tel.battery}%)`);

  // Citizens have no drone handlers at all: the ack never fires.
  const citizenAck = await Promise.race([
    new Promise(r => cs.emit('drone:command', { droneId: DRONE, action: 'takeoff' }, r)),
    new Promise(r => setTimeout(() => r('ignored'), 800)),
  ]);
  assert.equal(citizenAck, 'ignored');
  ok('citizen drone commands ignored');

  const bad = await call('POST', `/drones/${DRONE}/dispatch`, disp, { steps: ['forward 9000'] });
  assert.equal(bad.status, 400);
  const inject = await call('POST', `/drones/${DRONE}/dispatch`, disp, { steps: ['forward 100\nemergency'] });
  assert.equal(inject.status, 400);
  ok('invalid and injected mission steps rejected');

  const m = await call('POST', `/drones/${DRONE}/dispatch`, disp, { routeId: 'demo-short' });
  assert.equal(m.status, 201);
  const again = await call('POST', `/drones/${DRONE}/dispatch`, disp, { routeId: 'demo-short' });
  assert.equal(again.status, 409);
  const done = await until<any>(ds, 'drone:update', u => u._id === m.data._id && ['delivered', 'aborted'].includes(u.status));
  assert.equal(done.status, 'delivered', done.abortReason);
  ok('autonomous route flown and delivered; double dispatch blocked');

  // Manual: takeoff, sticks take over, land.
  const ack = await new Promise<any>(r => ds.emit('drone:command', { droneId: DRONE, action: 'takeoff' }, r));
  assert.equal(ack.ok, true);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.airborne);
  ds.emit('drone:rc', { droneId: DRONE, lr: 0, fb: 40, ud: 0, yaw: 0 });
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.mode === 'manual');
  ds.emit('drone:command', { droneId: DRONE, action: 'land' }, () => {});
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && !t.airborne);
  ok('manual takeoff, stick control and landing');

  // Operator takes the sticks mid-mission: autopilot yields and the drone hovers.
  const m2 = await call('POST', `/drones/${DRONE}/dispatch`, disp, { routeId: 'demo-return' });
  await until<any>(ds, 'drone:update', u => u._id === m2.data._id && u.status === 'in_flight');
  ds.emit('drone:rc', { droneId: DRONE, lr: 20, fb: 0, ud: 0, yaw: 0 });
  const taken = await until<any>(ds, 'drone:update', u => u._id === m2.data._id && u.status === 'aborted');
  assert.match(taken.abortReason, /operator/i);
  ds.emit('drone:command', { droneId: DRONE, action: 'land' }, () => {});
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && !t.airborne);
  ok('manual input overrides autopilot, then lands');

  ds.close(); cs.close();
  console.log('\nAll drone checks passed.');
  process.exit(0);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
