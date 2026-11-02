import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export const signAccess = (payload: object) =>
  jwt.sign(payload, env.jwtAccess, { expiresIn: env.accessTtl } as SignOptions);
export const signRefresh = (payload: object) =>
  jwt.sign(payload, env.jwtRefresh, { expiresIn: env.refreshTtl } as SignOptions);
// Pinned algorithm: a token cannot pick its own (e.g. `none`).
export const verifyAccess = (t: string) => jwt.verify(t, env.jwtAccess, { algorithms: ['HS256'] }) as any;
export const verifyRefresh = (t: string) => jwt.verify(t, env.jwtRefresh, { algorithms: ['HS256'] }) as any;
