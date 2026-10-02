import { Schema, model } from 'mongoose';

// One document per phone number: the current SMS code (hashed) plus send-rate bookkeeping.
// Mongo's TTL monitor removes it an hour after the last send window opened.
const PhoneCodeSchema = new Schema({
  phone: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
  lastSentAt: { type: Date, required: true },
  windowStart: { type: Date, required: true },
  sendsInWindow: { type: Number, default: 1 },
  purgeAt: { type: Date, required: true, index: { expires: 0 } },
});

export const PhoneCode = model('PhoneCode', PhoneCodeSchema);
