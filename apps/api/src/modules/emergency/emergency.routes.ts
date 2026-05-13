import { Router } from 'express';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { emergencyController } from './emergency.controller';
import { Hospital } from '../../models/Hospital';

const r = Router();
r.use(authRequired);

const EMERGENCY_NUMBERS = [
  { id: 'ambulance', name: 'Ambulance', number: '112', category: 'ambulance' as const },
  { id: 'police', name: 'Police', number: '129', category: 'police' as const },
  { id: 'fire', name: 'Fire brigade', number: '128', category: 'fire' as const },
  { id: 'poison', name: 'Poison control', number: '127', category: 'poison' as const },
];
r.get('/numbers', (_req, res) => res.json(EMERGENCY_NUMBERS));

r.get('/hospitals', async (_req, res, next) => {
  try {
    const items = await Hospital.find().lean();
    res.json(items.map(h => ({
      id: String(h._id),
      name: h.name,
      address: h.address,
      phone: h.phone,
      isOpen24h: h.isOpen24h,
    })));
  } catch (e) { next(e); }
});

r.post('/', allow('citizen','blood_donor'), emergencyController.create);
r.post('/:id/accept', allow('doctor','nurse','student_responder','blood_donor'), emergencyController.accept);
r.patch('/:id/status', allow('doctor','nurse','student_responder','dispatcher','admin'), emergencyController.updateStatus);
r.get('/', allow('dispatcher','admin','doctor','nurse'), emergencyController.list);
export default r;
