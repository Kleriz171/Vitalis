/**
 * Push notification check with a stand-in for Expo's push service.
 *   API:   EXPO_PUSH_URL=http://localhost:4199/push npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 npx tsx apps/api/scripts/push-check.ts
 */
import assert from 'node:assert/strict';
import http from 'node:http';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const TIRANA: [number, number] = [19.8187, 41.3275];
const received: any[] = [];

const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    const msgs = JSON.parse(body);
    received.push(...msgs);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: msgs.map(() => ({ status: 'ok', id: 'x' })) }));
  });
});

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
const waitFor = async (pred: (m: any) => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const m = received.find(pred);
    if (m) return m;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('push not received');
};
const ok = (m: string) => console.log(`  ✓ ${m}`);

async function main() {
  await new Promise<void>(r => stub.listen(4199, r));
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const doctor = await login('doctor@vitalis.com', 'Doctor1!');
  const DOC = 'ExponentPushToken[doctor-test-token-01]';
  const CIT = 'ExponentPushToken[citizen-test-token-01]';

  assert.equal((await call('POST', '/push/token', citizen, { token: 'not-a-token' })).status, 400);
  assert.equal((await call('POST', '/push/token', doctor, { token: DOC })).status, 204);
  assert.equal((await call('POST', '/push/token', citizen, { token: CIT })).status, 204);
  ok('push tokens validated and stored');

  const prior = await call('GET', '/emergencies/mine', citizen);
  if (prior.data?.emergency) await call('PATCH', `/emergencies/${prior.data.emergency._id}/status`, citizen, { status: 'cancelled' });
  await call('PATCH', '/biopassport/me', doctor, { available: true, location: { type: 'Point', coordinates: [19.822, 41.329] } });

  const sos = await call('POST', '/emergencies', citizen, { type: 'cardiac', priority: 1, coordinates: TIRANA });
  assert.equal(sos.status, 201);
  const id = sos.data.emergency._id;
  const alert = await waitFor(m => m.to === DOC && m.data?.emergencyId === id);
  assert.equal(alert.channelId, 'sos');
  assert.equal(alert.title, 'Cardiac arrest nearby');
  assert.match(alert.body, /m away/);
  assert.ok(!JSON.stringify(alert).includes('Elena'), 'SOS push must not reveal the caller');
  assert.equal(received.filter(m => m.to === CIT && m.data?.emergencyId === id).length, 0, 'caller is not alerted about own SOS');
  ok(`responder alerted on lock screen: "${alert.title} · ${alert.body}"`);

  await call('POST', `/emergencies/${id}/accept`, doctor);
  const accepted = await waitFor(m => m.to === CIT && m.title === 'Help is on the way');
  assert.match(accepted.body, /doctor/);
  await call('PATCH', `/emergencies/${id}/status`, doctor, { status: 'on_scene' });
  await waitFor(m => m.to === CIT && m.title === 'Responder has arrived');
  ok('caller told who accepted and when they arrive');

  await call('PATCH', `/emergencies/${id}/status`, citizen, { status: 'cancelled' });
  await waitFor(m => m.to === DOC && m.title === 'Call cancelled');
  ok('responder told to stand down on cancel');

  await call('DELETE', '/push/token', doctor, { token: DOC });
  await call('DELETE', '/push/token', citizen, { token: CIT });
  await call('PATCH', '/biopassport/me', doctor, { available: false });
  stub.close();
  console.log('\nAll push checks passed.');
  process.exit(0);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
