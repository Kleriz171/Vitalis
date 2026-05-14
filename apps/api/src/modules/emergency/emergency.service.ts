import { Emergency } from '../../models/Emergency';
import { User } from '../../models/User';
import { Certification } from '../../models/Training';
import { nearQuery, haversineKm } from '../../utils/geo';
import { blockchainService } from '../blockchain/blockchain.service';

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

export const emergencyService = {
  async create(citizenId: string, body: any) {
    const e = await Emergency.create({
      citizen: citizenId,
      type: body.type,
      priority: body.priority ?? 3,
      description: body.description,
      location: { type: 'Point', coordinates: body.coordinates },
      timeline: [{ status: 'pending', by: citizenId }],
      metadata: body.metadata ?? {},
    });
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: 'created', actor: citizenId,
    });
    return e;
  },
  async findNearbyResponders(coords: [number, number], radius = 5000) {
    return User.find({
      role: { $in: ['doctor','nurse','student_responder','blood_donor'] },
      available: true,
      ...nearQuery(coords[0], coords[1], radius),
    }).limit(15).lean();
  },
  async assign(emergencyId: string, responderId: string) {
    const e = await Emergency.findById(emergencyId);
    if (!e) throw Object.assign(new Error('Not found'), { status: 404 });
    if (e.status !== 'pending') throw Object.assign(new Error('Already assigned'), { status: 409 });
    const responder = await User.findById(responderId);
    if (!responder) throw Object.assign(new Error('Responder missing'), { status: 404 });
    const km = haversineKm(
      (responder.location as any).coordinates,
      (e.location as any).coordinates
    );
    e.responder = responderId as any;
    e.status = 'assigned';
    e.etaSeconds = Math.round((km / 30) * 3600);
    e.timeline.push({ status: 'assigned', by: responderId as any } as any);
    await e.save();
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: 'assigned', actor: responderId,
    });
    return e;
  },
  async updateStatus(emergencyId: string, status: string, actor: string) {
    const e = await Emergency.findById(emergencyId);
    if (!e) throw Object.assign(new Error('Not found'), { status: 404 });
    e.status = status as any;
    e.timeline.push({ status, by: actor as any } as any);
    await e.save();
    await blockchainService.append({
      entity: 'emergency', entityId: e._id.toString(), action: status, actor,
    });
    return e;
  },
  async list(query: any = {}) {
    const emergencies = await Emergency.find(query)
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
};
