/**
 * SOS by SMS: text parsing, Twilio signature checking, and a live signed webhook call.
 *   API:   MONGO_URI=…/vitalis_test TWILIO_AUTH_TOKEN=test-token TWILIO_WEBHOOK_URL=http://localhost:4000/api/sms/inbound npm run dev -w @vitalis/api
 *   Check: API_URL=http://localhost:4000 TWILIO_AUTH_TOKEN=test-token npx tsx apps/api/scripts/sms-check.ts
 */
import assert from 'node:assert/strict';
import { parseSosText, twilioSignature } from '../src/modules/sms/sms.routes';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const TOKEN = process.env.TWILIO_AUTH_TOKEN ?? 'test-token';
const URL_ = `${BASE}/api/sms/inbound`;
const ok = (name: string) => console.log(`  ✓ ${name}`);

assert.deepEqual(parseSosText('VITALIS SOS 41.3275,19.8187'), { coordinates: [19.8187, 41.3275], cardiac: false });
assert.deepEqual(parseSosText(' vitalis sos -33.9, 151.2 c '), { coordinates: [151.2, -33.9], cardiac: true });
for (const bad of ['SOS 41,19', 'VITALIS SOS 95,19', 'VITALIS SOS 41.3,190', 'VITALIS SOS 41.3,19.8; DROP', '']) assert.equal(parseSosText(bad), null, bad);
ok('SOS text parsed; malformed or out-of-range coordinates rejected');

const call = async (method: string, path: string, token?: string, body?: unknown) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};
const sms = async (params: Record<string, string>, sig?: string) => {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(sig !== undefined ? { 'X-Twilio-Signature': sig } : {}) },
    body: new URLSearchParams(params).toString(),
  });
  return { status: res.status, text: await res.text() };
};

async function main() {
  const phone = `+35569${String(Date.now()).slice(-7)}`;
  const code = (await call('POST', '/auth/phone/start', undefined, { phone })).data.devCode;
  const signup = (await call('POST', '/auth/phone/verify', undefined, { phone, code })).data.signupToken;
  const me = (await call('POST', '/auth/phone/register', undefined, {
    signupToken: signup, firstName: 'Sms', lastName: 'Test', dateOfBirth: '1990-01-01',
    emergencyContact: { name: 'C', phone: '+355691112233' }, bloodType: 'unknown', allergies: [], medications: [], conditions: [], consent: true,
  })).data.accessToken as string;

  const params = { From: phone, Body: 'VITALIS SOS 41.3275,19.8187 C' };
  assert.equal((await sms(params)).status, 403, 'no signature');
  assert.equal((await sms(params, 'forged')).status, 403, 'forged signature');
  assert.equal((await sms({ ...params, Body: 'VITALIS SOS 41.3,19.9' }, twilioSignature(TOKEN, URL_, params))).status, 403, 'body changed after signing');
  ok('unsigned, forged and tampered requests refused');

  const good = await sms(params, twilioSignature(TOKEN, URL_, params));
  assert.equal(good.status, 200);
  assert.match(good.text, /<Response><Message>Vitalis: SOS u mor\./);
  const mine = (await call('GET', '/emergencies/mine', me)).data.emergency;
  assert.ok(mine && mine.type === 'cardiac' && mine.description.startsWith('SOS by SMS'), 'SOS created from the text');
  ok('signed SOS text from a registered number opens a cardiac SOS and replies in Albanian');

  const stranger = { From: '+355690000009', Body: 'VITALIS SOS 41.3275,19.8187' };
  const unknown = await sms(stranger, twilioSignature(TOKEN, URL_, stranger));
  assert.match(unknown.text, /no Vitalis account/);
  ok('unknown number told to call the ambulance, no SOS');

  await call('PATCH', `/emergencies/${mine._id}/status`, me, { status: 'cancelled' });
}

main()
  .then(() => { console.log('\nAll SMS checks passed.'); process.exit(0); })
  .catch(e => { console.error(`\n✗ FAILED: ${e.message}`); process.exit(1); });
