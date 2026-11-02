import { Router } from 'express';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { User } from '../../models/User';
import { Hospital } from '../../models/Hospital';

// Hospital staff see their own hospital only: the hospital comes from the account, never the request.
const r = Router();
r.use(authRequired, allow('hospital'));

r.get('/me', async (req: AuthReq, res, next) => {
  try {
    const me = await User.findById(req.user!.id).select('hospital').lean();
    const h = me?.hospital ? await Hospital.findById(me.hospital).lean() : null;
    if (!h) return res.status(404).json({ error: 'This account is not linked to a hospital' });
    res.json({
      id: String(h._id),
      name: h.name,
      type: h.type,
      address: h.address,
      phone: h.phone,
      isOpen24h: h.isOpen24h,
      coordinates: (h.location as any)?.coordinates,
    });
  } catch (e) { next(e); }
});

export default r;
