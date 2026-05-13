import { Schema, model } from 'mongoose';

const CommunityGroupSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  category: { type: String, required: true, index: true },
  memberCount: { type: Number, default: 0 },
}, { timestamps: true });

export const CommunityGroup = model('CommunityGroup', CommunityGroupSchema);
