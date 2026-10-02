import { Schema, model, Types } from 'mongoose';

const DroneMissionSchema = new Schema({
  emergency: { type: Types.ObjectId, ref: 'Emergency' },
  droneId: { type: String, required: true },
  status: { type: String, enum: ['queued','launched','in_flight','delivered','aborted'], default: 'queued' },
  origin: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  destination: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  route: [[Number]],
  // Tello has no GPS: an autonomous flight is a list of relative SDK moves ("forward 200", "cw 90").
  steps: [String],
  routeName: String,
  currentStep: { type: Number, default: -1 },
  abortReason: String,
  dispatchedBy: { type: Types.ObjectId, ref: 'User' },
  payload: String,
}, { timestamps: true });

export const DroneMission = model('DroneMission', DroneMissionSchema);
