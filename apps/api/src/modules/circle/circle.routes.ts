import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User } from '../../models/User';

// The emergency circle: up to five people texted on an SOS (besides the emergency contact). Each one
// can be paused (notify) and kept from seeing the location (shareLocation).
const r = Router();
r.use(authRequired);

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use the international format, e.g. +355691234567'),
  notify: z.boolean().default(true),
  shareLocation: z.boolean().default(true),
}).strict();

const view = (u: any) => ({
  emergencyContact: u.emergencyContact?.phone ? { name: u.emergencyContact.name, phone: u.emergencyContact.phone } : null,
  circle: (u.circle ?? []).map((c: any) => ({ id: String(c._id), name: c.name, phone: c.phone, notify: c.notify, shareLocation: c.shareLocation })),
});

r.get('/', async (req: AuthReq, res, next) => {
  try { res.json(view(await User.findById(req.user!.id).select('emergencyContact circle').lean())); } catch (e) { next(e); }
});

r.put('/', validate(z.object({ circle: z.array(contactSchema).max(5) }).strict()
  .refine(b => new Set(b.circle.map(c => c.phone)).size === b.circle.length, { message: 'Each person once', path: ['circle'] })), async (req: AuthReq, res, next) => {
  try {
    const u = await User.findByIdAndUpdate(req.user!.id, { $set: { circle: req.body.circle } }, { new: true, runValidators: true }).select('emergencyContact circle').lean();
    res.json(view(u));
  } catch (e) { next(e); }
});

export default r;
