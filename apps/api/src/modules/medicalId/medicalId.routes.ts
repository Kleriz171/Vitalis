import { Router } from 'express';
import { User, ageOf } from '../../models/User';
import { Allergy, Condition, Medication } from '../../models/HealthRecord';
import { logAccess } from '../../models/AccessLog';

// Public, no login: the online emergency profile behind a person's medical ID QR (landing /id/:token).
// Only what the person chose to show; every opening goes into their access log. A rotated or
// switched-off link is simply not found.
const r = Router();

r.get('/:token', async (req, res, next) => {
  try {
    const token = String(req.params.token);
    if (!/^[a-f0-9]{32}$/.test(token)) return res.status(404).json({ error: 'This medical ID is not valid.' });
    const u = await User.findOne({ 'medicalId.token': token, 'medicalId.enabled': { $ne: false } })
      .select('name firstName lastName dateOfBirth age bloodType illnesses emergencyContact medicalId language').lean();
    if (!u) return res.status(404).json({ error: 'This medical ID is not valid.' });
    const show = (k: string) => (u.medicalId?.share as any)?.[k] !== false;
    const [allergies, medications, conditions] = await Promise.all([
      show('allergies') ? Allergy.find({ user: u._id }).lean() : [],
      show('medications') ? Medication.find({ user: u._id, isActive: true }).lean() : [],
      show('conditions') ? Condition.find({ user: u._id }).lean() : [],
    ]);
    await logAccess({ subject: u._id, kind: 'qr_profile' });
    res.set('Cache-Control', 'no-store');
    res.json({
      // First name and initial: enough for a paramedic to address them, no full identity to a stranger.
      name: `${u.firstName ?? u.name?.split(' ')[0] ?? ''} ${(u.lastName ?? '').slice(0, 1)}${u.lastName ? '.' : ''}`.trim(),
      age: ageOf(u),
      language: u.language,
      ...(show('bloodType') ? { bloodType: u.bloodType ?? null } : {}),
      ...(show('allergies') ? { allergies: allergies.map((a: any) => ({ allergen: a.allergen, severity: a.severity })) } : {}),
      ...(show('medications') ? { medications: medications.map((m: any) => [m.name, m.dosage].filter(Boolean).join(' ')) } : {}),
      ...(show('conditions') ? { conditions: [...new Set([...conditions.map((c: any) => c.name), ...(u.illnesses ?? [])])] } : {}),
      ...(show('contact') && u.emergencyContact?.phone ? { emergencyContact: { name: u.emergencyContact.name, phone: u.emergencyContact.phone } } : {}),
    });
  } catch (e) { next(e); }
});

export default r;
