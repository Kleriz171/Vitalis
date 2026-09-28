import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['citizen','blood_donor','doctor','nurse','student_responder','dispatcher','admin'] as const;
export type Role = typeof ROLES[number];
export const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'] as const;
export const GENDERS = ['female', 'male', 'non_binary', 'other', 'prefer_not_to_say'] as const;

const UserSchema = new Schema({
  // Citizens sign up by phone; staff (web console) and legacy accounts use email + password.
  // Both are unique only where present, so phone-only users do not collide on a missing email.
  email: { type: String, lowercase: true, trim: true },
  password: { type: String, select: false },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  name: { type: String, required: true },
  phone: { type: String, trim: true }, // E.164, set only after SMS verification
  dateOfBirth: Date,
  role: { type: String, enum: ROLES, default: 'citizen', index: true },
  bloodType: { type: String, enum: BLOOD_TYPES },
  age: { type: Number, min: 0, max: 130 },
  gender: { type: String, enum: GENDERS },
  heightCm: { type: Number, min: 30, max: 300 },
  weightKg: { type: Number, min: 1, max: 500 },
  illnesses: { type: [String], default: [] },
  disabilities: { type: [String], default: [] },
  allergies: [String],
  emergencyContact: { name: String, phone: String },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  available: { type: Boolean, default: false },
  // Expo push tokens, one per installed device. Pruned when Expo reports them dead.
  pushTokens: { type: [String], default: [], select: false },
  // App language, reported with the push token; server-written text (push) follows it.
  language: { type: String, enum: ['sq', 'en'], default: 'sq' },
  refreshTokenHash: { type: String, select: false },
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });
UserSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
UserSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password as string, 10);
  next();
});

UserSchema.methods.comparePassword = function (pw: string) {
  return bcrypt.compare(pw, this.password);
};

export const User = model('User', UserSchema);

/** Age in whole years: from date of birth when known (never goes stale), else the stored age. */
export const ageOf = (u: { dateOfBirth?: Date | null; age?: number | null }, now = new Date()) => {
  if (!u.dateOfBirth) return u.age ?? undefined;
  const d = new Date(u.dateOfBirth);
  const hadBirthday = now.getUTCMonth() > d.getUTCMonth()
    || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() >= d.getUTCDate());
  return now.getUTCFullYear() - d.getUTCFullYear() - (hadBirthday ? 0 : 1);
};
export type UserDoc = InstanceType<typeof User>;
