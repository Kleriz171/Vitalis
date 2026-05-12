import { Router } from 'express';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { emergencyController } from './emergency.controller';

const r = Router();
r.use(authRequired);
r.post('/', allow('citizen','blood_donor'), emergencyController.create);
r.post('/:id/accept', allow('doctor','nurse','student_responder','blood_donor'), emergencyController.accept);
r.patch('/:id/status', allow('doctor','nurse','student_responder','dispatcher','admin'), emergencyController.updateStatus);
r.get('/', allow('dispatcher','admin','doctor','nurse'), emergencyController.list);
export default r;
