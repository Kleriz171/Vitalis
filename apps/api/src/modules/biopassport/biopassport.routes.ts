import { Router } from 'express';
import { authRequired, AuthReq } from '../../middleware/auth';
import { User } from '../../models/User';
import { generateQR } from '../../utils/qr';

const r = Router();
r.use(authRequired);

r.get('/me', async (req: AuthReq, res, next) => {
  try {
    const u = await User.findById(req.user!.id).lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    const qr = await generateQR({
      id: u._id, bloodType: u.bloodType, allergies: u.allergies, contact: u.emergencyContact,
    });
    res.json({ profile: u, qr });
  } catch (e) { next(e); }
});

r.patch('/me', async (req: AuthReq, res, next) => {
  try {
    const u = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true });
    res.json(u);
  } catch (e) { next(e); }
});

export default r;
