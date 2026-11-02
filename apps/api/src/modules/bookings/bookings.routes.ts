import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { Booking } from '../../models/Booking';
import { Doctor } from '../../models/Doctor';
import { User, ageOf } from '../../models/User';
import { Allergy, Condition, Disability, Medication } from '../../models/HealthRecord';
import { Emergency } from '../../models/Emergency';
import { IncidentReport } from '../../models/IncidentReport';
import { logAccess } from '../../models/AccessLog';
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

// ── Clinical record (CL3, CL4): only with the patient's consent on this booking, every view logged ──

const RECORD_DAYS = 30; // after the consultation, the shared record closes again

/** The clinician's own booking with a patient who shared their record, still within its window. */
async function sharedBooking(bookingId: string, clinicianId: string) {
  if (!ID.safeParse(bookingId).success) throw Object.assign(new Error('Invalid request'), { status: 400 });
  const b = await Booking.findOne({ _id: bookingId, clinician: clinicianId, status: { $in: ['requested', 'confirmed', 'completed'] } }).lean();
  if (!b) throw Object.assign(new Error('Not found'), { status: 404 });
  if (!b.shareRecord) throw Object.assign(new Error('The patient has not shared their record with you for this consultation'), { status: 403 });
  if (Date.now() - +b.endsAt > RECORD_DAYS * 86_400_000) throw Object.assign(new Error('The shared record closed 30 days after the consultation'), { status: 403 });
  return b;
}

clinicRoutes.get('/bookings/:id/record', async (req: AuthReq, res, next) => {
  try {
    const b = await sharedBooking(req.params.id, req.user!.id);
    const patient = b.patient;
    const [u, allergies, medications, conditions, disabilities, consultations, emergencies] = await Promise.all([
      User.findById(patient).select('name gender bloodType dateOfBirth age illnesses').lean(),
      Allergy.find({ user: patient }).lean(),
      Medication.find({ user: patient, isActive: true }).lean(),
      Condition.find({ user: patient }).lean(),
      Disability.find({ user: patient }).lean(),
      Booking.find({ patient, status: 'completed', 'summary.summary': { $exists: true } }).populate('doctor', 'name specialty').sort('-startsAt').limit(50).lean(),
      Emergency.find({ citizen: patient, status: { $in: ['resolved', 'handed_over'] } }).select('type createdAt status').sort('-createdAt').limit(20).lean(),
    ]);
    const reports = await IncidentReport.find({ emergency: { $in: emergencies.map(e => e._id) } }).populate('author', 'name role').lean();
    await logAccess({ subject: patient, actor: req.user!.id, actorRole: req.user!.role, kind: 'clinician_record', booking: b._id });
    // One chronological list: consultations with their summaries, emergencies with the responders' reports.
    const timeline = [
      ...consultations.map((c: any) => ({
        kind: 'consultation', at: c.startsAt, title: `${c.type?.name ?? 'Consultation'} with ${c.doctor?.name ?? 'a clinician'}`,
        detail: c.summary, own: String(c.clinician) === req.user!.id,
      })),
      ...emergencies.map((e: any) => ({
        kind: 'emergency', at: e.createdAt, title: `Emergency: ${e.type}`,
        reports: reports.filter(r => String(r.emergency) === String(e._id)).map((r: any) => ({
          author: r.author?.name, role: r.author?.role, conscious: r.conscious, breathing: r.breathing, cprPerformed: r.cprPerformed,
          aedUsed: r.aedUsed, shocks: r.shocks, actions: r.actions, notes: r.notes, handover: r.handover,
        })),
      })),
    ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
    res.json({
      patient: { name: u?.name, age: u ? ageOf(u) : undefined, gender: u?.gender, bloodType: u?.bloodType },
      allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity })),
      medications: medications.map(m => [m.name, m.dosage].filter(Boolean).join(' ')),
      conditions: [...new Set([...conditions.map(c => c.name), ...(u?.illnesses ?? [])])],
      disabilities: disabilities.map(d => d.name),
      timeline,
      accessNote: 'This view was logged. The patient can see who opened their record.',
    });
  } catch (e) { next(e); }
});

const summarySchema = z.object({
  observations: z.string().trim().max(4000).optional(),
  recommendations: z.string().trim().max(4000).optional(),
  summary: z.string().trim().min(3).max(4000),
}).strict();

// Completes the consultation. Editable for a week after it was first written.
clinicRoutes.put('/bookings/:id/summary', validate(summarySchema), async (req: AuthReq, res, next) => {
  try {
    if (!ID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid request' });
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const b = await Booking.findOneAndUpdate(
      {
        _id: req.params.id, clinician: req.user!.id, startsAt: { $lte: new Date(Date.now() + 3600_000) },
        $or: [{ status: 'confirmed' }, { status: 'completed', 'summary.writtenAt': { $gte: weekAgo } }],
      },
      {
        $set: { status: 'completed', active: false, summary: { ...req.body, writtenAt: new Date() } },
        $push: { history: { by: req.user!.id, action: 'summary_written' } },
      },
      { new: true },
    ).populate('patient', 'name').lean();
    if (!b) return res.status(409).json({ error: 'Only a confirmed consultation that has started, or a summary less than a week old, can be written' });
    res.json(bookingView(b));
  } catch (e) { next(e); }
});

clinicRoutes.post('/bookings/:id/follow-up', validate(z.object({ typeId: ID, startsAt: z.string().datetime() }).strict()), async (req: AuthReq, res, next) => {
  try {
    if (!ID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid request' });
    const original = await Booking.findOne({ _id: req.params.id, clinician: req.user!.id, status: { $in: ['confirmed', 'completed'] } }).lean();
    if (!original) return res.status(404).json({ error: 'Not found' });
    const d = await myDoctor(req.user!.id);
    const b = await book(d, String(original.patient), { typeId: req.body.typeId, startsAt: req.body.startsAt, reason: `Follow-up of ${original.type?.name ?? 'a consultation'}`, shareRecord: !!original.shareRecord }, original._id);
    res.status(201).json(bookingView(await Booking.findById(b._id).populate('patient', 'name').lean()));
  } catch (e) { next(e); }
});
