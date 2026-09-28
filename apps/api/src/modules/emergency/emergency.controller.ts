import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthReq } from '../../middleware/auth';
import { EMERGENCY_STATUS, EMERGENCY_TYPE } from '../../models/Emergency';
import { emergencyService, fetchActiveCertifications, toResponderView } from './emergency.service';
import { getIO, OPERATOR_ROLES, emergencyAccess } from '../../realtime/socket';
import { sendPush } from '../push/push.service';
import { User } from '../../models/User';
import { haversineKm } from '../../utils/geo';

const TYPE_TITLE: Record<string, string> = {
  cardiac: 'Cardiac arrest nearby',
  trauma: 'Injury nearby',
  medical: 'Medical emergency nearby',
};

const distanceLabel = (km: number) => (km < 1 ? `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m away` : `${km.toFixed(1)} km away`);

// Push never blocks the request; failures are logged inside sendPush.
const push = (p: Parameters<typeof sendPush>[0]) => { void sendPush(p).catch(() => {}); };

export const createEmergencySchema = z.object({
  type: z.enum(EMERGENCY_TYPE),
  priority: z.number().int().min(1).max(5).optional(),
  description: z.string().trim().max(500).optional(),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});

export const statusSchema = z.object({ status: z.enum(EMERGENCY_STATUS) });
export const aedStatusSchema = z.object({ status: z.enum(['has_aed', 'delivered']) });

// Everyone with a stake in the incident hears about changes: its room, the caller, operators.
const broadcast = (event: string, e: any) => {
  const io = getIO();
  io.to(`emergency:${e._id}`).to(`user:${e.citizen}`).emit(event, e);
  io.to('dispatchers').emit('dashboard:emergency', e);
};

export const emergencyController = {
  create: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const { emergency: e, duplicate } = await emergencyService.create(req.user!.id, req.body);
      const nearby = await emergencyService.findNearbyResponders((e.location as any).coordinates, req.user!.id);
      if (!duplicate) {
        const certs = await fetchActiveCertifications([req.user!.id]);
        const io = getIO();
        // Alert only responders in range, with a view that hides the caller's identity.
        const responderPayload = { emergency: toResponderView(e) };
        for (const r of nearby) io.to(`user:${r._id}`).emit('emergency:new', responderPayload);
        // Each responder gets their own distance in the lock-screen alert.
        const at = (e.location as any).coordinates as [number, number];
        for (const r of nearby) {
          const their = (r.location as any)?.coordinates as [number, number] | undefined;
          push({
            userIds: [String(r._id)],
            kind: 'sos',
            title: TYPE_TITLE[e.type] ?? 'Emergency nearby',
            body: `${their ? distanceLabel(haversineKm(their, at)) + '. ' : ''}Tap to respond.`,
            data: { type: 'sos', emergencyId: String(e._id) },
          });
        }
        io.to('dispatchers').emit('dashboard:emergency', {
          ...e.toObject(),
          callerCertifications: certs.get(req.user!.id) ?? [],
          nearbyCount: nearby.length,
        });
      }
      res.status(duplicate ? 200 : 201).json({ emergency: e, nearbyCount: nearby.length, duplicate });
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
        title: role === 'aed' ? 'A defibrillator is on its way' : 'Help is on the way',
        body: role === 'aed'
          ? `${me?.name ?? 'A responder'} is bringing the nearest AED.`
          : `${me?.name ?? 'A responder'} (${me?.role === 'doctor' ? 'doctor' : me?.role === 'nurse' ? 'nurse' : 'certified first-aider'}) accepted your SOS.`,
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
      const toCaller: Record<string, [string, string]> = {
        en_route: ['Responder on the way', 'Stay where you are if it is safe.'],
        on_scene: ['Responder has arrived', 'Help is with you now.'],
      };
      if (toCaller[status]) {
        push({ userIds: [String(e.citizen)], kind: 'update', title: toCaller[status][0], body: toCaller[status][1], data: { type: 'update', emergencyId: String(e._id) } });
      }
      if (status === 'cancelled' || (status === 'resolved' && OPERATOR_ROLES.includes(req.user!.role))) {
        const crew = [e.responder, e.aedRunner].filter(Boolean).map(String).filter(id => id !== req.user!.id);
        push({ userIds: crew, kind: 'update', title: status === 'cancelled' ? 'Call cancelled' : 'Call closed by dispatch', body: 'You can stand down.', data: { type: 'update', emergencyId: String(e._id) } });
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
