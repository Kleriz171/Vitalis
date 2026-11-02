import { Schema, model, Types } from 'mongoose';

// One text to one person in someone's emergency circle about one SOS. `sent` means the SMS provider
// accepted it (no delivery receipts yet); `simulated` is a test demo without a provider, never sent.
export const ALERT_STATUS = ['sending', 'sent', 'simulated', 'failed', 'not_configured', 'skipped_recent', 'skipped_no_consent'] as const;

const ContactAlertSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency', required: true },
  user: { type: Types.ObjectId, ref: 'User', required: true },
  name: String,
  phone: { type: String, required: true },
  withLocation: Boolean,
  status: { type: String, enum: ALERT_STATUS, required: true },
  error: String,
  at: { type: Date, default: Date.now },
}, { versionKey: false });

// One alert per person per SOS, however often the sending is retried.
ContactAlertSchema.index({ emergency: 1, phone: 1 }, { unique: true });
ContactAlertSchema.index({ phone: 1, at: -1 });

export const ContactAlert = model('ContactAlert', ContactAlertSchema);
