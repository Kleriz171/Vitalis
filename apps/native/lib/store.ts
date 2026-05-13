import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id?: string;
  _id?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: string;
  bloodType?: string;
  age?: number;
  gender?: string;
  heightCm?: number;
  weightKg?: number;
  illnesses?: string[];
  disabilities?: string[];
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
}

const auth = createSlice({
  name: 'auth',
  initialState: {
    accessToken: null,
    refreshToken: null,
    user: null,
    hydrated: false,
  } as AuthState,
  reducers: {
    hydrate(s, a: PayloadAction<{ accessToken: string | null; refreshToken: string | null; user: AuthUser | null }>) {
      s.accessToken = a.payload.accessToken;
      s.refreshToken = a.payload.refreshToken;
      s.user = a.payload.user;
      s.hydrated = true;
    },
    setSession(s, a: PayloadAction<{ accessToken: string; refreshToken: string; user: AuthUser }>) {
      s.accessToken = a.payload.accessToken;
      s.refreshToken = a.payload.refreshToken;
      s.user = a.payload.user;
      void SecureStore.setItemAsync('at', a.payload.accessToken);
      void SecureStore.setItemAsync('rt', a.payload.refreshToken);
      void SecureStore.setItemAsync('user', JSON.stringify(a.payload.user));
    },
    logout(s) {
      s.accessToken = null;
      s.refreshToken = null;
      s.user = null;
      void SecureStore.deleteItemAsync('at');
      void SecureStore.deleteItemAsync('rt');
      void SecureStore.deleteItemAsync('user');
    },
  },
});

export const { hydrate, setSession, logout } = auth.actions;
export const store = configureStore({ reducer: { auth: auth.reducer } });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export async function loadSession() {
  const [at, rt, userRaw] = await Promise.all([
    SecureStore.getItemAsync('at'),
    SecureStore.getItemAsync('rt'),
    SecureStore.getItemAsync('user'),
  ]);
  store.dispatch(hydrate({
    accessToken: at,
    refreshToken: rt,
    user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
  }));
}
