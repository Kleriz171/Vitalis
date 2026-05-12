import axios from 'axios';
import { store } from '../store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
});

api.interceptors.request.use(cfg => {
  const t = store.getState().auth.accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
