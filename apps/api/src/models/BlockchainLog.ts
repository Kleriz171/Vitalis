import { Schema, model } from 'mongoose';

const BlockchainLogSchema = new Schema({
  index: { type: Number, required: true, unique: true, index: true },
  timestamp: { type: Date, default: Date.now },
  prevHash: { type: String, required: true },
  hash: { type: String, required: true, unique: true },
  payload: { type: Schema.Types.Mixed, required: true },
  nonce: { type: Number, default: 0 },
});

export const BlockchainLog = model('BlockchainLog', BlockchainLogSchema);
