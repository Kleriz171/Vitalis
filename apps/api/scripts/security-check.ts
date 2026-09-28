/**
 * End-to-end security + dispatch check against a running, seeded API.
 *   MONGO_URI=mongodb://localhost:27017/vitalis_test npm run seed -w @vitalis/api
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/security-check.ts
 * Exits non-zero on the first failed assertion.
 */
import assert from 'node:assert/strict';
import { io, Socket } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const TIRANA: [number, number] = [19.8187, 41.3275];

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};

const login = async (email: string, password: string) => {
  const r = await call('POST', '/auth/login', undefined, { email, password });
  assert.equal(r.status, 200, `login ${email}`);
  return r.data as { accessToken: string; user: { id: string; role: string } };
};

const connect = (token: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = io(BASE, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });

const waitFor = <T>(s: Socket, event: string, ms = 1500) =>
  new Promise<T | null>(resolve => {
    const t = setTimeout(() => resolve(null), ms);
    s.once(event, (p: T) => { clearTimeout(t); resolve(p); });
  });

const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const stamp = Date.now();

  // 1. Self-registration cannot mint privileged roles.
  const reg = await call('POST', '/auth/register', undefined, {
    email: `attacker${stamp}@test.dev`, password: 'Attack3r!x', firstName: 'A', lastName: 'B', role: 'admin',
  });
  assert.equal(reg.status, 400);
  ok('register rejects role=admin');

  const citizenReg = await call('POST', '/auth/register', undefined, {
    email: `citizen${stamp}@test.dev`, password: 'Citiz3n!x', firstName: 'C', lastName: 'D',
  });
  assert.equal(citizenReg.status, 200);
  const attacker = citizenReg.data as { accessToken: string; user: { id: string } };

  // 2. Profile PATCH cannot escalate role.
  const esc = await call('PATCH', '/biopassport/me', attacker.accessToken, { role: 'admin' });
  assert.equal(esc.status, 400);
  const adminProbe = await call('GET', '/admin/users', attacker.accessToken);
  assert.equal(adminProbe.status, 403);
  ok('biopassport PATCH rejects role, admin API still 403');

  // 3. NoSQL operator injection via query string is inert.
  const inj = await call('GET', '/blood/requests?status[$ne]=x', attacker.accessToken);
  assert.equal(inj.status, 200);
  assert.ok(Array.isArray(inj.data));
  ok('query operator injection ignored');

  // 4. Regex input is escaped (would throw / match everything otherwise).
  const rx = await call('GET', `/doctors?search=${encodeURIComponent('(a+)+$')}`, attacker.accessToken);
  assert.equal(rx.status, 200);
  ok('regex search escaped');

  // 5. Bad ids are 400, not 500 with a stack message.
  const bad = await call('GET', '/doctors/not-an-id', attacker.accessToken);
  assert.equal(bad.status, 400);
  ok('malformed ObjectId → 400');

  // 6. SOS reaches only nearby on-duty responders, and outsiders cannot spy on it.
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');
  const dispatcher = await login('dispatcher@vitalis.com', 'Dispatch1!');

  // Clear any live SOS the demo citizen has from previous runs.
  const prior = await call('GET', '/emergencies/mine', citizen.accessToken);
  if (prior.data?.emergency) await call('PATCH', `/emergencies/${prior.data.emergency._id}/status`, citizen.accessToken, { status: 'cancelled' });

  await call('PATCH', '/biopassport/me', doctor.accessToken, { available: true, location: { type: 'Point', coordinates: TIRANA } });
  await call('PATCH', '/biopassport/me', nurse.accessToken, { available: true, location: { type: 'Point', coordinates: [2.35, 48.85] } }); // Paris

  const [docSock, nurseSock, spySock, dispSock] = await Promise.all([
    connect(doctor.accessToken), connect(nurse.accessToken), connect(attacker.accessToken), connect(dispatcher.accessToken),
  ]);
  spySock.emit('dispatcher:join');
  await new Promise(r => setTimeout(r, 200));

  const docAlert = waitFor<any>(docSock, 'emergency:new');
  const nurseAlert = waitFor<any>(nurseSock, 'emergency:new');
  const spyDash = waitFor<any>(spySock, 'dashboard:emergency');
  const dispDash = waitFor<any>(dispSock, 'dashboard:emergency');

  const badSos = await call('POST', '/emergencies', citizen.accessToken, { type: 'medical', coordinates: [999, 0] });
  assert.equal(badSos.status, 400);
  const sos = await call('POST', '/emergencies', citizen.accessToken, { type: 'cardiac', priority: 1, coordinates: TIRANA });
  assert.equal(sos.status, 201);
  const eId = sos.data.emergency._id as string;

  const [d, n, spy, disp] = await Promise.all([docAlert, nurseAlert, spyDash, dispDash]);
  assert.ok(d, 'nearby doctor alerted');
  assert.equal(d.emergency.citizen, undefined, 'responder alert hides caller identity');
  assert.equal(n, null, 'far-away nurse not alerted');
  assert.equal(spy, null, 'citizen cannot join dispatchers room');
  assert.ok(disp, 'dispatcher sees dashboard event');
  ok('SOS fan-out scoped to nearby responders; dispatcher room locked');

  const dup = await call('POST', '/emergencies', citizen.accessToken, { type: 'cardiac', coordinates: TIRANA });
  assert.equal(dup.status, 200);
  assert.equal(dup.data.emergency._id, eId);
  ok('repeat SOS returns the open incident');

  // 7. Outsider cannot join the emergency room or read responder locations.
  spySock.emit('emergency:join', eId);
  const spyLoc = waitFor<any>(spySock, 'responder:location');

  // 8. Accept is atomic: two parallel accepts → exactly one wins.
  await call('PATCH', '/biopassport/me', nurse.accessToken, { available: true, location: { type: 'Point', coordinates: TIRANA } });
  const [a1, a2] = await Promise.all([
    call('POST', `/emergencies/${eId}/accept`, doctor.accessToken),
    call('POST', `/emergencies/${eId}/accept`, nurse.accessToken),
  ]);
  assert.deepEqual([a1.status, a2.status].sort(), [200, 409]);
  const winner = a1.status === 200 ? { tok: doctor, sock: docSock } : { tok: nurse, sock: nurseSock };
  const loser = a1.status === 200 ? { tok: nurse, sock: nurseSock } : { tok: doctor, sock: docSock };
  ok('parallel accept → one 200, one 409');

  // 9. Only the assigned responder may broadcast location / progress status.
  winner.sock.emit('emergency:join', eId);
  loser.sock.emit('emergency:join', eId);
  await new Promise(r => setTimeout(r, 300));
  loser.sock.emit('responder:location', { emergencyId: eId, coordinates: [0, 0] });
  winner.sock.emit('responder:location', { emergencyId: eId, coordinates: TIRANA });
  assert.equal(await spyLoc, null, 'outsider receives no location');
  ok('emergency room closed to outsiders');

  const loserStatus = await call('PATCH', `/emergencies/${eId}/status`, loser.tok.accessToken, { status: 'resolved' });
  assert.equal(loserStatus.status, 403);
  const callerResolve = await call('PATCH', `/emergencies/${eId}/status`, citizen.accessToken, { status: 'resolved' });
  assert.equal(callerResolve.status, 403);
  const winStatus = await call('PATCH', `/emergencies/${eId}/status`, winner.tok.accessToken, { status: 'en_route' });
  assert.equal(winStatus.status, 200);
  const done = await call('PATCH', `/emergencies/${eId}/status`, winner.tok.accessToken, { status: 'resolved' });
  assert.equal(done.status, 200);
  const reopen = await call('PATCH', `/emergencies/${eId}/status`, winner.tok.accessToken, { status: 'on_scene' });
  assert.equal(reopen.status, 409);
  ok('status changes limited to assigned responder; resolved is final');

  // 10. Ledger chain still verifies after concurrent appends.
  const chain = await call('GET', '/blockchain/verify', dispatcher.accessToken);
  assert.equal(chain.data.valid, true);
  ok('ledger chain valid');

  // Leave the demo doctor/nurse off duty.
  await call('PATCH', '/biopassport/me', doctor.accessToken, { available: false });
  await call('PATCH', '/biopassport/me', nurse.accessToken, { available: false });
  [docSock, nurseSock, spySock, dispSock].forEach(s => s.close());
  console.log('\nAll security checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
