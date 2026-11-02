/**
 * Hospitals on the shared call: capacity status, an operator's handover (a snapshot the hospital
 * cannot change), live delivery, acknowledgment, check-in, intake, duplicates, withdrawal, and
 * strict per-hospital access.
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/hospital-check.ts
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
const connect = (token: string) => new Promise<Socket>((resolve, reject) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const operator = await login('aleks@vitalis.com', 'AlexNo11$');
  const admin = await login('admin@vitalis.com', 'Admin1234!');
  const ward = await login('hospital@vitalis.com', 'Hospital1!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const me = (await call('GET', '/hospital/me', ward)).data;

  // A second participating hospital, to prove each sees only its own.
  const hospitals = (await call('GET', '/emergencies/hospitals', admin)).data as any[];
  const other = hospitals.find(h => h.id !== me.id && /Tiran/.test(h.address ?? ''))!;
  const otherStaff = { email: `ward-${Date.now()}@vitalis.test`, password: 'Ward123!x', firstName: 'Other', lastName: 'Ward', role: 'hospital', hospitalId: other.id };
  assert.equal((await call('POST', '/admin/staff', admin, otherStaff)).status, 201);
  const otherWard = await login(otherStaff.email, otherStaff.password);
  const unstaffed = hospitals.find(h => h.id !== me.id && h.id !== other.id)!;

  // H4. Capacity: hospital staff set it, operators see it with its time; nobody else changes it.
  assert.equal((await call('PATCH', '/hospital/me/capacity', ward, { status: 'full' })).status, 400);
  assert.equal((await call('PATCH', '/hospital/me/capacity', operator, { status: 'limited' })).status, 403);
  assert.equal((await call('PATCH', '/hospital/me/capacity', ward, { status: 'limited' })).status, 200);
  assert.equal((await call('GET', '/hospital/directory', citizen)).status, 403);
  const directory = (await call('GET', `/hospital/directory?lng=${TIRANA[0]}&lat=${TIRANA[1]}`, operator)).data as any[];
  assert.ok(directory.every(h => h.id !== unstaffed.id), 'only participating hospitals');
  const mine = directory.find(h => h.id === me.id);
  assert.equal(mine.capacity.status, 'limited');
  assert.ok(Date.now() - Date.parse(mine.capacity.updatedAt) < 60_000);
  assert.ok(directory.every((h, i) => i === 0 || (h.distanceKm ?? 1e9) >= (directory[i - 1].distanceKm ?? 1e9)), 'nearest first');
  ok('capacity: set by hospital staff, read by operators with its time; directory lists participating hospitals only');

  // A call with a responder and a report.
  const prior = await call('GET', '/emergencies/mine', citizen);
  if (prior.data?.emergency) await call('PATCH', `/emergencies/${prior.data.emergency._id}/status`, citizen, { status: 'cancelled' });
  await call('PATCH', '/biopassport/me', doctor, { available: true, location: { type: 'Point', coordinates: TIRANA } });
  const id = (await call('POST', '/emergencies', citizen, { type: 'medical', coordinates: TIRANA })).data.emergency._id;
  assert.equal((await call('POST', '/hospital/handovers', operator, { emergencyId: id, hospitalId: me.id })).status, 409, 'nobody has taken it yet');
  assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 200);
  for (const status of ['en_route', 'on_scene']) await call('PATCH', `/emergencies/${id}/status`, doctor, { status });
  const report = { conscious: 'yes', breathing: 'abnormal', cprPerformed: false, aedUsed: false, actions: ['recovery_position'], notes: 'Asthma attack, inhaler helped.', handover: 'hospital' };
  assert.equal((await call('PUT', `/emergencies/${id}/report`, doctor, report)).status, 200);

  // OP4. Send: operators only, to a participating hospital, one open handover per call.
  const wardSock = await connect(ward);
  const otherSock = await connect(otherWard);
  const heard: string[] = [];
  const otherHeard: string[] = [];
  wardSock.on('hospital:handover', (h: { id: string }) => heard.push(h.id));
  otherSock.on('hospital:handover', (h: { id: string }) => otherHeard.push(h.id));
  assert.equal((await call('POST', '/hospital/handovers', admin, { emergencyId: id, hospitalId: me.id })).status, 403);
  assert.equal((await call('POST', '/hospital/handovers', ward, { emergencyId: id, hospitalId: me.id })).status, 403);
  assert.equal((await call('POST', '/hospital/handovers', operator, { emergencyId: id, hospitalId: unstaffed.id })).status, 409, 'not on Vitalis');
  const sent = await call('POST', '/hospital/handovers', operator, { emergencyId: id, hospitalId: me.id });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.deliveredLive, true);
  assert.equal((await call('POST', '/hospital/handovers', operator, { emergencyId: id, hospitalId: other.id })).status, 409, 'one open handover per call');
  await sleep(300);
  assert.deepEqual(heard, [sent.data.id]);
  assert.deepEqual(otherHeard, [], 'the other hospital hears nothing');
  const hid = sent.data.id;
  ok('handover: operators only, participating hospital, one at a time, delivered live to that hospital only');

  // H1/H3. The board: this hospital only; the snapshot carries the patient essentials and the report.
  const board = (await call('GET', '/hospital/handovers', ward)).data as any[];
  const card = board.find(h => h.id === hid);
  assert.equal(card.summary.patient.name, 'Elena Demo');
  assert.ok(card.summary.patient.allergies.some((a: any) => a.allergen === 'Penicillin'));
  assert.equal(card.summary.patient.emergencyContact, undefined, 'no contact details to the hospital');
  assert.equal(card.summary.reports[0].notes, 'Asthma attack, inhaler helped.');
  assert.equal(card.summary.responders[0].name, 'Sara Doctor');
  assert.deepEqual((await call('GET', '/hospital/handovers', otherWard)).data, []);
  assert.equal((await call('GET', '/hospital/handovers', citizen)).status, 403);
  assert.equal((await call('GET', `/emergencies/${id}/handover`, ward)).status, 403, 'no access to the live call itself');
  assert.equal((await call('PUT', `/emergencies/${id}/report`, ward, report)).status, 403, 'cannot touch the report');
  // The responder corrects the report later: the hospital's snapshot stays as it was sent.
  await call('PUT', `/emergencies/${id}/report`, doctor, { ...report, notes: 'Edited later.' });
  assert.equal(((await call('GET', '/hospital/handovers', ward)).data as any[]).find(h => h.id === hid).summary.reports[0].notes, 'Asthma attack, inhaler helped.');
  ok('board: own hospital only; snapshot with patient essentials and the report; nothing editable');

  // Acknowledge, check in, intake: each once, own hospital only, on the call's timeline.
  assert.equal((await call('POST', `/hospital/handovers/${hid}/acknowledge`, otherWard)).status, 404);
  assert.equal((await call('POST', `/hospital/handovers/${hid}/acknowledge`, operator)).status, 403);
  assert.equal((await call('POST', `/hospital/handovers/${hid}/acknowledge`, ward)).status, 200);
  assert.equal((await call('POST', `/hospital/handovers/${hid}/acknowledge`, ward)).status, 409);
  assert.equal((await call('PATCH', `/hospital/handovers/${hid}/intake`, ward, { intake: 'in_treatment' })).status, 409, 'not arrived yet');
  const arrived = await call('POST', `/hospital/handovers/${hid}/arrive`, ward, { hospitalRef: 'SUT-2026-0412' });
  assert.equal(arrived.status, 200);
  assert.equal(arrived.data.intake, 'arrived');
  assert.equal((await call('PATCH', `/hospital/handovers/${hid}/intake`, ward, { intake: 'in_treatment' })).data.intake, 'in_treatment');
  assert.equal((await call('POST', `/hospital/handovers/${hid}/withdraw`, operator)).status, 409, 'patient already arrived');
  const seen = (await call('GET', `/hospital/handovers?emergencyId=${id}`, operator)).data[0];
  assert.ok(seen.acknowledgedAt && seen.arrivedAt);
  assert.equal(seen.acknowledgedBy, 'Drita Emergency Ward');
  const call1 = ((await call('GET', '/emergencies', operator)).data as any[]).find(e => e._id === id);
  const steps = call1.timeline.map((t: any) => t.status);
  for (const s of ['hospital_handover_sent', 'hospital_acknowledged', 'patient_arrived']) assert.ok(steps.includes(s), s);
  ok('acknowledge once, check-in with the hospital record number, intake; all on the one call timeline');

  // H2. Duplicates: the same person sent twice in a day is flagged; one is closed into the other.
  await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'resolved' });
  const id2 = (await call('POST', '/emergencies', citizen, { type: 'medical', coordinates: TIRANA })).data.emergency._id;
  await call('POST', `/emergencies/${id2}/accept`, doctor);
  const second = (await call('POST', '/hospital/handovers', operator, { emergencyId: id2, hospitalId: me.id })).data;
  const flagged = ((await call('GET', '/hospital/handovers', ward)).data as any[]).find(h => h.id === second.id);
  assert.deepEqual(flagged.possibleDuplicates, [hid]);
  assert.equal((await call('POST', `/hospital/handovers/${second.id}/duplicate`, ward, { of: second.id })).status, 400);
  assert.equal((await call('POST', `/hospital/handovers/${second.id}/duplicate`, otherWard, { of: hid })).status, 404);
  const dup = await call('POST', `/hospital/handovers/${second.id}/duplicate`, ward, { of: hid });
  assert.equal(dup.status, 200);
  assert.equal(dup.data.status, 'duplicate');
  ok('same patient twice in a day: flagged, closed into the first record');

  // Withdraw: an operator takes back an unanswered handover; the hospital sees it change live.
  await call('PATCH', `/emergencies/${id2}/status`, doctor, { status: 'resolved' });
  const id3 = (await call('POST', '/emergencies', citizen, { type: 'trauma', coordinates: TIRANA })).data.emergency._id;
  await call('POST', `/emergencies/${id3}/accept`, doctor);
  const third = (await call('POST', '/hospital/handovers', operator, { emergencyId: id3, hospitalId: me.id })).data;
  assert.equal((await call('POST', `/hospital/handovers/${third.id}/withdraw`, operator)).status, 200);
  assert.equal((await call('POST', `/hospital/handovers/${third.id}/acknowledge`, ward)).status, 409);
  const resent = await call('POST', '/hospital/handovers', operator, { emergencyId: id3, hospitalId: other.id });
  assert.equal(resent.status, 201, 'can go to another hospital once withdrawn');
  await call('PATCH', `/emergencies/${id3}/status`, doctor, { status: 'resolved' });
  ok('withdraw before arrival, then send elsewhere');

  wardSock.close();
  otherSock.close();
  console.log('\nAll hospital checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
