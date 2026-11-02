import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { User } from '../../models/User';
import { Hospital } from '../../models/Hospital';
import { Emergency } from '../../models/Emergency';
import { IncidentReport } from '../../models/IncidentReport';
import { HospitalHandover, INTAKE_STATUS } from '../../models/HospitalHandover';
import { emergencyService } from '../emergency/emergency.service';
import { blockchainService } from '../blockchain/blockchain.service';
import { getIO } from '../../realtime/socket';
import { haversineKm } from '../../utils/geo';

// Hospitals on Vitalis. Hospital staff work for one hospital, which always comes from their account,
// never from the request. Operators send handovers and read capacity; they never pick a hospital
// automatically.
const r = Router();
r.use(authRequired);

const ID = z.string().regex(/^[a-f0-9]{24}$/i);
const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const OPEN = ['sent', 'acknowledged', 'arrived'];
const DAY = 24 * 3600_000;

const myHospital = async (userId: string) => {
  const me = await User.findById(userId).select('hospital').lean();
  if (!me?.hospital) throw fail(404, 'This account is not linked to a hospital');
  return String(me.hospital);
};

const hospitalView = (h: any) => ({
  id: String(h._id),
  name: h.name,
  type: h.type,
  address: h.address,
  phone: h.phone,
  isOpen24h: h.isOpen24h,
  coordinates: h.location?.coordinates,
  capacity: h.capacity?.status ? { status: h.capacity.status, updatedAt: h.capacity.updatedAt } : null,
});

const handoverView = (h: any) => ({
  id: String(h._id),
  emergency: String(h.emergency),
  hospital: h.hospital?.name ? { id: String(h.hospital._id), name: h.hospital.name } : { id: String(h.hospital) },
  sentAt: h.sentAt,
  sentBy: h.sentBy?.name ?? null,
  deliveredLive: h.deliveredLive,
  summary: h.summary,
  status: h.status,
  acknowledgedAt: h.acknowledgedAt,
  acknowledgedBy: h.acknowledgedBy?.name ?? null,
  arrivedAt: h.arrivedAt,
  hospitalRef: h.hospitalRef,
  intake: h.intake,
  intakeAt: h.intakeAt,
  duplicateOf: h.duplicateOf ? String(h.duplicateOf) : undefined,
});

/** Put a hospital step on the call's own timeline and tell the operators. */
async function onTimeline(emergencyId: unknown, status: string, by: string, note: string) {
  const e = await Emergency.findOneAndUpdate(
    { _id: emergencyId },
    { $push: { timeline: { status, by, at: new Date(), note } } },
    { new: true },
  );
  await blockchainService.append({ entity: 'emergency', entityId: String(emergencyId), action: status, actor: by });
  if (e) getIO().to('dispatchers').emit('dashboard:emergency', e);
  getIO().to('dispatchers').emit('dashboard:handover', { emergencyId: String(emergencyId) });
}

// ── Hospital staff ──────────────────────────────────────────────────────────────────────────────

r.get('/me', allow('hospital'), async (req: AuthReq, res, next) => {
  try {
    const h = await Hospital.findById(await myHospital(req.user!.id)).lean();
    if (!h) return res.status(404).json({ error: 'This account is not linked to a hospital' });
    res.json(hospitalView(h));
  } catch (e) { next(e); }
});

r.patch('/me/capacity', allow('hospital'), validate(z.object({ status: z.enum(['accepting', 'limited', 'unavailable']) }).strict()), async (req: AuthReq, res, next) => {
  try {
    const h = await Hospital.findByIdAndUpdate(
      await myHospital(req.user!.id),
      { $set: { capacity: { status: req.body.status, updatedAt: new Date(), updatedBy: req.user!.id } } },
      { new: true },
    ).lean();
    if (!h) return res.status(404).json({ error: 'This account is not linked to a hospital' });
    getIO().to('dispatchers').emit('hospital:capacity', { hospitalId: String(h._id) });
    res.json(hospitalView(h));
  } catch (e) { next(e); }
});

// Hospital: everything sent to their hospital (newest first), with possible duplicates flagged.
// Operator: the handovers of one call (?emergencyId=).
r.get('/handovers', allow('hospital', 'eso'), async (req: AuthReq, res, next) => {
  try {
    if (req.user!.role === 'eso') {
      const id = ID.safeParse(req.query.emergencyId);
      if (!id.success) return res.status(400).json({ error: 'emergencyId is required' });
      const list = await HospitalHandover.find({ emergency: id.data }).sort('-sentAt')
        .populate('hospital', 'name').populate('sentBy acknowledgedBy', 'name').lean();
      return res.json(list.map(handoverView));
    }
    const hospital = await myHospital(req.user!.id);
    const list = await HospitalHandover.find({ hospital }).sort('-sentAt').limit(100)
      .populate('sentBy acknowledgedBy', 'name').lean();
    // The same person sent here twice within a day, both still open: probably one patient.
    const open = list.filter(h => OPEN.includes(h.status as string));
    res.json(list.map(h => ({
      ...handoverView(h),
      possibleDuplicates: OPEN.includes(h.status as string) && h.citizen
        ? open.filter(o => String(o._id) !== String(h._id) && String(o.citizen) === String(h.citizen)
          && Math.abs(+new Date(o.sentAt as Date) - +new Date(h.sentAt as Date)) < DAY).map(o => String(o._id))
        : [],
    })));
  } catch (e) { next(e); }
});

/** One of this hospital's handovers, moved from one status to the next atomically. */
async function hospitalStep(req: AuthReq, from: string[], set: Record<string, unknown>) {
  const hospital = await myHospital(req.user!.id);
  const id = ID.safeParse(req.params.id);
  if (!id.success) throw fail(400, 'Invalid request');
  const h = await HospitalHandover.findOneAndUpdate({ _id: id.data, hospital, status: { $in: from } }, { $set: set }, { new: true })
    .populate('hospital', 'name').lean();
  if (h) return h;
  if (!(await HospitalHandover.exists({ _id: id.data, hospital }))) throw fail(404, 'Not found');
  throw fail(409, 'This handover has already moved on');
}

r.post('/handovers/:id/acknowledge', allow('hospital'), async (req: AuthReq, res, next) => {
  try {
    const h = await hospitalStep(req, ['sent'], { status: 'acknowledged', acknowledgedAt: new Date(), acknowledgedBy: req.user!.id });
    await onTimeline(h.emergency, 'hospital_acknowledged', req.user!.id, (h.hospital as any).name);
    res.json(handoverView(h));
  } catch (e) { next(e); }
});

// Check-in: the patient is here. Allowed before the acknowledgment too (the ambulance can be quicker).
r.post('/handovers/:id/arrive', allow('hospital'), validate(z.object({ hospitalRef: z.string().trim().max(60).optional() }).strict()), async (req: AuthReq, res, next) => {
  try {
    const now = new Date();
    const h = await hospitalStep(req, ['sent', 'acknowledged'], {
      status: 'arrived', arrivedAt: now, arrivedBy: req.user!.id, intake: 'arrived', intakeAt: now,
      ...(req.body.hospitalRef ? { hospitalRef: req.body.hospitalRef } : {}),
    });
    await onTimeline(h.emergency, 'patient_arrived', req.user!.id, (h.hospital as any).name);
    res.json(handoverView(h));
  } catch (e) { next(e); }
});

r.patch('/handovers/:id/intake', allow('hospital'), validate(z.object({ intake: z.enum(INTAKE_STATUS), hospitalRef: z.string().trim().max(60).optional() }).strict()), async (req: AuthReq, res, next) => {
  try {
    const h = await hospitalStep(req, ['arrived'], { intake: req.body.intake, intakeAt: new Date(), ...(req.body.hospitalRef ? { hospitalRef: req.body.hospitalRef } : {}) });
    getIO().to('dispatchers').emit('dashboard:handover', { emergencyId: String(h.emergency) });
    res.json(handoverView(h));
  } catch (e) { next(e); }
});

// Two handovers for one patient: this one is closed as a duplicate of the other (which stays).
r.post('/handovers/:id/duplicate', allow('hospital'), validate(z.object({ of: ID }).strict()), async (req: AuthReq, res, next) => {
  try {
    if (req.body.of === req.params.id) return res.status(400).json({ error: 'A handover cannot duplicate itself' });
    const hospital = await myHospital(req.user!.id);
    const [keep, dup] = await Promise.all([
      HospitalHandover.findOne({ _id: req.body.of, hospital, status: { $in: OPEN } }).select('citizen').lean(),
      HospitalHandover.findOne({ _id: req.params.id, hospital }).select('citizen').lean(),
    ]);
    if (!keep || !dup) return res.status(404).json({ error: 'Not found' });
    if (String(dup.citizen) !== String(keep.citizen)) return res.status(409).json({ error: 'These handovers are for different people' });
    const h = await hospitalStep(req, OPEN, { status: 'duplicate', duplicateOf: req.body.of });
    getIO().to('dispatchers').emit('dashboard:handover', { emergencyId: String(h.emergency) });
    res.json(handoverView(h));
  } catch (e) { next(e); }
});

// ── Operators ───────────────────────────────────────────────────────────────────────────────────

// Participating hospitals (with at least one staff account), nearest first when a place is given.
r.get('/directory', allow('eso'), async (req, res, next) => {
  try {
    const staffed = await User.distinct('hospital', { role: 'hospital', hospital: { $ne: null } });
    const list = (await Hospital.find({ _id: { $in: staffed } }).lean()).map(hospitalView);
    const lng = Number(req.query.lng), lat = Number(req.query.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
      const withKm = list.map(h => ({ ...h, distanceKm: h.coordinates ? Math.round(haversineKm(h.coordinates as [number, number], [lng, lat]) * 10) / 10 : null }));
      return res.json(withKm.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)));
    }
    res.json(list.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) { next(e); }
});

const sendSchema = z.object({ emergencyId: ID, hospitalId: ID }).strict();
const SENDABLE = ['assigned', 'en_route', 'on_scene', 'assistance', 'handed_over', 'resolved'];

r.post('/handovers', allow('eso'), validate(sendSchema), async (req: AuthReq, res, next) => {
  try {
    const { emergencyId, hospitalId } = req.body as z.infer<typeof sendSchema>;
    const e = await Emergency.findById(emergencyId).select('status citizen timeline').lean();
    if (!e) return res.status(404).json({ error: 'Call not found' });
    const closedAt = (e.timeline as any[] ?? []).find(t => t.status === 'resolved')?.at;
    if (!SENDABLE.includes(e.status as string) || (closedAt && Date.now() - +new Date(closedAt) > DAY)) {
      return res.status(409).json({ error: 'Only calls a responder has taken, up to a day after they end, can be handed over' });
    }
    const hospital = await Hospital.findById(hospitalId).select('name').lean();
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    if (!(await User.exists({ role: 'hospital', hospital: hospitalId }))) return res.status(409).json({ error: 'This hospital is not on Vitalis yet' });
    if (await HospitalHandover.exists({ emergency: emergencyId, status: { $in: OPEN } })) {
      return res.status(409).json({ error: 'This call already has an open handover. Withdraw it first.' });
    }

    // The snapshot the hospital receives: patient essentials, responders, their reports, the timeline.
    const [h, reports] = await Promise.all([
      emergencyService.handover(emergencyId),
      IncidentReport.find({ emergency: emergencyId }).populate('author', 'name role').sort('createdAt').lean(),
    ]);
    const summary = {
      reference: emergencyId.slice(-6).toUpperCase(),
      type: h.type,
      priority: h.priority,
      reportedAt: h.createdAt,
      coordinates: (h.location as any)?.coordinates,
      patient: h.patient && { ...h.patient, emergencyContact: undefined },
      responders: [h.responder, h.aedRunner].filter(Boolean),
      aed: h.aed ?? null,
      reports: reports.map((x: any) => ({
        author: x.author?.name, role: x.author?.role, arrivedAt: x.arrivedAt, conscious: x.conscious, breathing: x.breathing,
        cprPerformed: x.cprPerformed, aedUsed: x.aedUsed, shocks: x.shocks, actions: x.actions, notes: x.notes, handover: x.handover,
      })),
      timeline: h.timeline.map((t: any) => ({ status: t.status, at: t.at })),
    };

    const room = `hospital:${hospitalId}`;
    const online = (await getIO().in(room).fetchSockets()).length > 0;
    const created = await HospitalHandover.create({
      emergency: emergencyId, hospital: hospitalId, citizen: e.citizen, sentBy: req.user!.id, deliveredLive: online, summary,
    });
    const view = handoverView({ ...created.toObject(), hospital: { _id: hospital._id, name: hospital.name } });
    getIO().to(room).emit('hospital:handover', view);
    await onTimeline(emergencyId, 'hospital_handover_sent', req.user!.id, hospital.name);
    res.status(201).json(view);
  } catch (e) { next(e); }
});

r.post('/handovers/:id/withdraw', allow('eso'), async (req: AuthReq, res, next) => {
  try {
    const id = ID.safeParse(req.params.id);
    if (!id.success) return res.status(400).json({ error: 'Invalid request' });
    const h = await HospitalHandover.findOneAndUpdate(
      { _id: id.data, status: { $in: ['sent', 'acknowledged'] } },
      { $set: { status: 'withdrawn', withdrawnAt: new Date() } },
      { new: true },
    ).populate('hospital', 'name').lean();
    if (!h) return res.status(409).json({ error: 'Not found, or the patient has already arrived' });
    getIO().to(`hospital:${(h.hospital as any)._id}`).emit('hospital:handover', handoverView(h));
    await onTimeline(h.emergency, 'hospital_handover_withdrawn', req.user!.id, (h.hospital as any).name);
    res.json(handoverView(h));
  } catch (e) { next(e); }
});

export default r;
