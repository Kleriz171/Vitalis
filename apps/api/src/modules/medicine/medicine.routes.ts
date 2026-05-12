import { Router } from 'express';
import { MedicineInventory } from '../../models/MedicineInventory';
import { authRequired } from '../../middleware/auth';
import { nearQuery } from '../../utils/geo';

const r = Router();
r.use(authRequired);

r.get('/search', async (req, res, next) => {
  try {
    const { q, lng, lat, radius = 8000 } = req.query as any;
    const filter: any = {};
    if (q) filter['medicine.name'] = new RegExp(q, 'i');
    if (lng && lat) Object.assign(filter, nearQuery(+lng, +lat, +radius));
    res.json(await MedicineInventory.find(filter).limit(25));
  } catch (e) { next(e); }
});

r.post('/:id/reserve', async (req, res, next) => {
  try {
    const inv = await MedicineInventory.findById(req.params.id);
    if (!inv || (inv.stock as number) < 1) return res.status(409).json({ error: 'Out of stock' });
    inv.stock = (inv.stock as number) - 1;
    await inv.save();
    res.json({ reserved: true, inventory: inv });
  } catch (e) { next(e); }
});

export default r;
