/**
 * Defibrillator cabinets end to end: battery readings, the cabinet code (sealed in the database,
 * given only to the runner on the way, every operator view logged), the device out of dispatch
 * until it's back in its cabinet, and what a connected cabinet reports.
 *   API:   AED_DEVICE_KEY=k npm run dev -w @vitalis/api   (seeded test database)
 *   Check: AED_DEVICE_KEY=k MONGO_URI=… npx tsx apps/api/scripts/aed-check.ts
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { io, Socket } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const KEY = process.env.AED_DEVICE_KEY ?? 'ci-aed-key';
const TIRANA: [number, number] = [19.8187, 41.3275];
const CODE = '4821';

const call = async (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, raw: text };
};
const login = async (email: string, password: string) => {
  const r = await call('POST', '/auth/login', undefined, { email, password });
  assert.equal(r.status, 200, `login ${email}`);
  return r.data.accessToken as string;
};
const connect = (token: string) => new Promise<Socket>((ok, bad) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => ok(s));
  s.on('connect_error', bad);
});
const ok = (m: string) => console.log(`  ✓ ${m}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const op = await login('aleks@vitalis.com', 'AlexNo11$');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');
  for (const t of [doctor, nurse]) await call('PATCH', '/biopassport/me', t, { available: true, location: { type: 'Point', coordinates: TIRANA } });

  // Everything operators receive live; the code must never be in any of it.
  const opSock = await connect(op);
  const seen: string[] = [];
  opSock.onAny((event, payload) => seen.push(`${event} ${JSON.stringify(payload)}`));

  // The device dispatch will pick: nearest verified one in service.
  const nearby = (await call('GET', `/aeds?lng=${TIRANA[0]}&lat=${TIRANA[1]}`, op)).data as any[];
  const aed = nearby.find(a => a.verified && a.status === 'ok')!;
  const other = nearby.find(a => a.id !== aed.id)!;

  // Battery and code, set by an operator only.
  assert.equal((await call('PATCH', `/aeds/${aed.id}`, citizen, { cabinetCode: CODE })).status, 403);
  assert.equal((await call('PATCH', `/aeds/${aed.id}`, op, { cabinetCode: '12ab' })).status, 400);
  const set = await call('PATCH', `/aeds/${aed.id}`, op, { cabinetCode: CODE, batteryPercent: 87 });
  assert.equal(set.status, 200, set.raw);
  assert.equal(set.data.hasCode, true);
  assert.equal(set.data.battery.percent, 87);
  assert.equal(set.data.battery.source, 'inspection');
  assert.ok(!set.raw.includes(CODE));
  const list = await call('GET', '/aeds', citizen);
  assert.ok(!list.raw.includes(CODE) && !list.raw.includes('cabinetCode'), 'the list never carries the code');
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    const raw = await mongoose.connection.db!.collection('aeds').findOne({ _id: new mongoose.Types.ObjectId(aed.id) });
    assert.ok(raw?.cabinetCode && !String(raw.cabinetCode).includes(CODE), 'code is sealed in the database');
    await mongoose.disconnect();
  }
  ok('operators set the code and battery; the code is sealed and never listed');

  // Reading the code: operators only, and on record.
  assert.equal((await call('POST', `/aeds/${aed.id}/code`, citizen, {})).status, 403);
  const shown = await call('POST', `/aeds/${aed.id}/code`, op, { reason: 'Inspection' });
  assert.equal(shown.status, 200);
  assert.equal(shown.data.code, CODE);
  assert.equal((await call('POST', `/aeds/${other.id}/code`, op, {})).status, 404); // no code set
  ok('only operators can read the code');

  // Cardiac call: the runner gets the code, the primary responder doesn't.
  const sos = await call('POST', '/emergencies', citizen, { type: 'cardiac', priority: 1, coordinates: TIRANA });
  const eId = sos.data.emergency._id as string;
  assert.equal((await call('POST', `/emergencies/${eId}/accept`, doctor)).data.myRole, 'primary');
  const runner = await call('POST', `/emergencies/${eId}/accept`, nurse);
  assert.equal(runner.data.myRole, 'aed');
  assert.equal(runner.data.aed.id, aed.id);
  assert.equal(runner.data.aed.cabinetCode, CODE);
  const doctorView = (await call('GET', '/emergencies', doctor)).raw;
  assert.ok(!doctorView.includes(CODE), 'primary responder never sees the code');
  const nurseCall = ((await call('GET', '/emergencies', nurse)).data as any[]).find(e => e._id === eId);
  assert.equal(nurseCall.aed.cabinetCode, CODE);
  ok('the runner on the way gets the code; nobody else on the call does');

  // Picked up: out of dispatch, and the code is no longer handed out.
  assert.equal((await call('PATCH', `/emergencies/${eId}/aed`, nurse, { status: 'has_aed' })).status, 200);
  const out = ((await call('GET', '/aeds', op)).data as any[]).find(a => a.id === aed.id);
  assert.equal(out.status, 'in_use');
  const afterPickup = ((await call('GET', '/emergencies', nurse)).data as any[]).find(e => e._id === eId);
  assert.equal(afterPickup.aed.cabinetCode, undefined);
  assert.equal((await call('PATCH', `/emergencies/${eId}/aed`, nurse, { status: 'delivered' })).status, 200);
  await call('PATCH', `/emergencies/${eId}/status`, doctor, { status: 'resolved' });

  // A new arrest at the same spot: the runner is sent elsewhere, not to the empty cabinet.
  const sos2 = await call('POST', '/emergencies', citizen, { type: 'cardiac', priority: 1, coordinates: TIRANA });
  const e2 = sos2.data.emergency._id as string;
  await call('POST', `/emergencies/${e2}/accept`, doctor);
  const runner2 = await call('POST', `/emergencies/${e2}/accept`, nurse);
  if (runner2.status === 200) assert.notEqual(runner2.data.aed?.id, aed.id);
  await call('PATCH', `/emergencies/${e2}/status`, doctor, { status: 'resolved' });
  ok('once taken, it is out of dispatch until it is back');

  // Back in its cabinet.
  const back = await call('POST', `/aeds/${aed.id}/verify`, op);
  assert.equal(back.data.status, 'ok');
  assert.equal(back.data.hasCode, true);

  // A connected cabinet: its own key, battery changes logged, unexpected opening raised.
  const report = (id: string, body: object, key = KEY) => call('POST', `/aeds/${id}/device`, undefined, body, { 'X-Device-Key': key });
  assert.equal((await report(aed.id, { batteryPercent: 55 }, 'wrong')).status, 401);
  assert.equal((await report(aed.id, { batteryPercent: 55 })).status, 204);
  assert.equal((await report(aed.id, { batteryPercent: 55 })).status, 204); // unchanged: not logged twice
  const reported = ((await call('GET', '/aeds', op)).data as any[]).find(a => a.id === aed.id);
  assert.deepEqual([reported.battery.percent, reported.battery.source], [55, 'device']);
  assert.equal((await report(aed.id, { door: 'opened' })).status, 204); // the code was given minutes ago: expected
  const alert = new Promise<any>(r => opSock.once('aed:alert', r));
  assert.equal((await report(other.id, { door: 'opened' })).status, 204); // nobody was given this one's code
  assert.equal((await alert).id, other.id);
  ok('cabinet reports battery with its own key; opening with nobody sent alerts operators');

  // The history: who, what, when, which call.
  assert.equal((await call('GET', `/aeds/${aed.id}/events`, citizen)).status, 403);
  const events = (await call('GET', `/aeds/${aed.id}/events`, op)).data as any[];
  const types = events.map(e => e.type).reverse();
  for (const t of ['code_changed', 'battery', 'code_viewed', 'code_given', 'picked_up', 'delivered', 'returned', 'door_opened']) assert.ok(types.includes(t), `${t} logged: ${types}`);
  assert.equal(types.filter(t => t === 'battery').length, 2); // inspection 87%, cabinet 55%
  const given = events.find(e => e.type === 'code_given');
  assert.equal(given.by.name.length > 0, true);
  assert.equal(given.emergency, eId);
  assert.equal(events.find(e => e.type === 'code_viewed').detail, 'Inspection');
  assert.ok(!events.find(e => e.type === 'door_opened').alert);
  const otherEvents = (await call('GET', `/aeds/${other.id}/events`, op)).data as any[];
  assert.equal(otherEvents.find(e => e.type === 'door_opened').alert, true);
  const ledger = ((await call('GET', '/blockchain', op)).data as any[]).filter(b => b.payload?.entity === 'aed').map(b => b.payload.action);
  for (const a of ['code_changed', 'code_viewed', 'code_given', 'cabinet_opened']) assert.ok(ledger.includes(a), `${a} in the call log`);
  ok('log shows who had the code, who took it and brought it back, battery and cabinet reports');

  const removed = await call('PATCH', `/aeds/${aed.id}`, op, { cabinetCode: null });
  assert.equal(removed.status, 200, removed.raw);
  assert.equal(removed.data.hasCode, false);
  assert.equal((await call('POST', `/aeds/${aed.id}/code`, op, {})).status, 404);
  ok('a code can be removed when a cabinet is no longer locked');

  await sleep(300);
  assert.ok(!seen.some(s => s.includes(CODE)), 'no live event to operators carried the code');
  ok('the code never went out in a live event');

  opSock.close();
  console.log('\nAll defibrillator checks passed.');
  process.exit(0);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
