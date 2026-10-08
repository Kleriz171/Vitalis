import crypto from 'crypto';
import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq, isRevoked } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { sha256 } from '../../utils/hash';
import { User } from '../../models/User';
import { Allergy, Medication, Condition } from '../../models/HealthRecord';
import { WatchDevice, WatchPairing } from '../../models/WatchDevice';
import { emergencyController, createEmergencySchema } from '../emergency/emergency.controller';
import { medicalLines } from '../biopassport/biopassport.routes';

const r = Router();
const PAIR_MS = 10 * 60_000;

// ---- Pairing ------------------------------------------------------------------------------

/** Watch: start pairing. Returns the code to show and the secret pairId to poll with. */
r.post('/pair/start', validate(z.object({ name: z.string().trim().max(60).optional() })), async (req, res, next) => {
  try {
    const pairId = crypto.randomBytes(32).toString('hex');
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await WatchPairing.create({ code, pairIdHash: sha256(pairId), name: req.body.name, expiresAt: new Date(Date.now() + PAIR_MS) });
    res.status(201).json({ code, pairId, expiresInS: PAIR_MS / 1000 });
  } catch (e) { next(e); }
});

/** Phone (signed in): confirm the code shown on the watch. */
r.post('/pair/confirm', authRequired, validate(z.object({ code: z.string().regex(/^\d{6}$/) })), async (req: AuthReq, res, next) => {
  try {
    const p = await WatchPairing.findOneAndUpdate(
      { code: req.body.code, user: null, expiresAt: { $gt: new Date() } },
      { $set: { user: req.user!.id } },
      { new: true },
    );
    if (!p) return res.status(404).json({ error: 'Code not found or expired. Check the watch.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

/** Watch: collect the key once the phone confirmed. The key is shown once and stored hashed. */
r.post('/pair/poll', validate(z.object({ pairId: z.string().regex(/^[a-f0-9]{64}$/) })), async (req, res, next) => {
  try {
    const p = await WatchPairing.findOne({ pairIdHash: sha256(req.body.pairId), expiresAt: { $gt: new Date() } });
    if (!p) return res.status(404).json({ error: 'Pairing expired. Start again.' });
    if (!p.user) return res.json({ status: 'pending' });
    const token = crypto.randomBytes(32).toString('hex');
    await WatchDevice.create({ user: p.user, tokenHash: sha256(token), name: p.name });
    await p.deleteOne();
    const u = await User.findById(p.user).select('name').lean();
    res.json({ status: 'paired', token, name: u?.name });
  } catch (e) { next(e); }
});

/** Phone: list and remove paired watches. */
r.get('/devices', authRequired, async (req: AuthReq, res, next) => {
  try {
    const list = await WatchDevice.find({ user: req.user!.id }).sort('-createdAt').lean();
    res.json(list.map(d => ({ id: String(d._id), name: d.name, pairedAt: (d as any).createdAt, lastSeenAt: d.lastSeenAt })));
  } catch (e) { next(e); }
});
r.delete('/devices/:id', authRequired, async (req: AuthReq, res, next) => {
  try {
    await WatchDevice.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// ---- What a paired watch may do ----------------------------------------------------------------

const watchAuth = async (req: AuthReq, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Watch ')) return res.status(401).json({ error: 'Missing watch key' });
  try {
    const d = await WatchDevice.findOneAndUpdate({ tokenHash: sha256(header.slice(6)) }, { $set: { lastSeenAt: new Date() } }).lean();
    const u = d && !isRevoked(String(d.user)) ? await User.findById(d.user).select('role').lean() : null;
    if (!d || !u) return res.status(401).json({ error: 'Watch not paired' });
    req.user = { id: String(d.user), role: u.role as string };
    (req as any).watchId = String(d._id);
    next();
  } catch (e) { next(e); }
};

// reason: what triggered it on the watch (button, or a heart-rate check nobody answered).
const sosSchema = createEmergencySchema.pick({ coordinates: true }).extend({
  reason: z.enum(['button', 'heart_high', 'heart_low']),
  heartRate: z.number().int().min(0).max(300).optional(),
});

r.post('/sos', watchAuth, validate(sosSchema), (req: AuthReq, res, next) => {
  const { reason, heartRate, coordinates } = req.body;
  const heart = reason !== 'button';
  req.body = {
    type: heart ? 'cardiac' : 'medical',
    priority: heart ? 1 : 2,
    description: heart
      ? `Watch: heart rate ${heartRate ?? '?'} bpm at rest (${reason === 'heart_high' ? 'too high' : 'too low'}), no answer to "Are you OK?"`
      : 'SOS from watch',
    coordinates,
    metadata: { fromWearable: true, deviceId: (req as any).watchId },
  };
  return emergencyController.create(req, res, next);
});

r.get('/sos', watchAuth, emergencyController.mine);

r.post('/sos/:id/cancel', watchAuth, (req: AuthReq, res, next) => {
  req.body = { status: 'cancelled' };
  return emergencyController.updateStatus(req, res, next);
});

r.get('/medical-id', watchAuth, async (req: AuthReq, res, next) => {
  try {
    const id = req.user!.id;
    const [u, allergies, medications, conditions] = await Promise.all([
      User.findById(id).lean(),
      Allergy.find({ user: id }).lean(),
      Medication.find({ user: id }).lean(),
      Condition.find({ user: id }).lean(),
    ]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json({ lines: medicalLines(u, { allergies, medications, conditions }), language: u.language ?? 'sq' });
  } catch (e) { next(e); }
});

export default r;
