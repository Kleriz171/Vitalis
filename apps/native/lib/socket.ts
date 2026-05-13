import { io } from 'socket.io-client';
import { API_BASE_URL } from './api';
import { store } from './store';

const socketUrl = API_BASE_URL.replace(/\/api\/?$/, '');

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
