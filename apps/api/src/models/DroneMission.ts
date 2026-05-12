import { Schema, model, Types } from 'mongoose';

const DroneMissionSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
  droneId: { type: String, required: true },
  status: { type: String, enum: ['queued','launched','in_flight','delivered','aborted'], default: 'queued' },
  origin: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  destination: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  route: [[Number]],
  payload: String,
}, { timestamps: true });

export const DroneMission = model('DroneMission', DroneMissionSchema);
