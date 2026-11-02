import { Schema, model, Types } from 'mongoose';

export const ACCESS_KINDS = ['clinician_record', 'admin_record', 'qr_profile'] as const;

// Who looked at someone's medical record, when and on what basis. Written by the server only; no
// route edits or deletes it. Patients read their own entries; administrators read all. Kept two years.
const AccessLogSchema = new Schema({
  subject: { type: Types.ObjectId, ref: 'User', required: true }, // whose record
  actor: { type: Types.ObjectId, ref: 'User' }, // empty for an anonymous QR scan
  actorRole: String,
  kind: { type: String, enum: ACCESS_KINDS, required: true },
  booking: { type: Types.ObjectId, ref: 'Booking' },
  at: { type: Date, default: Date.now },
}, { versionKey: false });

AccessLogSchema.index({ subject: 1, at: -1 });
AccessLogSchema.index({ at: 1 }, { expireAfterSeconds: 2 * 365 * 86_400 });

export const AccessLog = model('AccessLog', AccessLogSchema);

export const logAccess = (entry: { subject: unknown; actor?: unknown; actorRole?: string; kind: typeof ACCESS_KINDS[number]; booking?: unknown }) =>
  AccessLog.create(entry);
