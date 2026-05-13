import { Schema, model } from 'mongoose';

export const SUPPLY_CATEGORIES = ['blood', 'organ', 'tissue', 'medicine'] as const;

const SupplyRequestSchema = new Schema({
  category: { type: String, enum: SUPPLY_CATEGORIES, required: true, index: true },
  title: { type: String, required: true },
  resourceType: { type: String, required: true, index: true },
  urgency: { type: String, enum: ['normal', 'urgent', 'critical'], default: 'normal', index: true },
  quantityLabel: { type: String, required: true },
  facilityName: { type: String, required: true },
  notes: String,
  status: { type: String, enum: ['open', 'fulfilled', 'cancelled'], default: 'open', index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  inquiryCount: { type: Number, default: 0 },
}, { timestamps: true });

export const SupplyRequest = model('SupplyRequest', SupplyRequestSchema);

const SupplyInquirySchema = new Schema({
  request: { type: Schema.Types.ObjectId, ref: 'SupplyRequest', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  message: { type: String, required: true },
  contactPreference: { type: String, enum: ['in_app', 'phone', 'email'], default: 'in_app' },
  status: { type: String, enum: ['open', 'responded', 'closed'], default: 'open', index: true },
}, { timestamps: true });

SupplyInquirySchema.index({ request: 1, user: 1, createdAt: -1 });

export const SupplyInquiry = model('SupplyInquiry', SupplyInquirySchema);
