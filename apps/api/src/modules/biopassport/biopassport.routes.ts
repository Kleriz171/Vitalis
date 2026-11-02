import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User, ageOf, RESPONDER_ROLES } from '../../models/User';
import { generateTextQR } from '../../utils/qr';
import { randomBytes } from 'crypto';
import { env } from '../../config/env';
import { Allergy, Medication, Vaccination, Condition, Disability } from '../../models/HealthRecord';
import { hasResponderCertification } from '../../models/Training';


type Facts = { allergies: any[]; medications: any[]; conditions: any[] };
/**
 * What a first responder needs in the first minutes, as short plain lines in the user's app
 * language. Shown by the Bio Passport QR (readable by any camera, offline) and the watch's
 * Medical ID. The full record stays behind auth.
 */
export type Share = { bloodType?: boolean; allergies?: boolean; medications?: boolean; conditions?: boolean; contact?: boolean };
export function medicalLines(u: any, { allergies, medications, conditions }: Facts, share: Share = {}): string[] {
  const show = (k: keyof Share) => share[k] !== false;
  const sq = u.language !== 'en';
  const L = sq
    ? { blood: 'Gjaku', allergy: 'Alergji', meds: 'Ilaçe', cond: 'Sëmundje', ice: 'Kontakt', sev: { mild: 'e lehtë', moderate: 'mesatare', severe: 'e rëndë' } as Record<string, string> }
    : { blood: 'Blood', allergy: 'Allergies', meds: 'Meds', cond: 'Conditions', ice: 'ICE', sev: { mild: 'mild', moderate: 'moderate', severe: 'severe' } as Record<string, string> };
  const age = ageOf(u);
  const lines = [
    `VITALIS · ${u.name}${age != null ? `, ${age}` : ''}`,
    show('bloodType') ? `${L.blood}: ${u.bloodType ?? '?'}` : null,
    show('allergies') && allergies.length ? `${L.allergy}: ${allergies.map(a => `${a.allergen} (${L.sev[a.severity] ?? a.severity})`).join(', ')}` : null,
    show('medications') && medications.some(m => m.isActive) ? `${L.meds}: ${medications.filter(m => m.isActive).map(m => [m.name, m.dosage].filter(Boolean).join(' ')).join(', ')}` : null,
    show('conditions') && (conditions.length || u.illnesses?.length) ? `${L.cond}: ${[...new Set([...conditions.map(c => c.name), ...(u.illnesses ?? [])])].join(', ')}` : null,
    show('contact') && u.emergencyContact?.phone ? `${L.ice}: ${u.emergencyContact.name ?? ''} ${u.emergencyContact.phone}`.replace(/\s+/g, ' ') : null,
  ].filter(Boolean);
  return lines as string[];
}

/** The person's medical ID link token, made on first use. */
async function medicalIdToken(userId: string) {
  const u = await User.findById(userId).select('+medicalId.token').lean();
  if (u?.medicalId?.token) return u.medicalId.token;
  const token = randomBytes(16).toString('hex');
  await User.updateOne({ _id: userId, 'medicalId.token': { $exists: false } }, { $set: { 'medicalId.token': token } });
  return (await User.findById(userId).select('+medicalId.token').lean())!.medicalId!.token!;
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
    // The QR shows what the person chose, plus the link to the same facts online (logged, revocable).
    const token = await medicalIdToken(req.user!.id);
    const share = (u.medicalId?.share ?? {}) as Share;
    const enabled = u.medicalId?.enabled !== false;
    const lines = medicalLines(u, { allergies, medications, conditions }, share);
    const url = enabled ? `${env.publicWebUrl}/id/${token}` : null;
    const qr = await generateTextQR([...lines, ...(url ? [url] : [])].join('\n'));
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
        pausedUntil: u.pausedUntil && u.pausedUntil > new Date() ? u.pausedUntil : null,
        disabilities: disabilities.map(d => ({ id: String(d._id), name: d.name, notes: d.notes })),
        allergies: allergies.map(a => ({ id: String(a._id), allergen: a.allergen, severity: a.severity })),
        medications: medications.map(m => ({ id: String(m._id), name: m.name, dosage: m.dosage, isActive: m.isActive })),
        vaccinations: vaccinations.map(v => ({ id: String(v._id), name: v.name, date: v.date, provider: v.provider })),
        conditions: conditions.map(c => ({ id: String(c._id), name: c.name, notes: c.notes })),
      },
      qr,
      medicalId: { enabled, share: { bloodType: true, allergies: true, medications: true, conditions: true, contact: true, ...share }, url, preview: lines },
    });
  } catch (e) { next(e); }
});

const shareSchema = z.object({
  enabled: z.boolean().optional(),
  share: z.object({ bloodType: z.boolean(), allergies: z.boolean(), medications: z.boolean(), conditions: z.boolean(), contact: z.boolean() }).partial().strict().optional(),
}).strict();

r.patch('/medical-id', validate(shareSchema), async (req: AuthReq, res, next) => {
  try {
    const { enabled, share } = req.body as z.infer<typeof shareSchema>;
    const set: Record<string, unknown> = {};
    if (enabled !== undefined) set['medicalId.enabled'] = enabled;
    for (const [k, v] of Object.entries(share ?? {})) set[`medicalId.share.${k}`] = v;
    await User.updateOne({ _id: req.user!.id }, { $set: set });
    res.status(204).end();
  } catch (e) { next(e); }
});

// A new link: the old QR and link stop working at once (lost phone, printed card handed out).
r.post('/medical-id/rotate', async (req: AuthReq, res, next) => {
  try {
    await User.updateOne({ _id: req.user!.id }, { $set: { 'medicalId.token': randomBytes(16).toString('hex'), 'medicalId.rotatedAt': new Date() } });
    res.status(204).end();
  } catch (e) { next(e); }
});

// Only duty status and location are writable here; profile fields go through
// PATCH /health/profile (validated). Never pass req.body straight to the model.
const dutySchema = z.object({
  available: z.boolean().optional(),
  // Temporarily unavailable for this many minutes; 0 ends the pause.
  pauseMinutes: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  location: z.object({
    type: z.literal('Point'),
    coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }).optional(),
}).strict();

r.patch('/me', validate(dutySchema), async (req: AuthReq, res, next) => {
  try {
    // Only responders receive SOS alerts: clinicians, or first responders whose CPR/AED certificate
    // is still valid. Staff and citizens never go on duty, certificate or not.
    const role = req.user!.role;
    if (req.body.available === true
      && !(RESPONDER_ROLES.includes(role) && (['doctor', 'nurse'].includes(role) || await hasResponderCertification(req.user!.id)))) {
      return res.status(403).json({ error: 'Complete the CPR or AED course to go on duty' });
    }
    const { pauseMinutes, ...rest } = req.body as z.infer<typeof dutySchema>;
    const set: Record<string, unknown> = rest.location ? { ...rest, locationAt: new Date() } : { ...rest };
    // Going off duty or back on duty also ends a pause.
    if (pauseMinutes !== undefined || rest.available !== undefined) set.pausedUntil = pauseMinutes ? new Date(Date.now() + pauseMinutes * 60_000) : null;
    const u = await User.findByIdAndUpdate(req.user!.id, { $set: set }, { new: true, runValidators: true })
      .select('available location role pausedUntil').lean();
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json({ available: u.available, pausedUntil: u.pausedUntil ?? null, location: u.location, role: u.role });
  } catch (e) { next(e); }
});

export default r;
