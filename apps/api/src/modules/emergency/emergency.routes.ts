import { Router } from 'express';
import { authRequired, AuthReq } from '../../middleware/auth';
import { emergencyAccess } from '../../realtime/socket';
import { ContactAlert } from '../../models/ContactAlert';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { emergencyController, createEmergencySchema, statusSchema, aedStatusSchema, reportSchema, actionSchema } from './emergency.controller';
import { nearQuery } from '../../utils/geo';
import { Hospital } from '../../models/Hospital';
import { RESPONDER_ROLES } from '../../models/User';

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

r.post('/', allow('citizen', 'blood_donor', 'student_responder', 'doctor', 'nurse'), validate(createEmergencySchema), emergencyController.create);
r.get('/mine', emergencyController.mine);
r.post('/:id/accept', allow(...RESPONDER_ROLES), emergencyController.accept);
// Fine-grained checks (caller may cancel, assigned responder may progress) live in the service.
r.patch('/:id/status', validate(statusSchema), emergencyController.updateStatus);
r.patch('/:id/aed', allow(...RESPONDER_ROLES), validate(aedStatusSchema), emergencyController.aedStatus);
r.get('/:id/handover', emergencyController.handover);
r.put('/:id/report', allow(...RESPONDER_ROLES), validate(reportSchema), emergencyController.saveReport);
r.get('/:id/reports', emergencyController.reports);
// Who in the caller's circle was texted, and whether it worked. The caller and operators only.
r.get('/:id/alerts', async (req: AuthReq, res, next) => {
  try {
    const access = await emergencyAccess(req.user!, req.params.id);
    if (access !== 'citizen' && access !== 'operator') return res.status(403).json({ error: 'Not your emergency' });
    const list = await ContactAlert.find({ emergency: req.params.id }).sort('at').lean();
    res.json(list.map(a => ({ name: a.name, phone: `…${a.phone.slice(-3)}`, withLocation: a.withLocation, status: a.status, at: a.at })));
  } catch (e) { next(e); }
});
r.post('/:id/escalation/ack', allow('eso'), emergencyController.acknowledgeEscalation);
r.post('/:id/actions', allow('eso'), validate(actionSchema), emergencyController.recordAction);
r.get('/', allow('eso', ...RESPONDER_ROLES), emergencyController.list);
export default r;
