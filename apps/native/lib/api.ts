import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logout, setSession, store } from './store';

/**
 * Resolve the API base URL.
 *
 * Priority:
 *   1. EXPO_PUBLIC_API_URL env (set in .env or via app config) — always wins
 *   2. iOS Simulator: localhost works (shares host network)
 *   3. Android Emulator: 10.0.2.2 maps to host's localhost
 *   4. Physical device via Expo Go: use the LAN IP Metro is serving from
 */
const resolveBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const debuggerHost =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ??
    '';
  const lanIp = debuggerHost.split(':')[0];

  if (Platform.OS === 'ios') {
    // Simulator shares localhost with the host Mac.
    return lanIp ? `http://${lanIp}:4000/api` : 'http://localhost:4000/api';
  }
  if (Platform.OS === 'android') {
    // 10.0.2.2 is the Android emulator's alias for the host loopback.
    return lanIp ? `http://${lanIp}:4000/api` : 'http://10.0.2.2:4000/api';
  }
  return lanIp ? `http://${lanIp}:4000/api` : 'http://localhost:4000/api';
};

export const API_BASE_URL = resolveBaseUrl();

const DEBUG_NET = process.env.EXPO_PUBLIC_DEBUG_NET !== 'false';

if (DEBUG_NET) {
  console.log('[api] base URL =', API_BASE_URL, 'platform =', Platform.OS);
  if (Platform.OS !== 'web' && /localhost|127\.0\.0\.1/.test(API_BASE_URL)) {
    console.warn(
      '[api] base URL points at localhost on a device build — a phone cannot reach your laptop via "localhost".',
      'Set EXPO_PUBLIC_API_URL to http://<your-LAN-ip>:4000/api'
    );
  }
}

export const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(cfg => {
  const t = store.getState().auth.accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  if (DEBUG_NET) {
    console.log('[api] →', (cfg.method ?? 'GET').toUpperCase(), `${cfg.baseURL ?? ''}${cfg.url ?? ''}`);
  }
  return cfg;
});

api.interceptors.response.use(
  res => {
    if (DEBUG_NET) console.log('[api] ←', res.status, res.config.url);
    return res;
  },
  err => {
    if (DEBUG_NET) {
      const status = err.response?.status;
      const url = err.config?.url;
      const body = err.response?.data;
      console.warn('[api] ✕', status ?? 'NETWORK', url, body ?? err.message);
    }
    return Promise.reject(err);
  }
);

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const message = error.response?.data?.error;
    const refreshToken = store.getState().auth.refreshToken;

    if (!originalRequest || status !== 401 || originalRequest._retry || !refreshToken) {
      if (status === 401 && !refreshToken) store.dispatch(logout());
      return Promise.reject(error);
    }

    const isAuthFailure =
      message === 'Invalid token' ||
      message === 'Missing token' ||
      message === 'Invalid refresh token' ||
      message === 'Session expired';

    if (!isAuthFailure || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshPromise ??= refreshClient
        .post('/auth/refresh', { refreshToken })
        .then(({ data }) => {
          store.dispatch(setSession(data));
          return data.accessToken as string;
        })
        .catch(refreshError => {
          store.dispatch(logout());
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });

      const nextAccessToken = await refreshPromise;
      if (!nextAccessToken) {
        return Promise.reject(error);
      }

      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);
