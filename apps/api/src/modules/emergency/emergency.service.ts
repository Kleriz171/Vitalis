import crypto from 'crypto';
import { Emergency, ACTIVE_STATUSES, STATUS_ORDER } from '../../models/Emergency';
import { IncidentReport } from '../../models/IncidentReport';
import { ContactAlert } from '../../models/ContactAlert';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { sha256 } from '../../utils/hash';
import { sendSms } from '../../utils/sms';
import { User, ageOf } from '../../models/User';
import { Certification } from '../../models/Training';
import { Aed } from '../../models/Aed';
import { recordAedEvent } from '../../models/AedEvent';
import { unseal } from '../../utils/sealed';
import { Allergy, Medication, Condition } from '../../models/HealthRecord';
import { nearQuery, haversineKm, roadEtaSeconds } from '../../utils/geo';
import { blockchainService } from '../blockchain/blockchain.service';
import { OPERATOR_ROLES } from '../../realtime/socket';
import { RESPONDER_ROLES } from '../../models/User';

export { ACTIVE_STATUSES };
const REPORT_WINDOW_MS = 24 * 3600_000;

/** Responders already holding an open call (as the primary or the defibrillator runner). */
export async function busyResponderIds() {
  const open = { status: { $in: ACTIVE_STATUSES } };
  const [primary, runners] = await Promise.all([
    Emergency.distinct('responder', { ...open, responder: { $ne: null } }),
    Emergency.distinct('aedRunner', { ...open, aedRunner: { $ne: null } }),
  ]);
  return [...primary, ...runners].map(String);
}

// Search rings for responders: try close first, widen only if nobody is there.
const RINGS_M = [5_000, 20_000];

// Farthest an AED runner should detour for a device (metres from the patient).
const AED_RADIUS_M = 1_500;

// Only devices an operator confirmed, in their cabinet, with pads in date: a runner sent to a rumour loses minutes.
const nearestAed = (coords: [number, number]) =>
  Aed.findOne({
    ...nearQuery(coords[0], coords[1], AED_RADIUS_M),
    verifiedAt: { $ne: null },
    status: { $nin: ['needs_check', 'out_of_service', 'in_use'] },
    $or: [{ padsExpireAt: null }, { padsExpireAt: { $gt: new Date() } }],
  }).select('+cabinetCode').lean();

/** Texts the emergency contact a live link (landing /track/:token). Silent alarms never call this. */
// The same person is texted about at most one SOS per 10 minutes: a second press is the same emergency.
const RECENT_ALERT_MS = 10 * 60_000;

/**
 * Text the emergency contact and the emergency circle about a new SOS, each once, each tracked
 * (ContactAlert). People the user chose not to notify are recorded as skipped; those who may see the
 * location get the live tracking link. Never delays or fails the SOS itself.
 */
async function alertCircle(emergencyId: string, citizenId: string, token: string) {
  try {
    const u = await User.findById(citizenId).select('name emergencyContact circle language').lean();
    if (!u) return;
    const people = new Map<string, { name?: string; notify: boolean; shareLocation: boolean }>();
    if (u.emergencyContact?.phone) people.set(u.emergencyContact.phone, { name: u.emergencyContact.name ?? undefined, notify: true, shareLocation: true });
    for (const c of u.circle ?? []) if (!people.has(c.phone)) people.set(c.phone, { name: c.name, notify: c.notify !== false, shareLocation: c.shareLocation !== false });
    const link = `${env.publicWebUrl}/track/${token}`;
    const first = u.name?.split(' ')[0] ?? '';
    const en = u.language === 'en';
    for (const [phone, p] of people) {
      // Claim first: the unique (emergency, phone) index makes a retry a no-op instead of a second text.
      try {
        await ContactAlert.create({ emergency: emergencyId, user: citizenId, name: p.name, phone, withLocation: p.shareLocation, status: 'sending' });
      } catch (e: any) {
        if (e?.code === 11000) continue;
        throw e;
      }
      let status: string;
      let error: string | undefined;
      if (!p.notify) status = 'skipped_no_consent';
      else if (await ContactAlert.exists({ user: citizenId, phone, emergency: { $ne: emergencyId }, status: { $in: ['sent', 'simulated'] }, at: { $gte: new Date(Date.now() - RECENT_ALERT_MS) } })) status = 'skipped_recent';
      else {
        const text = p.shareLocation
          ? en ? `Vitalis: ${first} sent an SOS. Responders nearby are alerted. Follow live: ${link}?l=en` : `Vitalis: ${first} dërgoi një SOS. Ndihmësit pranë janë njoftuar. Ndiqeni live: ${link}`
          : en ? `Vitalis: ${first} sent an SOS. Responders nearby are alerted. Call them, or 112.` : `Vitalis: ${first} dërgoi një SOS. Ndihmësit pranë janë njoftuar. Telefonojini, ose 112.`;
        try {
          status = await sendSms(phone, text);
        } catch (e: any) {
          status = e?.status === 503 ? 'not_configured' : 'failed';
          error = e?.message;
        }
      }
      await ContactAlert.updateOne({ emergency: emergencyId, phone }, { $set: { status, ...(error ? { error } : {}), at: new Date() } });
    }
  } catch (err: any) {
    logger.error(`circle alert failed: ${err?.message ?? err}`);
  }
}

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

const isLngLat = (p?: number[]): p is [number, number] => Array.isArray(p) && p.length === 2;
const etaSeconds = async (a?: number[], b?: number[]) => (isLngLat(a) && isLngLat(b) ? roadEtaSeconds(a, b) : undefined);

export const fetchActiveCertifications = async (userIds: string[]) => {
  if (!userIds.length) return new Map<string, { badgeLabel: string; courseSlug: string; expiresAt: Date }[]>();
  const certs = await Certification.find({
    user: { $in: userIds },
    expiresAt: { $gt: new Date() },
  }).lean();
  const grouped = new Map<string, { badgeLabel: string; courseSlug: string; expiresAt: Date }[]>();
  for (const c of certs) {
    const key = String(c.user);
    const list = grouped.get(key) ?? [];
    list.push({ badgeLabel: c.badgeLabel, courseSlug: c.courseSlug, expiresAt: c.expiresAt });
    grouped.set(key, list);
  }
  return grouped;
};

// What a responder sees before accepting: enough to decide and navigate, no caller identity.
export const toResponderView = (e: any) => ({
  _id: String(e._id),
  type: e.type,
  priority: e.priority,
  status: e.status,
  description: e.description,
  location: e.location,
  createdAt: e.createdAt,
  etaSeconds: e.etaSeconds,
  responder: e.responder ? String(e.responder?._id ?? e.responder) : undefined,
  aedRunner: e.aedRunner ? String(e.aedRunner?._id ?? e.aedRunner) : undefined,
  aedStatus: e.aedStatus,
  // Cardiac calls stay open for a second runner until someone is fetching a defibrillator.
  needsAedRunner: e.type === 'cardiac' && !!e.responder && !e.aedRunner && ACTIVE_STATUSES.includes(e.status),
  aed: e.aed && typeof e.aed === 'object' && e.aed.location
    ? { name: e.aed.name, placement: e.aed.placement, coordinates: e.aed.location.coordinates }
    : undefined,
});

export const emergencyService = {
  async create(citizenId: string, body: { type: string; priority?: number; description?: string; coordinates: [number, number]; metadata?: { fromWearable: boolean; deviceId: string } }) {
    // One live SOS per person: repeated taps return the open incident instead of spamming responders.
    const existing = await Emergency.findOne({
      citizen: citizenId,
      silent: { $ne: true },
      status: { $in: ACTIVE_STATUSES },
      createdAt: { $gt: new Date(Date.now() - 2 * 3600_000) },
    });
    if (existing) return { emergency: existing, duplicate: true };

    const trackToken = crypto.randomBytes(16).toString('hex');
    const e = await Emergency.create({
      citizen: citizenId,
      trackTokenHash: sha256(trackToken),
      type: body.type,
      priority: body.priority ?? 3,
      description: body.description,
      location: { type: 'Point', coordinates: body.coordinates },
      metadata: body.metadata,
      timeline: [{ status: 'pending', by: citizenId }],
    });
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: 'created', actor: citizenId,
    });
    void alertCircle(String(e._id), citizenId, trackToken); // never delays the SOS
    return { emergency: e, duplicate: false };
  },

  /** On duty, not paused, and not already on an open call. */
  async findNearbyResponders(coords: [number, number], exclude: string | string[]) {
    const busy = await busyResponderIds();
    const ids = [...(Array.isArray(exclude) ? exclude : [exclude]), ...busy];
    for (const radius of RINGS_M) {
      const found = await User.find({
        _id: { $nin: ids },
        role: { $in: RESPONDER_ROLES },
        available: true,
        $or: [{ pausedUntil: null }, { pausedUntil: { $lte: new Date() } }],
        ...nearQuery(coords[0], coords[1], radius),
      }).select('_id location').limit(15).lean();
      if (found.length) return found;
    }
    return [];
  },

  /**
   * First accept claims the patient. On cardiac calls a second accept becomes the
   * AED runner, sent to the nearest defibrillator first. Both claims are atomic.
   */
  async assign(emergencyId: string, responderId: string) {
    const responder = await User.findById(responderId).select('location').lean();
    if (!responder) throw httpError(404, 'Responder missing');
    const current = await Emergency.findById(emergencyId).select('location citizen type').lean();
    if (!current) throw httpError(404, 'Not found');
    if (String(current.citizen) === responderId) throw httpError(400, 'Cannot respond to your own SOS');
    const incident = (current.location as any)?.coordinates as [number, number];

    const from = (responder.location as any)?.coordinates as [number, number] | undefined;
    const eta = await etaSeconds(from, incident); // before the atomic claim, so the claim stays one write
    const primary = await Emergency.findOneAndUpdate(
      // A responder taken off this call for not moving cannot take it back.
      { _id: emergencyId, status: 'pending', releasedResponders: { $ne: responderId } },
      {
        $set: {
          responder: responderId,
          status: 'assigned',
          etaSeconds: eta,
          responderStartM: from ? Math.round(haversineKm(from, incident) * 1000) : undefined,
        },
        $push: { timeline: { status: 'assigned', by: responderId, at: new Date() } },
      },
      { new: true },
    );
    if (primary) {
      await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: 'assigned', actor: responderId });
      const aed = primary.type === 'cardiac' ? await nearestAed(incident) : null;
      return { emergency: primary, role: 'primary' as const, aedAvailable: !!aed };
    }

    if (current.type === 'cardiac') {
      const aed = await nearestAed(incident);
      if (aed) {
        const runner = await Emergency.findOneAndUpdate(
          {
            _id: emergencyId,
            status: { $in: ['assigned', 'en_route', 'on_scene', 'assistance'] },
            responder: { $ne: responderId },
            aedRunner: null,
          },
          {
            $set: { aedRunner: responderId, aed: aed._id, aedStatus: 'to_aed' },
            $push: { timeline: { status: 'aed_runner_assigned', by: responderId, at: new Date() } },
          },
          { new: true },
        );
        if (runner) {
          await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: 'aed_runner_assigned', actor: responderId });
          // The runner gets the cabinet's code; that it went to them, and when, is on record.
          const cabinetCode = unseal(aed.cabinetCode) ?? undefined;
          if (cabinetCode) {
            await recordAedEvent(aed._id, 'code_given', { by: responderId, emergency: emergencyId });
            await blockchainService.append({ entity: 'aed', entityId: String(aed._id), action: 'code_given', actor: responderId, emergency: emergencyId });
          }
          return { emergency: runner, role: 'aed' as const, aedAvailable: true, aed, cabinetCode };
        }
      }
    }
    throw httpError(409, 'Already assigned');
  },

  async setAedStatus(emergencyId: string, aedStatus: 'has_aed' | 'delivered', actorId: string) {
    const e = await Emergency.findOneAndUpdate(
      { _id: emergencyId, aedRunner: actorId, status: { $in: ACTIVE_STATUSES } },
      { $set: { aedStatus }, $push: { timeline: { status: `aed_${aedStatus}`, by: actorId, at: new Date() } } },
      { new: true },
    );
    if (!e) throw httpError(403, 'You are not the AED runner on an active call');
    await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: `aed_${aedStatus}`, actor: actorId });
    if (e.aed) {
      // Out of its cabinet until an operator puts it back in service: nobody else is sent to an empty cabinet.
      if (aedStatus === 'has_aed') await Aed.updateOne({ _id: e.aed }, { $set: { status: 'in_use' } });
      await recordAedEvent(e.aed, aedStatus === 'has_aed' ? 'picked_up' : 'delivered', { by: actorId, emergency: emergencyId });
    }
    return e;
  },

  /**
   * Structured summary for whoever takes over care (ambulance crew, ER):
   * who did what when, plus the patient's critical medical facts.
   */
  async handover(emergencyId: string) {
    const e: any = await Emergency.findById(emergencyId)
      .populate('responder aedRunner', 'name role phone')
      .populate('timeline.by', 'name role')
      .populate('aed')
      .lean();
    if (!e) throw httpError(404, 'Not found');
    const [patient, allergies, medications, conditions] = await Promise.all([
      User.findById(e.citizen).select('name age dateOfBirth gender bloodType illnesses emergencyContact').lean(),
      Allergy.find({ user: e.citizen }).lean(),
      Medication.find({ user: e.citizen, isActive: true }).lean(),
      Condition.find({ user: e.citizen }).lean(),
    ]);
    const at = (status: string) => e.timeline.find((t: any) => t.status === status)?.at as Date | undefined;
    const secondsBetween = (a?: Date, b?: Date) => (a && b ? Math.round((+new Date(b) - +new Date(a)) / 1000) : null);
    const created = e.createdAt as Date;
    return {
      id: String(e._id),
      type: e.type,
      priority: e.priority,
      status: e.status,
      location: e.location,
      createdAt: created,
      metrics: {
        secondsToAssign: secondsBetween(created, at('assigned')),
        secondsToScene: secondsBetween(created, at('on_scene')),
        secondsToAed: secondsBetween(created, at('aed_delivered')),
      },
      patient: patient && {
        name: patient.name,
        age: ageOf(patient),
        gender: patient.gender,
        bloodType: patient.bloodType,
        allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity })),
        medications: medications.map(m => [m.name, m.dosage].filter(Boolean).join(' ')),
        conditions: [...new Set([...conditions.map(c => c.name), ...(patient.illnesses ?? [])])],
        emergencyContact: patient.emergencyContact,
      },
      responder: e.responder && { name: e.responder.name, role: e.responder.role },
      aedRunner: e.aedRunner && { name: e.aedRunner.name, role: e.aedRunner.role },
      aed: e.aed && { name: e.aed.name, placement: e.aed.placement, status: e.aedStatus },
      timeline: e.timeline.map((t: any) => ({ status: t.status, at: t.at, by: t.by?.name ?? null, ...(t.note ? { note: t.note } : {}) })),
    };
  },

  /**
   * One status change on the shared incident. Callers may only cancel; the assigned responder moves
   * the call forward (accepted → on my way → arrived → assistance → handed over → completed);
   * operators may close or cancel any open call and move a staffed one forward. Never backwards.
   * Compare-and-set on the current status, so two taps at once cannot both apply.
   */
  async updateStatus(emergencyId: string, status: string, actor: { id: string; role: string }) {
    const e = await Emergency.findById(emergencyId).select('status citizen responder').lean();
    if (!e) throw httpError(404, 'Not found');
    if (!ACTIVE_STATUSES.includes(e.status as any)) throw httpError(409, `Emergency already ${e.status}`);

    const isOperator = OPERATOR_ROLES.includes(actor.role);
    const isCaller = String(e.citizen) === actor.id;
    const isResponder = e.responder != null && String(e.responder) === actor.id;
    const rank = (s: string) => STATUS_ORDER.indexOf(s as any);
    const forward = rank(status) > rank(e.status as string) && rank(status) > rank('assigned');

    if (isOperator) {
      if (!['resolved', 'cancelled'].includes(status) && !(forward && e.responder)) throw httpError(409, `Cannot move a call from ${e.status} to ${status}`);
    } else if (isCaller) {
      if (status !== 'cancelled') throw httpError(403, 'Callers can only cancel');
    } else if (isResponder) {
      if (rank(status) <= rank('assigned')) throw httpError(403, 'Not allowed');
      if (!forward) throw httpError(409, `Cannot move a call from ${e.status} to ${status}`);
    } else {
      throw httpError(403, 'Not your emergency');
    }

    const updated = await Emergency.findOneAndUpdate(
      { _id: emergencyId, status: e.status },
      { $set: { status }, $push: { timeline: { status, by: actor.id, at: new Date() } } },
      { new: true },
    );
    if (!updated) throw httpError(409, 'The call changed meanwhile. Reload it and try again.');
    await blockchainService.append({
      entity: 'emergency', entityId: updated._id.toString(), action: status, actor: actor.id,
    });
    return updated;
  },

  /** A responder's quick report: once they have arrived, editable until a day after the call ends. */
  async saveReport(emergencyId: string, authorId: string, body: Record<string, unknown>) {
    const e = await Emergency.findById(emergencyId).select('status responder aedRunner timeline').lean();
    if (!e) throw httpError(404, 'Not found');
    if (![e.responder, e.aedRunner].some(r => r && String(r) === authorId)) throw httpError(403, 'Only responders on this call can report on it');
    const at = (s: string) => ((e.timeline ?? []) as any[]).find(t => t.status === s)?.at as Date | undefined;
    if (!['on_scene', 'assistance', 'handed_over', 'resolved'].includes(e.status as string)) throw httpError(409, 'Report once you have arrived');
    const closed = at('resolved');
    if (closed && Date.now() - new Date(closed).getTime() > REPORT_WINDOW_MS) throw httpError(409, 'Reports close a day after the call ends');
    const report = await IncidentReport.findOneAndUpdate(
      { emergency: emergencyId, author: authorId },
      { $set: { ...body, arrivedAt: at('on_scene') ?? null } },
      { upsert: true, new: true, runValidators: true },
    ).lean();
    await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: 'report_saved', actor: authorId });
    return report;
  },

  /** Operators see every report on a call; a responder sees their own. */
  async reports(emergencyId: string, user: { id: string; role: string }) {
    const filter = OPERATOR_ROLES.includes(user.role) ? { emergency: emergencyId } : { emergency: emergencyId, author: user.id };
    return IncidentReport.find(filter).populate('author', 'name role').sort('createdAt').lean();
  },

  /** Operator acknowledges an escalated (unanswered) call. Once only. */
  async acknowledgeEscalation(emergencyId: string, actorId: string) {
    const e = await Emergency.findOneAndUpdate(
      { _id: emergencyId, escalatedAt: { $ne: null }, escalationAckAt: null },
      { $set: { escalationAckAt: new Date(), escalationAckBy: actorId }, $push: { timeline: { status: 'escalation_acknowledged', by: actorId, at: new Date() } } },
      { new: true },
    );
    if (!e) throw httpError(409, 'Not escalated, or already acknowledged');
    await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: 'escalation_acknowledged', actor: actorId });
    return e;
  },

  /** Something an operator did by hand (a phone call, a note). Recorded, never simulated. */
  async recordAction(emergencyId: string, actorId: string, kind: string, note?: string) {
    const e = await Emergency.findOneAndUpdate(
      { _id: emergencyId },
      { $push: { timeline: { status: `action_${kind}`, by: actorId, at: new Date(), ...(note ? { note } : {}) } } },
      { new: true },
    );
    if (!e) throw httpError(404, 'Not found');
    await blockchainService.append({ entity: 'emergency', entityId: emergencyId, action: `action_${kind}`, actor: actorId });
    return e;
  },

  async list() {
    const emergencies = await Emergency.find()
      .populate('citizen responder', 'name role')
      .sort('-createdAt')
      .limit(100)
      .lean();
    const callerIds = emergencies
      .map((e: any) => e.citizen?._id ?? e.citizen)
      .filter(Boolean)
      .map(String);
    const certs = await fetchActiveCertifications(callerIds);
    return emergencies.map((e: any) => ({
      ...e,
      callerCertifications: certs.get(String(e.citizen?._id ?? e.citizen)) ?? [],
    }));
  },

  // Responder inbox: open calls near them (incl. cardiac calls still needing an AED runner)
  // plus whatever they're already handling.
  async listForResponder(responderId: string) {
    const me = await User.findById(responderId).select('location').lean();
    const coords = (me?.location as any)?.coordinates as [number, number] | undefined;
    const hasFix = Array.isArray(coords) && (coords[0] !== 0 || coords[1] !== 0);
    const [nearby, mine] = await Promise.all([
      hasFix
        ? Emergency.find({
            status: { $in: ACTIVE_STATUSES },
            dispatchOnly: { $ne: true },
            citizen: { $ne: responderId },
            ...nearQuery(coords![0], coords![1], RINGS_M[RINGS_M.length - 1]),
          }).limit(50).lean()
        : Promise.resolve([]),
      Emergency.find({
        $or: [{ responder: responderId }, { aedRunner: responderId }],
        status: { $in: ACTIVE_STATUSES },
      }).sort('-createdAt').limit(5).populate({ path: 'aed', select: 'name placement location +cabinetCode' }).lean(),
    ]);
    const mineIds = new Set(mine.map(e => String(e._id)));
    const open: ReturnType<typeof toResponderView>[] = [];
    for (const e of nearby) {
      const v = toResponderView(e);
      if (mineIds.has(v._id)) continue;
      if ((e as any).releasedResponders?.some((id: any) => String(id) === responderId)) continue;
      if (v.status === 'pending') open.push(v);
      // Only offer the AED role when there is actually a device to fetch.
      else if (v.needsAedRunner && v.responder !== responderId && (await nearestAed((e.location as any).coordinates))) open.push(v);
      if (open.length >= 30) break;
    }
    // The runner still on the way to the cabinet gets its code; nobody else does.
    const withCode = (e: any) => {
      const v = toResponderView(e);
      const code = String(e.aedRunner) === responderId && e.aedStatus === 'to_aed' ? unseal(e.aed?.cabinetCode) : null;
      return code && v.aed ? { ...v, aed: { ...v.aed, cabinetCode: code } } : v;
    };
    return [...mine.map(withCode), ...open];
  },

  // Caller's own live incident, so the app can restore state after a restart.
  async activeForCitizen(citizenId: string) {
    return Emergency.findOne({ citizen: citizenId, status: { $in: ACTIVE_STATUSES }, silent: { $ne: true } })
      .sort('-createdAt')
      .populate('responder aedRunner', 'name role')
      .populate('aed', 'name placement')
      .lean();
  },
};
