import { Router } from 'express';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { jobs, startedAt } from '../../utils/jobs';
import { ContactAlert } from '../../models/ContactAlert';
import { fleetSnapshot } from '../../realtime/drones';
import { z } from 'zod';
import { User } from '../../models/User';
import { Medication, Allergy, Vaccination, Appointment, Condition, Disability } from '../../models/HealthRecord';
import { Emergency } from '../../models/Emergency';
import { Certification, Enrollment, RESPONDER_COURSES } from '../../models/Training';
import { Doctor } from '../../models/Doctor';
import { Hospital } from '../../models/Hospital';
import { AccessLog, logAccess } from '../../models/AccessLog';
import { AdminAction, recordAdminAction } from '../../models/AdminAction';
import { revokeUser } from '../../middleware/auth';
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
    await recordAdminAction((req as AuthReq).user!.id, 'staff_created', user._id, role);
    res.status(201).json({ id: user._id, email: user.email, name: user.name, role: user.role });
  } catch (e) { next(e); }
});

r.get('/users', async (_req, res, next) => {
  try {
    const users = await User.find().sort('-createdAt').limit(500).select('email name role createdAt hospital suspendedAt').populate('hospital', 'name').lean();
    res.json(users);
  } catch (e) { next(e); }
});

r.get('/users/:id', async (req: AuthReq, res, next) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Administrators see every medical record; each opening is in the person's access log.
    await logAccess({ subject: user._id, actor: req.user!.id, actorRole: 'admin', kind: 'admin_record' });
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
    await recordAdminAction(req.user!.id, 'responder_removed', user._id, `was ${user.role}`);
    res.json({ role: 'citizen' });
  } catch (e) { next(e); }
});

r.delete('/users/:id', async (req: AuthReq, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    // Administrators may remove each other, never themselves: someone must always be left to run the console.
    if (String(user._id) === req.user!.id) return res.status(400).json({ error: 'You cannot remove your own account' });
    await recordAdminAction(req.user!.id, 'user_removed', user._id, `${user.role} ${user.email ?? user.phone ?? ''}`.trim());
    await user.deleteOne();
    revokeUser(String(user._id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Move a staff account between staff roles. Citizens and responders become staff only through a new
// staff account; nobody changes their own role (an administrator could otherwise lock everyone out).
const roleSchema = z.object({ role: z.enum(['eso', 'admin', 'hospital']), hospitalId: z.string().regex(/^[a-f0-9]{24}$/i).optional() }).strict()
  .refine(b => (b.role === 'hospital') === !!b.hospitalId, { message: 'Hospital staff need a hospital, and only they', path: ['hospitalId'] });
r.post('/users/:id/role', validate(roleSchema), async (req: AuthReq, res, next) => {
  try {
    if (req.params.id === req.user!.id) return res.status(400).json({ error: 'You cannot change your own role' });
    const { role, hospitalId } = req.body as z.infer<typeof roleSchema>;
    if (hospitalId && !(await Hospital.exists({ _id: hospitalId }))) return res.status(404).json({ error: 'No hospital with this id' });
    const before = await User.findOne({ _id: req.params.id, role: { $in: ['eso', 'admin', 'hospital'] } }).select('role').lean();
    if (!before) return res.status(404).json({ error: 'No staff account with this id' });
    await User.updateOne({ _id: req.params.id }, role === 'hospital' ? { $set: { role, hospital: hospitalId } } : { $set: { role }, $unset: { hospital: 1 } });
    await recordAdminAction(req.user!.id, 'role_changed', req.params.id, `${before.role} → ${role}`);
    res.json({ role });
  } catch (e) { next(e); }
});

// Suspend: no sign-in, no API, off duty, from the next request. Restore undoes it. Never yourself.
r.post('/users/:id/suspend', validate(z.object({ reason: z.string().trim().min(3).max(300) }).strict()), async (req: AuthReq, res, next) => {
  try {
    if (req.params.id === req.user!.id) return res.status(400).json({ error: 'You cannot suspend your own account' });
    const u = await User.findOneAndUpdate({ _id: req.params.id, suspendedAt: null }, { $set: { suspendedAt: new Date(), suspendedReason: req.body.reason, available: false }, $unset: { refreshTokenHash: 1 } }, { new: true }).lean();
    if (!u) return res.status(409).json({ error: 'Not found, or already suspended' });
    await recordAdminAction(req.user!.id, 'suspended', u._id, req.body.reason);
    res.json({ suspendedAt: u.suspendedAt, suspendedReason: u.suspendedReason });
  } catch (e) { next(e); }
});

r.post('/users/:id/restore', async (req: AuthReq, res, next) => {
  try {
    const u = await User.findOneAndUpdate({ _id: req.params.id, suspendedAt: { $ne: null } }, { $unset: { suspendedAt: 1, suspendedReason: 1 } }, { new: true }).lean();
    if (!u) return res.status(409).json({ error: 'Not found, or not suspended' });
    await recordAdminAction(req.user!.id, 'restored', u._id);
    res.json({ suspendedAt: null });
  } catch (e) { next(e); }
});

// The audit trail: what administrators did, and who opened whose medical record. Read only.
r.get('/audit', async (req, res, next) => {
  try {
    const kind = req.query.kind === 'access' ? 'access' : 'actions';
    const list = kind === 'access'
      ? await AccessLog.find().sort('-at').limit(300).populate('actor subject', 'name role').lean()
      : await AdminAction.find().sort('-at').limit(300).populate('actor target', 'name role').lean();
    res.json(list.map((x: any) => ({
      id: String(x._id), at: x.at, action: x.action ?? x.kind, detail: x.detail,
      actor: x.actor ? { name: x.actor.name, role: x.actor.role } : null,
      target: (x.target ?? x.subject) ? { id: String((x.target ?? x.subject)._id), name: (x.target ?? x.subject).name } : null,
    })));
  } catch (e) { next(e); }
});

// Measured health: what this API process sees now. Integrations without credentials say so.
r.get('/health', async (_req, res, next) => {
  try {
    const t0 = Date.now();
    await mongoose.connection.db!.admin().ping();
    const dbMs = Date.now() - t0;
    const day = new Date(Date.now() - 86_400_000);
    const texts = await ContactAlert.aggregate([{ $match: { at: { $gte: day } } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    const smsProvider = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
    res.json({
      api: { status: 'up', since: startedAt, version: (process.env.RENDER_GIT_COMMIT ?? 'local').slice(0, 7), node: process.version, demoMode: env.demoMode },
      database: { status: 'connected', pingMs: dbMs },
      jobs,
      texts24h: Object.fromEntries(texts.map(t => [t._id, t.n])),
      integrations: {
        sms: smsProvider ? 'configured' : env.demoMode || env.nodeEnv !== 'production' ? 'simulated (no provider)' : 'not configured',
        push: 'Expo push service (delivery not tracked)',
        assistant: env.geminiApiKey ? 'configured' : 'not configured',
        roadEta: env.osrmUrl ? 'configured' : 'straight-line estimate (no OSRM)',
        aedCabinets: env.aedDeviceKey ? 'configured' : 'not configured',
        droneBridges: env.droneBridgeKey ? `${fleetSnapshot().filter((d: any) => d.online).length} online` : 'not configured',
        mediaStore: env.mediaBucket ? 'Firebase Storage' : 'MongoDB (GridFS)',
      },
    });
  } catch (e) { next(e); }
});

export default r;
