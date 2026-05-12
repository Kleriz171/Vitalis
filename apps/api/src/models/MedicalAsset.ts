import { Schema, model } from 'mongoose';

const MedicalAssetSchema = new Schema({
  name: String,
  kind: { type: String, enum: ['blood','organ','plasma','vaccine','equipment'] },
  bloodType: String,
  custodian: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  status: { type: String, enum: ['available','reserved','in_transit','delivered'], default: 'available' },
}, { timestamps: true });

MedicalAssetSchema.index({ location: '2dsphere' });

export const MedicalAsset = model('MedicalAsset', MedicalAssetSchema);
