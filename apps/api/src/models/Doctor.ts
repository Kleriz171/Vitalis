import { Schema, model } from 'mongoose';

const DoctorSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  specialty: { type: String, required: true, index: true },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  imageUrl: String,
  biography: String,
  experience: { type: Number, default: 0 },
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  priceConsultation: { type: Number, default: 0 },
  availableOnline: { type: Boolean, default: false, index: true },
  availableNow: { type: Boolean, default: false },
}, { timestamps: true });

DoctorSchema.index({ name: 'text', specialty: 'text', biography: 'text' });

export const Doctor = model('Doctor', DoctorSchema);
