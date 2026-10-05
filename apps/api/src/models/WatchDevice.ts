import { Schema, model, Types } from 'mongoose';

// A paired watch. Its key is stored only as a hash and can do three things: send an SOS
// (and cancel it), read that SOS's status, and read the owner's Medical ID.
const WatchDeviceSchema = new Schema({
  user: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  name: { type: String, maxlength: 60 },
  lastSeenAt: Date,
}, { timestamps: true });

// A pairing in progress: the watch shows `code`, the signed-in phone confirms it, then the
// watch (which alone knows `pairId`) collects its key. Expires after ten minutes.
const WatchPairingSchema = new Schema({
  code: { type: String, required: true, index: true },
  pairIdHash: { type: String, required: true, unique: true },
  name: { type: String, maxlength: 60 },
  user: { type: Types.ObjectId, ref: 'User' },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const WatchDevice = model('WatchDevice', WatchDeviceSchema);
export const WatchPairing = model('WatchPairing', WatchPairingSchema);
