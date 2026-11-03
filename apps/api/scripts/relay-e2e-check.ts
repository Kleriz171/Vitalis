/**
 * Vitalis Relay end to end: one SOS travels through every role on ONE incident record (citizen and
 * circle, responder, operator, hospital, clinician, administrator), and each role is refused what is
 * not theirs along the way.
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/relay-e2e-check.ts
 */
import assert from 'node:assert/strict';

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
const login = async (email: string, password: string) => (await call('POST', '/auth/login', undefined, { email, password })).data.accessToken as string;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const [citizen, doctor, nurse, operator, admin, ward] = await Promise.all([
    login('demo@vitalis.com', 'Demo1234!'), login('doctor@vitalis.com', 'Doctor1!'), login('nurse@vitalis.com', 'Nurse1!'),
    login('aleks@vitalis.com', 'AlexNo11$'), login('admin@vitalis.com', 'Admin1234!'), login('hospital@vitalis.com', 'Hospital1!'),
  ]);
  const hospital = (await call('GET', '/hospital/me', ward)).data;

  // 1. Citizen: circle set, SOS sent; the circle is texted (simulated on this server).
  await call('PUT', '/circle', citizen, { circle: [{ name: 'Brother', phone: '+355691110099' }] });
  await call('PATCH', '/biopassport/me', doctor, { available: true, location: { type: 'Point', coordinates: TIRANA } });
  const sos = (await call('POST', '/emergencies', citizen, { type: 'medical', coordinates: TIRANA })).data;
  const id = sos.emergency._id as string;
  assert.equal(sos.nearbyCount, 1);
  await sleep(500);
  assert.ok(((await call('GET', `/emergencies/${id}/alerts`, citizen)).data as any[]).some(a => a.name === 'Brother'));
  ok('citizen: SOS sent, nearest responder alerted, circle texted');

  // Boundaries before anyone accepts.
  assert.equal((await call('GET', '/emergencies', ward)).status, 403, 'hospital: no call list');
  assert.equal((await call('GET', '/emergencies', admin)).status, 403, 'admin: no dispatch');
  assert.equal((await call('PATCH', `/emergencies/${id}/status`, admin, { status: 'cancelled' })).status, 403, 'admin: cannot close calls');
  assert.equal((await call('GET', `/emergencies/${id}/handover`, nurse)).status, 403, 'other responder: no patient data');

  // 2. Responder: accept, walk the steps, report.
  assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 200);
  for (const status of ['en_route', 'on_scene', 'assistance']) assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status })).status, 200, status);
  const report = { conscious: 'yes', breathing: 'abnormal', cprPerformed: false, aedUsed: false, actions: ['recovery_position'], notes: 'Asthma attack, settled with inhaler.', handover: 'hospital' };
  assert.equal((await call('PUT', `/emergencies/${id}/report`, doctor, report)).status, 200);
  ok('responder: accepted, on the way, arrived, helping; quick report filed');

  // 3. Operator: follows the call, reads the report, hands it to the hospital.
  const seen = ((await call('GET', '/emergencies', operator)).data as any[]).find(e => e._id === id);
  assert.equal(seen.status, 'assistance');
  assert.equal(((await call('GET', `/emergencies/${id}/reports`, operator)).data as any[])[0].notes, report.notes);
  await call('POST', `/emergencies/${id}/actions`, operator, { kind: 'called_ambulance' });
  const sent = await call('POST', '/hospital/handovers', operator, { emergencyId: id, hospitalId: hospital.id });
  assert.equal(sent.status, 201);
  ok('operator: sees the live call and the report, records the ambulance call, sends the handover');

  // 4. Hospital: only what was sent to it; acknowledges and checks the patient in.
  const card = ((await call('GET', '/hospital/handovers', ward)).data as any[]).find(h => h.id === sent.data.id);
  assert.equal(card.summary.reports[0].notes, report.notes);
  assert.equal((await call('GET', `/emergencies/${id}/reports`, ward)).status, 403, 'hospital: snapshot only, not the live call');
  assert.equal((await call('POST', `/hospital/handovers/${sent.data.id}/acknowledge`, ward)).status, 200);
  assert.equal((await call('POST', `/hospital/handovers/${sent.data.id}/arrive`, ward, { hospitalRef: 'SUT-E2E-1' })).status, 200);
  ok('hospital: reads the snapshot, acknowledges, checks the patient in');

  // 5. Responder hands over and completes.
  for (const status of ['handed_over', 'resolved']) assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status })).status, 200, status);

  // One record: every role's step on the same timeline, in order.
  const done = ((await call('GET', '/emergencies', operator)).data as any[]).find(e => e._id === id);
  const steps: string[] = done.timeline.map((t: any) => t.status);
  const expected = ['pending', 'assigned', 'en_route', 'on_scene', 'assistance', 'action_called_ambulance', 'hospital_handover_sent', 'hospital_acknowledged', 'patient_arrived', 'handed_over', 'resolved'];
  assert.deepEqual(steps.filter(s => expected.includes(s)), expected);
  const times = done.timeline.map((t: any) => Date.parse(t.at));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  const handover = (await call('GET', `/hospital/handovers?emergencyId=${id}`, operator)).data[0];
  assert.ok(handover.acknowledgedAt && handover.arrivedAt);
  ok('one incident record: citizen, responder, operator and hospital steps on one timeline, in order');

  // 6. Clinician follow-up: with the patient's consent the doctor sees the emergency and the report.
  const sara = ((await call('GET', '/doctors', citizen)).data as any[]).find(d => d.name === 'Sara Doctor');
  const type = (await call('GET', `/doctors/${sara.id}`, citizen)).data.consultationTypes[0];
  const slot = ((await call('GET', `/doctors/${sara.id}/slots?type=${type.id}&days=14`, citizen)).data as any[]).find(d => d.times.length).times[0];
  const booking = (await call('POST', `/doctors/${sara.id}/bookings`, citizen, { typeId: type.id, startsAt: slot, shareRecord: true, reason: 'Follow-up after the SOS' })).data;
  const record = (await call('GET', `/clinic/bookings/${booking.id}/record`, doctor)).data;
  const emergency = record.timeline.find((t: any) => t.kind === 'emergency');
  assert.equal(emergency.reports[0].notes, report.notes);
  assert.equal((await call('GET', `/clinic/bookings/${booking.id}/record`, nurse)).status, 404, 'another clinician: nothing');
  ok('clinician: follow-up booking with consent shows the emergency and the responder report');

  // 7. Administrator: governs, cannot dispatch; sees the access trail. The citizen sees it too.
  assert.equal((await call('GET', `/emergencies/${id}/reports`, admin)).status, 403);
  const access = (await call('GET', '/admin/audit?kind=access', admin)).data as any[];
  assert.equal(access[0].action, 'clinician_record');
  assert.equal(((await call('GET', '/account/access-log', citizen)).data as any[])[0].actor, 'Sara Doctor');
  assert.equal((await call('GET', `/emergencies/${id}/reports`, citizen)).status, 403, 'the caller never reads responder reports');
  ok('administrator: audit trail, no dispatch powers; the citizen sees who opened their record');

  console.log('\nAll relay end-to-end checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
