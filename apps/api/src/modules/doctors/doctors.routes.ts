import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { Doctor } from '../../models/Doctor';
import { Appointment } from '../../models/HealthRecord';

const r = Router();
r.use(authRequired);

r.get('/', async (req, res, next) => {
  try {
    const { search, specialty, availableOnline } = req.query as Record<string, string | undefined>;
    const q: Record<string, unknown> = {};
    if (specialty && specialty !== 'all') q.specialty = specialty;
    if (availableOnline === 'true') q.availableOnline = true;
    if (search) {
      q.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialty: { $regex: search, $options: 'i' } },
        { biography: { $regex: search, $options: 'i' } },
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
    })));
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    const d = await Doctor.findById(req.params.id).lean();
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json({ ...d, id: String(d._id) });
  } catch (e) { next(e); }
});

const bookSchema = z.object({
  scheduledAt: z.string().datetime(),
  appointmentType: z.enum(['consultation', 'emergency', 'checkup']).default('consultation'),
  notes: z.string().optional(),
});

r.post('/:id/book', validate(bookSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof bookSchema>;
    const apt = await Appointment.create({
      user: req.user!.id,
      doctor: req.params.id,
      appointmentType: body.appointmentType,
      scheduledAt: new Date(body.scheduledAt),
      notes: body.notes,
    });
    res.status(201).json({ id: String(apt._id), status: apt.status });
  } catch (e) { next(e); }
});

export default r;
