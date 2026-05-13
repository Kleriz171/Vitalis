import { Schema, model } from 'mongoose';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

const BloodInventorySchema = new Schema({
  hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  bloodType: { type: String, enum: BLOOD_TYPES, required: true, index: true },
  unitsAvailable: { type: Number, default: 0, min: 0 },
  unitsNeeded: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

BloodInventorySchema.index({ hospital: 1, bloodType: 1 }, { unique: true });

export const BloodInventory = model('BloodInventory', BloodInventorySchema);
