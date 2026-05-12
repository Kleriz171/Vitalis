import { Schema, model, Types } from 'mongoose';

const NotificationSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', index: true },
  kind: { type: String, enum: ['emergency','medicine','drone','system'] },
  title: String,
  body: String,
  read: { type: Boolean, default: false },
  data: Schema.Types.Mixed,
}, { timestamps: true });

export const Notification = model('Notification', NotificationSchema);
