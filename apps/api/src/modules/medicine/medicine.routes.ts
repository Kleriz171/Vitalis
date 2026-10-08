import { Router } from 'express';
import { MedicineInventory } from '../../models/MedicineInventory';
import { authRequired } from '../../middleware/auth';
import { nearQuery } from '../../utils/geo';
import { escapeRegex } from '../../utils/regex';

const r = Router();
r.use(authRequired);

r.get('/search', async (req, res, next) => {
  try {
    const { q, lng, lat, radius = 8000 } = req.query as any;
    const filter: any = {};
    if (q) filter['medicine.name'] = new RegExp(escapeRegex(String(q)), 'i');
    const [x, y, rad] = [Number(lng), Number(lat), Math.min(Number(radius) || 8000, 50_000)];
    if (lng && lat && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90) Object.assign(filter, nearQuery(x, y, rad));
    res.json(await MedicineInventory.find(filter).limit(25));
  } catch (e) { next(e); }
});

r.post('/:id/reserve', async (req, res, next) => {
  try {
    // Atomic decrement: two people can't both reserve the last unit.
    const inv = await MedicineInventory.findOneAndUpdate(
      { _id: req.params.id, stock: { $gte: 1 } },
      { $inc: { stock: -1 } },
      { new: true },
    );
    if (!inv) return res.status(409).json({ error: 'Out of stock' });
    res.json({ reserved: true, inventory: inv });
  } catch (e) { next(e); }
});

export default r;
