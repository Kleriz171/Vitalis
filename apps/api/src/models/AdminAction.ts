import { Schema, model, Types } from 'mongoose';

// What administrators did: accounts made, suspended, restored or removed, roles changed, applications
// and certificates decided. Append-only: written by the server, no route changes or deletes it.
const AdminActionSchema = new Schema({
  actor: { type: Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  target: { type: Types.ObjectId, ref: 'User' },
  detail: String,
  at: { type: Date, default: Date.now },
}, { versionKey: false });

AdminActionSchema.index({ at: -1 });
AdminActionSchema.index({ at: 1 }, { expireAfterSeconds: 5 * 365 * 86_400 }); // kept five years

export const AdminAction = model('AdminAction', AdminActionSchema);

export const recordAdminAction = (actor: unknown, action: string, target?: unknown, detail?: string) =>
  AdminAction.create({ actor, action, target, detail });
