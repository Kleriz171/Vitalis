import { Schema, model, Types } from 'mongoose';

/**
 * What happened to a defibrillator and who did it: who was given or viewed its cabinet code,
 * who took it out and brought it back, battery readings, and what a connected cabinet reports.
 * An alert is something an operator should look at now, such as the cabinet opening with
 * nobody sent to it.
 */
export const AED_EVENTS = [
  'code_given', 'code_viewed', 'code_changed', 'picked_up', 'delivered', 'returned',
  'verified', 'problem', 'battery', 'door_opened', 'door_closed',
] as const;

const AedEventSchema = new Schema({
  aed: { type: Types.ObjectId, ref: 'Aed', required: true },
  type: { type: String, enum: AED_EVENTS, required: true },
  by: { type: Types.ObjectId, ref: 'User' }, // none when the cabinet itself reports
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
  detail: { type: String, maxlength: 240 },
  alert: Boolean,
}, { timestamps: { createdAt: 'at', updatedAt: false } });

AedEventSchema.index({ aed: 1, at: -1 });

export const AedEvent = model('AedEvent', AedEventSchema);

export const recordAedEvent = (aed: unknown, type: (typeof AED_EVENTS)[number], more: { by?: unknown; emergency?: unknown; detail?: string; alert?: boolean } = {}) =>
  AedEvent.create({ aed, type, ...more });
