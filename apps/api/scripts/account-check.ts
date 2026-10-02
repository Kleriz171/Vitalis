/**
 * Your own data: export it all (no secrets), erase it all (SOS records stay, unlinked).
 *   API:   MONGO_URI=…/vitalis_test npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 MONGO_URI=…/vitalis_test npx tsx apps/api/scripts/account-check.ts
 */
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const MONGO = process.env.MONGO_URI ?? 'mongodb://localhost:27017/vitalis_test';
assert.ok(/_test\b/.test(MONGO), 'refusing to read a non-test database');
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

const signUp = async (phone: string) => {
  const code = (await call('POST', '/auth/phone/start', undefined, { phone })).data.devCode;
  const signupToken = (await call('POST', '/auth/phone/verify', undefined, { phone, code })).data.signupToken;
  return call('POST', '/auth/phone/register', undefined, {
    signupToken, firstName: 'Erion', lastName: 'Data', dateOfBirth: '1985-03-02',
    emergencyContact: { name: 'Mira', phone: '+355691112255' }, bloodType: 'O+',
    allergies: [{ allergen: 'Penicillin', severity: 'severe' }], medications: [{ name: 'Metformin' }], conditions: ['Diabetes'],
    consent: true,
  });
};

async function main() {
  await mongoose.connect(MONGO);
  const db = mongoose.connection;
  const phone = `+35569${String(Date.now()).slice(-7)}`;
  const reg = await signUp(phone);
  assert.equal(reg.status, 200, JSON.stringify(reg.data));
  const { accessToken: me, refreshToken } = reg.data;
  const id = new mongoose.Types.ObjectId(String(reg.data.user.id ?? reg.data.user._id));
  assert.equal((await call('PUT', '/checkin/pins', me, { pin: '1234', duressPin: '9876' })).status, 204);

  const exp = await call('GET', '/account/export', me);
  assert.equal(exp.status, 200);
  assert.equal(exp.data.user.phone, phone);
  assert.ok(exp.data.user.consentAt && exp.data.user.consentVersion, 'consent recorded');
  assert.equal(exp.data.health.allergies[0].allergen, 'Penicillin');
  assert.equal(exp.data.health.medications[0].name, 'Metformin');
  const text = JSON.stringify(exp.data);
  for (const secret of ['password', 'refreshTokenHash', 'checkInPinHash', 'duressPinHash', 'pushTokens', 'trackTokenHash']) {
    assert.ok(!text.includes(secret), `export leaks ${secret}`);
  }
  assert.equal((await call('GET', '/account/export')).status, 401);
  ok('export: profile, consent and health records, no secrets; login required');

  const sos = await call('POST', '/emergencies', me, { type: 'medical', priority: 2, description: 'Citizen SOS', coordinates: [19.8187, 41.3275] });
  assert.equal(sos.status, 201);
  assert.equal((await call('DELETE', '/account', me, {})).status, 400, 'needs confirm');
  assert.equal((await call('DELETE', '/account', me, { confirm: 'DELETE' })).status, 409, 'blocked during an SOS');
  assert.equal((await call('PATCH', `/emergencies/${sos.data.emergency._id}/status`, me, { status: 'cancelled' })).status, 200);
  const dispatcher = (await call('POST', '/auth/login', undefined, { email: 'dispatcher@vitalis.com', password: 'Dispatch1!' })).data.accessToken;
  assert.equal((await call('DELETE', '/account', dispatcher, { confirm: 'DELETE' })).status, 403, 'staff removed by admin');
  ok('erase needs the word DELETE, waits for an active SOS, never removes staff');

  assert.equal((await call('DELETE', '/account', me, { confirm: 'DELETE' })).status, 204);
  assert.equal((await call('GET', '/account/export', me)).status, 401, 'old access token refused');
  assert.equal((await call('POST', '/auth/refresh', undefined, { refreshToken })).status, 401, 'refresh token dead');
  const left = async (coll: string, field = 'user') => db.collection(coll).countDocuments({ [field]: id });
  assert.equal(await db.collection('users').countDocuments({ _id: id }), 0);
  for (const coll of ['allergies', 'medications', 'conditions', 'checkins']) assert.equal(await left(coll), 0, `${coll} left`);
  assert.equal(await db.collection('phonecodes').countDocuments({ phone }), 0);
  assert.equal(await left('emergencies', 'citizen'), 1, 'SOS record kept, unlinked');
  ok('erased: account, health records, check-ins, sign-up code; tokens dead; SOS record kept');

  assert.equal((await signUp(phone)).status, 200, 'number free again');
  ok('the phone number can sign up again');

  await mongoose.disconnect();
  console.log('\nAll account checks passed.');
}

main().catch(err => { console.error('✗ FAILED:', err.message); process.exit(1); });
