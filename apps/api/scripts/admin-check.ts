/**
 * Administration: suspension and restoration, the append-only audit trail (admin actions and medical
 * record access), feedback handling, platform analytics and system health. Administrators only.
 * Against a running, freshly seeded API:
 *   API_URL=http://localhost:4000 npx tsx apps/api/scripts/admin-check.ts
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
const login = (email: string, password: string) => call('POST', '/auth/login', undefined, { email, password });
const ok = (name: string) => console.log(`  ✓ ${name}`);

async function main() {
  const admin = (await login('admin@vitalis.com', 'Admin1234!')).data;
  const operator = (await login('aleks@vitalis.com', 'AlexNo11$')).data.accessToken;
  const email = `suspend-${Date.now()}@vitalis.test`;
  const person = (await call('POST', '/auth/register', undefined, { email, password: 'Susp3nd!x', firstName: 'Sus', lastName: 'Pended' })).data;

  // Suspension: administrators only, never themselves; it takes effect on the next request.
  assert.equal((await call('POST', `/admin/users/${person.user.id}/suspend`, operator, { reason: 'Abuse' })).status, 403);
  assert.equal((await call('POST', `/admin/users/${admin.user.id}/suspend`, admin.accessToken, { reason: 'Test' })).status, 400);
  assert.equal((await call('POST', `/admin/users/${person.user.id}/suspend`, admin.accessToken, { reason: 'False SOS alerts' })).status, 200);
  assert.equal((await call('POST', `/admin/users/${person.user.id}/suspend`, admin.accessToken, { reason: 'Again' })).status, 409);
  assert.equal((await call('GET', '/health/profile', person.accessToken)).status, 401, 'the open session stops at once');
  assert.equal((await login(email, 'Susp3nd!x')).status, 403, 'no new sign-in');
  assert.equal((await call('POST', '/auth/refresh', undefined, { refreshToken: person.refreshToken })).status, 401);
  assert.ok(((await call('GET', '/admin/users', admin.accessToken)).data as any[]).find(u => u._id === person.user.id).suspendedAt);
  assert.equal((await call('POST', `/admin/users/${person.user.id}/restore`, admin.accessToken)).status, 200);
  assert.equal((await login(email, 'Susp3nd!x')).status, 200);
  ok('suspension: admin only, not yourself, stops the session and sign-in at once; restore undoes it');

  // Audit trail: admin actions and record access, readable by administrators only.
  await call('GET', `/admin/users/${person.user.id}`, admin.accessToken);
  assert.equal((await call('GET', '/admin/audit', operator)).status, 403);
  const actions = (await call('GET', '/admin/audit', admin.accessToken)).data as any[];
  assert.deepEqual(actions.slice(0, 2).map(a => a.action), ['restored', 'suspended']);
  assert.equal(actions[1].detail, 'False SOS alerts');
  assert.equal(actions[1].actor.name, 'Arta Admin');
  const access = (await call('GET', '/admin/audit?kind=access', admin.accessToken)).data as any[];
  assert.deepEqual([access[0].action, access[0].target.id], ['admin_record', person.user.id]);
  ok('audit: every admin action with who and why; every record opening; administrators only');

  // Role changes: between staff roles only, never your own, in the audit.
  const staffEmail = `op-${Date.now()}@vitalis.test`;
  const op2 = (await call('POST', '/admin/staff', admin.accessToken, { email: staffEmail, password: 'Operat0r!x', firstName: 'Second', lastName: 'Operator', role: 'eso' })).data;
  assert.equal((await call('POST', `/admin/users/${person.user.id}/role`, admin.accessToken, { role: 'admin' })).status, 404, 'a citizen is not made staff this way');
  assert.equal((await call('POST', `/admin/users/${admin.user.id}/role`, admin.accessToken, { role: 'eso' })).status, 400, 'not yourself');
  assert.equal((await call('POST', `/admin/users/${op2.id}/role`, admin.accessToken, { role: 'hospital' })).status, 400, 'hospital needs a hospital');
  assert.equal((await call('POST', `/admin/users/${op2.id}/role`, operator, { role: 'admin' })).status, 403);
  assert.equal((await call('POST', `/admin/users/${op2.id}/role`, admin.accessToken, { role: 'admin' })).status, 200);
  const promoted = (await login(staffEmail, 'Operat0r!x')).data.accessToken;
  assert.equal((await call('GET', '/admin/users', promoted)).status, 200, 'new role counts at once');
  assert.equal(((await call('GET', '/admin/audit', admin.accessToken)).data as any[])[0].detail, 'eso → admin');
  ok('role changes: staff roles only, not yourself, effective at once, audited');

  // A3. Feedback: anyone sends it and sees the outcome; administrators triage, assign and close it.
  const citizen = (await login('demo@vitalis.com', 'Demo1234!')).data.accessToken;
  assert.equal((await call('POST', '/feedback', citizen, { category: 'responder', message: 'hi' })).status, 400, 'too short');
  const sent = await call('POST', '/feedback', citizen, { category: 'responder', message: 'The responder arrived quickly but did not know where the AED was.' });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.priority, undefined, 'no admin fields to the author');
  assert.equal((await call('GET', '/admin/feedback', citizen)).status, 403);
  assert.equal((await call('GET', '/admin/feedback', operator)).status, 403);
  const inbox = (await call('GET', '/admin/feedback?status=new', admin.accessToken)).data as any[];
  assert.equal(inbox[0].author.name, 'Elena Demo');
  const fid = sent.data.id;
  assert.equal((await call('PATCH', `/admin/feedback/${fid}`, admin.accessToken, { assignee: person.user.id })).status, 400, 'administrators only');
  assert.equal((await call('PATCH', `/admin/feedback/${fid}`, admin.accessToken, { status: 'resolved' })).status, 400, 'needs a resolution');
  await call('PATCH', `/admin/feedback/${fid}`, admin.accessToken, { status: 'in_review', priority: 'high', assignee: admin.user.id });
  const closed = await call('PATCH', `/admin/feedback/${fid}`, admin.accessToken, { status: 'resolved', resolution: 'Cabinet locations added to the responder training.' });
  assert.deepEqual([closed.data.status, closed.data.assignee.name, closed.data.history.length], ['resolved', 'Arta Admin', 3]);
  const mine = ((await call('GET', '/feedback/mine', citizen)).data as any[])[0];
  assert.deepEqual([mine.status, mine.resolution], ['resolved', 'Cabinet locations added to the responder training.']);
  ok('feedback: sent by anyone, triaged, assigned and resolved by administrators, history kept, outcome visible to the author');

  // A2 / A5. Platform numbers and measured health, administrators only.
  assert.equal((await call('GET', '/analytics/platform', operator)).status, 403);
  assert.equal((await call('GET', '/admin/health', operator)).status, 403);
  const p = (await call('GET', '/analytics/platform', admin.accessToken)).data;
  assert.ok(p.users >= 8 && p.responders >= 3 && p.clinicians === 1 && p.staff >= 3);
  assert.ok(p.aeds.registered > 0 && p.hospitals.participating === 1 && p.hospitals.total > 50);
  assert.equal(p.activity.signups.length, 14);
  assert.ok(p.activity.signups.at(-1).n >= 2, 'today’s sign-ups counted');
  const h = (await call('GET', '/admin/health', admin.accessToken)).data;
  assert.equal(h.database.status, 'connected');
  assert.ok(h.database.pingMs >= 0 && h.api.status === 'up');
  assert.equal(h.integrations.sms, 'simulated (no provider)');
  ok('platform numbers from the database; health measured, integrations without credentials say so');

  console.log('\nAll admin checks passed.');
}

main().catch(err => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
