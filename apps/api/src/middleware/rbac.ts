import { Response, NextFunction } from 'express';
import { AuthReq } from './auth';

export const allow = (...roles: string[]) =>
  (req: AuthReq, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    next();
  };
