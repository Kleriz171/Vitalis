/**
 * Operators take responder powers away: certificate revoke and "remove responder status".
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/roles-check.ts
 */
import assert from 'node:assert/strict';

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
  return r.data as { accessToken: string; user: { id: string } };
};
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const operator = await login('aleks@vitalis.com', 'AlexNo11$');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const responder = await login('responder@vitalis.com', 'Responder1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');

  // The seeded responder holds a CPR certificate with a readable number and can go on duty.
  const [cpr] = (await call('GET', '/training/certifications', responder.accessToken)).data as any[];
  assert.match(cpr.number, /^VTL-\d{4}-[0-9A-F]{6}$/);
  assert.equal((await call('PATCH', '/biopassport/me', responder.accessToken, { available: true })).status, 200);
  ok('seeded first responder: CPR certificate VTL-…, can go on duty');

  // Revoke: operators only; the holder stops being a responder at once, the public check says so.
  assert.equal((await call('POST', `/training/certifications/${cpr.id}/revoke`, citizen.accessToken, {})).status, 403);
  assert.equal((await call('POST', `/training/certifications/${cpr.id}/revoke`, operator.accessToken, { reason: 'Test' })).status, 200);
  assert.equal((await call('PATCH', '/biopassport/me', responder.accessToken, { available: true })).status, 403);
  const publicView = (await call('GET', `/training/certifications/verify/${cpr.shareToken}`)).data;
  assert.equal(publicView.valid, false);
  assert.equal(publicView.revoked, true);
  ok('revoked certificate: holder cannot go on duty, verify page shows revoked');

  // Remove responder status: works on a nurse whose sign-in token still says nurse.
  assert.equal((await call('POST', `/admin/users/${nurse.user.id}/remove-responder`, citizen.accessToken)).status, 403);
  assert.equal((await call('POST', `/admin/users/${nurse.user.id}/remove-responder`, operator.accessToken)).status, 200);
  assert.equal((await call('PATCH', '/biopassport/me', nurse.accessToken, { available: true })).status, 403);
  ok('responder status removed: the old token no longer puts them on duty');

  // Problem reports take a device out of dispatch, so one person gets three a day.
  const aeds = (await call('GET', '/aeds', citizen.accessToken)).data as any[];
  for (const a of aeds.slice(0, 3)) {
    assert.equal((await call('POST', `/aeds/${a.id}/problem`, citizen.accessToken, { note: 'Missing' })).status, 200);
  }
  assert.equal((await call('POST', `/aeds/${aeds[3].id}/problem`, citizen.accessToken, { note: 'Missing' })).status, 429);
  ok('AED problem reports capped at three a day per person');

  console.log('\nAll role checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
