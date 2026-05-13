import { io } from 'socket.io-client';
import { store } from '../store';

const defaultUrl = () => `http://${window.location.hostname}:4000`;
const url = import.meta.env.VITE_SOCKET_URL ?? defaultUrl();

export const socket = io(url, {
  autoConnect: false,
  auth: cb => cb({ token: store.getState().auth.accessToken }),
});

store.subscribe(() => {
  const t = store.getState().auth.accessToken;
  if (t && !socket.connected) socket.connect();
  if (!t && socket.connected) socket.disconnect();
});
