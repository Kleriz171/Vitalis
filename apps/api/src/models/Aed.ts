import { Schema, model, Types } from 'mongoose';

// Public-access defibrillator. Community-reported, operator-verified.
const AedSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  // Where exactly the device hangs: "Ground floor, left of the pharmacy counter".
  placement: { type: String, trim: true, maxlength: 240 },
  access: { type: String, enum: ['24h', 'business_hours', 'restricted'], default: 'business_hours' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  padsExpireAt: Date,
  // Charge, typed in at an inspection or sent by a connected cabinet.
  battery: {
    percent: { type: Number, min: 0, max: 100 },
    at: Date,
    source: { type: String, enum: ['inspection', 'device'] },
    by: { type: Types.ObjectId, ref: 'User' },
  },
  // Locked cabinet's code, sealed (utils/sealed). Only the runner sent for it and operators read
  // it, and every read is in AedEvent. Never part of a list or a broadcast.
  cabinetCode: { type: String, select: false },
  // ok = usable. needs_check = someone reported a problem; out_of_service = an operator confirmed one.
  // in_use = a runner took it from its cabinet; it's back when an operator puts it back in service.
  // Dispatch skips all but ok until an operator verifies the device again.
  status: { type: String, enum: ['ok', 'needs_check', 'out_of_service', 'in_use'], default: 'ok' },
  problem: {
    note: { type: String, trim: true, maxlength: 240 },
    reportedAt: Date,
    reportedBy: { type: Types.ObjectId, ref: 'User' },
  },
  verifiedAt: Date,
  verifiedBy: { type: Types.ObjectId, ref: 'User' },
  reportedBy: { type: Types.ObjectId, ref: 'User' },
}, { timestamps: true });

AedSchema.index({ location: '2dsphere' });

export const Aed = model('Aed', AedSchema);
