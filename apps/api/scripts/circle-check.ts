/**
 * Emergency circle: up to five people besides the emergency contact, each texted once per SOS with
 * the person's own choices (notify, share location), every attempt tracked, repeats held back.
 * Against a running, freshly seeded API without an SMS provider (texts are simulated, not sent):
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/circle-check.ts
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
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (name: string) => console.log(`  ✓ ${name}`);
const register = async (name: string) => (await call('POST', '/auth/register', undefined, { email: `${name}-${Date.now()}@vitalis.test`, password: 'Circl3!xx', firstName: name, lastName: 'Test' })).data.accessToken as string;

async function main() {
  const me = await register('Circle');
  const stranger = await register('Stranger');
  const operator = (await call('POST', '/auth/login', undefined, { email: 'aleks@vitalis.com', password: 'AlexNo11$' })).data.accessToken;
  await call('PATCH', '/health/profile', me, { emergencyContact: { name: 'Mum', phone: '+355691110001' } });

  const people = [
    { name: 'Brother', phone: '+355691110002' },
    { name: 'Neighbour', phone: '+355691110003', notify: false },
    { name: 'Colleague', phone: '+355691110004', shareLocation: false },
  ];
  assert.equal((await call('PUT', '/circle', me, { circle: [{ name: 'Bad', phone: '0691110002' }] })).status, 400);
  assert.equal((await call('PUT', '/circle', me, { circle: [people[0], people[0]] })).status, 400, 'each person once');
  assert.equal((await call('PUT', '/circle', me, { circle: Array.from({ length: 6 }, (_, i) => ({ name: `P${i}`, phone: `+35569111010${i}` })) })).status, 400, 'five at most');
  const saved = await call('PUT', '/circle', me, { circle: people });
  assert.equal(saved.data.circle.length, 3);
  assert.equal(saved.data.emergencyContact.name, 'Mum');
  ok('circle: valid numbers, each once, five at most, with per-person choices');

  // An SOS texts everyone who may be told, once each, and records what happened.
  const sos = (await call('POST', '/emergencies', me, { type: 'medical', coordinates: TIRANA })).data.emergency._id;
  await sleep(600);
  const alerts = (await call('GET', `/emergencies/${sos}/alerts`, me)).data as any[];
  const by = (name: string) => alerts.find(a => a.name === name);
  assert.equal(alerts.length, 4);
  assert.deepEqual([by('Mum').status, by('Mum').withLocation], ['simulated', true]);
  assert.deepEqual([by('Brother').status, by('Brother').withLocation], ['simulated', true]);
  assert.equal(by('Neighbour').status, 'skipped_no_consent');
  assert.deepEqual([by('Colleague').status, by('Colleague').withLocation], ['simulated', false]);
  assert.ok(alerts.every(a => /^…\d{3}$/.test(a.phone)), 'numbers masked');
  assert.equal((await call('GET', `/emergencies/${sos}/alerts`, stranger)).status, 403);
  assert.equal(((await call('GET', `/emergencies/${sos}/alerts`, operator)).data as any[]).length, 4);
  ok('SOS: everyone allowed is texted once, location only where shared, each result recorded');

  // A second SOS minutes later does not text the same people again.
  await call('PATCH', `/emergencies/${sos}/status`, me, { status: 'cancelled' });
  const again = (await call('POST', '/emergencies', me, { type: 'medical', coordinates: TIRANA })).data.emergency._id;
  await sleep(600);
  const repeat = (await call('GET', `/emergencies/${again}/alerts`, me)).data as any[];
  assert.ok(repeat.filter(a => a.name !== 'Neighbour').every(a => a.status === 'skipped_recent'));
  await call('PATCH', `/emergencies/${again}/status`, me, { status: 'cancelled' });
  ok('no repeat texts to the same person within 10 minutes');

  console.log('\nAll circle checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
