import { Schema, model } from 'mongoose';

const DoctorApplicationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  specialty: { type: String, required: true },
  yearsExperience: { type: Number, required: true, min: 0 },
  bio: { type: String, required: true },
  certificateFileId: { type: Schema.Types.ObjectId, required: true },
  certificateFilename: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  rejectionReason: String,
}, { timestamps: true });

export const DoctorApplication = model('DoctorApplication', DoctorApplicationSchema);
