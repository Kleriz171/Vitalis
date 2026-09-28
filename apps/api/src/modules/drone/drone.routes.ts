import { Router } from 'express';
import { z } from 'zod';
import { DroneMission } from '../../models/DroneMission';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { getIO } from '../../realtime/socket';

const r = Router();
r.use(authRequired, allow('dispatcher','admin'));

const point = z.object({
  type: z.literal('Point').default('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

const createSchema = z.object({
  emergency: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  droneId: z.string().trim().min(1).max(64),
  origin: point.optional(),
  destination: point.optional(),
  route: z.array(z.tuple([z.number(), z.number()])).max(500).optional(),
  payload: z.string().trim().max(200).optional(),
}).strict();

const updateSchema = z.object({
  status: z.enum(['queued','launched','in_flight','delivered','aborted']).optional(),
  route: z.array(z.tuple([z.number(), z.number()])).max(500).optional(),
  payload: z.string().trim().max(200).optional(),
}).strict();

r.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const m = await DroneMission.create(req.body);
    getIO().to('dispatchers').emit('drone:mission', m);
    res.status(201).json(m);
  } catch (e) { next(e); }
});

r.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const m = await DroneMission.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!m) return res.status(404).json({ error: 'Not found' });
    getIO().to('dispatchers').emit('drone:update', m);
    res.json(m);
  } catch (e) { next(e); }
});

r.get('/', async (_req, res, next) => {
  try { res.json(await DroneMission.find().sort('-createdAt').limit(50)); } catch (e) { next(e); }
});

export default r;
