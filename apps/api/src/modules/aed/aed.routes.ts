import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { Aed } from '../../models/Aed';
import { AedEvent, recordAedEvent } from '../../models/AedEvent';
import { getIO } from '../../realtime/socket';
import { nearQuery, haversineKm } from '../../utils/geo';
import { seal, unseal } from '../../utils/sealed';
import { blockchainService } from '../blockchain/blockchain.service';

const r = Router();
const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
// Someone at the cabinet within this long of being given the code is expected; otherwise it's an alert.
const EXPECTED_OPEN_MS = 30 * 60_000;

const deviceKeyMatches = (given: unknown) => {
  if (!env.aedDeviceKey || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(env.aedDeviceKey);
  return a.length === b.length && timingSafeEqual(a, b);
};

const deviceSchema = z.object({
  batteryPercent: z.number().min(0).max(100).optional(),
  door: z.enum(['opened', 'closed']).optional(),
}).strict().refine(b => b.batteryPercent !== undefined || !!b.door, { message: 'Send batteryPercent or door' });

// Connected cabinets report their battery and door with the device key, not a user session,
// so this comes before sign-in is required.
// ponytail: one key for every cabinet; give each its own key if they're ever installed in numbers.
r.post('/:id/device', validate(deviceSchema), async (req, res, next) => {
  try {
    if (!env.aedDeviceKey) return res.status(503).json({ error: 'Cabinet reports are off. Set AED_DEVICE_KEY on the server.' });
    if (!deviceKeyMatches(req.header('x-device-key'))) return res.status(401).json({ error: 'Bad device key' });
    if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Not found' });
    const a = await Aed.findById(req.params.id).select('name battery').lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    const b = req.body as z.infer<typeof deviceSchema>;

    if (b.batteryPercent !== undefined) {
      const percent = Math.round(b.batteryPercent);
      await Aed.updateOne({ _id: a._id }, { $set: { battery: { percent, at: new Date(), source: 'device' } } });
      // Cabinets report often; the log keeps changes only.
      if (a.battery?.percent !== percent) await recordAedEvent(a._id, 'battery', { detail: `${percent}%` });
    }
    if (b.door === 'closed') await recordAedEvent(a._id, 'door_closed');
    if (b.door === 'opened') {
      const expected = await AedEvent.exists({ aed: a._id, type: { $in: ['code_given', 'code_viewed'] }, at: { $gt: new Date(Date.now() - EXPECTED_OPEN_MS) } });
      await recordAedEvent(a._id, 'door_opened', expected ? {} : { alert: true, detail: 'Nobody was given the code' });
      if (!expected) {
        await blockchainService.append({ entity: 'aed', entityId: String(a._id), action: 'cabinet_opened', actor: 'cabinet' });
        getIO().to('dispatchers').emit('aed:alert', { id: String(a._id), name: a.name, at: new Date() });
      }
    }
    res.status(204).end();
  } catch (e) { next(e); }
});

r.use(authRequired);

const toView = (a: any, from?: [number, number]) => ({
  id: String(a._id),
  name: a.name,
  placement: a.placement,
  access: a.access,
  coordinates: a.location?.coordinates,
  padsExpireAt: a.padsExpireAt,
  battery: a.battery?.percent != null ? { percent: a.battery.percent, at: a.battery.at, source: a.battery.source } : undefined,
  // Whether the cabinet is locked with a code; the code itself only comes from POST /:id/code.
  hasCode: !!a.cabinetCode,
  verified: !!a.verifiedAt,
  status: a.status ?? 'ok',
  problem: a.problem?.note,
  distanceM: from ? Math.round(haversineKm(from, a.location.coordinates) * 1000) : undefined,
});

// Nearest devices first. Without coordinates, returns everything (operator map).
r.get('/', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    const hasFix = req.query.lng && req.query.lat && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
    const items = hasFix
      ? await Aed.find(nearQuery(lng, lat, 10_000)).select('+cabinetCode').limit(20).lean()
      : await Aed.find().select('+cabinetCode').sort('-createdAt').limit(500).lean();
    res.json(items.map(a => toView(a, hasFix ? [lng, lat] : undefined)));
  } catch (e) { next(e); }
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  placement: z.string().trim().max(240).optional(),
  access: z.enum(['24h', 'business_hours', 'restricted']).default('business_hours'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  padsExpireAt: z.string().datetime().optional(),
});

// Anyone can report a device; it stays "unverified" until an operator confirms it.
r.post('/', validate(createSchema), async (req: AuthReq, res, next) => {
  try {
    const b = req.body as z.infer<typeof createSchema>;
    const dupe = await Aed.findOne(nearQuery(b.coordinates[0], b.coordinates[1], 15)).lean();
    if (dupe) return res.status(409).json({ error: 'A defibrillator is already registered at this spot', aed: toView(dupe) });
    const a = await Aed.create({
      name: b.name,
      placement: b.placement,
      access: b.access,
      location: { type: 'Point', coordinates: b.coordinates },
      padsExpireAt: b.padsExpireAt ? new Date(b.padsExpireAt) : undefined,
      reportedBy: req.user!.id,
    });
    res.status(201).json(toView(a.toObject()));
  } catch (e) { next(e); }
});

const problemSchema = z.object({ note: z.string().trim().min(2).max(240) });

// Anyone who finds a device missing, broken or locked away flags it; dispatch skips it until checked.
r.post('/:id/problem', validate(problemSchema), async (req: AuthReq, res, next) => {
  try {
    // One person cannot take the whole registry out of dispatch: three open reports a day.
    const today = { 'problem.reportedBy': req.user!.id, 'problem.reportedAt': { $gt: new Date(Date.now() - 864e5) } };
    if (await Aed.countDocuments(today) >= 3) {
      return res.status(429).json({ error: 'You have reported three problems today. A dispatcher is checking them.' });
    }
    const a = await Aed.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'needs_check', problem: { note: req.body.note, reportedAt: new Date(), reportedBy: req.user!.id } } },
      { new: true },
    ).select('+cabinetCode').lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    await recordAedEvent(a._id, 'problem', { by: req.user!.id, detail: req.body.note });
    res.json(toView(a));
  } catch (e) { next(e); }
});

const editSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  placement: z.string().trim().max(240).optional(),
  access: z.enum(['24h', 'business_hours', 'restricted']).optional(),
  padsExpireAt: z.string().datetime().nullable().optional(),
  status: z.enum(['ok', 'needs_check', 'out_of_service']).optional(),
  // A reading taken at an inspection.
  batteryPercent: z.number().int().min(0).max(100).optional(),
  // The cabinet's keypad code; null removes it (an unlocked cabinet).
  cabinetCode: z.string().regex(/^\d{4,8}$/, 'The code is 4 to 8 digits').nullable().optional(),
}).strict();

r.patch('/:id', allow('eso'), validate(editSchema), async (req: AuthReq, res, next) => {
  try {
    const { batteryPercent, cabinetCode, ...b } = req.body as z.infer<typeof editSchema>;
    const set: Record<string, unknown> = { ...b };
    if (b.padsExpireAt !== undefined) set.padsExpireAt = b.padsExpireAt ? new Date(b.padsExpireAt) : null;
    if (batteryPercent !== undefined) set.battery = { percent: batteryPercent, at: new Date(), source: 'inspection', by: req.user!.id };
    if (cabinetCode) set.cabinetCode = seal(cabinetCode);
    const update = { ...(Object.keys(set).length ? { $set: set } : {}), ...(cabinetCode === null ? { $unset: { cabinetCode: '' } } : {}) };
    const a = await Aed.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('+cabinetCode').lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (batteryPercent !== undefined) await recordAedEvent(a._id, 'battery', { by: req.user!.id, detail: `${batteryPercent}%` });
    if (cabinetCode !== undefined) {
      await recordAedEvent(a._id, 'code_changed', { by: req.user!.id, detail: cabinetCode ? undefined : 'Code removed' });
      await blockchainService.append({ entity: 'aed', entityId: String(a._id), action: 'code_changed', actor: req.user!.id });
    }
    res.json(toView(a));
  } catch (e) { next(e); }
});

const revealSchema = z.object({
  emergencyId: objectId.optional(),
  reason: z.string().trim().max(200).optional(),
}).strict();

// An operator reads the code out to whoever is at the cabinet. Every read is logged here and in the call log.
r.post('/:id/code', allow('eso'), validate(revealSchema), async (req: AuthReq, res, next) => {
  try {
    const b = req.body as z.infer<typeof revealSchema>;
    const a = await Aed.findById(req.params.id).select('+cabinetCode').lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    const code = unseal(a.cabinetCode);
    if (!code) return res.status(404).json({ error: a.cabinetCode ? 'The stored code can\'t be read. Set it again.' : 'This cabinet has no code set.' });
    await recordAedEvent(a._id, 'code_viewed', { by: req.user!.id, emergency: b.emergencyId, detail: b.reason });
    await blockchainService.append({ entity: 'aed', entityId: String(a._id), action: 'code_viewed', actor: req.user!.id, ...(b.emergencyId ? { emergency: b.emergencyId } : {}) });
    res.set('Cache-Control', 'no-store').json({ code });
  } catch (e) { next(e); }
});

// Who had the code, who took it out and brought it back, and what the cabinet reported. Newest first.
r.get('/:id/events', allow('eso'), async (req, res, next) => {
  try {
    if (!objectId.safeParse(req.params.id).success) return res.status(404).json({ error: 'Not found' });
    const events = await AedEvent.find({ aed: req.params.id }).sort('-at').limit(100).populate('by', 'name role').lean();
    res.json(events.map((e: any) => ({
      id: String(e._id),
      type: e.type,
      at: e.at,
      by: e.by ? { name: e.by.name, role: e.by.role } : null,
      emergency: e.emergency ? String(e.emergency) : undefined,
      detail: e.detail,
      alert: e.alert || undefined,
    })));
  } catch (e) { next(e); }
});

// Verifying confirms the device is there and usable, so it also clears a reported problem,
// and puts one a runner took back in service.
r.post('/:id/verify', allow('eso'), async (req: AuthReq, res, next) => {
  try {
    const a = await Aed.findByIdAndUpdate(
      req.params.id,
      { $set: { verifiedAt: new Date(), verifiedBy: req.user!.id, status: 'ok' }, $unset: { problem: '' } },
      { new: false },
    ).select('+cabinetCode').lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    await recordAedEvent(a._id, a.status === 'in_use' ? 'returned' : 'verified', { by: req.user!.id });
    res.json(toView({ ...a, verifiedAt: new Date(), status: 'ok', problem: undefined }));
  } catch (e) { next(e); }
});

r.delete('/:id', allow('eso'), async (req, res, next) => {
  try {
    const a = await Aed.findByIdAndDelete(req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
