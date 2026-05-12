import { Router } from 'express';
import { Emergency } from '../../models/Emergency';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';

const r = Router();
r.use(authRequired, allow('dispatcher','admin'));

r.get('/kpis', async (_req, res, next) => {
  try {
    const [total, active, resolvedToday] = await Promise.all([
      Emergency.countDocuments(),
      Emergency.countDocuments({ status: { $in: ['pending','assigned','en_route','on_scene'] } }),
      Emergency.countDocuments({ status: 'resolved', updatedAt: { $gte: new Date(Date.now() - 86400000) } }),
    ]);
    const byType = await Emergency.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    res.json({ total, active, resolvedToday, byType });
  } catch (e) { next(e); }
});

export default r;
