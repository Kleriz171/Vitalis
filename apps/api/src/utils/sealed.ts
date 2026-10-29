import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * Secrets the server must read back (cabinet codes), encrypted at rest with AES-256-GCM so a
 * copy of the database alone doesn't open every cabinet in town.
 * ponytail: the key comes from JWT_ACCESS; rotating that secret makes stored codes unreadable,
 * so re-enter them afterwards (or give the key its own variable if rotations become routine).
 */
const key = () => createHash('sha256').update(`vitalis-sealed:${env.jwtAccess}`).digest();

export const seal = (plain: string) => {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
};

/** Null when it can't be read (tampered with, or sealed under another key). */
export const unseal = (sealed?: string | null) => {
  if (!sealed) return null;
  try {
    const [iv, tag, data] = sealed.split('.').map(p => Buffer.from(p, 'base64url'));
    const d = createDecipheriv('aes-256-gcm', key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return null;
  }
};
