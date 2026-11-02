import { Request, Response, NextFunction } from 'express';
import { verifyAccess } from '../utils/jwt';
import { User } from '../models/User';

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

/** The role is read from the database, not the token: a changed role counts from the next request. */
export const currentRole = async (id: string) =>
  (await User.findById(id).select('role').lean())?.role as string | undefined;

export const authRequired = async (req: AuthReq, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  let sub: string;
  try {
    sub = verifyAccess(header.slice(7)).sub;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (isRevoked(sub)) return res.status(401).json({ error: 'Invalid token' });
  try {
    const role = await currentRole(sub);
    if (!role) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: sub, role };
    next();
  } catch (e) { next(e); }
};
