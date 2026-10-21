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
  // ok = usable. needs_check = someone reported a problem; out_of_service = an operator confirmed one.
  // Dispatch skips both until an operator verifies the device again.
  status: { type: String, enum: ['ok', 'needs_check', 'out_of_service'], default: 'ok' },
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
