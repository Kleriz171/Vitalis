import { io } from 'socket.io-client';
import { store } from '../store';

const url = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000';

export const socket = io(url, {
  autoConnect: false,
  auth: cb => cb({ token: store.getState().auth.accessToken }),
});

// Reloading with a saved session changes nothing in the store, so connect up front too.
if (store.getState().auth.accessToken) socket.connect();

store.subscribe(() => {
  const t = store.getState().auth.accessToken;
  if (t && !socket.connected) socket.connect();
  if (!t && socket.connected) socket.disconnect();
});

// A reconnect after the access token expired is rejected; refresh and retry once.
socket.on('connect_error', err => {
  if (err.message !== 'auth failed' || !store.getState().auth.refreshToken) return;
  import('../api/client')
    .then(({ refresh }) => refresh())
    .then(() => socket.connect())
    .catch(() => {});
});
