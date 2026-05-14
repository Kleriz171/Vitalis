import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { Course, Enrollment, Certification } from '../../models/Training';
import { generateQR } from '../../utils/qr';
import { env } from '../../config/env';

const r = Router();

const CERT_VALID_MS = 365 * 24 * 60 * 60 * 1000;

const courseToSummary = (c: any) => ({
  id: String(c._id),
  slug: c.slug,
  title: c.title,
  category: c.category,
  shortDescription: c.shortDescription,
  heroEmoji: c.heroEmoji,
  estimatedMinutes: c.estimatedMinutes,
  level: c.level,
  lessonCount: c.lessons?.length ?? 0,
  badgeLabel: c.badgeLabel,
});

const courseToDetail = (c: any) => ({
  ...courseToSummary(c),
  passingScore: c.passingScore,
  lessons: (c.lessons ?? []).map((l: any) => ({
    id: String(l._id),
    title: l.title,
    summary: l.summary,
    body: l.body,
    imageUrl: l.imageUrl,
    durationMin: l.durationMin,
  })),
  quiz: (c.quiz ?? []).map((q: any) => ({
    id: String(q._id),
    prompt: q.prompt,
    choices: q.choices,
  })),
});

const certToView = (c: any) => ({
  id: String(c._id),
  courseId: String(c.course),
  courseSlug: c.courseSlug,
  badgeLabel: c.badgeLabel,
  score: c.score,
  issuedAt: c.issuedAt,
  expiresAt: c.expiresAt,
  shareToken: c.shareToken,
});

const enrollmentToView = (e: any) => ({
  id: String(e._id),
  courseId: String(e.course),
  completedLessonIds: (e.completedLessonIds ?? []).map((id: any) => String(id)),
  lastScore: e.lastScore,
  attempts: e.attempts,
  completedAt: e.completedAt,
});

// Public certificate verification — no auth so QR scanners can use it.
r.get('/certifications/verify/:token', async (req, res, next) => {
  try {
    const cert = await Certification.findOne({ shareToken: req.params.token })
      .populate('user', 'firstName lastName name')
      .lean();
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    const user: any = cert.user;
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'Vitalis citizen';
    res.json({
      valid: new Date(cert.expiresAt).getTime() > Date.now(),
      holderName: name,
      badgeLabel: cert.badgeLabel,
      courseSlug: cert.courseSlug,
      score: cert.score,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
    });
  } catch (e) { next(e); }
});

r.use(authRequired);

r.get('/courses', async (_req, res, next) => {
  try {
    const courses = await Course.find().sort('title').lean();
    res.json(courses.map(courseToSummary));
  } catch (e) { next(e); }
});

r.get('/courses/:id', async (req, res, next) => {
  try {
    const isObjectId = mongoose.isValidObjectId(req.params.id);
    const course = await Course.findOne(
      isObjectId ? { $or: [{ _id: req.params.id }, { slug: req.params.id }] } : { slug: req.params.id }
    ).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(courseToDetail(course));
  } catch (e) { next(e); }
});

r.get('/enrollments', async (req: AuthReq, res, next) => {
  try {
    const enrollments = await Enrollment.find({ user: req.user!.id }).lean();
    res.json(enrollments.map(enrollmentToView));
  } catch (e) { next(e); }
});

const enrollSchema = z.object({ courseId: z.string().min(1) });

r.post('/enrollments', validate(enrollSchema), async (req: AuthReq, res, next) => {
  try {
    const { courseId } = req.body as z.infer<typeof enrollSchema>;
    const isObjectId = mongoose.isValidObjectId(courseId);
    const course = await Course.findOne(
      isObjectId ? { $or: [{ _id: courseId }, { slug: courseId }] } : { slug: courseId }
    ).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    const enrollment = await Enrollment.findOneAndUpdate(
      { user: req.user!.id, course: course._id },
      { $setOnInsert: { user: req.user!.id, course: course._id } },
      { upsert: true, new: true }
    ).lean();
    res.status(201).json(enrollmentToView(enrollment));
  } catch (e) { next(e); }
});

const completeLessonSchema = z.object({
  lessonId: z.string().min(1),
});

r.post(
  '/enrollments/:courseId/lessons/complete',
  validate(completeLessonSchema),
  async (req: AuthReq, res, next) => {
    try {
      const { lessonId } = req.body as z.infer<typeof completeLessonSchema>;
      const isObjectId = mongoose.isValidObjectId(req.params.courseId);
      const course = await Course.findOne(
        isObjectId ? { $or: [{ _id: req.params.courseId }, { slug: req.params.courseId }] } : { slug: req.params.courseId }
      ).lean();
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const lesson = course.lessons?.find((l: any) => String(l._id) === lessonId);
      if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
      const enrollment = await Enrollment.findOneAndUpdate(
        { user: req.user!.id, course: course._id },
        {
          $addToSet: { completedLessonIds: new mongoose.Types.ObjectId(lessonId) },
          $setOnInsert: { user: req.user!.id, course: course._id },
        },
        { upsert: true, new: true }
      ).lean();
      res.json(enrollmentToView(enrollment));
    } catch (e) { next(e); }
  }
);

const quizSchema = z.object({
  answers: z.array(z.object({ questionId: z.string().min(1), choiceIndex: z.number().int().min(0) })).min(1),
});

r.post('/enrollments/:courseId/quiz', validate(quizSchema), async (req: AuthReq, res, next) => {
  try {
    const { answers } = req.body as z.infer<typeof quizSchema>;
    const isObjectId = mongoose.isValidObjectId(req.params.courseId);
    const course = await Course.findOne(
      isObjectId ? { $or: [{ _id: req.params.courseId }, { slug: req.params.courseId }] } : { slug: req.params.courseId }
    ).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const quiz: any[] = course.quiz ?? [];
    if (!quiz.length) return res.status(400).json({ error: 'Course has no quiz' });

    let correct = 0;
    const review = quiz.map((q: any) => {
      const submitted = answers.find((a) => a.questionId === String(q._id));
      const right = submitted?.choiceIndex === q.answerIndex;
      if (right) correct++;
      return {
        questionId: String(q._id),
        correct: right,
        correctIndex: q.answerIndex,
        explanation: q.explanation,
      };
    });
    const score = Math.round((correct / quiz.length) * 100);
    const passed = score >= (course.passingScore ?? 70);

    const enrollment = await Enrollment.findOneAndUpdate(
      { user: req.user!.id, course: course._id },
      {
        $set: { lastScore: score, completedAt: passed ? new Date() : undefined },
        $inc: { attempts: 1 },
        $setOnInsert: { user: req.user!.id, course: course._id },
      },
      { upsert: true, new: true }
    ).lean();

    let certification: any = null;
    if (passed) {
      const shareToken = randomBytes(12).toString('hex');
      certification = await Certification.findOneAndUpdate(
        { user: req.user!.id, course: course._id },
        {
          $set: {
            badgeLabel: course.badgeLabel,
            courseSlug: course.slug,
            score,
            issuedAt: new Date(),
            expiresAt: new Date(Date.now() + CERT_VALID_MS),
          },
          $setOnInsert: {
            user: req.user!.id,
            course: course._id,
            shareToken,
          },
        },
        { upsert: true, new: true }
      ).lean();
    }

    res.json({
      score,
      passed,
      passingScore: course.passingScore ?? 70,
      review,
      enrollment: enrollmentToView(enrollment),
      certification: certification ? certToView(certification) : null,
    });
  } catch (e) { next(e); }
});

r.get('/certifications', async (req: AuthReq, res, next) => {
  try {
    const certs = await Certification.find({ user: req.user!.id }).sort('-issuedAt').lean();
    res.json(certs.map(certToView));
  } catch (e) { next(e); }
});

r.get('/certifications/:id', async (req: AuthReq, res, next) => {
  try {
    const cert = await Certification.findOne({ _id: req.params.id, user: req.user!.id }).lean();
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    const verifyUrl = `${env.publicWebUrl}/verify/${cert.shareToken}`;
    const qr = await generateQR({ url: verifyUrl, token: cert.shareToken });
    res.json({ ...certToView(cert), qr, verifyUrl });
  } catch (e) { next(e); }
});

export default r;
