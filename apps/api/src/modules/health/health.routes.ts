import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User, BLOOD_TYPES, GENDERS } from '../../models/User';
import {
  Medication,
  Allergy,
  Vaccination,
  Appointment,
  Condition,
  Disability,
} from '../../models/HealthRecord';

const r = Router();
r.use(authRequired);

const listStrings = (items?: string[]) =>
  [...new Set((items ?? []).map(item => item.trim()).filter(Boolean))];

const serializeUser = (user: any) => ({
  id: String(user._id),
  email: user.email,
  name: user.name,
  firstName: user.firstName,
  lastName: user.lastName,
  role: user.role,
  bloodType: user.bloodType,
  age: user.age,
  gender: user.gender,
  heightCm: user.heightCm,
  weightKg: user.weightKg,
  illnesses: user.illnesses ?? [],
  disabilities: user.disabilities ?? [],
});

async function loadProfile(userId: string) {
  const [user, medications, allergies, vaccinations, appointments, conditions, disabilities] = await Promise.all([
    User.findById(userId).lean(),
    Medication.find({ user: userId }).sort('-createdAt').lean(),
    Allergy.find({ user: userId }).sort('-createdAt').lean(),
    Vaccination.find({ user: userId }).sort('-date').lean(),
    Appointment.find({ user: userId }).sort('-scheduledAt').limit(50).lean(),
    Condition.find({ user: userId }).sort('-createdAt').lean(),
    Disability.find({ user: userId }).sort('-createdAt').lean(),
  ]);

  if (!user) throw Object.assign(new Error('Not found'), { status: 404 });

  return {
    user: serializeUser(user),
    medications: medications.map(m => ({
      id: String(m._id),
      name: m.name,
      dosage: m.dosage,
      isActive: m.isActive,
    })),
    allergies: allergies.map(a => ({
      id: String(a._id),
      allergen: a.allergen,
      severity: a.severity,
    })),
    vaccinations: vaccinations.map(v => ({
      id: String(v._id),
      name: v.name,
      date: v.date,
      provider: v.provider,
    })),
    appointments: appointments.map(a => ({
      id: String(a._id),
      appointmentType: a.appointmentType,
      scheduledAt: a.scheduledAt,
      status: a.status,
      notes: a.notes,
    })),
    conditions: conditions.map(c => ({
      id: String(c._id),
      name: c.name,
      notes: c.notes,
    })),
    disabilities: disabilities.map(d => ({
      id: String(d._id),
      name: d.name,
      notes: d.notes,
    })),
  };
}

r.get('/profile', async (req: AuthReq, res, next) => {
  try {
    res.json(await loadProfile(req.user!.id));
  } catch (e) { next(e); }
});

const profileSchema = z.object({
  bloodType: z.enum(BLOOD_TYPES).optional(),
  age: z.number().int().min(0).max(130).optional(),
  gender: z.enum(GENDERS).optional(),
  heightCm: z.number().min(30).max(300).optional(),
  weightKg: z.number().min(1).max(500).optional(),
  illnesses: z.array(z.string().min(1)).optional(),
  disabilities: z.array(z.string().min(1)).optional(),
});

r.patch('/profile', validate(profileSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof profileSchema>;
    const updates: Record<string, unknown> = { ...body };
    if (body.illnesses) updates.illnesses = listStrings(body.illnesses);
    if (body.disabilities) updates.disabilities = listStrings(body.disabilities);
    const user = await User.findByIdAndUpdate(req.user!.id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json({ user: serializeUser(user) });
  } catch (e) { next(e); }
});

// Medications
r.get('/medications', async (req: AuthReq, res, next) => {
  try {
    const items = await Medication.find({ user: req.user!.id }).sort('-createdAt').lean();
    res.json(items.map(m => ({
      id: String(m._id), name: m.name, dosage: m.dosage, isActive: m.isActive,
    })));
  } catch (e) { next(e); }
});

const medSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  isActive: z.boolean().default(true),
});
r.post('/medications', validate(medSchema), async (req: AuthReq, res, next) => {
  try {
    const m = await Medication.create({ ...req.body, user: req.user!.id });
    res.status(201).json({ id: String(m._id) });
  } catch (e) { next(e); }
});
r.delete('/medications/:id', async (req: AuthReq, res, next) => {
  try {
    await Medication.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Allergies
r.get('/allergies', async (req: AuthReq, res, next) => {
  try {
    const items = await Allergy.find({ user: req.user!.id }).sort('-createdAt').lean();
    res.json(items.map(a => ({
      id: String(a._id), allergen: a.allergen, severity: a.severity,
    })));
  } catch (e) { next(e); }
});

const allergySchema = z.object({
  allergen: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'severe']).default('mild'),
});
r.post('/allergies', validate(allergySchema), async (req: AuthReq, res, next) => {
  try {
    const a = await Allergy.create({ ...req.body, user: req.user!.id });
    res.status(201).json({ id: String(a._id) });
  } catch (e) { next(e); }
});
r.delete('/allergies/:id', async (req: AuthReq, res, next) => {
  try {
    await Allergy.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Vaccinations
r.get('/vaccinations', async (req: AuthReq, res, next) => {
  try {
    const items = await Vaccination.find({ user: req.user!.id }).sort('-date').lean();
    res.json(items.map(v => ({
      id: String(v._id), name: v.name, date: v.date, provider: v.provider,
    })));
  } catch (e) { next(e); }
});

const vaccinationSchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime().optional(),
  provider: z.string().optional(),
});
r.post('/vaccinations', validate(vaccinationSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof vaccinationSchema>;
    const v = await Vaccination.create({
      user: req.user!.id,
      name: body.name,
      date: body.date ? new Date(body.date) : undefined,
      provider: body.provider,
    });
    res.status(201).json({ id: String(v._id) });
  } catch (e) { next(e); }
});
r.delete('/vaccinations/:id', async (req: AuthReq, res, next) => {
  try {
    await Vaccination.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Appointments
r.get('/appointments', async (req: AuthReq, res, next) => {
  try {
    const items = await Appointment.find({ user: req.user!.id }).sort('-scheduledAt').limit(50).lean();
    res.json(items.map(a => ({
      id: String(a._id),
      appointmentType: a.appointmentType,
      scheduledAt: a.scheduledAt,
      status: a.status,
      notes: a.notes,
    })));
  } catch (e) { next(e); }
});

const appointmentSchema = z.object({
  appointmentType: z.enum(['consultation', 'emergency', 'checkup']).default('consultation'),
  scheduledAt: z.string().datetime(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).default('scheduled'),
  notes: z.string().optional(),
});
r.post('/appointments', validate(appointmentSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof appointmentSchema>;
    const appointment = await Appointment.create({
      user: req.user!.id,
      appointmentType: body.appointmentType,
      scheduledAt: new Date(body.scheduledAt),
      status: body.status,
      notes: body.notes,
    });
    res.status(201).json({ id: String(appointment._id) });
  } catch (e) { next(e); }
});
r.delete('/appointments/:id', async (req: AuthReq, res, next) => {
  try {
    await Appointment.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Conditions
const noteSchema = z.object({
  name: z.string().min(1),
  notes: z.string().optional(),
});

r.post('/conditions', validate(noteSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof noteSchema>;
    const created = await Condition.create({ user: req.user!.id, name: body.name, notes: body.notes });
    res.status(201).json({ id: String(created._id) });
  } catch (e) { next(e); }
});

r.delete('/conditions/:id', async (req: AuthReq, res, next) => {
  try {
    await Condition.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Disabilities
r.post('/disabilities', validate(noteSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof noteSchema>;
    const created = await Disability.create({ user: req.user!.id, name: body.name, notes: body.notes });
    res.status(201).json({ id: String(created._id) });
  } catch (e) { next(e); }
});

r.delete('/disabilities/:id', async (req: AuthReq, res, next) => {
  try {
    await Disability.deleteOne({ _id: req.params.id, user: req.user!.id });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
