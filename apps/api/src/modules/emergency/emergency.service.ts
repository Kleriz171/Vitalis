import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { Certification } from '../../models/Training';
import { Aed } from '../../models/Aed';
import { Allergy, Medication, Condition } from '../../models/HealthRecord';
import { nearQuery, haversineKm } from '../../utils/geo';
import { blockchainService } from '../blockchain/blockchain.service';
import { RESPONDER_ROLES, OPERATOR_ROLES } from '../../realtime/socket';

export const ACTIVE_STATUSES = ['pending', 'assigned', 'en_route', 'on_scene'] as const;

// Search rings for responders: try close first, widen only if nobody is there.
const RINGS_M = [5_000, 20_000];

// Farthest an AED runner should detour for a device (metres from the patient).
const AED_RADIUS_M = 1_500;

const nearestAed = (coords: [number, number]) =>
  Aed.findOne(nearQuery(coords[0], coords[1], AED_RADIUS_M)).lean();

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

// ponytail: straight-line distance × 1.4 road factor at 35 km/h urban average.
// Swap for a routing API (Mapbox Directions) when ETA accuracy matters.
const etaSeconds = (a?: number[], b?: number[]) =>
  Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
    ? Math.round(((haversineKm(a as [number, number], b as [number, number]) * 1.4) / 35) * 3600)
    : undefined;

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
  async create(citizenId: string, body: { type: string; priority?: number; description?: string; coordinates: [number, number] }) {
    // One live SOS per person: repeated taps return the open incident instead of spamming responders.
    const existing = await Emergency.findOne({
      citizen: citizenId,
      status: { $in: ACTIVE_STATUSES },
      createdAt: { $gt: new Date(Date.now() - 2 * 3600_000) },
    });
    if (existing) return { emergency: existing, duplicate: true };

    const e = await Emergency.create({
      citizen: citizenId,
      type: body.type,
      priority: body.priority ?? 3,
      description: body.description,
      location: { type: 'Point', coordinates: body.coordinates },
      timeline: [{ status: 'pending', by: citizenId }],
    });
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: 'created', actor: citizenId,
    });
    return { emergency: e, duplicate: false };
  },

  async findNearbyResponders(coords: [number, number], excludeId: string) {
    for (const radius of RINGS_M) {
      const found = await User.find({
        _id: { $ne: excludeId },
        role: { $in: RESPONDER_ROLES },
        available: true,
        ...nearQuery(coords[0], coords[1], radius),
      }).select('_id').limit(15).lean();
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

    const primary = await Emergency.findOneAndUpdate(
      { _id: emergencyId, status: 'pending' },
      {
        $set: {
          responder: responderId,
          status: 'assigned',
          etaSeconds: etaSeconds((responder.location as any)?.coordinates, incident),
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
            status: { $in: ['assigned', 'en_route', 'on_scene'] },
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
          return { emergency: runner, role: 'aed' as const, aedAvailable: true, aed };
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
      User.findById(e.citizen).select('name age gender bloodType illnesses emergencyContact').lean(),
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
        age: patient.age,
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
      timeline: e.timeline.map((t: any) => ({ status: t.status, at: t.at, by: t.by?.name ?? null })),
    };
  },

  async updateStatus(emergencyId: string, status: string, actor: { id: string; role: string }) {
    const e = await Emergency.findById(emergencyId);
    if (!e) throw httpError(404, 'Not found');
    if (!ACTIVE_STATUSES.includes(e.status as any)) throw httpError(409, `Emergency already ${e.status}`);

    const isOperator = OPERATOR_ROLES.includes(actor.role);
    const isCaller = String(e.citizen) === actor.id;
    const isResponder = e.responder != null && String(e.responder) === actor.id;

    if (isOperator) {
      // operators may set any status
    } else if (isCaller) {
      if (status !== 'cancelled') throw httpError(403, 'Callers can only cancel');
    } else if (isResponder) {
      if (!['en_route', 'on_scene', 'resolved'].includes(status)) throw httpError(403, 'Not allowed');
    } else {
      throw httpError(403, 'Not your emergency');
    }

    e.status = status as any;
    e.timeline.push({ status, by: actor.id as any } as any);
    await e.save();
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: status, actor: actor.id,
    });
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
            citizen: { $ne: responderId },
            ...nearQuery(coords![0], coords![1], RINGS_M[RINGS_M.length - 1]),
          }).limit(50).lean()
        : Promise.resolve([]),
      Emergency.find({
        $or: [{ responder: responderId }, { aedRunner: responderId }],
        status: { $in: ACTIVE_STATUSES },
      }).sort('-createdAt').limit(5).populate('aed', 'name placement location').lean(),
    ]);
    const mineIds = new Set(mine.map(e => String(e._id)));
    const open: ReturnType<typeof toResponderView>[] = [];
    for (const e of nearby) {
      const v = toResponderView(e);
      if (mineIds.has(v._id)) continue;
      if (v.status === 'pending') open.push(v);
      // Only offer the AED role when there is actually a device to fetch.
      else if (v.needsAedRunner && v.responder !== responderId && (await nearestAed((e.location as any).coordinates))) open.push(v);
      if (open.length >= 30) break;
    }
    return [...mine.map(toResponderView), ...open];
  },

  // Caller's own live incident, so the app can restore state after a restart.
  async activeForCitizen(citizenId: string) {
    return Emergency.findOne({ citizen: citizenId, status: { $in: ACTIVE_STATUSES } })
      .sort('-createdAt')
      .populate('responder aedRunner', 'name role')
      .populate('aed', 'name placement')
      .lean();
  },
};
