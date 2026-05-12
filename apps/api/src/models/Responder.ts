import { Schema, model, Types } from 'mongoose';

const ResponderSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
  specialties: [{ type: String }],
  vehicleType: { type: String, enum: ['foot','bike','car','ambulance','drone'], default: 'foot' },
  rating: { type: Number, default: 5 },
  activeEmergency: { type: Types.ObjectId, ref: 'Emergency' },
}, { timestamps: true });

export const Responder = model('Responder', ResponderSchema);
