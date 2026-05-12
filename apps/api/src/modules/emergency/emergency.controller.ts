import { Response, NextFunction } from 'express';
import { AuthReq } from '../../middleware/auth';
import { emergencyService } from './emergency.service';
import { getIO } from '../../realtime/socket';

export const emergencyController = {
  create: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const e = await emergencyService.create(req.user!.id, req.body);
      const nearby = await emergencyService.findNearbyResponders((e.location as any).coordinates);
      getIO().to('responders').emit('emergency:new', { emergency: e, nearby: nearby.map(r => r._id) });
      getIO().to('dispatchers').emit('dashboard:emergency', e);
      res.status(201).json({ emergency: e, nearbyCount: nearby.length });
    } catch (err) { next(err); }
  },
  accept: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const e = await emergencyService.assign(req.params.id, req.user!.id);
      getIO().to(`emergency:${e._id}`).emit('emergency:assigned', e);
      getIO().to('dispatchers').emit('dashboard:emergency', e);
      res.json(e);
    } catch (err) { next(err); }
  },
  updateStatus: async (req: AuthReq, res: Response, next: NextFunction) => {
    try {
      const e = await emergencyService.updateStatus(req.params.id, req.body.status, req.user!.id);
      getIO().to(`emergency:${e._id}`).emit('emergency:status', e);
      getIO().to('dispatchers').emit('dashboard:emergency', e);
      res.json(e);
    } catch (err) { next(err); }
  },
  list: async (_req: AuthReq, res: Response, next: NextFunction) => {
    try { res.json(await emergencyService.list()); } catch (err) { next(err); }
  },
};
