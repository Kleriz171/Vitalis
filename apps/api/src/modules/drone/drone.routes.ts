import { Router } from 'express';
import { DroneMission } from '../../models/DroneMission';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { getIO } from '../../realtime/socket';

const r = Router();
r.use(authRequired, allow('dispatcher','admin'));

r.post('/', async (req, res, next) => {
  try {
    const m = await DroneMission.create(req.body);
    getIO().to('dispatchers').emit('drone:mission', m);
    res.status(201).json(m);
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    const m = await DroneMission.findByIdAndUpdate(req.params.id, req.body, { new: true });
    getIO().to('dispatchers').emit('drone:update', m);
    res.json(m);
  } catch (e) { next(e); }
});

r.get('/', async (_req, res, next) => {
  try { res.json(await DroneMission.find().sort('-createdAt').limit(50)); } catch (e) { next(e); }
});

export default r;
