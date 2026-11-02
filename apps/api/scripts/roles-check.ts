/**
 * Who may do what: operator (dispatch), administrator (people, verification, reports), hospital staff
 * (their own hospital), responders, citizens. Roles are read from the database on every request.
 * Administrators take responder powers away: certificate revoke and "remove responder status".
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
  const admin = await login('admin@vitalis.com', 'Admin1234!');
  const hospital = await login('hospital@vitalis.com', 'Hospital1!');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const responder = await login('responder@vitalis.com', 'Responder1!');
  const nurse = await login('nurse@vitalis.com', 'Nurse1!');

  // The seeded responder holds a CPR certificate with a readable number and can go on duty.
  const [cpr] = (await call('GET', '/training/certifications', responder.accessToken)).data as any[];
  assert.match(cpr.number, /^VTL-\d{4}-[0-9A-F]{6}$/);
  assert.equal((await call('PATCH', '/biopassport/me', responder.accessToken, { available: true })).status, 200);
  ok('seeded first responder: CPR certificate VTL-…, can go on duty');

  // Each console role reaches its own areas and nothing else.
  const status = async (method: string, path: string, token: string, body?: unknown) => (await call(method, path, token, body)).status;
  const [aed] = (await call('GET', '/aeds', citizen.accessToken)).data as any[];
  const matrix: [string, string, string, number][] = [
    // [who, method, path, expected status]
    ['operator', 'GET', '/emergencies', 200],
    ['operator', 'GET', '/drones/fleet', 200],
    ['operator', 'GET', `/aeds/${aed.id}/events`, 200],
    ['operator', 'GET', '/analytics/kpis', 200],
    ['operator', 'GET', '/blockchain', 200],
    ['operator', 'GET', '/admin/users', 403],
    ['operator', 'GET', '/doctor-applications', 403],
    ['operator', 'GET', '/analytics/timeseries', 403],
    ['operator', 'GET', '/hospital/me', 403],
    ['admin', 'GET', '/admin/users', 200],
    ['admin', 'GET', '/doctor-applications', 200],
    ['admin', 'GET', '/analytics/timeseries', 200],
    ['admin', 'GET', '/analytics/kpis', 200],
    ['admin', 'GET', '/blockchain', 200],
    ['admin', 'GET', '/emergencies', 403],
    ['admin', 'GET', '/drones/fleet', 403],
    ['admin', 'GET', `/aeds/${aed.id}/events`, 403],
    ['admin', 'GET', '/hospital/me', 403],
    ['hospital', 'GET', '/hospital/me', 200],
    ['hospital', 'GET', '/emergencies', 403],
    ['hospital', 'GET', '/admin/users', 403],
    ['hospital', 'GET', '/analytics/kpis', 403],
    ['hospital', 'GET', '/blockchain', 403],
    ['citizen', 'GET', '/emergencies', 403],
    ['citizen', 'GET', '/blockchain', 403],
    ['citizen', 'GET', '/hospital/me', 403],
  ];
  const tokens: Record<string, string> = { operator: operator.accessToken, admin: admin.accessToken, hospital: hospital.accessToken, citizen: citizen.accessToken };
  for (const [who, method, path, want] of matrix) assert.equal(await status(method, path, tokens[who]), want, `${who} ${method} ${path}`);
  assert.equal(await status('DELETE', `/admin/users/${admin.user.id}`, admin.accessToken), 400, 'admin removes itself');
  // Staff never raise an SOS from the console, never go on duty, never erase their own account.
  for (const who of ['operator', 'admin', 'hospital']) {
    assert.equal(await status('POST', '/emergencies', tokens[who], { type: 'medical', coordinates: [19.8187, 41.3275] }), 403, `${who} SOS`);
    assert.equal(await status('PATCH', '/biopassport/me', tokens[who], { available: true }), 403, `${who} duty`);
    assert.equal(await status('DELETE', '/account', tokens[who], { confirm: 'DELETE' }), 403, `${who} erase`);
  }
  ok(`role matrix: ${matrix.length} routes; staff cannot SOS, go on duty or erase themselves; admin cannot remove itself`);

  // The seeded hospital account sees its own hospital.
  assert.match((await call('GET', '/hospital/me', hospital.accessToken)).data.name, /Traumës/);
  ok('hospital staff see their linked hospital');

  // Staff accounts: administrators only; hospital staff must name a hospital, others must not.
  const [someHospital] = (await call('GET', '/emergencies/hospitals', admin.accessToken)).data as any[];
  const staff = (role: string, extra: object = {}) => ({
    email: `staff-${role}-${Date.now()}@vitalis.test`, password: 'Staff123!', firstName: 'New', lastName: role, role, ...extra,
  });
  assert.equal(await status('POST', '/admin/staff', operator.accessToken, staff('eso')), 403);
  assert.equal(await status('POST', '/admin/staff', admin.accessToken, staff('hospital')), 400);
  assert.equal(await status('POST', '/admin/staff', admin.accessToken, staff('eso', { hospitalId: someHospital.id })), 400);
  assert.equal(await status('POST', '/admin/staff', admin.accessToken, staff('citizen')), 400);
  assert.equal(await status('POST', '/admin/staff', admin.accessToken, staff('hospital', { hospitalId: '0'.repeat(24) })), 404);
  const newWard = staff('hospital', { hospitalId: someHospital.id });
  assert.equal(await status('POST', '/admin/staff', admin.accessToken, newWard), 201);
  const ward = await login(newWard.email, newWard.password);
  assert.equal((ward.user as any).role, 'hospital');
  assert.equal((await call('GET', '/hospital/me', ward.accessToken)).data.id, someHospital.id);
  const listed = ((await call('GET', '/admin/users', admin.accessToken)).data as any[]).find(u => u.email === newWard.email);
  assert.equal(listed.hospital?.name, someHospital.name);
  ok('staff accounts: admin only, hospital link required and checked, listed with the hospital');

  // A blood donor is a citizen: no responder inbox, no duty.
  const donorReg = await call('POST', '/auth/register', undefined, {
    email: `donor-${Date.now()}@vitalis.test`, password: 'Donor123!', firstName: 'Blood', lastName: 'Donor', role: 'blood_donor',
  });
  assert.equal(donorReg.status, 200);
  for (const role of ['eso', 'admin', 'hospital']) {
    assert.equal(await status('POST', '/auth/register', '', { email: `x-${role}-${Date.now()}@vitalis.test`, password: 'Attack3r!x', firstName: 'A', lastName: 'B', role }), 400, `sign up as ${role}`);
  }
  assert.equal(await status('PATCH', '/biopassport/me', donorReg.data.accessToken, { available: true }), 403);
  assert.equal(await status('GET', '/emergencies', donorReg.data.accessToken), 403);
  ok('nobody signs up as staff; blood donors are not responders');

  // Revoke: administrators only; the holder stops being a responder at once, the public check says so.
  assert.equal((await call('POST', `/training/certifications/${cpr.id}/revoke`, citizen.accessToken, {})).status, 403);
  assert.equal((await call('POST', `/training/certifications/${cpr.id}/revoke`, operator.accessToken, {})).status, 403);
  assert.equal((await call('POST', `/training/certifications/${cpr.id}/revoke`, admin.accessToken, { reason: 'Test' })).status, 200);
  assert.equal((await call('PATCH', '/biopassport/me', responder.accessToken, { available: true })).status, 403);
  const publicView = (await call('GET', `/training/certifications/verify/${cpr.shareToken}`)).data;
  assert.equal(publicView.valid, false);
  assert.equal(publicView.revoked, true);
  ok('revoked certificate: holder cannot go on duty, verify page shows revoked');

  // Remove responder status: works on a nurse whose sign-in token still says nurse.
  assert.equal((await call('GET', '/emergencies', nurse.accessToken)).status, 200);
  assert.equal((await call('POST', `/admin/users/${nurse.user.id}/remove-responder`, citizen.accessToken)).status, 403);
  assert.equal((await call('POST', `/admin/users/${nurse.user.id}/remove-responder`, operator.accessToken)).status, 403);
  assert.equal((await call('POST', `/admin/users/${nurse.user.id}/remove-responder`, admin.accessToken)).status, 200);
  assert.equal((await call('PATCH', '/biopassport/me', nurse.accessToken, { available: true })).status, 403);
  assert.equal((await call('GET', '/emergencies', nurse.accessToken)).status, 403);
  ok('responder status removed: the old token (still saying nurse) loses duty and the inbox at once');

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
