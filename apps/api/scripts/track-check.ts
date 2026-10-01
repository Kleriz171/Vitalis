/**
 * Live tracking link for the emergency contact (GET /api/track/:token).
 *   API:   MONGO_URI=…/vitalis_test npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 MONGO_URI=…/vitalis_test npx tsx apps/api/scripts/track-check.ts
 * Rewrites an emergency's link token and timeline in the test DB, so never point it at real data.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const MONGO = process.env.MONGO_URI ?? 'mongodb://localhost:27017/vitalis_test';
assert.ok(/_test\b/.test(MONGO), 'refusing to edit a non-test database');
const ok = (name: string) => console.log(`  ✓ ${name}`);
const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const PATIENT: [number, number] = [19.8187, 41.3275];
const NEAR: [number, number] = [19.8250, 41.3275]; // ~500 m east

async function main() {
  await mongoose.connect(MONGO);
  const emergencies = mongoose.connection.collection('emergencies');

  // Fresh phone user (has an emergency contact); needs the dev SMS echo.
  const phone = `+35568${String(Date.now()).slice(-7)}`;
  const code = (await call('POST', '/auth/phone/start', undefined, { phone })).data.devCode;
  const signup = (await call('POST', '/auth/phone/verify', undefined, { phone, code })).data.signupToken;
  const me = (await call('POST', '/auth/phone/register', undefined, {
    signupToken: signup, firstName: 'Drita', lastName: 'Track', dateOfBirth: '1960-05-01',
    emergencyContact: { name: 'Son', phone: '+355691112244' }, bloodType: 'unknown', allergies: [], medications: [], conditions: [], consent: true,
  })).data.accessToken as string;
  const doctor = (await call('POST', '/auth/login', undefined, { email: 'doctor@vitalis.com', password: 'Doctor1!' })).data.accessToken as string;
  await call('PATCH', '/biopassport/me', doctor, { available: true, location: { type: 'Point', coordinates: [19.84, 41.33] } });

  const sos = await call('POST', '/emergencies', me, { type: 'medical', priority: 2, description: 'Citizen SOS', coordinates: PATIENT });
  assert.equal(sos.status, 201, JSON.stringify(sos.data));
  const id = new mongoose.Types.ObjectId(String(sos.data.emergency._id));
  const stored = await emergencies.findOne({ _id: id });
  assert.match(stored?.trackTokenHash ?? '', /^[a-f0-9]{64}$/, 'SOS stores a hashed link token');
  assert.ok(!JSON.stringify(sos.data).includes(stored!.trackTokenHash), 'hash not sent to the app');
  // The real token only went out by SMS; give the emergency one we know.
  const token = crypto.randomBytes(16).toString('hex');
  await emergencies.updateOne({ _id: id }, { $set: { trackTokenHash: crypto.createHash('sha256').update(token).digest('hex') } });
  ok('every SOS gets a link token, stored only as a hash');

  assert.equal((await call('GET', '/track/not-a-token')).status, 404);
  assert.equal((await call('GET', `/track/${crypto.randomBytes(16).toString('hex')}`)).status, 404);
  let t = await call('GET', `/track/${token}`);
  assert.equal(t.status, 200);
  assert.deepEqual(Object.keys(t.data).sort(), ['endedAt', 'firstName', 'help', 'location', 'startedAt', 'status']);
  assert.deepEqual([t.data.firstName, t.data.status, t.data.help], ['Drita', 'pending', null]);
  assert.deepEqual(t.data.location, { lat: PATIENT[1], lng: PATIENT[0] });
  ok('public view: first name, status and place only; wrong tokens get nothing');

  assert.equal((await call('POST', `/emergencies/${id}/accept`, doctor)).status, 200);
  t = await call('GET', `/track/${token}`);
  assert.equal(t.data.status, 'assigned');
  assert.equal(t.data.help.distanceM, null, 'no fresh fix yet');
  assert.ok(t.data.help.etaMinutes >= 1, 'counts down from the road ETA');
  await call('PATCH', '/biopassport/me', doctor, { location: { type: 'Point', coordinates: NEAR } });
  t = await call('GET', `/track/${token}`);
  assert.ok(t.data.help.distanceM > 400 && t.data.help.distanceM < 700, `distance ${t.data.help.distanceM}`);
  assert.ok(t.data.help.etaMinutes >= 1);
  assert.ok(!/Sara|Doctor/.test(JSON.stringify(t.data)), 'responder name hidden'); // seeded doctor@vitalis.com
  assert.ok(!JSON.stringify(t.data).includes(String(NEAR[0])), 'responder position hidden');
  ok('after accept: distance and ETA of help, never who or exactly where');

  assert.equal((await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'resolved' })).status, 200);
  t = await call('GET', `/track/${token}`);
  assert.deepEqual([t.status, t.data.status, t.data.help], [200, 'resolved', null]);
  assert.ok(t.data.endedAt);
  await emergencies.updateOne({ _id: id }, { $set: { 'timeline.$[].at': new Date(Date.now() - 3 * 3600_000) } });
  assert.equal((await call('GET', `/track/${token}`)).status, 410);
  ok('ended SOS stays readable for 2 hours, then the link expires');

  await emergencies.updateOne({ _id: id }, { $set: { silent: true, status: 'pending' } });
  assert.equal((await call('GET', `/track/${token}`)).status, 404, 'silent alarm never visible');
  ok('silent alarms have no public view');

  await mongoose.disconnect();
  console.log('\nAll tracking-link checks passed.');
}

main().catch(err => { console.error('✗ FAILED:', err.message); process.exit(1); });
