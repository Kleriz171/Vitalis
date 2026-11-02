import { Router } from 'express';
import { z } from 'zod';
import { User } from '../../models/User';
import { Medication, Allergy, Vaccination, Appointment, Condition, Disability } from '../../models/HealthRecord';
import { Emergency } from '../../models/Emergency';
import { Certification, Enrollment, RESPONDER_COURSES } from '../../models/Training';
import { Doctor } from '../../models/Doctor';
import { Hospital } from '../../models/Hospital';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';

const r = Router();
r.use(authRequired, allow('admin'));

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: z.enum(['eso', 'admin', 'hospital']),
  hospitalId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
}).refine(b => (b.role === 'hospital') === !!b.hospitalId, { message: 'Hospital staff need a hospital, and only they', path: ['hospitalId'] });

// New console account: operator, administrator or hospital staff. Nobody can sign up for these.
r.post('/staff', validate(createStaffSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role, hospitalId } = req.body as z.infer<typeof createStaffSchema>;
    if (await User.exists({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email already used' });
    if (hospitalId && !(await Hospital.exists({ _id: hospitalId }))) return res.status(404).json({ error: 'No hospital with this id' });
    const user = await User.create({
      email, password, firstName, lastName, name: `${firstName} ${lastName}`, role, hospital: hospitalId,
    });
    res.status(201).json({ id: user._id, email: user.email, name: user.name, role: user.role });
  } catch (e) { next(e); }
});

r.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().sort('-createdAt').limit(500).select('email name role createdAt hospital').populate('hospital', 'name').lean();
    res.json(users);
  } catch (e) { next(e); }
});

r.get('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    const [medications, allergies, vaccinations, appointments, conditions, disabilities, emergencies, certifications, enrollments] =
      await Promise.all([
        Medication.find({ user: user._id }).lean(),
        Allergy.find({ user: user._id }).lean(),
        Vaccination.find({ user: user._id }).lean(),
        Appointment.find({ user: user._id }).sort('-scheduledAt').lean(),
        Condition.find({ user: user._id }).lean(),
        Disability.find({ user: user._id }).lean(),
        Emergency.find({ citizen: user._id }).sort('-createdAt').limit(50).lean(),
        Certification.find({ user: user._id }).sort('-issuedAt').lean(),
        Enrollment.find({ user: user._id }).lean(),
      ]);
    const { password, refreshTokenHash, ...safeUser } = user as any;
    res.json({
      user: safeUser,
      medications,
      allergies,
      vaccinations,
      appointments,
      conditions,
      disabilities,
      emergencies,
      certifications,
      enrollments,
    });
  } catch (e) { next(e); }
});

// Takes away responder powers but keeps the account: CPR/AED certificates revoked (so the quiz
// cannot bring them back), doctors leave the directory, role back to citizen, off duty at once.
r.post('/users/:id/remove-responder', async (req: AuthReq, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $in: ['student_responder', 'doctor', 'nurse'] } });
    if (!user) return res.status(404).json({ error: 'No responder with this id' });
    await Certification.updateMany(
      { user: user._id, courseSlug: { $in: RESPONDER_COURSES }, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedReason: 'Responder status removed by an administrator' } },
    );
    await Doctor.deleteMany({ user: user._id });
    await User.updateOne({ _id: user._id }, { $set: { role: 'citizen', available: false } });
    res.json({ role: 'citizen' });
  } catch (e) { next(e); }
});

r.delete('/users/:id', async (req: AuthReq, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Administrators may remove each other, never themselves: someone must always be left to run the console.
    if (String(user._id) === req.user!.id) return res.status(400).json({ error: 'You cannot remove your own account' });
    await user.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
