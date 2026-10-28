import { Schema, model, Types } from 'mongoose';

// Drone footage shows patients and bystanders, so it is kept 30 days and no longer:
// this TTL index deletes the record, a lifecycle rule on the bucket deletes the file.
export const MEDIA_RETENTION_DAYS = 30;

const DroneMediaSchema = new Schema({
  droneId: { type: String, required: true },
  kind: { type: String, enum: ['photo', 'video'], required: true },
  // video: recording → uploading → ready. photo: uploading → ready. Either can end failed.
  status: { type: String, enum: ['recording', 'uploading', 'ready', 'failed'], required: true },
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
  requestedBy: { type: Types.ObjectId, ref: 'User', required: true },
  storageKey: String,
  contentType: String,
  size: Number,
  sha256: String,
  error: String,
}, { timestamps: true });

DroneMediaSchema.index({ createdAt: 1 }, { expireAfterSeconds: MEDIA_RETENTION_DAYS * 24 * 3600 });
DroneMediaSchema.index({ droneId: 1, status: 1 });

export const DroneMedia = model('DroneMedia', DroneMediaSchema);
