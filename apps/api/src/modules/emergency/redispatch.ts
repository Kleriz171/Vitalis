import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { haversineKm } from '../../utils/geo';
import { logger } from '../../config/logger';
import { blockchainService } from '../blockchain/blockchain.service';
import { getIO } from '../../realtime/socket';
import { alertResponders, broadcast, push } from './emergency.controller';

// A responder who accepts and then does not move leaves the caller waiting for help that is
// not coming. This sweep takes them off the call and alerts the next responders.
// Progress is measured from the location the phone reports while on duty (every ~150 m or
// minute), never from button taps: someone driving who forgot "I'm on my way" is kept.
const ms = (v: string | undefined, fallback: number) => (v ? Number(v) : fallback);
export const REDISPATCH = {
  tickMs: ms(process.env.REDISPATCH_TICK_MS, 20_000),
  progressMs: ms(process.env.REDISPATCH_PROGRESS_MS, 3 * 60_000), // time to show movement
  lateGraceMs: ms(process.env.REDISPATCH_LATE_MS, 8 * 60_000), // added to the ETA before "late"
  minProgressM: 150, // must be this much closer than where they accepted
  closeM: 200, // within this distance counts as there
};

export type StallInput = {
  status: string;
  elapsedMs: number; // since accept
  etaSeconds?: number | null;
  startM?: number | null; // distance at accept
  currentM?: number | null; // distance now, only from a fix reported after accept
};

/** Why the responder should be released, or null while they are plausibly on their way. */
export function stallReason(x: StallInput): 'late' | 'no_progress' | null {
  if (x.status === 'on_scene') return null;
  const eta = (x.etaSeconds ?? 0) * 1000;
  if (x.elapsedMs >= Math.max(2 * eta, eta + REDISPATCH.lateGraceMs)) return 'late';
  if (x.elapsedMs < REDISPATCH.progressMs) return null;
  if (x.startM != null && x.startM <= REDISPATCH.closeM) return null; // accepted from next door
  const moved = x.currentM != null && (
    x.currentM <= REDISPATCH.closeM
    || (x.startM != null && x.startM - x.currentM >= REDISPATCH.minProgressM)
  );
  return moved ? null : 'no_progress';
}

async function release(e: any, reason: 'late' | 'no_progress') {
  const rid = String(e.responder);
  // Atomic: only if this responder still holds the call (they may have arrived or cancelled meanwhile).
  const updated = await Emergency.findOneAndUpdate(
    { _id: e._id, responder: rid, status: { $in: ['assigned', 'en_route'] } },
    {
      $set: { status: 'pending' },
      $unset: { responder: 1, etaSeconds: 1, responderStartM: 1 },
      $addToSet: { releasedResponders: rid },
      $push: { timeline: { status: 'released', by: rid, at: new Date() } },
    },
    { new: true },
  );
  if (!updated) return;
  logger.info(`redispatch: released ${rid} from ${updated._id} (${reason})`);
  await blockchainService.append({ entity: 'emergency', entityId: String(updated._id), action: 'released', actor: rid });

  broadcast('emergency:status', updated);
  getIO().to(`user:${rid}`).emit('emergency:released', { _id: String(updated._id), reason });
  push({
    userIds: [rid],
    kind: 'update',
    title: { en: 'You were taken off the call', sq: 'U hoqët nga thirrja' },
    body: {
      en: 'You did not seem to be moving toward the patient, so the next responders are being alerted.',
      sq: 'Nuk dukej se po lëviznit drejt pacientit, prandaj po njoftohen ndihmësit e tjerë.',
    },
    data: { type: 'update', emergencyId: String(updated._id) },
  });
  push({
    userIds: [String(updated.citizen)],
    kind: 'update',
    title: { en: 'Finding another responder', sq: 'Po kërkojmë një ndihmës tjetër' },
    body: {
      en: 'The first responder could not make it. Call the ambulance too.',
      sq: 'Ndihmësi i parë nuk mundi të vijë. Telefononi edhe ambulancën.',
    },
    data: { type: 'update', emergencyId: String(updated._id) },
  });
  const exclude = [String(updated.citizen), ...(updated.releasedResponders ?? []).map(String)];
  if (updated.aedRunner) exclude.push(String(updated.aedRunner));
  await alertResponders(updated, exclude);
}

export async function sweepStalledResponders(now = Date.now()) {
  const calls = await Emergency.find({ status: { $in: ['assigned', 'en_route'] }, responder: { $ne: null } })
    .select('responder status etaSeconds responderStartM location timeline citizen')
    .lean();
  for (const e of calls as any[]) {
    const accepted = [...(e.timeline ?? [])].reverse().find((t: any) => t.status === 'assigned')?.at;
    if (!accepted) continue;
    const r = await User.findById(e.responder).select('location locationAt').lean();
    const incident = (e.location as any).coordinates as [number, number];
    const fix = (r?.location as any)?.coordinates as [number, number] | undefined;
    const fresh = fix && r?.locationAt && new Date(r.locationAt).getTime() >= new Date(accepted).getTime();
    const reason = stallReason({
      status: e.status as string,
      elapsedMs: now - new Date(accepted).getTime(),
      etaSeconds: e.etaSeconds,
      startM: e.responderStartM,
      currentM: fresh ? haversineKm(fix, incident) * 1000 : null,
    });
    if (reason) await release(e, reason).catch(err => logger.error(`redispatch failed: ${err?.message}`));
  }
}

export function startRedispatch() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // a slow sweep must not overlap the next one
    running = true;
    try { await sweepStalledResponders(); } catch (err: any) { logger.error(`redispatch sweep: ${err?.message}`); }
    finally { running = false; }
  }, REDISPATCH.tickMs);
  timer.unref();
}
