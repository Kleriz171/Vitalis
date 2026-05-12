import { Schema, model } from 'mongoose';

const MedicineInventorySchema = new Schema({
  pharmacy: { name: String, phone: String },
  medicine: { name: { type: String, index: 'text' }, atc: String },
  stock: { type: Number, default: 0 },
  rare: { type: Boolean, default: false },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
}, { timestamps: true });

MedicineInventorySchema.index({ location: '2dsphere' });

export const MedicineInventory = model('MedicineInventory', MedicineInventorySchema);
