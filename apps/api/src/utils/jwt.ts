import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export const signAccess = (payload: object) =>
  jwt.sign(payload, env.jwtAccess, { expiresIn: env.accessTtl } as SignOptions);
export const signRefresh = (payload: object) =>
  jwt.sign(payload, env.jwtRefresh, { expiresIn: env.refreshTtl } as SignOptions);
export const verifyAccess = (t: string) => jwt.verify(t, env.jwtAccess) as any;
export const verifyRefresh = (t: string) => jwt.verify(t, env.jwtRefresh) as any;
