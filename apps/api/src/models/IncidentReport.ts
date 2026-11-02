import { Schema, model, Types } from 'mongoose';

export const REPORT_ACTIONS = ['cpr', 'aed_shock', 'recovery_position', 'bleeding_control', 'airway', 'reassurance', 'called_ambulance'] as const;
export const REPORT_HANDOVER = ['ambulance', 'hospital', 'stayed_on_scene', 'refused_care', 'none'] as const;

// A responder's short structured report on one call: one per responder per call, never shown to
// the caller. The arrival time comes from the call's timeline, not from what was typed.
const IncidentReportSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency', required: true },
  author: { type: Types.ObjectId, ref: 'User', required: true },
  arrivedAt: Date,
  conscious: { type: String, enum: ['yes', 'no', 'unknown'], default: 'unknown' },
  breathing: { type: String, enum: ['normal', 'abnormal', 'none', 'unknown'], default: 'unknown' },
  cprPerformed: { type: Boolean, default: false },
  aedUsed: { type: Boolean, default: false },
  shocks: { type: Number, min: 0, max: 50 },
  actions: [{ type: String, enum: REPORT_ACTIONS }],
  notes: { type: String, maxlength: 1000 },
  handover: { type: String, enum: REPORT_HANDOVER, default: 'none' },
}, { timestamps: true });

IncidentReportSchema.index({ emergency: 1, author: 1 }, { unique: true });

export const IncidentReport = model('IncidentReport', IncidentReportSchema);
