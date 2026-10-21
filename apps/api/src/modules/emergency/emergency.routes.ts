import { Router } from 'express';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { emergencyController, createEmergencySchema, statusSchema, aedStatusSchema } from './emergency.controller';
import { nearQuery } from '../../utils/geo';
import { Hospital } from '../../models/Hospital';

const r = Router();
r.use(authRequired);

// Albania. 127 is the ambulance line; 112 routes to all services.
const EMERGENCY_NUMBERS = [
  { id: 'ambulance', name: 'Ambulance', number: '127', category: 'ambulance' as const },
  { id: 'general', name: 'European emergency number', number: '112', category: 'general' as const },
  { id: 'police', name: 'Police', number: '129', category: 'police' as const },
  { id: 'fire', name: 'Fire brigade', number: '128', category: 'fire' as const },
];
r.get('/numbers', (_req, res) => res.json(EMERGENCY_NUMBERS));

// Every hospital in the country: nearest first when the phone says where it is, else by town.
r.get('/hospitals', async (req, res, next) => {
  try {
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    const near = req.query.lng && req.query.lat && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;
    const items = near
      ? await Hospital.find(nearQuery(lng, lat, 400_000)).lean()
      : await Hospital.find().sort('address').lean();
    res.json(items.map(h => ({
      id: String(h._id),
      name: h.name,
      address: h.address,
      phone: h.phone,
      isOpen24h: h.isOpen24h,
    })));
  } catch (e) { next(e); }
});

const RESPONDERS = ['doctor', 'nurse', 'student_responder', 'blood_donor'] as const;

r.post('/', allow('citizen', 'blood_donor', 'student_responder', 'doctor', 'nurse'), validate(createEmergencySchema), emergencyController.create);
r.get('/mine', emergencyController.mine);
r.post('/:id/accept', allow(...RESPONDERS), emergencyController.accept);
// Fine-grained checks (caller may cancel, assigned responder may progress) live in the service.
r.patch('/:id/status', validate(statusSchema), emergencyController.updateStatus);
r.patch('/:id/aed', allow(...RESPONDERS), validate(aedStatusSchema), emergencyController.aedStatus);
r.get('/:id/handover', emergencyController.handover);
r.get('/', allow('eso', ...RESPONDERS), emergencyController.list);
export default r;
