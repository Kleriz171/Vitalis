import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store, setSession, logout } from '../store';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const api = axios.create({ baseURL, timeout: 15_000 });

api.interceptors.request.use(cfg => {
  const t = store.getState().auth.accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Access tokens live 15 minutes; a dispatch console stays open for a whole shift.
// Refresh once on 401 (single flight shared by concurrent requests), then retry.
let refreshing: Promise<string> | null = null;

export const refresh = () => {
  refreshing ??= axios
    .post(`${baseURL}/auth/refresh`, { refreshToken: store.getState().auth.refreshToken })
    .then(({ data }) => {
      store.dispatch(setSession(data));
      return data.accessToken as string;
    })
    .finally(() => { refreshing = null; });
  return refreshing;
};

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  if (error.response?.status !== 401 || !original || original._retry || !store.getState().auth.refreshToken) {
    return Promise.reject(error);
  }
  original._retry = true;
  try {
    const token = await refresh();
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  } catch {
    store.dispatch(logout());
    return Promise.reject(error);
  }
});
