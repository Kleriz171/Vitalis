import { Router } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { authRequired, AuthReq } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { DoctorApplication } from '../../models/DoctorApplication';
import { Doctor } from '../../models/Doctor';

const r = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

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
    const { fullName, email, phone, specialty, yearsExperience, bio } = req.body;
    if (!fullName || !email || !phone || !specialty || !yearsExperience || !bio) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!req.file) return res.status(400).json({ error: 'Certificate PDF is required' });

    const bucket = getBucket();
    const filename = `${Date.now()}-${req.file.originalname}`;
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
      yearsExperience: Number(yearsExperience),
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
r.get('/', allow('admin'), async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const apps = await DoctorApplication.find(filter).sort('-createdAt').lean();
    res.json(apps.map(appToView));
  } catch (e) { next(e); }
});

// Admin downloads the certificate PDF
r.get('/:id/certificate', allow('admin'), async (req, res, next) => {
  try {
    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const bucket = getBucket();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${app.certificateFilename}"`);
    bucket.openDownloadStream(app.certificateFileId as unknown as ObjectId).pipe(res);
  } catch (e) { next(e); }
});

// Admin approves -> creates a Doctor record
r.post('/:id/approve', allow('admin'), async (req: AuthReq, res, next) => {
  try {
    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already reviewed' });

    await Doctor.create({
      user: app.user,
      name: app.fullName,
      specialty: app.specialty,
      biography: app.bio,
      experience: app.yearsExperience,
      phone: app.phone,
      availableOnline: true,
    });

    app.status = 'approved';
    app.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    app.reviewedAt = new Date();
    await app.save();
    res.json(appToView(app));
  } catch (e) { next(e); }
});

// Admin rejects
r.post('/:id/reject', allow('admin'), async (req: AuthReq, res, next) => {
  try {
    const app = await DoctorApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (app.status !== 'pending') return res.status(400).json({ error: 'Application already reviewed' });
    app.status = 'rejected';
    app.rejectionReason = String(req.body?.reason ?? '').trim() || 'No reason provided';
    app.reviewedBy = new mongoose.Types.ObjectId(req.user!.id);
    app.reviewedAt = new Date();
    await app.save();
    res.json(appToView(app));
  } catch (e) { next(e); }
});

export default r;
