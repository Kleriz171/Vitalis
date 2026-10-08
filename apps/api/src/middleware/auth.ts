import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';
import { normalizeRole } from '../models/User';

export interface AuthReq extends Request {
  user?: { id: string; role: string };
}

// Deleted accounts: their access tokens stay signed until they expire (ACCESS_TTL), so refuse them.
// ponytail: in-memory, one API process; move to Redis or a DB check when the API runs on several.
const revoked = new Map<string, number>();
export const revokeUser = (id: string) => revoked.set(id, Date.now() + 24 * 3600_000);
export const isRevoked = (id: string) => {
  const until = revoked.get(id);
  if (until && until < Date.now()) revoked.delete(id);
  return !!until && until >= Date.now();
};

export const authRequired = (req: AuthReq, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = verifyAccess(header.slice(7));
    if (isRevoked(decoded.sub)) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: decoded.sub, role: normalizeRole(decoded.role) };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
