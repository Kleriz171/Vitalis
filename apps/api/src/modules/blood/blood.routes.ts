import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { BloodRequest } from '../../models/BloodRequest';
import { BloodInventory } from '../../models/BloodInventory';
import { Hospital } from '../../models/Hospital';

const r = Router();
r.use(authRequired);

r.get('/requests', async (req, res, next) => {
  try {
    const { bloodType, urgency, status } = req.query as Record<string, string | undefined>;
    const q: Record<string, unknown> = {};
    if (bloodType) q.bloodType = bloodType;
    if (urgency) q.urgency = urgency;
    q.status = status ?? 'open';
    const items = await BloodRequest.find(q).populate('hospital', 'name').sort('-createdAt').limit(50).lean();
    res.json(items.map(i => ({
      id: String(i._id),
      bloodType: i.bloodType,
      urgency: i.urgency,
      unitsNeeded: i.unitsNeeded,
      patientName: i.patientName,
      reason: i.reason,
      hospitalName: (i.hospital as any)?.name ?? null,
      createdAt: i.createdAt,
    })));
  } catch (e) { next(e); }
});

const createRequestSchema = z.object({
  hospitalId: z.string().min(1),
  patientName: z.string().min(1),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  urgency: z.enum(['normal', 'urgent', 'critical']).default('normal'),
  unitsNeeded: z.number().int().min(1).max(50),
  reason: z.string().optional(),
});

r.post('/requests',
  allow('doctor', 'nurse', 'dispatcher', 'admin'),
  validate(createRequestSchema),
  async (req: AuthReq, res, next) => {
    try {
      const body = req.body as z.infer<typeof createRequestSchema>;
      const created = await BloodRequest.create({
        hospital: body.hospitalId,
        patientName: body.patientName,
        bloodType: body.bloodType,
        urgency: body.urgency,
        unitsNeeded: body.unitsNeeded,
        reason: body.reason,
        createdBy: req.user!.id,
      });
      res.status(201).json({ id: String(created._id) });
    } catch (e) { next(e); }
  }
);

r.get('/inventory', async (_req, res, next) => {
  try {
    const items = await BloodInventory.find().populate('hospital', 'name').lean();
    res.json(items.map(i => ({
      id: String(i._id),
      bloodType: i.bloodType,
      unitsAvailable: i.unitsAvailable,
      unitsNeeded: i.unitsNeeded,
      hospitalName: (i.hospital as any)?.name ?? null,
    })));
  } catch (e) { next(e); }
});

r.get('/critical', async (_req, res, next) => {
  try {
    const items = await BloodInventory.find({
      $expr: { $lt: ['$unitsAvailable', '$unitsNeeded'] },
    }).populate('hospital', 'name').lean();
    res.json(items.map(i => ({
      id: String(i._id),
      bloodType: i.bloodType,
      unitsAvailable: i.unitsAvailable,
      unitsNeeded: i.unitsNeeded,
      hospitalName: (i.hospital as any)?.name ?? null,
    })));
  } catch (e) { next(e); }
});

r.get('/hospitals', async (_req, res, next) => {
  try {
    const items = await Hospital.find().lean();
    res.json(items.map(h => ({
      id: String(h._id),
      name: h.name,
      type: h.type,
      address: h.address,
      phone: h.phone,
      isOpen24h: h.isOpen24h,
    })));
  } catch (e) { next(e); }
});

export default r;
