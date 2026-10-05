import { Server, Socket } from 'socket.io';
import http from 'http';
import { env } from '../config/env';
import { verifyAccess } from '../utils/jwt';
import { normalizeRole } from '../models/User';
import { isRevoked } from '../middleware/auth';
import { logger } from '../config/logger';
import { Emergency } from '../models/Emergency';
import { registerWebRTC } from './webrtc';
import { registerDrones, registerOperatorDroneControls } from './drones';

let io: Server;

export const RESPONDER_ROLES = ['doctor', 'nurse', 'student_responder', 'blood_donor'];
export const OPERATOR_ROLES = ['eso'];

type SocketUser = { id: string; role: string };
const userOf = (socket: Socket) => (socket.data as { user: SocketUser }).user;

/**
 * Who may watch an emergency's live room: the caller, the assigned responder, operators.
 * Returns the relationship so callers can gate responder-only actions.
 */
export const emergencyAccess = async (
  user: SocketUser,
  emergencyId: unknown,
): Promise<'operator' | 'citizen' | 'responder' | null> => {
  if (typeof emergencyId !== 'string' || !/^[a-f0-9]{24}$/i.test(emergencyId)) return null;
  if (OPERATOR_ROLES.includes(user.role)) return 'operator';
  const e = await Emergency.findById(emergencyId).select('citizen responder aedRunner').lean();
  if (!e) return null;
  if (String(e.citizen) === user.id) return 'citizen';
  if (e.responder && String(e.responder) === user.id) return 'responder';
  if (e.aedRunner && String(e.aedRunner) === user.id) return 'responder';
  return null;
};

const isLngLat = (c: unknown): c is [number, number] =>
  Array.isArray(c) && c.length === 2 &&
  typeof c[0] === 'number' && typeof c[1] === 'number' &&
  Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;

export const initSocket = (server: http.Server) => {
  const origins = env.corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
  io = new Server(server, {
    cors: env.nodeEnv === 'production'
      ? { origin: origins.length > 1 ? origins : origins[0], credentials: true }
      : { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('no token'));
      const decoded = verifyAccess(token);
      if (isRevoked(decoded.sub)) return next(new Error('auth failed'));
      (socket.data as any).user = { id: decoded.sub, role: normalizeRole(decoded.role) };
      (socket.data as any).responding = new Set<string>();
      next();
    } catch {
      next(new Error('auth failed'));
    }
  });

  registerDrones(io);

  io.on('connection', socket => {
    const user = userOf(socket);
    const responding: Set<string> = (socket.data as any).responding;
    logger.info(`socket connect ${user.id} (${user.role})`);
    socket.join(`user:${user.id}`);
    if (RESPONDER_ROLES.includes(user.role)) socket.join('responders');
    if (OPERATOR_ROLES.includes(user.role)) socket.join('dispatchers');

    // Kept for older clients; membership is decided by role at connect time.
    socket.on('dispatcher:join', () => {
      if (OPERATOR_ROLES.includes(user.role)) socket.join('dispatchers');
    });

    socket.on('emergency:join', async (eId: unknown) => {
      try {
        const access = await emergencyAccess(user, eId);
        if (!access) return;
        socket.join(`emergency:${eId}`);
        if (access === 'responder') responding.add(eId as string);
      } catch (e: any) {
        logger.warn(`emergency:join failed ${e?.message}`);
      }
    });

    socket.on('emergency:leave', (eId: unknown) => {
      if (typeof eId !== 'string') return;
      socket.leave(`emergency:${eId}`);
      responding.delete(eId);
    });

    // Only the assigned responder of a joined emergency may publish their position.
    socket.on('responder:location', (msg: any) => {
      const emergencyId = msg?.emergencyId;
      if (!responding.has(emergencyId) || !isLngLat(msg?.coordinates)) return;
      const payload = { userId: user.id, emergencyId, coordinates: msg.coordinates };
      io.to(`emergency:${emergencyId}`).emit('responder:location', payload);
      io.to('dispatchers').emit('responder:location', payload);
    });

    socket.on('wearable:pulse', (msg: any) => {
      const bpm = Number(msg?.bpm);
      if (!Number.isFinite(bpm) || bpm < 0 || bpm > 300) return;
      io.to('dispatchers').emit('wearable:pulse', { userId: user.id, bpm, at: Date.now() });
    });

    registerWebRTC(socket, io, user);
    if (OPERATOR_ROLES.includes(user.role)) registerOperatorDroneControls(socket, user);

    socket.on('disconnect', () => logger.info(`socket disconnect ${user.id}`));
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};
