import axios from 'axios';
import { store } from '../store';

// Resolve the API base URL relative to the host the page is loaded from.
// Works for: localhost dev, LAN-IP dev (iOS simulator / physical device),
// and any future deployment that serves the SPA + API from the same host.
const defaultBase = () => {
  const { hostname } = window.location;
  return `http://${hostname}:4000/api`;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? defaultBase(),
});

api.interceptors.request.use(cfg => {
  const t = store.getState().auth.accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
