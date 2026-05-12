import { io } from 'socket.io-client';
import { store } from '../store';

const url = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export const socket = io(url, {
  autoConnect: false,
  auth: cb => cb({ token: store.getState().auth.accessToken }),
});

store.subscribe(() => {
  const t = store.getState().auth.accessToken;
  if (t && !socket.connected) socket.connect();
  if (!t && socket.connected) socket.disconnect();
});
