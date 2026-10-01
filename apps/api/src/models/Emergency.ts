import { Schema, model, Types } from 'mongoose';

export const EMERGENCY_STATUS = ['pending','assigned','en_route','on_scene','resolved','cancelled'] as const;
export const EMERGENCY_TYPE = ['medical','trauma','cardiac','blood_needed','rare_medicine','other'] as const;

const EmergencySchema = new Schema({
  citizen: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  responder: { type: Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: EMERGENCY_TYPE, required: true },
  priority: { type: Number, min: 1, max: 5, default: 3 },
  status: { type: String, enum: EMERGENCY_STATUS, default: 'pending', index: true },
  description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  etaSeconds: Number,
  // Re-dispatch (redispatch.ts): distance at accept, and responders taken off this call.
  responderStartM: Number,
  releasedResponders: [{ type: Types.ObjectId, ref: 'User' }],
  // Second runner for cardiac arrests: fetches the nearest defibrillator, then joins the patient.
  aedRunner: { type: Types.ObjectId, ref: 'User', index: true },
  aed: { type: Types.ObjectId, ref: 'Aed' },
  aedStatus: { type: String, enum: ['to_aed', 'has_aed', 'delivered'] },
  metadata: { fromWearable: Boolean, deviceId: String },
  // Raised by a missed check-in or a duress PIN (checkin.service.ts). Dispatch-only incidents
  // never reach responders' inboxes; silent ones are also hidden from the person's own app,
  // so whoever is forcing them cannot see that an alarm went out.
  dispatchOnly: { type: Boolean, default: false },
  silent: { type: Boolean, default: false },
  // sha256 of the live-tracking link token texted to the emergency contact (track.routes.ts).
  trackTokenHash: { type: String, select: false, index: { unique: true, sparse: true } },
  timeline: [{ status: String, at: { type: Date, default: Date.now }, by: { type: Types.ObjectId, ref: 'User' } }],
}, {
  timestamps: true,
  // The link-token hash never leaves the server, even from a freshly created document.
  toJSON: { transform: (_doc, ret: any) => { delete ret.trackTokenHash; return ret; } },
  toObject: { transform: (_doc, ret: any) => { delete ret.trackTokenHash; return ret; } },
});

EmergencySchema.index({ location: '2dsphere' });
EmergencySchema.index({ status: 1, createdAt: -1 });

export const Emergency = model('Emergency', EmergencySchema);
