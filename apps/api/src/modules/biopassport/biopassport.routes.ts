import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User, ageOf } from '../../models/User';
import { generateTextQR } from '../../utils/qr';
import { Allergy, Medication, Vaccination, Condition, Disability } from '../../models/HealthRecord';
import { hasResponderCertification } from '../../models/Training';


type Facts = { allergies: any[]; medications: any[]; conditions: any[] };
/**
 * What a first responder needs in the first minutes, as short plain lines in the user's app
 * language. Shown by the Bio Passport QR (readable by any camera, offline) and the watch's
 * Medical ID. The full record stays behind auth.
 */
export function medicalLines(u: any, { allergies, medications, conditions }: Facts): string[] {
  const sq = u.language !== 'en';
  const L = sq
    ? { blood: 'Gjaku', allergy: 'Alergji', meds: 'Ilaçe', cond: 'Sëmundje', ice: 'Kontakt', sev: { mild: 'e lehtë', moderate: 'mesatare', severe: 'e rëndë' } as Record<string, string> }
    : { blood: 'Blood', allergy: 'Allergies', meds: 'Meds', cond: 'Conditions', ice: 'ICE', sev: { mild: 'mild', moderate: 'moderate', severe: 'severe' } as Record<string, string> };
  const age = ageOf(u);
  const lines = [
    `VITALIS · ${u.name}${age != null ? `, ${age}` : ''}`,
    `${L.blood}: ${u.bloodType ?? '?'}`,
    allergies.length ? `${L.allergy}: ${allergies.map(a => `${a.allergen} (${L.sev[a.severity] ?? a.severity})`).join(', ')}` : null,
    medications.some(m => m.isActive) ? `${L.meds}: ${medications.filter(m => m.isActive).map(m => [m.name, m.dosage].filter(Boolean).join(' ')).join(', ')}` : null,
    conditions.length || u.illnesses?.length ? `${L.cond}: ${[...new Set([...conditions.map(c => c.name), ...(u.illnesses ?? [])])].join(', ')}` : null,
    u.emergencyContact?.phone ? `${L.ice}: ${u.emergencyContact.name ?? ''} ${u.emergencyContact.phone}`.replace(/\s+/g, ' ') : null,
  ].filter(Boolean);
  return lines as string[];
}

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
    const lines = medicalLines(u, { allergies, medications, conditions });
    const qr = await generateTextQR(lines.join('\n'));
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
