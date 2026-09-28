import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthReq } from '../../middleware/auth';
import { EMERGENCY_STATUS, EMERGENCY_TYPE } from '../../models/Emergency';
import { emergencyService, fetchActiveCertifications, toResponderView } from './emergency.service';
import { getIO, OPERATOR_ROLES, emergencyAccess } from '../../realtime/socket';
import { PushText, sendPush } from '../push/push.service';
import { User } from '../../models/User';
import { haversineKm } from '../../utils/geo';

// Push text in both app languages (Albanian is a draft pending native review, like the app's).
const TYPE_TITLE: Record<string, PushText> = {
  cardiac: { en: 'Cardiac arrest nearby', sq: 'Arrest kardiak afër jush' },
  trauma: { en: 'Injury nearby', sq: 'Lëndim afër jush' },
  medical: { en: 'Medical emergency nearby', sq: 'Urgjencë mjekësore afër jush' },
};
const ROLE_NAME: Record<string, PushText> = {
  doctor: { en: 'doctor', sq: 'mjek' },
  nurse: { en: 'nurse', sq: 'infermier' },
};
const FIRST_AIDER: PushText = { en: 'certified first-aider', sq: 'ndihmës i certifikuar' };

const distance = (km: number) => (km < 1 ? `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m` : `${km.toFixed(1)} km`);

// Push never blocks the request; failures are logged inside sendPush.
export const push = (p: Parameters<typeof sendPush>[0]) => { void sendPush(p).catch(() => {}); };

export const createEmergencySchema = z.object({
  type: z.enum(EMERGENCY_TYPE),
  priority: z.number().int().min(1).max(5).optional(),
  description: z.string().trim().max(500).optional(),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

export const statusSchema = z.object({ status: z.enum(EMERGENCY_STATUS) });
export const aedStatusSchema = z.object({ status: z.enum(['has_aed', 'delivered']) });

// Everyone with a stake in the incident hears about changes: its room, the caller, operators.
export const broadcast = (event: string, e: any) => {
  const io = getIO();
  io.to(`emergency:${e._id}`).to(`user:${e.citizen}`).emit(event, e);
  io.to('dispatchers').emit('dashboard:emergency', e);
};

/**
 * Alert on-duty responders in range (socket + lock-screen push, each with their own distance),
 * with a view that hides the caller's identity. Used for a new SOS and for re-dispatch.
 */
export async function alertResponders(e: any, exclude: string[]) {
  const at = (e.location as any).coordinates as [number, number];
  const nearby = await emergencyService.findNearbyResponders(at, exclude);
  const io = getIO();
  const payload = { emergency: toResponderView(e) };
  for (const r of nearby) {
    io.to(`user:${r._id}`).emit('emergency:new', payload);
    const their = (r.location as any)?.coordinates as [number, number] | undefined;
    push({
      userIds: [String(r._id)],
      kind: 'sos',
      title: TYPE_TITLE[e.type as string] ?? { en: 'Emergency nearby', sq: 'Urgjencë afër jush' },
      body: their
        ? { en: `${distance(haversineKm(their, at))} away. Tap to respond.`, sq: `${distance(haversineKm(their, at))} larg. Prekni për t’u përgjigjur.` }
        : { en: 'Tap to respond.', sq: 'Prekni për t’u përgjigjur.' },
      data: { type: 'sos', emergencyId: String(e._id) },
    });
  }
  return nearby;
}

export const emergencyController = {
  create: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const { emergency: e, duplicate } = await emergencyService.create(req.user!.id, req.body);
      let nearbyCount = 0;
      if (!duplicate) {
        nearbyCount = (await alertResponders(e, [req.user!.id])).length;
        const certs = await fetchActiveCertifications([req.user!.id]);
        getIO().to('dispatchers').emit('dashboard:emergency', {
          ...e.toObject(),
          callerCertifications: certs.get(req.user!.id) ?? [],
          nearbyCount,
        });
      } else {
        nearbyCount = (await emergencyService.findNearbyResponders((e.location as any).coordinates, req.user!.id)).length;
      }
      res.status(duplicate ? 200 : 201).json({ emergency: e, nearbyCount, duplicate });
    } catch (err) { next(err); }
  },
  accept: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const { emergency: e, role, aedAvailable, aed } = await emergencyService.assign(req.params.id, req.user!.id);
      broadcast('emergency:assigned', e);
      const me = await User.findById(req.user!.id).select('name role').lean();
      push({
        userIds: [String(e.citizen)],
        kind: 'update',
        title: role === 'aed'
          ? { en: 'A defibrillator is on its way', sq: 'Një defibrilator po vjen' }
          : { en: 'Help is on the way', sq: 'Ndihma është rrugës' },
        body: role === 'aed'
          ? { en: `${me?.name ?? 'A responder'} is bringing the nearest AED.`, sq: `${me?.name ?? 'Një ndihmës'} po sjell defibrilatorin më të afërt.` }
          : {
            en: `${me?.name ?? 'A responder'} (${(ROLE_NAME[me?.role ?? ''] ?? FIRST_AIDER).en}) accepted your SOS.`,
            sq: `${me?.name ?? 'Një ndihmës'} (${(ROLE_NAME[me?.role ?? ''] ?? FIRST_AIDER).sq}) e pranoi SOS-in tuaj.`,
          },
        data: { type: 'update', emergencyId: String(e._id) },
      });
      // Other responders drop the call from their inbox, unless it still needs an AED runner.
      getIO().to('responders').emit('emergency:taken', {
        _id: String(e._id),
        needsAedRunner: role === 'primary' && aedAvailable,
      });
      res.json({
        ...e.toObject(),
        myRole: role,
        aed: aed ? { id: String(aed._id), name: aed.name, placement: aed.placement, coordinates: (aed.location as any).coordinates } : undefined,
      });
    } catch (err) { next(err); }
  },
  aedStatus: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const e = await emergencyService.setAedStatus(req.params.id, req.body.status, req.user!.id);
      broadcast('emergency:status', e);
      res.json(e);
    } catch (err) { next(err); }
  },
  handover: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      if (!(await emergencyAccess(req.user!, req.params.id))) return res.status(403).json({ error: 'Not your emergency' });
      res.json(await emergencyService.handover(req.params.id));
    } catch (err) { next(err); }
  },
  updateStatus: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const e = await emergencyService.updateStatus(req.params.id, req.body.status, req.user!);
      broadcast('emergency:status', e);
      const status = req.body.status as string;
      const toCaller: Record<string, [PushText, PushText]> = {
        en_route: [
          { en: 'Responder on the way', sq: 'Ndihmësi është rrugës' },
          { en: 'Stay where you are if it is safe.', sq: 'Qëndroni ku jeni nëse është e sigurt.' },
        ],
        on_scene: [
          { en: 'Responder has arrived', sq: 'Ndihmësi mbërriti' },
          { en: 'Help is with you now.', sq: 'Ndihma është me ju tani.' },
        ],
      };
      if (toCaller[status]) {
        push({ userIds: [String(e.citizen)], kind: 'update', title: toCaller[status][0], body: toCaller[status][1], data: { type: 'update', emergencyId: String(e._id) } });
      }
      if (status === 'cancelled' || (status === 'resolved' && OPERATOR_ROLES.includes(req.user!.role))) {
        const crew = [e.responder, e.aedRunner].filter(Boolean).map(String).filter(id => id !== req.user!.id);
        push({ userIds: crew, kind: 'update', title: status === 'cancelled' ? { en: 'Call cancelled', sq: 'Thirrja u anulua' } : { en: 'Call closed by dispatch', sq: 'Dispeçeria e mbylli thirrjen' }, body: { en: 'You can stand down.', sq: 'Mund të tërhiqeni.' }, data: { type: 'update', emergencyId: String(e._id) } });
      }
      res.json(e);
    } catch (err) { next(err); }
  },
  list: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      res.json(OPERATOR_ROLES.includes(req.user!.role)
        ? await emergencyService.list()
        : await emergencyService.listForResponder(req.user!.id));
    } catch (err) { next(err); }
  },
  mine: async (req: AuthReq, res: Response, next: NextFunction) => {
    try { res.json({ emergency: await emergencyService.activeForCitizen(req.user!.id) }); } catch (err) { next(err); }
  },
};
