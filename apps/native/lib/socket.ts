import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { store } from './store';

// Allow an explicit override (e.g. for prod or a different socket port).
// Otherwise strip the `/api` suffix off the REST base URL.
const socketUrl =
  process.env.EXPO_PUBLIC_SOCKET_URL?.replace(/\/$/, '') ??
  API_BASE_URL.replace(/\/api\/?$/, '');

export const socket = io(socketUrl, {
  autoConnect: false,
  transports: ['websocket'],
  auth: cb => cb({ token: store.getState().auth.accessToken }),
});

store.subscribe(() => {
  const t = store.getState().auth.accessToken;
  if (t && !socket.connected) socket.connect();
  if (!t && socket.connected) socket.disconnect();
});
