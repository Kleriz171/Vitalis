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

export const api = axios.create({ baseURL: API_BASE_URL });
const refreshClient = axios.create({ baseURL: API_BASE_URL });
let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use(cfg => {
  const t = store.getState().auth.accessToken;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

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
