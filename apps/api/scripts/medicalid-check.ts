/**
 * Medical ID QR: shows only what the person chose, its online link is logged and revocable.
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/medicalid-check.ts
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
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const me = (await call('POST', '/auth/login', undefined, { email: 'demo@vitalis.com', password: 'Demo1234!' })).data.accessToken;
  const passport = async () => (await call('GET', '/biopassport/me', me)).data.medicalId;
  const tokenOf = (url: string) => url.split('/id/')[1];

  let id = await passport();
  assert.ok(id.enabled && id.url.includes('/id/'));
  const token = tokenOf(id.url);
  assert.equal(tokenOf((await passport()).url), token, 'stable until rotated');
  const open = await call('GET', `/medical-id/${token}`);
  assert.equal(open.status, 200);
  assert.equal(open.data.name, 'Elena D.', 'first name and initial only');
  assert.ok(open.data.allergies.some((a: any) => a.allergen === 'Penicillin'));
  assert.equal(open.data.vaccinations, undefined, 'never the private record');
  assert.equal(((await call('GET', '/account/access-log', me)).data as any[])[0].kind, 'qr_profile');
  ok('the link opens without login, first name only, and the opening is in the access log');

  // Choices apply to both the QR text and the link.
  assert.equal((await call('PATCH', '/biopassport/medical-id', me, { share: { allergies: false, contact: false } })).status, 204);
  assert.equal((await call('PATCH', '/biopassport/medical-id', me, { share: { vaccinations: true } })).status, 400);
  id = await passport();
  assert.ok(!id.preview.some((l: string) => /Alergji|Allergies/.test(l)));
  const narrowed = (await call('GET', `/medical-id/${token}`)).data;
  assert.equal(narrowed.allergies, undefined);
  assert.equal(narrowed.emergencyContact, undefined);
  assert.ok(narrowed.bloodType);
  ok('hidden facts leave the QR text and the link');

  // Off, then a new link: the old one stops working.
  await call('PATCH', '/biopassport/medical-id', me, { enabled: false });
  assert.equal((await passport()).url, null);
  assert.equal((await call('GET', `/medical-id/${token}`)).status, 404);
  await call('PATCH', '/biopassport/medical-id', me, { enabled: true, share: { allergies: true, contact: true } });
  assert.equal((await call('POST', '/biopassport/medical-id/rotate', me)).status, 204);
  const fresh = tokenOf((await passport()).url);
  assert.notEqual(fresh, token);
  assert.equal((await call('GET', `/medical-id/${token}`)).status, 404);
  assert.equal((await call('GET', `/medical-id/${fresh}`)).status, 200);
  assert.equal((await call('GET', '/medical-id/not-a-token')).status, 404);
  ok('switch off hides the link; a new link revokes the old one');

  console.log('\nAll medical ID checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
