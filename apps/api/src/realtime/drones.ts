import { Server, Socket } from 'socket.io';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { DroneMission } from '../models/DroneMission';
import { DroneMedia, MEDIA_RETENTION_DAYS } from '../models/DroneMedia';
import { blockchainService } from '../modules/blockchain/blockchain.service';

/**
 * Drone bridges (apps/drone) connect to the /drones namespace with a shared key.
 * Operators never talk to a bridge directly: they emit on the main namespace,
 * this module checks their role and relays. Bridges only ever receive commands.
 */

export const DRONE_ID = /^[a-z0-9-]{1,32}$/;

// Tello SDK moves. Distances in cm (SDK accepts 20–500), rotations in degrees.
const STEP = /^(?:(forward|back|left|right|up|down) (\d{2,3})|(cw|ccw) (\d{1,3}))$/;
export const isValidStep = (s: string) => {
  const m = STEP.exec(s);
  if (!m) return false;
  if (m[1]) return +m[2] >= 20 && +m[2] <= 500;
  return +m[4] >= 1 && +m[4] <= 360;
};

// ponytail: fixed demo routes for an indoor/courtyard Tello. Real deployments replace
// these with GPS waypoints on a GPS drone; the dispatch flow stays the same.
export const ROUTES: Record<string, { name: string; steps: string[] }> = {
  'demo-short': { name: 'Short hop · 2 m forward and land', steps: ['up 50', 'forward 200'] },
  'demo-corner': { name: 'Around the corner · 3 m, turn, 2 m', steps: ['up 50', 'forward 300', 'cw 90', 'forward 200'] },
  'demo-return': { name: 'Out and back · 3 m and return', steps: ['up 50', 'forward 300', 'cw 180', 'forward 300'] },
};

/** What a bridge says about its drone when it connects. Bridges from before toy-drone support are Tellos. */
export interface DroneInfo { driver: 'tello' | 'turbodrone'; model: string; routes: boolean }

const parseInfo = (raw: any): DroneInfo => {
  if (raw?.driver !== 'turbodrone') return { driver: 'tello', model: 'tello', routes: true };
  // Toy drones have no positioning, so they never fly routes, whatever the bridge claims.
  return { driver: 'turbodrone', model: typeof raw.model === 'string' && /^[a-z0-9_]{1,24}$/.test(raw.model) ? raw.model : 'unknown', routes: false };
};

export interface Telemetry {
  battery?: number;
  heightCm?: number;
  tempC?: number;
  flightTimeS?: number;
  speedCms?: number;
  airborne?: boolean;
  mode?: 'idle' | 'mission' | 'manual' | 'landing';
  linkOk?: boolean;
  videoUrl?: string;
  at: number;
}

const fleet = new Map<string, { socketId: string; info: DroneInfo; telemetry?: Telemetry; connectedAt: number }>();
let nsp: ReturnType<Server['of']> | null = null;
let ioRef: Server | null = null;

/** A photo or video as the console sees it. */
export const mediaView = (m: any) => ({
  _id: String(m._id),
  droneId: m.droneId,
  kind: m.kind,
  status: m.status,
  emergency: m.emergency ? String(m.emergency) : undefined,
  size: m.size,
  sha256: m.sha256,
  error: m.error,
  createdAt: m.createdAt,
  expiresAt: new Date(new Date(m.createdAt).getTime() + MEDIA_RETENTION_DAYS * 24 * 3600_000),
});
export const emitMedia = (m: any) => ioRef?.to('dispatchers').emit('drone:media', mediaView(m));

export const fleetSnapshot = () =>
  [...fleet.entries()].map(([droneId, v]) => ({ droneId, online: true, info: v.info, connectedAt: v.connectedAt, telemetry: v.telemetry ?? null }));

export const isOnline = (droneId: string) => fleet.has(droneId);
export const droneInfo = (droneId: string) => fleet.get(droneId)?.info;

export const sendToBridge = (droneId: string, event: string, payload: unknown) => {
  const entry = fleet.get(droneId);
  if (!entry || !nsp) return false;
  nsp.to(entry.socketId).emit(event, payload);
  return true;
};

export const bridgeKeyMatches = (given: unknown) => {
  if (!env.droneBridgeKey || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(env.droneBridgeKey);
  return a.length === b.length && timingSafeEqual(a, b);
};

const clampRc = (v: unknown) => Math.max(-100, Math.min(100, Math.round(Number(v) || 0)));
// A reading the drone doesn't report stays missing, so the console shows "—" rather than 0.
const reading = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined);

export const registerDrones = (io: Server) => {
  ioRef = io;
  nsp = io.of('/drones');

  nsp.use((socket, next) => {
    const { key, droneId } = socket.handshake.auth ?? {};
    if (!bridgeKeyMatches(key)) return next(new Error('bridge auth failed'));
    if (typeof droneId !== 'string' || !DRONE_ID.test(droneId)) return next(new Error('bad drone id'));
    if (fleet.has(droneId)) return next(new Error('drone id already connected'));
    (socket.data as any).droneId = droneId;
    (socket.data as any).info = parseInfo(socket.handshake.auth?.info);
    const active = socket.handshake.auth?.activeMedia;
    (socket.data as any).activeMedia = Array.isArray(active) ? active.filter((id: unknown) => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id)).slice(0, 20) : [];
    next();
  });

  nsp.on('connection', (socket: Socket) => {
    const droneId: string = (socket.data as any).droneId;
    const info: DroneInfo = (socket.data as any).info;

    socket.on('telemetry', (t: Partial<Telemetry>) => {
      const entry = fleet.get(droneId);
      if (!entry) return;
      entry.telemetry = {
        battery: reading(t.battery),
        heightCm: reading(t.heightCm),
        tempC: reading(t.tempC),
        flightTimeS: reading(t.flightTimeS),
        speedCms: reading(t.speedCms),
        airborne: !!t.airborne,
        mode: (['idle', 'mission', 'manual', 'landing'] as const).includes(t.mode as any) ? t.mode : 'idle',
        linkOk: !!t.linkOk,
        videoUrl: typeof t.videoUrl === 'string' && /^http:\/\/[\w.-]+(:\d+)?\/[\w./-]*$/.test(t.videoUrl) ? t.videoUrl : undefined,
        at: Date.now(),
      };
      io.to('dispatchers').volatile.emit('drone:telemetry', { droneId, ...entry.telemetry });
    });

    // Mission progress reported by the bridge while it flies a route.
    socket.on('mission:progress', async (p: { missionId?: string; step?: number; status?: string; reason?: string }) => {
      if (typeof p?.missionId !== 'string' || !/^[a-f0-9]{24}$/i.test(p.missionId)) return;
      const status = ['launched', 'in_flight', 'delivered', 'aborted'].includes(p.status as string) ? p.status : undefined;
      const update: Record<string, unknown> = {};
      if (status) update.status = status;
      if (Number.isInteger(p.step)) update.currentStep = p.step;
      if (status === 'aborted') update.abortReason = String(p.reason ?? 'aborted').slice(0, 200);
      try {
        const m = await DroneMission.findOneAndUpdate(
          { _id: p.missionId, droneId, status: { $nin: ['delivered', 'aborted'] } },
          { $set: update },
          { new: true },
        );
        if (!m) return;
        io.to('dispatchers').emit('drone:update', m);
        if (status === 'delivered' || status === 'aborted') {
          await blockchainService.append({ entity: 'drone_mission', entityId: String(m._id), action: status, actor: `drone:${droneId}` });
        }
      } catch (e: any) {
        logger.warn(`mission progress failed ${e?.message}`);
      }
    });

    // Photo/video progress from the bridge. "ready" only ever comes from a finished upload.
    socket.on('media:status', async (p: { mediaId?: string; status?: string; reason?: string }) => {
      if (typeof p?.mediaId !== 'string' || !/^[a-f0-9]{24}$/i.test(p.mediaId) || !['uploading', 'failed'].includes(p.status as string)) return;
      const update = p.status === 'failed' ? { status: 'failed', error: String(p.reason ?? 'failed').slice(0, 200) } : { status: 'uploading' };
      const m = await DroneMedia.findOneAndUpdate({ _id: p.mediaId, droneId, status: { $in: ['recording', 'uploading'] } }, { $set: update }, { new: true }).catch(() => null);
      if (m) emitMedia(m);
    });

    // Captures this bridge no longer knows about (it restarted) will never upload.
    const closeLostMedia = async () => {
      const lost = await DroneMedia.find({ droneId, status: { $in: ['recording', 'uploading'] }, _id: { $nin: (socket.data as any).activeMedia } });
      for (const m of lost) {
        m.status = 'failed';
        m.error = 'The bridge restarted before the file was saved';
        await m.save();
        emitMedia(m);
      }
    };

    const closeOpenMissions = async (reason: string) => {
      const open = await DroneMission.find({ droneId, status: { $in: ['queued', 'launched', 'in_flight'] } });
      for (const m of open) {
        m.status = 'aborted';
        m.abortReason = reason;
        await m.save();
        io.to('dispatchers').emit('drone:update', m);
      }
    };

    // A bridge always lands and drops its mission when it loses us, so anything still
    // open for this drone (API restart, network blip) is stale. Clean it up before the
    // drone shows as online, so a fresh dispatch can't be caught by the cleanup.
    Promise.all([closeOpenMissions('Bridge reconnected; previous flight was ended by the bridge'), closeLostMedia()])
      .catch(() => {})
      .finally(() => {
        if (!socket.connected) return;
        fleet.set(droneId, { socketId: socket.id, info, connectedAt: Date.now() });
        logger.info(`drone bridge online ${droneId} (${info.model})`);
        io.to('dispatchers').emit('drone:fleet', fleetSnapshot());
      });

    socket.on('disconnect', async () => {
      if (fleet.get(droneId)?.socketId === socket.id) fleet.delete(droneId);
      logger.info(`drone bridge offline ${droneId}`);
      io.to('dispatchers').emit('drone:fleet', fleetSnapshot());
      // A mission can't continue without its bridge; the bridge itself lands the drone on link loss.
      await closeOpenMissions('Bridge disconnected').catch(() => {});
    });
  });
};

/** Operator-side events on the main namespace. Caller has already verified the operator role. */
export const registerOperatorDroneControls = (socket: Socket, user: { id: string }) => {
  const ACTIONS = new Set(['takeoff', 'land', 'emergency', 'abort']);

  socket.on('drone:command', async (msg: { droneId?: string; action?: string }, ack?: (r: { ok: boolean; error?: string }) => void) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const droneId = msg?.droneId;
    const action = msg?.action;
    if (typeof droneId !== 'string' || !DRONE_ID.test(droneId) || typeof action !== 'string' || !ACTIONS.has(action)) {
      return reply({ ok: false, error: 'Invalid command' });
    }
    if (!sendToBridge(droneId, 'command', { action, by: user.id })) return reply({ ok: false, error: 'Drone is offline' });
    if (action !== 'abort') {
      blockchainService.append({ entity: 'drone', entityId: droneId, action, actor: user.id }).catch(() => {});
    }
    reply({ ok: true });
  });

  // Manual stick input, ~10 Hz while a key is held. Latest-wins, so volatile is fine.
  socket.on('drone:rc', (msg: { droneId?: string; lr?: number; fb?: number; ud?: number; yaw?: number }) => {
    if (typeof msg?.droneId !== 'string' || !DRONE_ID.test(msg.droneId)) return;
    sendToBridge(msg.droneId, 'rc', { lr: clampRc(msg.lr), fb: clampRc(msg.fb), ud: clampRc(msg.ud), yaw: clampRc(msg.yaw) });
  });
};
