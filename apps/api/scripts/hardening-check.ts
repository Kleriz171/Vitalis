/**
 * Session and abuse limits: sign-out kills the refresh token, wrong passwords pause one account,
 * uploads must really be PDFs, the AI assistant has a daily allowance.
 * Against a running, freshly seeded API started with AI_DAILY_LIMIT=2:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/hardening-check.ts
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
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  // 1. Sign-out: the old refresh token is refused afterwards.
  const s = (await call('POST', '/auth/login', undefined, { email: 'demo@vitalis.com', password: 'Demo1234!' })).data;
  assert.equal((await call('POST', '/auth/logout')).status, 401, 'sign-out needs a session');
  assert.equal((await call('POST', '/auth/logout', s.accessToken)).status, 204);
  assert.equal((await call('POST', '/auth/refresh', undefined, { refreshToken: s.refreshToken })).status, 401);
  ok('sign-out revokes the refresh token');

  // 2. Ten wrong passwords pause that account (even the right password), not other accounts.
  for (let i = 0; i < 10; i++) {
    assert.equal((await call('POST', '/auth/login', undefined, { email: 'nurse@vitalis.com', password: `wrong-${i}` })).status, 401);
  }
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'nurse@vitalis.com', password: 'Nurse1!' })).status, 429);
  const doctor = await call('POST', '/auth/login', undefined, { email: 'doctor@vitalis.com', password: 'Doctor1!' });
  assert.equal(doctor.status, 200);
  ok('10 wrong passwords pause that account only');

  // 3. A "PDF" that is not one is refused; a real one is accepted.
  const apply = async (bytes: string) => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ fullName: 'Ana Test', email: 'ana@vitalis.test', phone: '+355690000001', specialty: 'Cardiology', yearsExperience: '5', bio: 'Cardiologist, ten years in emergency care.' })) form.append(k, v);
    form.append('certificate', new Blob([bytes], { type: 'application/pdf' }), 'cert.pdf');
    const res = await fetch(`${BASE}/api/doctor-applications`, { method: 'POST', headers: { Authorization: `Bearer ${s2.accessToken}` }, body: form });
    return res.status;
  };
  const s2 = (await call('POST', '/auth/register', undefined, { email: `applicant-${Date.now()}@vitalis.test`, password: 'Applic4nt!x', firstName: 'Ana', lastName: 'Test' })).data;
  assert.equal(await apply('<html><script>alert(1)</script></html>'), 400);
  assert.equal(await apply('%PDF-1.4\n%%EOF\n'), 201);
  ok('certificate upload checks the file content, not just its label');

  // 4. The assistant: two questions a day here (AI_DAILY_LIMIT=2), then 429.
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await call('POST', '/ai/chat', doctor.data.accessToken, { message: 'How do I do CPR?' })).status);
  assert.notEqual(statuses[0], 429);
  assert.notEqual(statuses[1], 429);
  assert.equal(statuses[2], 429);
  ok('assistant stops at the daily allowance');

  console.log('\nAll hardening checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
