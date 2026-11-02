import { Schema, model } from 'mongoose';

const HospitalSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['public', 'private'], default: 'public' },
  address: String,
  phone: String,
  isOpen24h: { type: Boolean, default: false },
  // Reported by the hospital's own staff on Vitalis; operators see it with its time. Never used to pick
  // a hospital automatically.
  capacity: {
    status: { type: String, enum: ['accepting', 'limited', 'unavailable'] },
    updatedAt: Date,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
}, { timestamps: true });

HospitalSchema.index({ location: '2dsphere' });

export const Hospital = model('Hospital', HospitalSchema);
