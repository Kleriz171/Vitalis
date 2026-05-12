import { Schema, model, Types } from 'mongoose';

const VideoSessionSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
  participants: [{ type: Types.ObjectId, ref: 'User' }],
  roomId: { type: String, required: true, unique: true },
  status: { type: String, enum: ['open','closed'], default: 'open' },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
});

export const VideoSession = model('VideoSession', VideoSessionSchema);
