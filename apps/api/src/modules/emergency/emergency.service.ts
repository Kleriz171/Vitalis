import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { Certification } from '../../models/Training';
import { nearQuery, haversineKm } from '../../utils/geo';
import { blockchainService } from '../blockchain/blockchain.service';
import { RESPONDER_ROLES, OPERATOR_ROLES } from '../../realtime/socket';

export const ACTIVE_STATUSES = ['pending', 'assigned', 'en_route', 'on_scene'] as const;

// Search rings for responders: try close first, widen only if nobody is there.
const RINGS_M = [5_000, 20_000];

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

  async assign(emergencyId: string, responderId: string) {
    const responder = await User.findById(responderId).select('location').lean();
    if (!responder) throw httpError(404, 'Responder missing');
    const current = await Emergency.findById(emergencyId).select('location citizen').lean();
    if (!current) throw httpError(404, 'Not found');
    if (String(current.citizen) === responderId) throw httpError(400, 'Cannot respond to your own SOS');

    // Atomic claim: only one responder can move it out of `pending`.
    const e = await Emergency.findOneAndUpdate(
      { _id: emergencyId, status: 'pending' },
      {
        $set: {
          responder: responderId,
          status: 'assigned',
          etaSeconds: etaSeconds((responder.location as any)?.coordinates, (current.location as any)?.coordinates),
        },
        $push: { timeline: { status: 'assigned', by: responderId, at: new Date() } },
      },
      { new: true },
    );
    if (!e) throw httpError(409, 'Already assigned');
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: 'assigned', actor: responderId,
    });
    return e;
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

  // Responder inbox: open calls near them plus whatever they're already handling.
  async listForResponder(responderId: string) {
    const me = await User.findById(responderId).select('location').lean();
    const coords = (me?.location as any)?.coordinates as [number, number] | undefined;
    const hasFix = Array.isArray(coords) && (coords[0] !== 0 || coords[1] !== 0);
    const [open, mine] = await Promise.all([
      hasFix
        ? Emergency.find({
            status: 'pending',
            citizen: { $ne: responderId },
            ...nearQuery(coords![0], coords![1], RINGS_M[RINGS_M.length - 1]),
          }).limit(30).lean()
        : Promise.resolve([]),
      Emergency.find({ responder: responderId, status: { $in: ACTIVE_STATUSES } }).sort('-createdAt').limit(5).lean(),
    ]);
    return [...mine, ...open].map(toResponderView);
  },

  // Caller's own live incident, so the app can restore state after a restart.
  async activeForCitizen(citizenId: string) {
    return Emergency.findOne({ citizen: citizenId, status: { $in: ACTIVE_STATUSES } })
      .sort('-createdAt')
      .populate('responder', 'name role')
      .lean();
  },
};
