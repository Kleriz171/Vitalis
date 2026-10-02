/**
 * Safety check-in: PINs, duress, the missed-check-in ladder and the wrong-PIN alarm.
 *   API:   MONGO_URI=…/vitalis_test CHECKIN_TICK_MS=500 CHECKIN_GRACE_MS=2000 npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 MONGO_URI=…/vitalis_test npx tsx apps/api/scripts/checkin-check.ts
 * Moves a check-in's due time into the past in the test DB, so never point it at real data.
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const MONGO = process.env.MONGO_URI ?? 'mongodb://localhost:27017/vitalis_test';
assert.ok(/_test\b/.test(MONGO), 'refusing to edit a non-test database');
const ok = (name: string) => console.log(`  ✓ ${name}`);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const HERE: [number, number] = [19.8187, 41.3275];

async function main() {
  await mongoose.connect(MONGO);
  const checkins = mongoose.connection.collection('checkins');

  // A fresh phone-registered user (has an emergency contact); needs the dev SMS echo.
  const phone = `+35567${String(Date.now()).slice(-7)}`;
  const code = (await call('POST', '/auth/phone/start', undefined, { phone })).data.devCode;
  const signup = (await call('POST', '/auth/phone/verify', undefined, { phone, code })).data.signupToken;
  const me = (await call('POST', '/auth/phone/register', undefined, {
    signupToken: signup, firstName: 'Check', lastName: 'In', dateOfBirth: '1990-01-01',
    emergencyContact: { name: 'Contact', phone: '+355691112233' }, bloodType: 'unknown', allergies: [], medications: [], conditions: [], consent: true,
  })).data.accessToken as string;
  const dispatcher = (await call('POST', '/auth/login', undefined, { email: 'dispatcher@vitalis.com', password: 'Dispatch1!' })).data.accessToken as string;
  const incidents = async () => (await call('GET', '/emergencies', dispatcher)).data as any[];

  assert.equal((await call('POST', '/checkin', me, { minutes: 30 })).status, 409, 'no PINs yet');
  assert.equal((await call('PUT', '/checkin/pins', me, { pin: '1111', duressPin: '1111' })).status, 400);
  assert.equal((await call('PUT', '/checkin/pins', me, { pin: '1234', duressPin: '9876' })).status, 204);
  ok('PINs required, must differ');

  let c = (await call('POST', '/checkin', me, { minutes: 30, note: 'Hike Dajti', coordinates: HERE })).data;
  assert.equal((await call('POST', `/checkin/${c.id}/ok`, me, { pin: '0000' })).status, 400);
  const real = await call('POST', `/checkin/${c.id}/ok`, me, { pin: '1234' });
  assert.deepEqual([real.status, real.data], [200, { status: 'ok' }]);
  assert.equal((await call('GET', '/checkin', me)).data.active, null);
  ok('wrong PIN refused, real PIN checks in');

  // Duress: indistinguishable reply; incident silent to the person, visible to dispatch only.
  c = (await call('POST', '/checkin', me, { minutes: 30, note: 'Taxi home', coordinates: HERE })).data;
  const duress = await call('POST', `/checkin/${c.id}/ok`, me, { pin: '9876' });
  assert.deepEqual([duress.status, duress.data], [real.status, real.data], 'duress reply identical');
  assert.equal((await call('GET', '/checkin', me)).data.active, null);
  assert.equal((await call('GET', '/emergencies/mine', me)).data.emergency ?? null, null, 'hidden from the person');
  const silent = (await incidents()).find(e => e.description?.startsWith('Silent alarm: duress') && e.description.includes('Taxi home'));
  assert.ok(silent, 'dispatcher sees the silent alarm');
  assert.equal(silent.silent, true);
  assert.equal(silent.dispatchOnly, true);
  ok('duress PIN looks normal, raises a silent dispatcher-only alarm');

  // Missed: reminder → contact → dispatcher, then a late real check-in closes it.
  c = (await call('POST', '/checkin', me, { minutes: 30, note: 'Night shift walk', coordinates: HERE })).data;
  await checkins.updateOne({ _id: new mongoose.Types.ObjectId(c.id) }, { $set: { dueAt: new Date(Date.now() - 1000) } });
  let stage = 0;
  // Read the stage from the DB: polling the API would spend the per-minute rate limit.
  for (let i = 0; i < 40 && stage < 3; i++) { await sleep(250); stage = (await checkins.findOne({ _id: new mongoose.Types.ObjectId(c.id) }))?.stage ?? 0; }
  assert.equal(stage, 3, 'reached the dispatcher stage (is the API running with CHECKIN_GRACE_MS=2000?)');
  const missed = (await incidents()).find(e => e.description === 'Missed safety check-in: Night shift walk');
  assert.ok(missed && missed.silent === false && missed.dispatchOnly === true, 'missed incident for dispatch');
  assert.ok((await call('GET', '/emergencies/mine', me)).data.emergency, 'the person sees help is coming');
  assert.equal((await call('POST', `/checkin/${c.id}/ok`, me, { pin: '1234' })).data.status, 'ok');
  const closed = (await incidents()).find(e => String(e._id) === String(missed._id));
  assert.equal(closed.status, 'resolved', 'late check-in closes the incident');
  ok('missed check-in escalates to contact and dispatcher; late check-in closes it');

  // Five wrong PINs: still "wrong" to whoever is guessing, silently alarmed.
  c = (await call('POST', '/checkin', me, { minutes: 30, note: 'Guess test', coordinates: HERE })).data;
  for (let i = 0; i < 5; i++) assert.equal((await call('POST', `/checkin/${c.id}/cancel`, me, { pin: '5555' })).status, 400);
  assert.ok((await incidents()).find(e => e.description === 'Silent alarm: 5 wrong check-in PINs (Guess test)'));
  await call('POST', `/checkin/${c.id}/cancel`, me, { pin: '1234' });
  ok('five wrong PINs raise a silent alarm and still read as wrong');

  // Tidy: close the test incidents.
  for (const e of await incidents()) {
    if (/check-in|Silent alarm/.test(e.description ?? '') && e.status === 'pending') {
      await call('PATCH', `/emergencies/${e._id}/status`, dispatcher, { status: 'cancelled' });
    }
  }
}

main()
  .then(async () => { await mongoose.disconnect(); console.log('\nAll check-in checks passed.'); process.exit(0); })
  .catch(async e => { await mongoose.disconnect().catch(() => {}); console.error(`\n✗ FAILED: ${e.message}`); process.exit(1); });
