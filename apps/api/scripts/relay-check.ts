/**
 * Vitalis Relay, emergency operations: responder availability, the call's forward-only status path,
 * the responder's quick report, and unanswered-SOS escalation with operator acknowledgement.
 * Against a running, freshly seeded API started with ESCALATE_AFTER_MS=1500 REDISPATCH_TICK_MS=500:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/relay-check.ts
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
  return r.data.accessToken as string;
};
const citizen = async (name: string) => {
  const r = await call('POST', '/auth/register', undefined, { email: `${name}-${Date.now()}@vitalis.test`, password: 'Citiz3n!x', firstName: name, lastName: 'Test' });
  assert.equal(r.status, 200);
  return r.data.accessToken as string;
};
const connect = (token: string) => new Promise<Socket>((resolve, reject) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (name: string) => console.log(`  ✓ ${name}`);
const duty = (token: string, body: object) => call('PATCH', '/biopassport/me', token, body);
const sos = async (token: string, coordinates = TIRANA) => {
  const r = await call('POST', '/emergencies', token, { type: 'medical', coordinates });
  assert.equal(r.status, 201);
  return r.data as { emergency: { _id: string }; nearbyCount: number };
};

async function main() {
  const operator = await login('aleks@vitalis.com', 'AlexNo11$');
  const admin = await login('admin@vitalis.com', 'Admin1234!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');
  const responder = await login('responder@vitalis.com', 'Responder1!');
  const caller = await citizen('Caller');
  const here = { type: 'Point', coordinates: TIRANA };

  // FR1. Available, temporarily unavailable, off duty. A paused responder is not alerted.
  assert.equal((await duty(doctor, { available: true, location: here })).status, 200);
  assert.equal((await duty(responder, { available: true, location: here })).status, 200);
  assert.equal((await duty(responder, { pauseMinutes: 45 })).status, 400, 'only 15/30/60');
  const paused = await duty(responder, { pauseMinutes: 30 });
  assert.ok(Date.parse(paused.data.pausedUntil) > Date.now() + 29 * 60_000);
  assert.ok((await call('GET', '/biopassport/me', responder)).data.profile.pausedUntil);
  const first = await sos(caller);
  assert.equal(first.nearbyCount, 1, 'only the doctor: the responder is paused, the nurse off duty');
  assert.equal((await duty(responder, { pauseMinutes: 0 })).data.pausedUntil, null);
  ok('pause for 15/30/60 min: no alerts meanwhile; resume clears it');

  // FR2. The doctor walks the call forward; never backwards; operators can't skip a responder.
  const id = first.emergency._id;
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, operator, { status: 'on_scene' })).status, 409, 'nobody assigned yet');
  assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 200);
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'assigned' })).status, 403);
  const race = await Promise.all([1, 2].map(() => call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'en_route' })));
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409], 'two taps at once: one applies');
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'on_scene' })).status, 200);
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'en_route' })).status, 409, 'backwards');
  ok('accept → on my way → arrived; backwards refused; parallel taps apply once');

  // A responder on a call is busy: a second SOS nearby alerts only the free responder.
  const second = await sos(await citizen('Second'));
  assert.equal(second.nearbyCount, 1, 'the doctor is busy, the first responder is free');
  ok('responders on an open call are not alerted again');

  // FR3. Quick report: only the responders on the call, once arrived; operators read every report.
  const report = { conscious: 'yes', breathing: 'abnormal', cprPerformed: false, aedUsed: false, actions: ['recovery_position', 'called_ambulance'], notes: 'Fainted in the heat, came round quickly.', handover: 'ambulance' };
  assert.equal((await call('PUT', `/emergencies/${id}/report`, nurse, report)).status, 403, 'not on this call');
  assert.equal((await call('PUT', `/emergencies/${id}/report`, caller, report)).status, 403, 'the caller');
  assert.equal((await call('PUT', `/emergencies/${id}/report`, doctor, { ...report, breathing: 'maybe' })).status, 400);
  assert.equal((await call('PUT', `/emergencies/${id}/report`, doctor, { ...report, role: 'admin' })).status, 400, 'no extra fields');
  const saved = await call('PUT', `/emergencies/${id}/report`, doctor, report);
  assert.equal(saved.status, 200);
  assert.ok(saved.data.arrivedAt, 'arrival time taken from the timeline');
  assert.equal((await call('GET', `/emergencies/${id}/reports`, caller)).status, 403);
  assert.equal((await call('GET', `/emergencies/${id}/reports`, admin)).status, 403);
  const seen = (await call('GET', `/emergencies/${id}/reports`, operator)).data;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].author.name, 'Sara Doctor');
  ok('quick report: responders on the call only, validated, operators read it, the caller cannot');

  for (const status of ['assistance', 'handed_over', 'resolved']) {
    assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status })).status, 200, status);
  }
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, operator, { status: 'cancelled' })).status, 409, 'completed is final');
  assert.equal((await call('PUT', `/emergencies/${id}/report`, doctor, { ...report, notes: 'Corrected after the call.' })).status, 200, 'editable a day after');
  const done = ((await call('GET', '/emergencies', operator)).data as any[]).find(e => e._id === id);
  const path = done.timeline.map((t: any) => t.status).filter((s: string) => !s.startsWith('action_') && s !== 'escalated');
  assert.deepEqual(path, ['pending', 'assigned', 'en_route', 'on_scene', 'assistance', 'handed_over', 'resolved']);
  const times = done.timeline.map((t: any) => Date.parse(t.at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b), 'timestamps in order');
  ok('assistance → handed over → completed, one timeline with every timestamp');

  // OP2. Escalation: once per call, acknowledged once, by operators only; manual actions recorded.
  const opSock = await connect(operator);
  const escalatedIds = new Set<string>(); // the second SOS above escalates too
  opSock.on('dashboard:escalation', (m: { _id: string }) => escalatedIds.add(m._id));
  const lonely = await sos(await citizen('Lonely'), [20.6, 40.2]); // far from every responder
  const lid = lonely.emergency._id;
  for (let i = 0; i < 60 && !escalatedIds.has(lid); i++) await sleep(100);
  assert.ok(escalatedIds.has(lid), 'operators hear about the escalation live');
  await sleep(1500); // more sweeps: still raised once
  const find = async () => ((await call('GET', '/emergencies', operator)).data as any[]).find(e => e._id === lid);
  let e = await find();
  assert.ok(e.escalatedAt);
  assert.equal(e.timeline.filter((t: any) => t.status === 'escalated').length, 1);
  assert.equal((await call('POST', `/emergencies/${lid}/escalation/ack`, admin)).status, 403);
  assert.equal((await call('POST', `/emergencies/${lid}/escalation/ack`, operator)).status, 200);
  assert.equal((await call('POST', `/emergencies/${lid}/escalation/ack`, operator)).status, 409);
  assert.equal((await call('POST', `/emergencies/${lid}/actions`, operator, { kind: 'note' })).status, 400, 'a note needs text');
  assert.equal((await call('POST', `/emergencies/${lid}/actions`, operator, { kind: 'called_caller' })).status, 200);
  assert.equal((await call('POST', `/emergencies/${lid}/actions`, operator, { kind: 'note', note: 'Caller says a neighbour is with her.' })).status, 200);
  assert.equal((await call('POST', `/emergencies/${lid}/actions`, doctor, { kind: 'called_ambulance' })).status, 403);
  e = await find();
  const tail = e.timeline.slice(-3);
  assert.deepEqual(tail.map((t: any) => t.status), ['escalation_acknowledged', 'action_called_caller', 'action_note']);
  assert.equal(tail[2].note, 'Caller says a neighbour is with her.');
  assert.ok(e.escalationAckAt);
  opSock.close();
  ok('unanswered SOS escalates once, live to operators; acknowledged once; manual actions on the timeline');

  console.log('\nAll relay checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
