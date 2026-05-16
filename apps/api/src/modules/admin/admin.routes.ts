import { Router } from 'express';
import { z } from 'zod';
import { User } from '../../models/User';
import { Medication, Allergy, Vaccination, Appointment, Condition, Disability } from '../../models/HealthRecord';
import { Emergency } from '../../models/Emergency';
import { Certification, Enrollment } from '../../models/Training';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';

const r = Router();
r.use(authRequired, allow('admin'));

const createDispatcherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

r.post('/dispatchers', validate(createDispatcherSchema), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'Email already used' });
    const user = await User.create({
      email,
      password,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: `${firstName.trim()} ${lastName.trim()}`,
      role: 'dispatcher',
    });
    res.status(201).json({ id: user._id, email: user.email, name: user.name, role: user.role });
  } catch (e) { next(e); }
});

r.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().sort('-createdAt').limit(500).select('email name role createdAt');
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

r.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (user.role === 'admin') return res.status(400).json({ error: 'Cannot delete admin' });
    await user.deleteOne();
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
