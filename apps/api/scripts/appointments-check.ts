/**
 * Consultations: clinician hours, days off and fees; free slots; booking without double booking
 * (even under races); prices copied at booking; reschedule, confirm, decline, cancel; who may do what.
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/appointments-check.ts
 */
import assert from 'node:assert/strict';
import { addDays, inTirana, tiranaTime } from '../src/utils/tirana';

const BASE = process.env.API_URL ?? 'http://localhost:4000';

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
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');
  const admin = await login('admin@vitalis.com', 'Admin1234!');
  const other = (await call('POST', '/auth/register', undefined, { email: `patient-${Date.now()}@vitalis.test`, password: 'Pati3nt!x', firstName: 'Other', lastName: 'Patient' })).data.accessToken;

  // Directory: only clinicians with an account, hours and fees are bookable.
  const list = (await call('GET', '/doctors', citizen)).data as any[];
  const sara = list.find(d => d.name === 'Sara Doctor');
  assert.equal(sara.bookable, true);
  const directoryOnly = list.find(d => d.name !== 'Sara Doctor');
  assert.equal(directoryOnly.bookable, false);
  const detail = (await call('GET', `/doctors/${sara.id}`, citizen)).data;
  assert.equal(detail.user, undefined, 'no account id in the public profile');
  const consult = detail.consultationTypes.find((t: any) => t.name === 'Consultation');
  const followUp = detail.consultationTypes.find((t: any) => t.name === 'Follow-up');
  assert.deepEqual([consult.minutes, consult.price], [30, 3000]);
  assert.equal((await call('GET', `/doctors/${directoryOnly.id}/slots?type=${consult.id}`, citizen)).status, 409);
  ok('directory: bookable clinicians with their consultation types and prices');

  // Free slots on the next Monday: 09:00 to 12:30 and 14:00 to 16:30 for a 30-minute consultation.
  const today = inTirana(new Date());
  const monday = addDays(today.date, ((8 - today.weekday) % 7) || 7);
  const at = (hhmm: string, date = monday) => tiranaTime(date, hhmm).toISOString();
  const day = (await call('GET', `/doctors/${sara.id}/slots?type=${consult.id}&from=${monday}&days=1`, citizen)).data[0];
  assert.equal(day.date, monday);
  assert.equal(day.times[0], at('09:00'));
  assert.ok(day.times.includes(at('12:30')) && !day.times.includes(at('13:00')) && day.times.includes(at('14:00')));
  assert.equal(day.times.at(-1), at('16:30'));
  ok('free slots follow the working hours, in Tirana time');

  // Booking: wrong times refused; two patients racing for one time, one wins.
  const req = (startsAt: string, typeId = consult.id) => ({ typeId, startsAt, reason: 'Check-up after an asthma attack', shareRecord: true });
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, citizen, req(at('13:00')))).status, 400, 'lunch break');
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, citizen, req(at('10:00', addDays(monday, -1))))).status, 400, 'Sunday');
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, citizen, req(at('09:07')))).status, 400, 'not on the grid');
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, doctor, req(at('09:00')))).status, 400, 'yourself');
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, admin, req(at('09:00')))).status, 403, 'staff');
  const race = await Promise.all([citizen, other].map(t => call('POST', `/doctors/${sara.id}/bookings`, t, req(at('09:00')))));
  assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
  const won = race.find(r => r.status === 201)!.data;
  const winner = race[0].status === 201 ? citizen : other;
  const loser = winner === citizen ? other : citizen;
  assert.equal((await call('POST', `/doctors/${sara.id}/bookings`, loser, req(at('09:15'), followUp.id))).status, 409, 'inside the 09:00 consultation');
  assert.deepEqual([won.status, won.price, won.type.minutes], ['requested', 3000, 30]);
  assert.ok(!(await call('GET', `/doctors/${sara.id}/slots?type=${consult.id}&from=${monday}&days=1`, citizen)).data[0].times.includes(at('09:00')));
  ok('booking: hours, grid and roles enforced; two at once for one time → one booking; overlaps refused');

  // Fees change: the existing booking keeps its price, a new one pays the new price.
  const me = (await call('GET', '/clinic/me', doctor)).data;
  const settings = { workingHours: me.workingHours, daysOff: me.daysOff, consultationTypes: me.consultationTypes.map((t: any) => (t.id === consult.id ? { ...t, price: 4000 } : t)) };
  assert.equal((await call('PUT', '/clinic/settings', doctor, settings)).status, 200);
  const later = await call('POST', `/doctors/${sara.id}/bookings`, loser, req(at('11:00')));
  assert.equal(later.data.price, 4000);
  assert.equal(((await call('GET', '/bookings/mine', winner)).data as any[]).find(b => b.id === won.id).price, 3000);
  ok('a fee change never touches a booking made before it');

  // The clinician's queue: confirm once; decline; patients cannot do clinician actions.
  assert.equal((await call('GET', '/clinic/me', citizen)).status, 403);
  assert.equal((await call('GET', '/clinic/me', admin)).status, 403);
  assert.equal((await call('GET', '/clinic/me', nurse)).data, null, 'a nurse without a clinic yet');
  const queue = (await call('GET', '/clinic/requests', doctor)).data as any[];
  assert.deepEqual(queue.map(b => b.id).sort(), [won.id, later.data.id].sort());
  assert.ok(queue[0].patient.name);
  assert.equal((await call('POST', `/clinic/bookings/${won.id}/confirm`, nurse)).status, 404, 'not her booking');
  assert.equal((await call('POST', `/clinic/bookings/${won.id}/confirm`, doctor)).data.status, 'confirmed');
  assert.equal((await call('POST', `/clinic/bookings/${won.id}/confirm`, doctor)).status, 409);
  assert.equal((await call('POST', `/clinic/bookings/${later.data.id}/decline`, doctor, { note: 'Fully booked that day' })).data.status, 'declined');
  ok('clinician confirms or declines requests; each once; only their own');

  // Reschedule: the patient's move needs confirming again and frees the old time; the clinician's doesn't.
  const moved = await call('POST', `/bookings/${won.id}/reschedule`, winner, { startsAt: at('10:00') });
  assert.deepEqual([moved.status, moved.data.status], [200, 'requested']);
  const times = (await call('GET', `/doctors/${sara.id}/slots?type=${consult.id}&from=${monday}&days=1`, citizen)).data[0].times;
  assert.ok(times.includes(at('09:00')) && !times.includes(at('10:00')));
  assert.equal((await call('POST', `/bookings/${won.id}/reschedule`, loser, { startsAt: at('10:30') })).status, 404, 'someone else’s booking');
  const byClinician = await call('POST', `/clinic/bookings/${won.id}/reschedule`, doctor, { startsAt: at('14:00') });
  assert.equal(byClinician.data.status, 'confirmed');
  ok('reschedule: patient moves need re-confirming, old time freed; clinician moves stay confirmed');

  // Days off: no slots that day. Cancel: frees the time, once.
  assert.equal((await call('PUT', '/clinic/settings', doctor, { ...settings, daysOff: [addDays(monday, 1)] })).status, 200);
  assert.deepEqual((await call('GET', `/doctors/${sara.id}/slots?type=${consult.id}&from=${addDays(monday, 1)}&days=1`, citizen)).data[0].times, []);
  assert.equal((await call('POST', `/bookings/${won.id}/cancel`, loser)).status, 404);
  assert.equal((await call('POST', `/bookings/${won.id}/cancel`, winner, { note: 'Feeling better' })).data.status, 'cancelled');
  assert.equal((await call('POST', `/bookings/${won.id}/cancel`, winner)).status, 409);
  assert.ok((await call('GET', `/doctors/${sara.id}/slots?type=${consult.id}&from=${monday}&days=1`, citizen)).data[0].times.includes(at('14:00')));
  assert.equal((await call('PUT', '/clinic/settings', doctor, { ...settings, consultationTypes: [{ name: 'Odd', minutes: 20, price: 100 }] })).status, 400, '15-minute steps');
  ok('days off close the day; cancelling frees the time, once');

  console.log('\nAll appointment checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
