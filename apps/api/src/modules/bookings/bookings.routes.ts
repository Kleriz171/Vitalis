import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { Booking } from '../../models/Booking';
import { Doctor } from '../../models/Doctor';
import { User } from '../../models/User';
import { inTirana } from '../../utils/tirana';
import { book, bookableDoctor, freeSlots, isHhmm, reschedule, setStatus } from './bookings.service';

const ID = z.string().regex(/^[a-f0-9]{24}$/i);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const PATIENT_ROLES = ['citizen', 'blood_donor', 'student_responder', 'doctor', 'nurse'];

export const bookingView = (b: any) => ({
  id: String(b._id),
  doctor: b.doctor?.name ? { id: String(b.doctor._id), name: b.doctor.name, specialty: b.doctor.specialty } : { id: String(b.doctor) },
  patient: b.patient?.name ? { id: String(b.patient._id), name: b.patient.name } : { id: String(b.patient) },
  type: b.type,
  price: b.price,
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  status: b.status,
  reason: b.reason,
  shareRecord: b.shareRecord,
  summary: b.summary,
  followUpOf: b.followUpOf ? String(b.followUpOf) : undefined,
  history: (b.history ?? []).map((h: any) => ({ at: h.at, action: h.action, note: h.note })),
});

// ── Patients: book from the directory, see and change their own bookings ─────────────────────────

export const doctorBookingRoutes = Router();
doctorBookingRoutes.use(authRequired);

doctorBookingRoutes.get('/:id/slots', async (req, res, next) => {
  try {
    const q = z.object({ type: ID, from: DATE.optional(), days: z.coerce.number().int().min(1).max(31).default(14) }).safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: 'type is required' });
    const d = await bookableDoctor(req.params.id);
    res.json(await freeSlots(d, q.data.type, q.data.from ?? inTirana(new Date()).date, q.data.days));
  } catch (e) { next(e); }
});

const bookSchema = z.object({
  typeId: ID,
  startsAt: z.string().datetime(),
  reason: z.string().trim().max(500).optional(),
  shareRecord: z.boolean(),
}).strict();

doctorBookingRoutes.post('/:id/bookings', allow(...PATIENT_ROLES), validate(bookSchema), async (req: AuthReq, res, next) => {
  try {
    const d = await bookableDoctor(req.params.id);
    const b = await book(d, req.user!.id, req.body);
    res.status(201).json(bookingView({ ...b.toObject(), doctor: d }));
  } catch (e) { next(e); }
});

export const bookingRoutes = Router();
bookingRoutes.use(authRequired);

bookingRoutes.get('/mine', async (req: AuthReq, res, next) => {
  try {
    const list = await Booking.find({ patient: req.user!.id }).sort('-startsAt').limit(100).populate('doctor', 'name specialty').lean();
    res.json(list.map(bookingView));
  } catch (e) { next(e); }
});

bookingRoutes.post('/:id/cancel', validate(z.object({ note: z.string().trim().max(300).optional() }).strict()), async (req: AuthReq, res, next) => {
  try { res.json(bookingView(await setStatus(req.params.id, { id: req.user!.id, asClinician: false }, 'cancel', req.body.note))); } catch (e) { next(e); }
});

bookingRoutes.post('/:id/reschedule', validate(z.object({ startsAt: z.string().datetime() }).strict()), async (req: AuthReq, res, next) => {
  try { res.json(bookingView(await reschedule(req.params.id, { id: req.user!.id, asClinician: false }, req.body.startsAt))); } catch (e) { next(e); }
});

// ── Clinicians: their schedule, fees and consultations ────────────────────────────────────────────

export const clinicRoutes = Router();
clinicRoutes.use(authRequired, allow('doctor', 'nurse'));

const myDoctor = (userId: string) => Doctor.findOne({ user: userId }).lean();

const clinicView = (d: any) => d && {
  id: String(d._id),
  name: d.name,
  specialty: d.specialty,
  biography: d.biography,
  workingHours: d.workingHours ?? [],
  daysOff: d.daysOff ?? [],
  consultationTypes: (d.consultationTypes ?? []).map((t: any) => ({ id: String(t._id), name: t.name, minutes: t.minutes, price: t.price, online: t.online, active: t.active })),
};

clinicRoutes.get('/me', async (req: AuthReq, res, next) => {
  try { res.json(clinicView(await myDoctor(req.user!.id))); } catch (e) { next(e); }
});

const settingsSchema = z.object({
  specialty: z.string().trim().min(2).max(80).optional(),
  biography: z.string().trim().max(1000).optional(),
  workingHours: z.array(z.object({ day: z.number().int().min(0).max(6), start: z.string().refine(isHhmm), end: z.string().refine(isHhmm) })
    .refine(w => w.start < w.end, { message: 'Hours must end after they start' })).max(21),
  daysOff: z.array(DATE).max(366),
  consultationTypes: z.array(z.object({
    id: ID.optional(),
    name: z.string().trim().min(2).max(60),
    minutes: z.number().int().min(15).max(120).refine(m => m % 15 === 0, { message: 'Minutes in steps of 15' }),
    price: z.number().int().min(0).max(1_000_000),
    online: z.boolean().default(false),
    active: z.boolean().default(true),
  })).max(12),
}).strict();

// Changing a fee or a type never changes a booking: each booking keeps the copy it was made with.
clinicRoutes.put('/settings', validate(settingsSchema), async (req: AuthReq, res, next) => {
  try {
    const body = req.body as z.infer<typeof settingsSchema>;
    const me = await User.findById(req.user!.id).select('name role').lean();
    const set: Record<string, unknown> = {
      workingHours: body.workingHours,
      daysOff: [...new Set(body.daysOff)].sort(),
      consultationTypes: body.consultationTypes.map(({ id, ...t }) => ({ ...(id ? { _id: id } : {}), ...t })),
      ...(body.specialty ? { specialty: body.specialty } : {}),
      ...(body.biography !== undefined ? { biography: body.biography } : {}),
    };
    const d = await Doctor.findOneAndUpdate(
      { user: req.user!.id },
      { $set: set, $setOnInsert: { name: me!.name, ...(body.specialty ? {} : { specialty: me!.role === 'nurse' ? 'Nursing' : 'General practice' }) } },
      { new: true, upsert: true, runValidators: true },
    ).lean();
    res.json(clinicView(d));
  } catch (e) { next(e); }
});

clinicRoutes.get('/bookings', async (req: AuthReq, res, next) => {
  try {
    const q = z.object({ from: z.string().datetime(), to: z.string().datetime() }).safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: 'from and to are required' });
    const list = await Booking.find({ clinician: req.user!.id, startsAt: { $lt: new Date(q.data.to) }, endsAt: { $gt: new Date(q.data.from) } })
      .sort('startsAt').limit(500).populate('patient', 'name').lean();
    res.json(list.map(bookingView));
  } catch (e) { next(e); }
});

// Requests still waiting for an answer, oldest first: the consultation queue.
clinicRoutes.get('/requests', async (req: AuthReq, res, next) => {
  try {
    const list = await Booking.find({ clinician: req.user!.id, status: 'requested', startsAt: { $gt: new Date() } })
      .sort('createdAt').limit(100).populate('patient', 'name').lean();
    res.json(list.map(bookingView));
  } catch (e) { next(e); }
});

clinicRoutes.get('/slots', async (req: AuthReq, res, next) => {
  try {
    const q = z.object({ type: ID, from: DATE.optional(), days: z.coerce.number().int().min(1).max(31).default(14) }).safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: 'type is required' });
    const d = await myDoctor(req.user!.id);
    if (!d) return res.status(404).json({ error: 'Set up your clinic first' });
    res.json(await freeSlots(d, q.data.type, q.data.from ?? inTirana(new Date()).date, q.data.days));
  } catch (e) { next(e); }
});

for (const action of ['confirm', 'decline', 'cancel'] as const) {
  clinicRoutes.post(`/bookings/:id/${action}`, validate(z.object({ note: z.string().trim().max(300).optional() }).strict()), async (req: AuthReq, res, next) => {
    try { res.json(bookingView(await setStatus(req.params.id, { id: req.user!.id, asClinician: true }, action, req.body.note))); } catch (e) { next(e); }
  });
}

clinicRoutes.post('/bookings/:id/reschedule', validate(z.object({ startsAt: z.string().datetime() }).strict()), async (req: AuthReq, res, next) => {
  try { res.json(bookingView(await reschedule(req.params.id, { id: req.user!.id, asClinician: true }, req.body.startsAt))); } catch (e) { next(e); }
});
