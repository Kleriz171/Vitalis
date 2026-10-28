/**
 * End-to-end drone photo/video check: API + bridge in simulator mode (its camera is a test card).
 *   API:    DRONE_BRIDGE_KEY=k npm run dev -w @vitalis/api   (no MEDIA_BUCKET: files go to MongoDB)
 *   Bridge: DRONE_BRIDGE_KEY=k API_URL=http://localhost:4000 npm run sim -w @vitalis/drone
 *   Check:  API_URL=http://localhost:4000 npx tsx apps/api/scripts/drone-media-check.ts
 * The video part needs ffmpeg on PATH (the bridge encodes with it).
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import mongoose from 'mongoose';
import { io, Socket } from 'socket.io-client';

const BASE = process.env.API_URL ?? 'http://localhost:4000';
const DRONE = 'tello-1';

const call = async (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data: any = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, data };
};
const login = async (email: string, password: string) => (await call('POST', '/auth/login', undefined, { email, password })).data.accessToken as string;
const connect = (token: string) => new Promise<Socket>((ok, bad) => {
  const s = io(BASE, { auth: { token }, transports: ['websocket'] });
  s.on('connect', () => ok(s));
  s.on('connect_error', bad);
});
const until = <T>(s: Socket, event: string, pred: (p: T) => boolean, ms = 30_000) =>
  new Promise<T>((ok, bad) => {
    const t = setTimeout(() => { s.off(event, h); bad(new Error(`timeout waiting for ${event}`)); }, ms);
    const h = (p: T) => { if (pred(p)) { clearTimeout(t); s.off(event, h); ok(p); } };
    s.on(event, h);
  });
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const ok = (m: string) => console.log(`  ✓ ${m}`);
const open = async (token: string, id: string) => {
  const link = await call('GET', `/drones/media/${id}/link`, token);
  assert.equal(link.status, 200, JSON.stringify(link.data));
  const res = await fetch(new URL(link.data.url, BASE));
  assert.equal(res.status, 200);
  return { url: link.data.url as string, type: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
};

async function main() {
  const disp = await login('aleks@vitalis.com', 'AlexNo11$');
  const citizen = await login('demo@vitalis.com', 'Demo1234!');
  const ds = await connect(disp);
  await until<any>(ds, 'drone:telemetry', t => t.droneId === DRONE && t.linkOk && !!t.videoUrl);

  assert.equal((await call('POST', '/drones/media', citizen, { droneId: DRONE, kind: 'photo' })).status, 403);
  assert.equal((await call('GET', '/drones/media', citizen)).status, 403);
  ok('only operators can take or see footage');

  // Photo: requested by the operator, captured and uploaded by the bridge, opened via a short link.
  const emergencyId = (await call('GET', '/emergencies', disp)).data[0]?._id;
  const p = await call('POST', '/drones/media', disp, { droneId: DRONE, kind: 'photo', ...(emergencyId ? { emergencyId } : {}) });
  assert.equal(p.status, 201, JSON.stringify(p.data));
  const photo = await until<any>(ds, 'drone:media', m => m._id === p.data._id && ['ready', 'failed'].includes(m.status));
  assert.equal(photo.status, 'ready', photo.error);
  const pic = await open(disp, photo._id);
  assert.equal(pic.type, 'image/jpeg');
  assert.equal(pic.bytes[0], 0xff); assert.equal(pic.bytes[1], 0xd8);
  assert.equal(createHash('sha256').update(pic.bytes).digest('hex'), photo.sha256);
  if (emergencyId) assert.equal(photo.emergency, emergencyId);
  const days = (new Date(photo.expiresAt).getTime() - new Date(photo.createdAt).getTime()) / 86_400_000;
  assert.equal(days, 30);
  ok('photo taken, stored, opened; hash matches; linked to the call; expires in 30 days');

  // Links are signed and short-lived.
  const tampered = pic.url.replace(/sig=[^&]+/, 'sig=forged');
  assert.equal((await fetch(new URL(tampered, BASE))).status, 403);
  ok('a forged link is refused');

  // Only the bridge can upload, only for its own drone, and only what was asked for.
  const put = (id: string, headers: Record<string, string>) => call('PUT', `/drones/media/${id}/file`, undefined, 'x', { 'Content-Type': 'image/jpeg', ...headers });
  assert.equal((await put(photo._id, {})).status, 401);
  assert.equal((await put(photo._id, { 'X-Bridge-Key': 'wrong', 'X-Drone-Id': DRONE })).status, 401);
  const key = process.env.DRONE_BRIDGE_KEY ?? 'ci-bridge-key';
  assert.equal((await put(photo._id, { 'X-Bridge-Key': key, 'X-Drone-Id': DRONE })).status, 409); // already saved
  assert.equal((await put(photo._id, { 'X-Bridge-Key': key, 'X-Drone-Id': 'other-1' })).status, 409);
  ok('uploads need the bridge key and a pending request for that drone');

  let hasFfmpeg = true;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { hasFfmpeg = false; }
  if (hasFfmpeg) {
    const v = await call('POST', '/drones/media', disp, { droneId: DRONE, kind: 'video' });
    assert.equal(v.status, 201, JSON.stringify(v.data));
    assert.equal(v.data.status, 'recording');
    assert.equal((await call('POST', '/drones/media', disp, { droneId: DRONE, kind: 'video' })).status, 409);
    await sleep(2500);
    assert.equal((await call('POST', `/drones/media/${v.data._id}/stop`, disp)).status, 202);
    const video = await until<any>(ds, 'drone:media', m => m._id === v.data._id && ['ready', 'failed'].includes(m.status), 60_000);
    assert.equal(video.status, 'ready', video.error);
    const clip = await open(disp, video._id);
    assert.equal(clip.type, 'video/mp4');
    assert.equal(clip.bytes.subarray(4, 8).toString(), 'ftyp');
    assert.equal(createHash('sha256').update(clip.bytes).digest('hex'), video.sha256);
    // Seeking in a video asks for byte ranges.
    const part = await fetch(new URL(clip.url, BASE), { headers: { Range: 'bytes=4-7' } });
    assert.equal(part.status, 206);
    assert.equal(Buffer.from(await part.arrayBuffer()).toString(), 'ftyp');
    ok(`video recorded, encoded and stored (${Math.round(clip.bytes.length / 1024)} KB), seekable; one recording at a time`);
  } else {
    console.log('  - video skipped: no ffmpeg on PATH');
  }

  // Saving and opening both land in the tamper-proof call log.
  const log = (await call('GET', '/blockchain', disp)).data as any[];
  const entries = log.filter(b => b.payload?.entity === 'drone_media' && b.payload.entityId === photo._id).map(b => b.payload.action);
  assert.ok(entries.includes('photo_taken') && entries.includes('media_viewed'), JSON.stringify(entries));
  assert.equal(log.find(b => b.payload?.action === 'photo_taken' && b.payload.entityId === photo._id).payload.sha256, photo.sha256);
  assert.equal((await call('GET', '/blockchain/verify', disp)).data.valid, true);
  ok('saving and opening are in the call log, with the file hash; chain still valid');

  // Retention: the database deletes records after 30 days on its own.
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI);
    const indexes = await mongoose.connection.db!.collection('dronemedias').indexes();
    assert.ok(indexes.some(i => i.key.createdAt === 1 && i.expireAfterSeconds === 30 * 24 * 3600), 'TTL index on createdAt');
    await mongoose.disconnect();
    ok('records expire after 30 days (TTL index)');
  }

  ds.close();
  console.log('\nAll drone media checks passed.');
  process.exit(0);
}

main().catch(e => { console.error('\n✗ FAILED:', e.message); process.exit(1); });
