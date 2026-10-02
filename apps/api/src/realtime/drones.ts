import { Server, Socket } from 'socket.io';
import { timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { DroneMission } from '../models/DroneMission';
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

const fleet = new Map<string, { socketId: string; telemetry?: Telemetry; connectedAt: number }>();
let nsp: ReturnType<Server['of']> | null = null;

export const fleetSnapshot = () =>
  [...fleet.entries()].map(([droneId, v]) => ({ droneId, online: true, connectedAt: v.connectedAt, telemetry: v.telemetry ?? null }));

export const isOnline = (droneId: string) => fleet.has(droneId);

export const sendToBridge = (droneId: string, event: string, payload: unknown) => {
  const entry = fleet.get(droneId);
  if (!entry || !nsp) return false;
  nsp.to(entry.socketId).emit(event, payload);
  return true;
};

const keyMatches = (given: unknown) => {
  if (!env.droneBridgeKey || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(env.droneBridgeKey);
  return a.length === b.length && timingSafeEqual(a, b);
};

const clampRc = (v: unknown) => Math.max(-100, Math.min(100, Math.round(Number(v) || 0)));

export const registerDrones = (io: Server) => {
  nsp = io.of('/drones');

  nsp.use((socket, next) => {
    const { key, droneId } = socket.handshake.auth ?? {};
    if (!keyMatches(key)) return next(new Error('bridge auth failed'));
    if (typeof droneId !== 'string' || !DRONE_ID.test(droneId)) return next(new Error('bad drone id'));
    if (fleet.has(droneId)) return next(new Error('drone id already connected'));
    (socket.data as any).droneId = droneId;
    next();
  });

  nsp.on('connection', (socket: Socket) => {
    const droneId: string = (socket.data as any).droneId;

    socket.on('telemetry', (t: Partial<Telemetry>) => {
      const entry = fleet.get(droneId);
      if (!entry) return;
      entry.telemetry = {
        battery: Number(t.battery) || 0,
        heightCm: Number(t.heightCm) || 0,
        tempC: Number(t.tempC) || 0,
        flightTimeS: Number(t.flightTimeS) || 0,
        speedCms: Number(t.speedCms) || 0,
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
    closeOpenMissions('Bridge reconnected; previous flight was ended by the bridge')
      .catch(() => {})
      .finally(() => {
        if (!socket.connected) return;
        fleet.set(droneId, { socketId: socket.id, connectedAt: Date.now() });
        logger.info(`drone bridge online ${droneId}`);
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
