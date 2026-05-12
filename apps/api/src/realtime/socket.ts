import { Server } from 'socket.io';
import http from 'http';
import { env } from '../config/env';
import { verifyAccess } from '../utils/jwt';
import { logger } from '../config/logger';
import { registerWebRTC } from './webrtc';

let io: Server;

export const initSocket = (server: http.Server) => {
  const origins = env.corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
  io = new Server(server, { cors: { origin: origins.length > 1 ? origins : origins[0], credentials: true } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('no token'));
      const decoded = verifyAccess(token);
      (socket.data as any).user = { id: decoded.sub, role: decoded.role };
      next();
    } catch {
      next(new Error('auth failed'));
    }
  });

  io.on('connection', socket => {
    const { id, role } = (socket.data as any).user;
    logger.info(`socket connect ${id} (${role})`);
    socket.join(`user:${id}`);
    if (['doctor','nurse','student_responder','blood_donor'].includes(role)) socket.join('responders');
    if (['dispatcher','admin'].includes(role)) socket.join('dispatchers');

    socket.on('dispatcher:join', () => socket.join('dispatchers'));
    socket.on('emergency:join', (eId: string) => socket.join(`emergency:${eId}`));

    socket.on('responder:location', ({ emergencyId, coordinates }) => {
      io.to(`emergency:${emergencyId}`).emit('responder:location', { userId: id, coordinates });
      io.to('dispatchers').emit('responder:location', { userId: id, emergencyId, coordinates });
    });

    socket.on('wearable:pulse', payload =>
      io.to('dispatchers').emit('wearable:pulse', { userId: id, ...payload })
    );

    registerWebRTC(socket, io);

    socket.on('disconnect', () => logger.info(`socket disconnect ${id}`));
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error('Socket not initialized');
  return io;
};
