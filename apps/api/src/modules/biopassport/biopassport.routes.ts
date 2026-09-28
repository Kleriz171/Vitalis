import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User, ageOf } from '../../models/User';
import { generateQR } from '../../utils/qr';
import { Allergy, Medication, Vaccination, Condition, Disability } from '../../models/HealthRecord';
import { hasResponderCertification } from '../../models/Training';

const r = Router();
r.use(authRequired);

r.get('/me', async (req: AuthReq, res, next) => {
  try {
    const [u, allergies, medications, vaccinations, conditions, disabilities] = await Promise.all([
      User.findById(req.user!.id).lean(),
      Allergy.find({ user: req.user!.id }).sort('-createdAt').lean(),
      Medication.find({ user: req.user!.id }).sort('-createdAt').lean(),
      Vaccination.find({ user: req.user!.id }).sort('-date').lean(),
      Condition.find({ user: req.user!.id }).sort('-createdAt').lean(),
      Disability.find({ user: req.user!.id }).sort('-createdAt').lean(),
    ]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    // The QR is readable by any camera, so it carries only what a first responder
    // needs in the first minutes. The full record stays behind auth.
    const qr = await generateQR({
      v: 1,
      name: u.name,
      bloodType: u.bloodType,
      age: ageOf(u),
      allergies: allergies.map(a => `${a.allergen} (${a.severity})`),
      conditions: [...new Set([...conditions.map(c => c.name), ...(u.illnesses ?? [])])],
      medications: medications.filter(m => m.isActive).map(m => [m.name, m.dosage].filter(Boolean).join(' ')),
      contact: u.emergencyContact,
    });
    res.json({
      profile: {
        id: String(u._id),
        name: u.name,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        bloodType: u.bloodType,
        age: ageOf(u),
        gender: u.gender,
        heightCm: u.heightCm,
        weightKg: u.weightKg,
        illnesses: u.illnesses ?? [],
        available: !!u.available,
        disabilities: disabilities.map(d => ({ id: String(d._id), name: d.name, notes: d.notes })),
        allergies: allergies.map(a => ({ id: String(a._id), allergen: a.allergen, severity: a.severity })),
        medications: medications.map(m => ({ id: String(m._id), name: m.name, dosage: m.dosage, isActive: m.isActive })),
        vaccinations: vaccinations.map(v => ({ id: String(v._id), name: v.name, date: v.date, provider: v.provider })),
        conditions: conditions.map(c => ({ id: String(c._id), name: c.name, notes: c.notes })),
      },
      qr,
    });
  } catch (e) { next(e); }
});

// Only duty status and location are writable here; profile fields go through
// PATCH /health/profile (validated). Never pass req.body straight to the model.
const dutySchema = z.object({
  available: z.boolean().optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }).optional(),
}).strict();

r.patch('/me', validate(dutySchema), async (req: AuthReq, res, next) => {
  try {
    // Only clinicians or people with a valid CPR/AED certificate may receive SOS alerts.
    if (req.body.available === true
      && !['doctor', 'nurse'].includes(req.user!.role)
      && !(await hasResponderCertification(req.user!.id))) {
      return res.status(403).json({ error: 'Complete the CPR or AED course to go on duty' });
    }
    const set = req.body.location ? { ...req.body, locationAt: new Date() } : req.body;
    const u = await User.findByIdAndUpdate(req.user!.id, { $set: set }, { new: true, runValidators: true })
      .select('available location role').lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json({ available: u.available, location: u.location, role: u.role });
  } catch (e) { next(e); }
});

export default r;
