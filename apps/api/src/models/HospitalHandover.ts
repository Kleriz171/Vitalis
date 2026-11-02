import { Schema, model, Types } from 'mongoose';

export const HANDOVER_STATUS = ['sent', 'acknowledged', 'arrived', 'withdrawn', 'duplicate'] as const;
export const INTAKE_STATUS = ['arrived', 'in_treatment', 'admitted', 'discharged', 'transferred'] as const;

// An operator sends a call's handover to one participating hospital. The summary is a snapshot taken
// at sending: the hospital reads it but can never change the responders' reports or the call.
const HospitalHandoverSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency', required: true, index: true },
  hospital: { type: Types.ObjectId, ref: 'Hospital', required: true },
  citizen: { type: Types.ObjectId, ref: 'User' }, // for spotting the same patient twice
  sentBy: { type: Types.ObjectId, ref: 'User', required: true },
  sentAt: { type: Date, default: Date.now },
  // Someone from the hospital had the console open when it was sent.
  deliveredLive: { type: Boolean, default: false },
  summary: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: HANDOVER_STATUS, default: 'sent', index: true },
  acknowledgedAt: Date,
  acknowledgedBy: { type: Types.ObjectId, ref: 'User' },
  arrivedAt: Date,
  arrivedBy: { type: Types.ObjectId, ref: 'User' },
  hospitalRef: { type: String, maxlength: 60 }, // the hospital's own record number
  intake: { type: String, enum: INTAKE_STATUS },
  intakeAt: Date,
  duplicateOf: { type: Types.ObjectId, ref: 'HospitalHandover' },
  withdrawnAt: Date,
}, { timestamps: true });

HospitalHandoverSchema.index({ hospital: 1, sentAt: -1 });

export const HospitalHandover = model('HospitalHandover', HospitalHandoverSchema);
