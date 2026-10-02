import { Schema, model, Types } from 'mongoose';

// A safety check-in: "if I have not checked in by dueAt, raise the alarm".
// stage: 0 waiting, 1 reminded, 2 emergency contact texted, 3 dispatcher alerted.
const CheckInSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'ok', 'cancelled'], default: 'active', index: true },
  dueAt: { type: Date, required: true, index: true },
  note: { type: String, maxlength: 200 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined },
  },
  stage: { type: Number, default: 0 },
  wrongPins: { type: Number, default: 0 },
  // Audit only; never returned to the person's app (a duress check-in must look normal).
  silentAlarm: { type: String, enum: ['duress', 'pin_attempts'], select: false },
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
}, { timestamps: true });

export const CheckIn = model('CheckIn', CheckInSchema);
