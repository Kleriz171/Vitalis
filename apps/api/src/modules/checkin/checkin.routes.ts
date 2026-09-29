import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { checkInService } from './checkin.service';

const r = Router();
r.use(authRequired);

const pin = z.string().regex(/^\d{4,6}$/, 'Use 4 to 6 digits');
const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

r.put('/pins', validate(z.object({ pin, duressPin: pin }).strict()), async (req: AuthReq, res, next) => {
  try { await checkInService.setPins(req.user!.id, req.body.pin, req.body.duressPin); res.status(204).end(); } catch (e) { next(e); }
});

r.get('/', async (req: AuthReq, res, next) => {
  try { res.json(await checkInService.status(req.user!.id)); } catch (e) { next(e); }
});

r.post('/', validate(z.object({
  minutes: z.number().int().min(5).max(720),
  note: z.string().trim().max(200).optional(),
  coordinates: lngLat.optional(),
}).strict()), async (req: AuthReq, res, next) => {
  try { res.status(201).json(await checkInService.start(req.user!.id, req.body.minutes, req.body.note, req.body.coordinates)); } catch (e) { next(e); }
});

const confirmSchema = z.object({ pin, coordinates: lngLat.optional() }).strict();
r.post('/:id/ok', validate(confirmSchema), async (req: AuthReq, res, next) => {
  try { res.json(await checkInService.confirm(req.user!.id, req.params.id, req.body.pin, 'ok', req.body.coordinates)); } catch (e) { next(e); }
});
r.post('/:id/cancel', validate(confirmSchema), async (req: AuthReq, res, next) => {
  try { res.json(await checkInService.confirm(req.user!.id, req.params.id, req.body.pin, 'cancel', req.body.coordinates)); } catch (e) { next(e); }
});

export default r;
