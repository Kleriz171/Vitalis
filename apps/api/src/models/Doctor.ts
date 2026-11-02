import { Schema, model } from 'mongoose';

const DoctorSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  specialty: { type: String, required: true, index: true },
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital' },
  imageUrl: String,
  biography: String,
  phone: String,
  experience: { type: Number, default: 0 },
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  priceConsultation: { type: Number, default: 0 },
  availableOnline: { type: Boolean, default: false, index: true },
  availableNow: { type: Boolean, default: false },
  // Bookable on Vitalis only when `user` is a clinician account. Hours are Tirana wall-clock times.
  workingHours: [{ _id: false, day: { type: Number, min: 0, max: 6 }, start: String, end: String }],
  daysOff: [String], // YYYY-MM-DD
  consultationTypes: [{
    name: { type: String, required: true, maxlength: 60 },
    minutes: { type: Number, required: true, min: 15, max: 120 },
    price: { type: Number, required: true, min: 0, max: 1_000_000 }, // lek
    online: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  }],
}, { timestamps: true });

DoctorSchema.index({ name: 'text', specialty: 'text', biography: 'text' });

export const Doctor = model('Doctor', DoctorSchema);
