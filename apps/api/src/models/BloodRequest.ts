import { Schema, model } from 'mongoose';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const BloodRequestSchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
  patientName: { type: String, required: true },
  bloodType: { type: String, enum: BLOOD_TYPES, required: true, index: true },
  urgency: { type: String, enum: ['normal', 'urgent', 'critical'], default: 'normal', index: true },
  unitsNeeded: { type: Number, required: true, min: 1 },
  reason: String,
  status: { type: String, enum: ['open', 'fulfilled', 'cancelled'], default: 'open', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const BloodRequest = model('BloodRequest', BloodRequestSchema);
