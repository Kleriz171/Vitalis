import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { DoctorApplication } from '../../models/DoctorApplication';
import { Doctor } from '../../models/Doctor';
import { User } from '../../models/User';
import { z } from 'zod';

const r = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(Object.assign(new Error('Only PDF files are allowed'), { status: 400 }));
    cb(null, true);
  },
});

const applicationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  specialty: z.string().trim().min(2).max(80),
  yearsExperience: z.coerce.number().int().min(0).max(70),
  bio: z.string().trim().min(10).max(2000),
});

// Stored filenames end up in a Content-Disposition header; keep them boring.
const safeName = (name: string) => name.replace(/[^\w.\-]+/g, '_').slice(-80) || 'certificate.pdf';

const getBucket = () => {
  const conn = mongoose.connection;
  if (!conn?.db) throw new Error('Database not ready');
  return new GridFSBucket(conn.db, { bucketName: 'doctorCerts' });
};

const appToView = (a: any) => ({
  id: String(a._id),
  fullName: a.fullName,
  email: a.email,
  phone: a.phone,
  specialty: a.specialty,
  yearsExperience: a.yearsExperience,
  bio: a.bio,
  certificateFilename: a.certificateFilename,
  status: a.status,
  rejectionReason: a.rejectionReason,
  createdAt: a.createdAt,
  reviewedAt: a.reviewedAt,
});

r.use(authRequired);

// User submits an application
r.post('/', upload.single('certificate'), async (req: AuthReq, res, next) => {
  try {
    const parsed = applicationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'All fields are required', issues: parsed.error.issues });
    const { fullName, email, phone, specialty, yearsExperience, bio } = parsed.data;
    if (!req.file) return res.status(400).json({ error: 'Certificate PDF is required' });
    // Client-sent mimetype is not proof; real PDFs start with %PDF-.
    if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return res.status(400).json({ error: 'Certificate must be a PDF file' });
    }
    if (await DoctorApplication.exists({ user: req.user!.id, status: 'pending' })) {
      return res.status(409).json({ error: 'You already have an application under review' });
    }

    const bucket = getBucket();
    const filename = `${Date.now()}-${safeName(req.file.originalname)}`;
    const uploadStream = bucket.openUploadStream(filename, { contentType: 'application/pdf' });
    uploadStream.end(req.file.buffer);

    await new Promise<void>((resolve, reject) => {
      uploadStream.on('finish', () => resolve());
      uploadStream.on('error', reject);
    });

    const application = await DoctorApplication.create({
      user: req.user!.id,
      fullName,
      email,
      phone,
      specialty,
      yearsExperience,
      bio,
      certificateFileId: uploadStream.id,
      certificateFilename: filename,
    });

    res.status(201).json(appToView(application));
  } catch (e) { next(e); }
});

// User views their own applications
r.get('/mine', async (req: AuthReq, res, next) => {
  try {
    const apps = await DoctorApplication.find({ user: req.user!.id }).sort('-createdAt').lean();
    res.json(apps.map(appToView));
  } catch (e) { next(e); }
});

// Admin lists all applications
r.get('/', allow('eso'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (typeof status === 'string' && ['pending', 'approved', 'rejected'].includes(status)) filter.status = status;
    const apps = await DoctorApplication.find(filter).sort('-createdAt').lean();
    res.json(apps.map(appToView));
  } catch (e) { next(e); }
});

// Admin downloads the certificate PDF
r.get('/:id/certificate', allow('eso'), async (req, res, next) => {
  try {
    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const bucket = getBucket();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName(String(app.certificateFilename))}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    bucket.openDownloadStream(app.certificateFileId as unknown as ObjectId)
      .on('error', err => next(err))
      .pipe(res);
  } catch (e) { next(e); }
});

// Admin approves -> creates a Doctor record
r.post('/:id/approve', allow('eso'), async (req: AuthReq, res, next) => {
  try {
    // Atomic pending → approved so a double click can't create two doctors.
    const app = await DoctorApplication.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'approved', reviewedBy: req.user!.id, reviewedAt: new Date() } },
      { new: true },
    );
    if (!app) return res.status(409).json({ error: 'Application not found or already reviewed' });

    await Doctor.create({
      user: app.user,
      name: app.fullName,
      specialty: app.specialty,
      biography: app.bio,
      experience: app.yearsExperience,
      phone: app.phone,
      availableOnline: true,
    });
    // Approval is what grants responder powers; never touch operator accounts.
    await User.updateOne({ _id: app.user, role: { $in: ['citizen', 'blood_donor', 'student_responder'] } }, { $set: { role: 'doctor' } });
    res.json(appToView(app));
  } catch (e) { next(e); }
});

// Admin rejects
r.post('/:id/reject', allow('eso'), async (req: AuthReq, res, next) => {
  try {
    const reason = String(req.body?.reason ?? '').trim().slice(0, 500) || 'No reason provided';
    const app = await DoctorApplication.findOneAndUpdate(
      { _id: req.params.id, status: 'pending' },
      { $set: { status: 'rejected', rejectionReason: reason, reviewedBy: req.user!.id, reviewedAt: new Date() } },
      { new: true },
    );
    if (!app) return res.status(409).json({ error: 'Application not found or already reviewed' });
    res.json(appToView(app));
  } catch (e) { next(e); }
});

export default r;
