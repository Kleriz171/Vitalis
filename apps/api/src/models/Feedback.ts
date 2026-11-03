import { Schema, model, Types } from 'mongoose';

export const FEEDBACK_CATEGORY = ['app', 'emergency', 'responder', 'clinician', 'hospital', 'privacy', 'other'] as const;
export const FEEDBACK_PRIORITY = ['low', 'normal', 'high', 'urgent'] as const;
export const FEEDBACK_STATUS = ['new', 'in_review', 'resolved', 'dismissed'] as const;

// Feedback and complaints from anyone signed in, handled by administrators. Every change is in `history`.
const FeedbackSchema = new Schema({
  author: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, enum: FEEDBACK_CATEGORY, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  priority: { type: String, enum: FEEDBACK_PRIORITY, default: 'normal' },
  status: { type: String, enum: FEEDBACK_STATUS, default: 'new', index: true },
  assignee: { type: Types.ObjectId, ref: 'User' },
  resolution: { type: String, maxlength: 2000 },
  history: [{ _id: false, at: { type: Date, default: Date.now }, by: { type: Types.ObjectId, ref: 'User' }, change: String }],
}, { timestamps: true });

export const Feedback = model('Feedback', FeedbackSchema);
