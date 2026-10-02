/**
 * Re-dispatch: the release rule, then a live run against a seeded test API with fast timings.
 *   API:   MONGO_URI=…/vitalis_test REDISPATCH_TICK_MS=1000 REDISPATCH_PROGRESS_MS=3000 npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 npx tsx apps/api/scripts/redispatch-check.ts
 */
import assert from 'node:assert/strict';
import { io, Socket } from 'socket.io-client';
import { stallReason } from '../src/modules/emergency/redispatch';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const MIN = 60_000;
const ok = (name: string) => console.log(`  ✓ ${name}`);

// 1. The rule (default timings: 3 min to show movement, late after max(2×ETA, ETA + 8 min)).
const base = { status: 'assigned', elapsedMs: 4 * MIN, etaSeconds: 300, startM: 2000 };
assert.equal(stallReason({ ...base, currentM: 1700 }), null, 'moved 300 m closer');
assert.equal(stallReason({ ...base, currentM: 1990 }), 'no_progress', 'stood still');
assert.equal(stallReason({ ...base, currentM: null }), 'no_progress', 'no fix since accepting');
assert.equal(stallReason({ ...base, startM: 150, currentM: null }), null, 'accepted from next door');
assert.equal(stallReason({ ...base, startM: null, currentM: 180 }), null, 'no start fix but now close');
assert.equal(stallReason({ ...base, elapsedMs: 2 * MIN, currentM: null }), null, 'too early to judge');
assert.equal(stallReason({ ...base, status: 'en_route', elapsedMs: 14 * MIN, currentM: 900 }), 'late', 'still not there');
assert.equal(stallReason({ ...base, status: 'on_scene', elapsedMs: 60 * MIN }), null, 'arrived');
ok('release rule: movement kept, standing still or very late released');

// 2. Live: the doctor accepts and does not move → released, cannot re-take it, the nurse is alerted and takes it.
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
const connect = (token: string) => new Promise<Socket>((resolve, reject) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const once = <T>(s: Socket, event: string, ms: number) => new Promise<T | null>(resolve => {
  const t = setTimeout(() => resolve(null), ms);
  s.once(event, (p: T) => { clearTimeout(t); resolve(p); });
});
const point = (dLng: number): [number, number] => [19.8187 + dLng, 41.3275];

async function live() {
  const [citizen, doctor, nurse] = await Promise.all([
    login('demo@vitalis.com', 'Demo1234!'), login('doctor@vitalis.com', 'Doctor1!'), login('nurse@vitalis.com', 'Nurse1!'),
  ]);
  const mine = await call('GET', '/emergencies/mine', citizen);
  if (mine.data?.emergency) await call('PATCH', `/emergencies/${mine.data.emergency._id}/status`, citizen, { status: 'cancelled' });
  // Both on duty ~1 km from the patient.
  for (const t of [doctor, nurse]) {
    assert.equal((await call('PATCH', '/biopassport/me', t, { available: true, location: { type: 'Point', coordinates: point(0.012) } })).status, 200);
  }
  const [docSock, nurseSock] = await Promise.all([connect(doctor), connect(nurse)]);
  try {
    const sos = await call('POST', '/emergencies', citizen, { type: 'medical', coordinates: point(0) });
    assert.equal(sos.status, 201);
    const id = sos.data.emergency._id as string;
    assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 200);

    const released = once<{ _id: string; reason: string }>(docSock, 'emergency:released', 15_000);
    const realert = once<{ emergency: { _id: string } }>(nurseSock, 'emergency:new', 15_000);
    const r = await released;
    assert.ok(r, 'doctor released (is the API running with REDISPATCH_PROGRESS_MS=3000?)');
    assert.equal(r!._id, id);
    assert.equal(r!.reason, 'no_progress');
    assert.equal((await realert)?.emergency._id, id, 'nurse alerted again');
    assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 409, 'released responder cannot re-take it');
    assert.equal((await call('POST', `/emergencies/${id}/accept`, nurse)).status, 200);
    ok('stalled responder released, next responder alerted and accepts');

    // The nurse moves 300 m closer: kept past the progress window.
    await call('PATCH', '/biopassport/me', nurse, { location: { type: 'Point', coordinates: point(0.0085) } });
    const wrong = await once(nurseSock, 'emergency:released', 6_000);
    assert.equal(wrong, null, 'moving responder kept');
    const handover = await call('GET', `/emergencies/${id}/handover`, nurse);
    assert.ok(handover.data.timeline.some((t: any) => t.status === 'released'), 'release on the timeline');
    ok('moving responder kept; release recorded on the timeline');

    await call('PATCH', `/emergencies/${id}/status`, citizen, { status: 'cancelled' });
  } finally {
    docSock.close();
    nurseSock.close();
    for (const t of [doctor, nurse]) await call('PATCH', '/biopassport/me', t, { available: false });
  }
}

live()
  .then(() => { console.log('\nAll re-dispatch checks passed.'); process.exit(0); })
  .catch(e => { console.error(`\n✗ FAILED: ${e.message}`); process.exit(1); });
