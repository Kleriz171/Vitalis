import { Router } from 'express';
import { authRequired, AuthReq } from '../../middleware/auth';
import { User } from '../../models/User';
import { generateQR } from '../../utils/qr';
import { Allergy, Medication, Vaccination, Condition, Disability } from '../../models/HealthRecord';

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
    const qr = await generateQR({
      id: u._id,
      name: u.name,
      bloodType: u.bloodType,
      age: u.age,
      gender: u.gender,
      heightCm: u.heightCm,
      weightKg: u.weightKg,
      illnesses: u.illnesses ?? [],
      disabilities: disabilities.map(d => d.name),
      allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity })),
      medications: medications.map(m => ({ name: m.name, dosage: m.dosage, isActive: m.isActive })),
      vaccinations: vaccinations.map(v => ({ name: v.name, date: v.date, provider: v.provider })),
      conditions: conditions.map(c => ({ name: c.name, notes: c.notes })),
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
        age: u.age,
        gender: u.gender,
        heightCm: u.heightCm,
        weightKg: u.weightKg,
        illnesses: u.illnesses ?? [],
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

r.patch('/me', async (req: AuthReq, res, next) => {
  try {
    const u = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true });
    res.json(u);
  } catch (e) { next(e); }
});

export default r;
