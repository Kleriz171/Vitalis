import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { Storage } from '@google-cloud/storage';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MEDIA_RETENTION_DAYS } from '../../models/DroneMedia';

/**
 * Where drone photos and videos live:
 *   - MongoDB (GridFS), the default: free, in the database we already run, but it shares
 *     the free Atlas tier's 512 MB, so footage is capped at MEDIA_QUOTA_MB.
 *   - Firebase Storage when MEDIA_BUCKET is set: no cap, needs the Blaze plan.
 * Files are private either way: the console gets a link that works for LINK_TTL_MS.
 */
export interface MediaStore {
  where: string;
  writer(key: string, contentType: string): Promise<Writable>;
  remove(key: string): Promise<void>;
  link(key: string, id: string): Promise<string>;
  exists(key: string): Promise<boolean>;
  /** Bytes in use, for the cap. */
  used(): Promise<number>;
  /** Stores without their own links stream files through the API. */
  serve?(key: string, contentType: string, req: Request, res: Response): Promise<void>;
}

const PREFIX = 'drone-media/';
export const LINK_TTL_MS = 10 * 60_000;
const DAY_MS = 24 * 3600_000;

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
    remove: async key => { await bucket.file(PREFIX + key).delete({ ignoreNotFound: true }); },
    link: async key => {
      const [url] = await bucket.file(PREFIX + key).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + LINK_TTL_MS });
      return url;
    },
    exists: async key => (await bucket.file(PREFIX + key).exists())[0],
    used: async () => 0, // pay as you go: no cap
  };
};

const sign = (id: string, exp: number) => createHmac('sha256', env.jwtAccess).update(`drone-media:${id}:${exp}`).digest('base64url');

const mongoStore = (): MediaStore => {
  // Lazy: the database connects after this module loads.
  const bucket = () => {
    if (!mongoose.connection.db) throw new Error('Database not ready');
    return new GridFSBucket(mongoose.connection.db, { bucketName: 'droneMedia' });
  };
  const files = (filter: object) => bucket().find(filter).toArray();

  // The 30 days on the files: the record's TTL index doesn't reach GridFS, so sweep hourly.
  const sweep = async () => {
    try {
      for (const f of await files({ uploadDate: { $lt: new Date(Date.now() - MEDIA_RETENTION_DAYS * DAY_MS) } })) await bucket().delete(f._id);
    } catch (e: any) {
      logger.warn(`drone media sweep failed: ${e?.message}`);
    }
  };
  setTimeout(() => void sweep(), 60_000).unref();
  setInterval(() => void sweep(), 3600_000).unref();

  const remove = async (key: string) => {
    for (const f of await files({ filename: key })) await bucket().delete(f._id);
  };

  return {
    where: 'MongoDB (GridFS: droneMedia)',
    writer: async (key, contentType) => bucket().openUploadStream(key, { metadata: { contentType } }),
    remove,
    link: async (_key, id) => {
      const exp = Date.now() + LINK_TTL_MS;
      return `/api/drones/media/${id}/file?exp=${exp}&sig=${sign(id, exp)}`;
    },
    exists: async key => (await files({ filename: key })).length > 0,
    used: async () => {
      const [row] = await mongoose.connection.db!.collection('droneMedia.files').aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: '$length' } } }]).toArray();
      return row?.total ?? 0;
    },
    // With Range support, so videos can seek.
    serve: async (key, contentType, req, res) => {
      const [file] = await files({ filename: key });
      if (!file) { res.status(404).json({ error: 'Not found' }); return; }
      const size = file.length;
      const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
      let start = 0;
      let end = size - 1;
      if (m && (m[1] || m[2])) {
        start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
        end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        if (start > end || start >= size) { res.status(416).setHeader('Content-Range', `bytes */${size}`).end(); return; }
        res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(end - start + 1));
      res.type(contentType);
      await pipeline(bucket().openDownloadStream(file._id, { start, end: end + 1 }), res);
    },
  };
};

export const mediaStore: MediaStore = env.mediaBucket ? firebaseStore(env.mediaBucket) : mongoStore();
logger.info(`drone photos and videos: ${mediaStore.where}${env.mediaBucket ? '' : `, up to ${env.mediaQuotaMb} MB`}`);

export const QUOTA_BYTES = env.mediaBucket ? Infinity : env.mediaQuotaMb * 1024 * 1024;

export const linkValid = (id: string, exp: unknown, sig: unknown) => {
  if (typeof exp !== 'string' || typeof sig !== 'string' || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(id, Number(exp)));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
};
