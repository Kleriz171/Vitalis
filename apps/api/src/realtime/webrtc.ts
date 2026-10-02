import { Server, Socket } from 'socket.io';
import { emergencyAccess } from './socket';

/**
 * Signalling for Live-Link video. Rooms are emergency ids, so only the caller,
 * the assigned responder and operators can join. Messages never leave the room.
 */
export const registerWebRTC = (socket: Socket, io: Server, user: { id: string; role: string }) => {
  const joined = new Set<string>();

  // `to` may only target a peer socket that is inside the same room.
  const relay = (event: string) => (msg: any) => {
    const roomId = msg?.roomId;
    if (!joined.has(roomId)) return;
    const room = `rtc:${roomId}`;
    const target = typeof msg?.to === 'string' && io.sockets.adapter.rooms.get(room)?.has(msg.to) ? msg.to : null;
    const out = event === 'rtc:ice'
      ? { from: socket.id, candidate: msg.candidate }
      : { from: socket.id, sdp: msg.sdp };
    (target ? io.to(target) : socket.to(room)).emit(event, out);
  };

  socket.on('rtc:join', async (roomId: unknown) => {
    if (!(await emergencyAccess(user, roomId))) return;
    joined.add(roomId as string);
    socket.join(`rtc:${roomId}`);
    socket.to(`rtc:${roomId}`).emit('rtc:peer-joined', { peerId: socket.id });
  });

  socket.on('rtc:offer', relay('rtc:offer'));
  socket.on('rtc:answer', relay('rtc:answer'));
  socket.on('rtc:ice', relay('rtc:ice'));

  socket.on('rtc:leave', (roomId: unknown) => {
    if (typeof roomId !== 'string' || !joined.delete(roomId)) return;
    socket.leave(`rtc:${roomId}`);
    socket.to(`rtc:${roomId}`).emit('rtc:peer-left', { peerId: socket.id });
  });
};
