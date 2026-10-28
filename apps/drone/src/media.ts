import { spawn } from 'node:child_process';
import { openAsBlob } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Socket } from 'socket.io-client';

/**
 * Photos and videos the operator asks for. Both come from the bridge's own camera feed
 * (/video.mjpg), so they work the same for every driver. A photo is one frame; a video is
 * the frames encoded to H.264 MP4 by ffmpeg. Files go to the API, which stores them for
 * 30 days, and are deleted from this laptop once uploaded: it is footage of patients.
 */

// Calibration knob: long recordings make big files over a phone-tethered link.
const MAX_RECORD_S = Number(process.env.MAX_RECORD_S ?? 600);
const PHOTO_TIMEOUT_MS = 5_000;
const UPLOAD_TRIES = 6; // backoff 2 s, 4 s … about a minute in all

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const BOUNDARY = Buffer.from('--frame');
const NEXT = Buffer.from('\r\n--frame');
const HEADER_END = Buffer.from('\r\n\r\n');

/** JPEG frames from an MJPEG stream ("--frame" parts, with or without Content-Length). */
export async function* frames(url: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`camera feed answered ${res.status}`);
  let buf = Buffer.alloc(0);
  for await (const chunk of res.body) {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const start = buf.indexOf(BOUNDARY);
      const head = start === -1 ? -1 : buf.indexOf(HEADER_END, start);
      const end = head === -1 ? -1 : buf.indexOf(NEXT, head + 4);
      if (end === -1) break;
      yield buf.subarray(head + 4, end);
      buf = buf.subarray(end + 2);
    }
    if (buf.length > 8_000_000) buf = Buffer.alloc(0); // never a frame that big: resync
  }
}

async function photo(feed: string) {
  const done = new AbortController();
  const timeout = AbortSignal.timeout(PHOTO_TIMEOUT_MS);
  try {
    for await (const frame of frames(feed, AbortSignal.any([done.signal, timeout]))) return Buffer.from(frame);
  } catch (e) {
    if (!timeout.aborted) throw e;
  } finally {
    done.abort(); // hang up the feed
  }
  throw new Error('No camera picture');
}

/** Starts recording; resolves with the MP4's path once stopped (or at MAX_RECORD_S). */
function record(feed: string, file: string) {
  const abort = new AbortController();
  // Frames arrive irregularly over Wi-Fi, so timestamps come from the wall clock.
  const ff = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-use_wallclock_as_timestamps', '1', '-c:v', 'mjpeg', '-i', 'pipe:0',
    // Even dimensions and standard-range yuv420p: what every browser and the macOS web view play.
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p', '-fps_mode', 'vfr', '-movflags', '+faststart',
    '-y', file,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  ff.stderr.on('data', d => { stderr = (stderr + d).slice(-500); });
  ff.stdin.on('error', () => {}); // ffmpeg gone: the exit code tells the story
  const exited = new Promise<void>((resolve, reject) => {
    ff.on('error', e => reject((e as NodeJS.ErrnoException).code === 'ENOENT' ? new Error('Recording needs ffmpeg on the bridge laptop') : e));
    ff.on('exit', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${stderr.trim() || `exit ${code}`}`))));
  });
  exited.catch(() => abort.abort());
  let count = 0;
  const pump = (async () => {
    try {
      for await (const frame of frames(feed, abort.signal)) {
        if (!ff.stdin.writableNeedDrain) ff.stdin.write(frame); // drop frames rather than fall behind
        count++;
      }
    } catch { /* stopped, or the feed went away: keep what we have */ }
    ff.stdin.end();
  })();
  const limit = setTimeout(() => abort.abort(), MAX_RECORD_S * 1000);
  const done = exited.then(() => {
    if (!count) throw new Error('No camera picture while recording');
  });
  done.catch(() => {}); // awaited later; an unhandled rejection here would take the whole bridge down
  return {
    done,
    /** Resolves when recording ends for any reason: stop(), the time limit, or ffmpeg failing. */
    ended: new Promise<void>(r => abort.signal.addEventListener('abort', () => r(), { once: true })),
    stop: async () => {
      clearTimeout(limit);
      abort.abort();
      await pump;
    },
  };
}

async function upload(apiUrl: string, key: string, droneId: string, mediaId: string, body: Blob) {
  for (let attempt = 1; ; attempt++) {
    let error: string;
    try {
      const res = await fetch(`${apiUrl}/api/drones/media/${mediaId}/file`, {
        method: 'PUT',
        headers: { 'Content-Type': body.type, 'X-Bridge-Key': key, 'X-Drone-Id': droneId },
        body,
      });
      if (res.ok) return;
      error = `${res.status} ${(await res.text()).slice(0, 200)}`;
      // 4xx other than rate limits, or storage full (507), won't get better by retrying.
      if ((res.status < 500 && res.status !== 429) || res.status === 507) throw Object.assign(new Error(`upload refused: ${error}`), { final: true });
    } catch (e) {
      if ((e as { final?: boolean }).final) throw e;
      error = (e as Error).message;
    }
    if (attempt >= UPLOAD_TRIES) throw new Error(`upload failed: ${error}`);
    await sleep(2000 * 2 ** (attempt - 1));
  }
}

/**
 * Wires the API's media:start / media:stop to the camera. `feed` is the bridge's own MJPEG
 * URL, or undefined while the drone has no camera picture. Returns the ids still in hand,
 * which the bridge reports on reconnect so the API knows which captures are still coming.
 */
export function handleMedia(socket: Socket, opts: { apiUrl: string; key: string; droneId: string; feed: () => string | undefined; log: (...a: unknown[]) => void }) {
  const { apiUrl, key, droneId, feed, log } = opts;
  const active = new Set<string>();
  const recordings = new Map<string, ReturnType<typeof record>>();
  const status = (mediaId: string, s: 'uploading' | 'failed', reason?: string) => socket.emit('media:status', { mediaId, status: s, reason });

  const run = async (mediaId: string, work: () => Promise<void>) => {
    active.add(mediaId);
    try {
      await work();
    } catch (e) {
      log(`media ${mediaId} failed:`, (e as Error).message);
      status(mediaId, 'failed', (e as Error).message);
    } finally {
      active.delete(mediaId);
    }
  };

  socket.on('media:start', ({ mediaId, kind }: { mediaId: string; kind: 'photo' | 'video' }) => {
    if (typeof mediaId !== 'string' || active.has(mediaId)) return;
    const url = feed();
    if (!url) return status(mediaId, 'failed', 'No camera picture');

    if (kind === 'photo') {
      void run(mediaId, async () => {
        const jpeg = await photo(url);
        await upload(apiUrl, key, droneId, mediaId, new Blob([jpeg], { type: 'image/jpeg' }));
        log(`photo ${mediaId} saved (${Math.round(jpeg.length / 1024)} KB)`);
      });
      return;
    }

    const file = path.join(os.tmpdir(), `vitalis-${mediaId}.mp4`);
    const rec = record(url, file);
    recordings.set(mediaId, rec);
    log(`recording ${mediaId}`);
    void run(mediaId, async () => {
      try {
        await rec.ended;
        recordings.delete(mediaId);
        await rec.stop();
        await rec.done;
        status(mediaId, 'uploading');
        await upload(apiUrl, key, droneId, mediaId, await openAsBlob(file, { type: 'video/mp4' }));
        log(`video ${mediaId} saved`);
      } finally {
        await rm(file, { force: true });
      }
    });
  });

  socket.on('media:stop', ({ mediaId }: { mediaId: string }) => {
    const rec = recordings.get(mediaId);
    if (rec) void rec.stop();
  });

  return {
    active,
    /** Bridge shutting down: end recordings and give uploads up to `ms` to finish. */
    flush: async (ms: number) => {
      await Promise.all([...recordings.values()].map(r => r.stop()));
      const until = Date.now() + ms;
      while (active.size && Date.now() < until) await sleep(200);
    },
  };
}
