import { Schema, model, Types } from 'mongoose';

export const BOOKING_STATUS = ['requested', 'confirmed', 'completed', 'cancelled', 'declined'] as const;
export const SLOT_MIN = 15;

// A consultation booked with a clinician on Vitalis. The type, length and price are copied at booking,
// so later changes to the clinician's fees never touch it. `slots` lists every 15-minute start the
// booking covers; while it is `active` (requested or confirmed) a unique index keeps any two bookings
// of one clinician from sharing a slot, which makes double booking impossible even under races.
const BookingSchema = new Schema({
  doctor: { type: Types.ObjectId, ref: 'Doctor', required: true },
  clinician: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  patient: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  type: { id: Types.ObjectId, name: String, minutes: Number, online: Boolean },
  price: { type: Number, min: 0, required: true }, // lek, as offered when booked
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  slots: { type: [Date], required: true },
  status: { type: String, enum: BOOKING_STATUS, default: 'requested', index: true },
  active: { type: Boolean, default: true },
  reason: { type: String, maxlength: 500 },
  // The patient agreed to show this clinician their Bio Passport and Vitalis history (timeline).
  shareRecord: { type: Boolean, default: false },
  history: [{ at: { type: Date, default: Date.now }, by: { type: Types.ObjectId, ref: 'User' }, action: String, note: String }],
  remindedAt: Date,
}, { timestamps: true });

BookingSchema.index({ doctor: 1, slots: 1 }, { unique: true, partialFilterExpression: { active: true } });
BookingSchema.index({ doctor: 1, startsAt: 1 });

export const Booking = model('Booking', BookingSchema);
