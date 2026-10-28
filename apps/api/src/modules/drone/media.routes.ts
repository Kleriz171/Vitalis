import { Router } from 'express';
import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { DroneMedia } from '../../models/DroneMedia';
import { Emergency } from '../../models/Emergency';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { logger } from '../../config/logger';
import { DRONE_ID, bridgeKeyMatches, emitMedia, fleetSnapshot, mediaView, sendToBridge } from '../../realtime/drones';
import { blockchainService } from '../blockchain/blockchain.service';
import { LINK_TTL_MS, diskFile, diskLinkValid, isDiskStore, mediaStore } from './media.storage';

/**
 * Drone photos and videos. An operator asks for one, the bridge captures it from the
 * drone's camera and uploads it here, and we store it (Firebase Storage) for 30 days.
 * Every saved file and every time someone opens one goes into the call log.
 */
const r = Router();

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const TYPE = { photo: 'image/jpeg', video: 'video/mp4' } as const;
const EXT = { photo: 'jpg', video: 'mp4' } as const;
const MAX_BYTES = { photo: 10 * 1024 * 1024, video: 500 * 1024 * 1024 } as const;

// ── Bridge side: authenticated with the bridge key, never with a user token ──

r.put('/:id/file', async (req, res, next) => {
  const droneId = req.get('x-drone-id') ?? '';
  if (!bridgeKeyMatches(req.get('x-bridge-key')) || !DRONE_ID.test(droneId)) return res.status(401).json({ error: 'Bridge auth failed' });
  if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  if (!mediaStore) return res.status(503).json({ error: 'Storage is not set up' });
  let key: string | undefined;
  try {
    // Only files the API asked this drone for, and only once.
    const m = await DroneMedia.findOne({ _id: req.params.id, droneId, status: { $in: ['recording', 'uploading'] } });
    if (!m) return res.status(409).json({ error: 'Nothing to upload for this id' });
    const kind = m.kind as 'photo' | 'video';
    if (req.get('content-type') !== TYPE[kind]) return res.status(415).json({ error: `Expected ${TYPE[kind]}` });
    if (Number(req.get('content-length')) > MAX_BYTES[kind]) return res.status(413).json({ error: 'File too large' });

    const hash = createHash('sha256');
    let size = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.length;
        if (size > MAX_BYTES[kind]) return cb(Object.assign(new Error('File too large'), { status: 413 }));
        hash.update(chunk);
        cb(null, chunk);
      },
    });
    key = `${droneId}/${m._id}.${EXT[kind]}`;
    await pipeline(req, meter, await mediaStore.writer(key, TYPE[kind]));
    if (size === 0) throw Object.assign(new Error('Empty file'), { status: 400 });

    const sha256 = hash.digest('hex');
    const saved = await DroneMedia.findOneAndUpdate(
      { _id: m._id, status: { $in: ['recording', 'uploading'] } },
      { $set: { status: 'ready', storageKey: key, contentType: TYPE[kind], size, sha256 }, $unset: { error: 1 } },
      { new: true },
    );
    if (!saved) return res.status(409).json({ error: 'Already saved' });
    // The hash in the tamper-proof log is what proves later that the file wasn't edited.
    await blockchainService.append({
      entity: 'drone_media', entityId: String(m._id), action: kind === 'photo' ? 'photo_taken' : 'video_recorded',
      actor: `drone:${droneId}`, requestedBy: String(m.requestedBy), ...(m.emergency ? { emergency: String(m.emergency) } : {}), sha256, size,
    });
    emitMedia(saved);
    res.status(201).json({ ok: true, sha256 });
  } catch (e: any) {
    // Leave it "uploading": the bridge retries, then reports a failure itself.
    if (key && isDiskStore) await unlink(diskFile(key)).catch(() => {});
    logger.warn(`drone media upload ${req.params.id} failed: ${e?.message}`);
    if (e?.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// Development only (disk store): the console opens files through short signed links.
r.get('/:id/file', async (req, res, next) => {
  try {
    if (!OBJECT_ID.test(req.params.id) || !diskLinkValid(req.params.id, req.query.exp, req.query.sig)) return res.status(403).json({ error: 'Link expired' });
    const m = await DroneMedia.findById(req.params.id).lean();
    if (!m || m.status !== 'ready' || !m.storageKey) return res.status(404).json({ error: 'Not found' });
    // helmet sends Cross-Origin-Resource-Policy: same-origin, which would block the console's <img>/<video>.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'private, no-store');
    res.type(m.contentType ?? 'application/octet-stream');
    res.sendFile(diskFile(m.storageKey)); // handles Range, so videos can seek
  } catch (e) { next(e); }
});

// ── Operator side ──

r.use(authRequired, allow('eso'));

r.get('/', async (_req, res, next) => {
  try {
    const items = await DroneMedia.find().sort('-createdAt').limit(100).lean();
    res.json(items.map(mediaView));
  } catch (e) { next(e); }
});

const captureSchema = z.object({
  droneId: z.string().regex(DRONE_ID),
  kind: z.enum(['photo', 'video']),
  emergencyId: z.string().regex(OBJECT_ID).optional(),
}).strict();

r.post('/', validate(captureSchema), async (req: AuthReq, res, next) => {
  try {
    const { droneId, kind, emergencyId } = req.body as z.infer<typeof captureSchema>;
    if (!mediaStore) return res.status(503).json({ error: 'Photo and video storage isn\'t set up on the server yet.' });
    const drone = fleetSnapshot().find(d => d.droneId === droneId);
    if (!drone) return res.status(409).json({ error: 'Drone is offline' });
    if (!drone.telemetry?.videoUrl || !drone.telemetry.linkOk) return res.status(409).json({ error: 'This drone has no camera picture right now' });
    if (kind === 'video' && await DroneMedia.exists({ droneId, kind: 'video', status: 'recording' })) {
      return res.status(409).json({ error: 'This drone is already recording' });
    }
    if (emergencyId && !(await Emergency.exists({ _id: emergencyId }))) return res.status(404).json({ error: 'Emergency not found' });

    const m = await DroneMedia.create({ droneId, kind, status: kind === 'video' ? 'recording' : 'uploading', emergency: emergencyId, requestedBy: req.user!.id });
    sendToBridge(droneId, 'media:start', { mediaId: String(m._id), kind });
    emitMedia(m);
    res.status(201).json(mediaView(m));
  } catch (e) { next(e); }
});

r.post('/:id/stop', async (req, res, next) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const m = await DroneMedia.findOne({ _id: req.params.id, kind: 'video', status: 'recording' }).lean();
    if (!m) return res.status(409).json({ error: 'Not recording' });
    if (!sendToBridge(m.droneId, 'media:stop', { mediaId: String(m._id) })) return res.status(409).json({ error: 'Drone is offline. The bridge stops the recording at its time limit (10 minutes unless changed).' });
    res.status(202).json(mediaView(m));
  } catch (e) { next(e); }
});

// A link that works for 10 minutes. Opening footage is logged: who looked at what, and when.
r.get('/:id/link', async (req: AuthReq, res, next) => {
  try {
    if (!OBJECT_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    if (!mediaStore) return res.status(503).json({ error: 'Storage is not set up' });
    const m = await DroneMedia.findById(req.params.id).lean();
    if (!m || m.status !== 'ready' || !m.storageKey) return res.status(404).json({ error: 'Not found' });
    // The bucket's 30-day rule can run a little before the database's; or the file was removed by hand.
    if (!(await mediaStore.exists(m.storageKey))) return res.status(410).json({ error: 'This file is no longer stored.' });
    const url = await mediaStore.link(m.storageKey, String(m._id));
    await blockchainService.append({ entity: 'drone_media', entityId: String(m._id), action: 'media_viewed', actor: req.user!.id });
    res.json({ url, contentType: m.contentType, expiresInS: LINK_TTL_MS / 1000 });
  } catch (e) { next(e); }
});

export default r;
