import { Router } from 'express';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { z } from 'zod';
import { authRequired, AuthReq, revokeUser } from '../../middleware/auth';
import { getIO } from '../../realtime/socket';
import { validate } from '../../middleware/validate';
import { User } from '../../models/User';
import { Emergency } from '../../models/Emergency';
import { Allergy, Appointment, Condition, Disability, Medication, Vaccination } from '../../models/HealthRecord';
import { Certification, Enrollment } from '../../models/Training';
import { CheckIn } from '../../models/CheckIn';
import { WatchDevice } from '../../models/WatchDevice';
import { CommunityPost } from '../../models/CommunityPost';
import { SupplyInquiry, SupplyRequest } from '../../models/SupplyRequest';
import { BloodRequest } from '../../models/BloodRequest';
import { DoctorApplication } from '../../models/DoctorApplication';
import { Doctor } from '../../models/Doctor';
import { Notification } from '../../models/Notification';
import { Responder } from '../../models/Responder';
import { PhoneCode } from '../../models/PhoneCode';
import { VideoSession } from '../../models/VideoSession';
import { Aed } from '../../models/Aed';
import { logger } from '../../config/logger';

// The person's own data: export everything, or erase it (privacy policy, landing /privacy).
const r = Router();
r.use(authRequired);

const ACTIVE = ['pending', 'assigned', 'en_route', 'on_scene'];
const HEALTH = { allergies: Allergy, medications: Medication, conditions: Condition, disabilities: Disability, vaccinations: Vaccination, appointments: Appointment };
const SECRETS = '-password -refreshTokenHash -checkInPinHash -duressPinHash -pushTokens';

r.get('/export', async (req: AuthReq, res, next) => {
  try {
    const id = req.user!.id;
    const user = await User.findById(id).select(SECRETS).lean();
    if (!user) return res.status(404).json({ error: 'Account not found' });
    const health = Object.fromEntries(await Promise.all(
      Object.entries(HEALTH).map(async ([k, M]) => [k, await (M as any).find({ user: id }).select('-user').lean()]),
    ));
    const [sos, checkIns, certifications, enrollments, posts, supplyRequests, supplyInquiries, doctorApplication] = await Promise.all([
      // Your own SOS calls. Calls you answered as a responder belong to the patient.
      Emergency.find({ citizen: id, silent: { $ne: true } }).select('type status description location createdAt updatedAt').lean(),
      CheckIn.find({ user: id }).select('-user').lean(),
      Certification.find({ user: id }).select('-user').lean(),
      Enrollment.find({ user: id }).select('-user').lean(),
      CommunityPost.find({ author: id }).select('-author').lean(),
      SupplyRequest.find({ createdBy: id }).lean(),
      SupplyInquiry.find({ user: id }).select('-user').lean(),
      DoctorApplication.find({ user: id }).select('-user -certificateFileId').lean(),
    ]);
    res.set('Content-Disposition', 'attachment; filename="vitalis-data.json"');
    res.set('Cache-Control', 'no-store');
    res.json({
      exportedAt: new Date(), user, health, sos, checkIns, certifications, enrollments,
      communityPosts: posts, supplyRequests, supplyInquiries, doctorApplication,
    });
  } catch (e) { next(e); }
});

/**
 * Erases the account. SOS records stay (they are also the responders' and dispatch's record)
 * but no longer lead to a person: the user document they point to is gone.
 */
r.delete('/', validate(z.object({ confirm: z.literal('DELETE') }).strict()), async (req: AuthReq, res, next) => {
  try {
    const id = req.user!.id;
    const user = await User.findById(id).select('role phone').lean();
    if (!user) return res.status(404).json({ error: 'Account not found' });
    // Staff accounts are removed by an admin, so a console never loses its last operator by accident.
    if (['dispatcher', 'admin'].includes(user.role)) return res.status(403).json({ error: 'Staff accounts are removed by an administrator.' });
    const busy = await Emergency.exists({
      status: { $in: ACTIVE },
      $or: [{ citizen: id, silent: { $ne: true } }, { responder: id }, { aedRunner: id }],
    });
    if (busy) return res.status(409).json({ error: 'Finish or cancel your active SOS first.' });

    const apps = await DoctorApplication.find({ user: id }).select('certificateFileId').lean();
    const bucket = new GridFSBucket(mongoose.connection.db!, { bucketName: 'doctorCerts' });
    for (const a of apps) await bucket.delete(a.certificateFileId as any).catch(() => {}); // already gone is fine

    await Promise.all([
      ...Object.values(HEALTH).map(M => (M as any).deleteMany({ user: id })),
      CheckIn.deleteMany({ user: id }),
      WatchDevice.deleteMany({ user: id }),
      Certification.deleteMany({ user: id }),
      Enrollment.deleteMany({ user: id }),
      CommunityPost.deleteMany({ author: id }),
      SupplyInquiry.deleteMany({ user: id }),
      SupplyRequest.deleteMany({ createdBy: id }),
      BloodRequest.updateMany({ createdBy: id }, { $unset: { createdBy: 1 } }),
      DoctorApplication.deleteMany({ user: id }),
      Doctor.deleteMany({ user: id }),
      Notification.deleteMany({ user: id }),
      Responder.deleteMany({ user: id }),
      VideoSession.updateMany({ participants: id }, { $pull: { participants: id } }),
      Aed.updateMany({ reportedBy: id }, { $unset: { reportedBy: 1 } }),
      user.phone ? PhoneCode.deleteMany({ phone: user.phone }) : null,
    ]);
    await User.deleteOne({ _id: id }); // last, so a failure above can simply be retried
    revokeUser(id);
    getIO().in(`user:${id}`).disconnectSockets(true);
    logger.info(`account deleted ${id}`);
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
