import { Schema, model, Types } from 'mongoose';

const QuestionSchema = new Schema({
  prompt: { type: String, required: true },
  choices: { type: [String], required: true },
  answerIndex: { type: Number, required: true },
  explanation: String,
}, { _id: true });

const LessonSchema = new Schema({
  title: { type: String, required: true },
  summary: String,
  body: { type: String, required: true },
  imageUrl: String,
  durationMin: { type: Number, default: 5 },
}, { _id: true });

const CourseSchema = new Schema({
  slug: { type: String, required: true, unique: true, index: true },
  title: { type: String, required: true },
  category: { type: String, required: true, index: true },
  shortDescription: { type: String, required: true },
  heroEmoji: { type: String, default: '🩺' },
  estimatedMinutes: { type: Number, default: 15 },
  level: { type: String, enum: ['intro', 'standard', 'advanced'], default: 'intro' },
  lessons: { type: [LessonSchema], default: [] },
  quiz: { type: [QuestionSchema], default: [] },
  passingScore: { type: Number, default: 70 },
  badgeLabel: { type: String, required: true },
}, { timestamps: true });

export const Course = model('Course', CourseSchema);

const EnrollmentSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  completedLessonIds: { type: [Schema.Types.ObjectId], default: [] },
  lastScore: Number,
  attempts: { type: Number, default: 0 },
  completedAt: Date,
}, { timestamps: true });

EnrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

export const Enrollment = model('Enrollment', EnrollmentSchema);

const CertificationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
  courseSlug: { type: String, required: true },
  badgeLabel: { type: String, required: true },
  score: { type: Number, required: true },
  issuedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  shareToken: { type: String, required: true, unique: true, index: true },
}, { timestamps: true });

export const Certification = model('Certification', CertificationSchema);

export type CourseDoc = ReturnType<typeof Course['hydrate']>;
export type EnrollmentDoc = ReturnType<typeof Enrollment['hydrate']>;
export type CertificationDoc = ReturnType<typeof Certification['hydrate']>;

export const objectIdEqual = (a: Types.ObjectId | string, b: Types.ObjectId | string) =>
  String(a) === String(b);
