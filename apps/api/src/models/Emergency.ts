import { Schema, model, Types } from 'mongoose';

export const EMERGENCY_STATUS = ['pending','assigned','en_route','on_scene','resolved','cancelled'] as const;
export const EMERGENCY_TYPE = ['medical','trauma','cardiac','blood_needed','rare_medicine','other'] as const;

const EmergencySchema = new Schema({
  citizen: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  responder: { type: Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: EMERGENCY_TYPE, required: true },
  priority: { type: Number, min: 1, max: 5, default: 3 },
  status: { type: String, enum: EMERGENCY_STATUS, default: 'pending', index: true },
  description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  etaSeconds: Number,
  metadata: { fromWearable: Boolean, deviceId: String },
  timeline: [{ status: String, at: { type: Date, default: Date.now }, by: { type: Types.ObjectId, ref: 'User' } }],
}, { timestamps: true });

EmergencySchema.index({ location: '2dsphere' });
EmergencySchema.index({ status: 1, createdAt: -1 });

export const Emergency = model('Emergency', EmergencySchema);
