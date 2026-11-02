import { Router } from 'express';
import { authRequired } from '../../middleware/auth';
import { Doctor } from '../../models/Doctor';
import { escapeRegex } from '../../utils/regex';

const r = Router();
r.use(authRequired);

r.get('/', async (req, res, next) => {
  try {
    const { search, specialty, availableOnline } = req.query as Record<string, string | undefined>;
    const q: Record<string, unknown> = {};
    if (specialty && specialty !== 'all') q.specialty = specialty;
    if (availableOnline === 'true') q.availableOnline = true;
    if (search) {
      const pattern = escapeRegex(search);
      q.$or = [
        { name: { $regex: pattern, $options: 'i' } },
        { specialty: { $regex: pattern, $options: 'i' } },
        { biography: { $regex: pattern, $options: 'i' } },
      ];
    }
    const docs = await Doctor.find(q).sort('-rating').limit(50).lean();
    res.json(docs.map(d => ({
      id: String(d._id),
      name: d.name,
      specialty: d.specialty,
      imageUrl: d.imageUrl,
      biography: d.biography,
      experience: d.experience,
      rating: d.rating,
      reviewCount: d.reviewCount,
      priceConsultation: d.priceConsultation,
      availableOnline: d.availableOnline,
      availableNow: d.availableNow,
      // Has a Vitalis account with hours and fees: patients can book in the app.
      bookable: !!d.user && (d.consultationTypes ?? []).some(t => t.active),
    })));
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const d = await Doctor.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    const { user, workingHours, daysOff, consultationTypes, ...rest } = d as any;
    res.json({
      ...rest,
      id: String(d._id),
      bookable: !!user && (consultationTypes ?? []).some((t: any) => t.active),
      consultationTypes: (consultationTypes ?? []).filter((t: any) => t.active)
        .map((t: any) => ({ id: String(t._id), name: t.name, minutes: t.minutes, price: t.price, online: t.online })),
    });
  } catch (e) { next(e); }
});

export default r;
