import { Server, Socket } from 'socket.io';

export const registerWebRTC = (socket: Socket, io: Server) => {
  socket.on('rtc:join', (roomId: string) => {
    socket.join(`rtc:${roomId}`);
    socket.to(`rtc:${roomId}`).emit('rtc:peer-joined', { peerId: socket.id });
  });

  socket.on('rtc:offer', ({ roomId, sdp, to }) =>
    io.to(to ?? `rtc:${roomId}`).emit('rtc:offer', { from: socket.id, sdp }));

  socket.on('rtc:answer', ({ roomId, sdp, to }) =>
    io.to(to ?? `rtc:${roomId}`).emit('rtc:answer', { from: socket.id, sdp }));

  socket.on('rtc:ice', ({ roomId, candidate, to }) =>
    io.to(to ?? `rtc:${roomId}`).emit('rtc:ice', { from: socket.id, candidate }));

  socket.on('rtc:leave', (roomId: string) => {
    socket.leave(`rtc:${roomId}`);
    socket.to(`rtc:${roomId}`).emit('rtc:peer-left', { peerId: socket.id });
  });
};
