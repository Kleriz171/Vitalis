/**
 * Paired watch: pairing code, limited key, SOS, status, cancel, Medical ID, unpairing.
 *   API:   MONGO_URI=…/vitalis_test npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 npx tsx apps/api/scripts/watch-check.ts
 */
import assert from 'node:assert/strict';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const ok = (name: string) => console.log(`  ✓ ${name}`);
const call = async (method: string, path: string, auth?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const HERE: [number, number] = [19.8187, 41.3275];

async function main() {
  const login = (await call('POST', '/auth/login', undefined, { email: 'demo@vitalis.com', password: 'Demo1234!' })).data;
  const phone = `Bearer ${login.accessToken}`;

  // Pairing: watch shows a code, phone confirms, watch collects its key once.
  const start = await call('POST', '/watch/pair/start', undefined, { name: 'Test watch' });
  assert.equal(start.status, 201);
  assert.match(start.data.code, /^\d{6}$/);
  assert.equal((await call('POST', '/watch/pair/poll', undefined, { pairId: start.data.pairId })).data.status, 'pending');
  assert.equal((await call('POST', '/watch/pair/confirm', undefined, { code: start.data.code })).status, 401, 'confirm needs a signed-in phone');
  assert.equal((await call('POST', '/watch/pair/confirm', phone, { code: '000000' === start.data.code ? '000001' : '000000' })).status, 404);
  assert.equal((await call('POST', '/watch/pair/confirm', phone, { code: start.data.code })).status, 200);
  assert.equal((await call('POST', '/watch/pair/confirm', phone, { code: start.data.code })).status, 404, 'a code works once');
  const paired = await call('POST', '/watch/pair/poll', undefined, { pairId: start.data.pairId });
  assert.equal(paired.data.status, 'paired');
  assert.match(paired.data.token, /^[a-f0-9]{64}$/);
  assert.equal(paired.data.name, login.user.name);
  assert.equal((await call('POST', '/watch/pair/poll', undefined, { pairId: start.data.pairId })).status, 404, 'the key is handed out once');
  ok('pairing code, confirmed by the phone, key handed out once');

  const watch = `Watch ${paired.data.token}`;
  // The key is limited: no access to the normal API, and a wrong key is refused.
  assert.equal((await call('GET', '/biopassport/me', watch)).status, 401);
  assert.equal((await call('GET', '/watch/medical-id', `Watch ${'0'.repeat(64)}`)).status, 401);
  assert.equal((await call('GET', '/watch/medical-id', phone)).status, 401, 'phone tokens do not work on watch routes');
  ok('watch key only opens watch routes');

  const med = await call('GET', '/watch/medical-id', watch);
  assert.equal(med.status, 200);
  assert.ok(med.data.lines[0].includes(login.user.name));
  ok('Medical ID lines');

  // Clear any open SOS from earlier runs, then send one from the watch.
  const open = (await call('GET', '/emergencies/mine', phone)).data.emergency;
  if (open) await call('PATCH', `/emergencies/${open._id}/status`, phone, { status: 'cancelled' });
  assert.equal((await call('POST', '/watch/sos', watch, { reason: 'heart_high' })).status, 400, 'location required');
  const sos = await call('POST', '/watch/sos', watch, { reason: 'heart_high', heartRate: 178, coordinates: HERE });
  assert.equal(sos.status, 201);
  assert.equal(sos.data.emergency.type, 'cardiac');
  assert.equal(sos.data.emergency.metadata.fromWearable, true);
  assert.ok(sos.data.emergency.description.includes('178'));
  const status = await call('GET', '/watch/sos', watch);
  assert.equal(status.data.emergency._id, sos.data.emergency._id);
  assert.equal((await call('GET', '/emergencies/mine', phone)).data.emergency._id, sos.data.emergency._id, 'the phone sees the watch SOS');
  ok('heart-rate SOS from the watch, visible on the phone');

  assert.equal((await call('POST', `/watch/sos/${sos.data.emergency._id}/cancel`, watch)).status, 200);
  assert.equal((await call('GET', '/watch/sos', watch)).data.emergency, null);
  ok('false alarm cancelled from the watch');

  // Unpairing from the phone kills the key.
  const devices = (await call('GET', '/watch/devices', phone)).data;
  const mine = devices.find((d: any) => d.name === 'Test watch');
  assert.ok(mine?.lastSeenAt);
  assert.equal((await call('DELETE', `/watch/devices/${mine.id}`, phone)).status, 204);
  assert.equal((await call('GET', '/watch/medical-id', watch)).status, 401);
  ok('unpaired from the phone, key stops working');

  console.log('All watch checks passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
