import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['citizen','blood_donor','doctor','nurse','student_responder','dispatcher','admin'] as const;
export type Role = typeof ROLES[number];
export const BLOOD_TYPES = ['A+','A-','B+','B-','AB+','AB-','O+','O-'] as const;
export const GENDERS = ['female', 'male', 'non_binary', 'other', 'prefer_not_to_say'] as const;

const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, index: true, lowercase: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  name: { type: String, required: true },
  phone: String,
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
  refreshTokenHash: { type: String, select: false },
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });

UserSchema.pre('save', async function (next) {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password as string, 10);
  next();
});

UserSchema.methods.comparePassword = function (pw: string) {
  return bcrypt.compare(pw, this.password);
};

export const User = model('User', UserSchema);
export type UserDoc = InstanceType<typeof User>;
