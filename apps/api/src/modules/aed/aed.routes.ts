import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { Aed } from '../../models/Aed';
import { nearQuery, haversineKm } from '../../utils/geo';

const r = Router();
r.use(authRequired);

const toView = (a: any, from?: [number, number]) => ({
  id: String(a._id),
  name: a.name,
  placement: a.placement,
  access: a.access,
  coordinates: a.location?.coordinates,
  padsExpireAt: a.padsExpireAt,
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
      ? await Aed.find(nearQuery(lng, lat, 10_000)).limit(20).lean()
      : await Aed.find().sort('-createdAt').limit(500).lean();
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
    ).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(toView(a));
  } catch (e) { next(e); }
});

const editSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  placement: z.string().trim().max(240).optional(),
  access: z.enum(['24h', 'business_hours', 'restricted']).optional(),
  padsExpireAt: z.string().datetime().nullable().optional(),
  status: z.enum(['ok', 'needs_check', 'out_of_service']).optional(),
}).strict();

r.patch('/:id', allow('eso'), validate(editSchema), async (req, res, next) => {
  try {
    const b = req.body as z.infer<typeof editSchema>;
    const set: Record<string, unknown> = { ...b };
    if (b.padsExpireAt !== undefined) set.padsExpireAt = b.padsExpireAt ? new Date(b.padsExpireAt) : null;
    const a = await Aed.findByIdAndUpdate(req.params.id, { $set: set }, { new: true, runValidators: true }).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(toView(a));
  } catch (e) { next(e); }
});

// Verifying confirms the device is there and usable, so it also clears a reported problem.
r.post('/:id/verify', allow('eso'), async (req: AuthReq, res, next) => {
  try {
    const a = await Aed.findByIdAndUpdate(
      req.params.id,
      { $set: { verifiedAt: new Date(), verifiedBy: req.user!.id, status: 'ok' }, $unset: { problem: '' } },
      { new: true },
    ).lean();
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(toView(a));
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
