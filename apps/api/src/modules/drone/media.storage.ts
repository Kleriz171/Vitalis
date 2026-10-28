import { createHmac, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { Writable } from 'node:stream';
import { Storage } from '@google-cloud/storage';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MEDIA_RETENTION_DAYS } from '../../models/DroneMedia';

/**
 * Where drone photos and videos live. Firebase Storage in production; plain files on disk
 * when MEDIA_BUCKET is unset, so development and CI work without a cloud account.
 * Files are private either way: the console gets a link that works for LINK_TTL_MS.
 */
export interface MediaStore {
  where: string;
  writer(key: string, contentType: string): Promise<Writable>;
  link(key: string, id: string): Promise<string>;
  exists(key: string): Promise<boolean>;
}

const PREFIX = 'drone-media/';
export const LINK_TTL_MS = 10 * 60_000;

const firebaseStore = (bucketName: string): MediaStore => {
  const bucket = new Storage().bucket(bucketName);

  // The 30 days apply to the files too: a lifecycle rule on the bucket, limited to our prefix.
  bucket.getMetadata()
    .then(async ([meta]) => {
      const rules = meta.lifecycle?.rule ?? [];
      const has = rules.some(r => r.action?.type === 'Delete' && r.condition?.age === MEDIA_RETENTION_DAYS && r.condition?.matchesPrefix?.includes(PREFIX));
      if (!has) await bucket.addLifecycleRule({ action: { type: 'Delete' }, condition: { age: MEDIA_RETENTION_DAYS, matchesPrefix: [PREFIX] } });
      logger.info(`drone media in gs://${bucketName}, deleted after ${MEDIA_RETENTION_DAYS} days`);
    })
    .catch(e => logger.error(`drone media bucket gs://${bucketName}: ${e.message}. Uploads will fail or never expire until this is fixed.`));

  return {
    where: `gs://${bucketName}`,
    writer: async (key, contentType) =>
      bucket.file(PREFIX + key).createWriteStream({ contentType, resumable: false, metadata: { cacheControl: 'private, no-store' } }),
    link: async key => {
      const [url] = await bucket.file(PREFIX + key).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + LINK_TTL_MS });
      return url;
    },
    exists: async key => (await bucket.file(PREFIX + key).exists())[0],
  };
};

const sign = (id: string, exp: number) => createHmac('sha256', env.jwtAccess).update(`drone-media:${id}:${exp}`).digest('base64url');

const diskStore = (dir: string): MediaStore => {
  const root = path.resolve(dir);
  // Same 30 days on disk: sweep hourly.
  const sweep = async () => {
    const cutoff = Date.now() - MEDIA_RETENTION_DAYS * 24 * 3600_000;
    const files = await readdir(root, { recursive: true, withFileTypes: true }).catch(() => []);
    for (const f of files) {
      if (!f.isFile()) continue;
      const p = path.join(f.parentPath, f.name);
      if ((await stat(p)).mtimeMs < cutoff) await unlink(p).catch(() => {});
    }
  };
  void sweep();
  setInterval(() => void sweep(), 3600_000).unref();
  logger.info(`drone media on local disk at ${root} (development only; set MEDIA_BUCKET for Firebase Storage)`);

  return {
    where: root,
    writer: async key => {
      await mkdir(path.dirname(path.join(root, key)), { recursive: true });
      return createWriteStream(path.join(root, key));
    },
    link: async (_key, id) => {
      const exp = Date.now() + LINK_TTL_MS;
      return `/api/drones/media/${id}/file?exp=${exp}&sig=${sign(id, exp)}`;
    },
    exists: key => access(path.join(root, key)).then(() => true, () => false),
  };
};

export const mediaStore: MediaStore | null = env.mediaBucket
  ? firebaseStore(env.mediaBucket)
  : env.nodeEnv === 'production' ? null : diskStore(env.mediaDir);

if (!mediaStore) logger.warn('Drone photos and videos are off: set MEDIA_BUCKET to the Firebase Storage bucket.');

export const isDiskStore = !env.mediaBucket && !!mediaStore;
export const diskFile = (key: string) => path.join(path.resolve(env.mediaDir), key);

export const diskLinkValid = (id: string, exp: unknown, sig: unknown) => {
  if (!isDiskStore || typeof exp !== 'string' || typeof sig !== 'string' || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(id, Number(exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
};
