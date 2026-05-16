import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async deleteItem(key: string): Promise<void> {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

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
      void storage.setItem('at', a.payload.accessToken);
      void storage.setItem('rt', a.payload.refreshToken);
      void storage.setItem('user', JSON.stringify(a.payload.user));
    },
    logout(s) {
      s.accessToken = null;
      s.refreshToken = null;
      s.user = null;
      void storage.deleteItem('at');
      void storage.deleteItem('rt');
      void storage.deleteItem('user');
    },
  },
});

export const { hydrate, setSession, logout } = auth.actions;

export interface TrainingEnrollment {
  id: string;
  courseId: string;
  completedLessonIds: string[];
  lastScore?: number;
  attempts?: number;
  completedAt?: string;
}

export interface TrainingCertification {
  id: string;
  courseId: string;
  courseSlug: string;
  badgeLabel: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  shareToken: string;
}

interface TrainingState {
  enrollments: TrainingEnrollment[];
  certifications: TrainingCertification[];
  loaded: boolean;
}

const training = createSlice({
  name: 'training',
  initialState: { enrollments: [], certifications: [], loaded: false } as TrainingState,
  reducers: {
    setTraining(s, a: PayloadAction<{ enrollments: TrainingEnrollment[]; certifications: TrainingCertification[] }>) {
      s.enrollments = a.payload.enrollments;
      s.certifications = a.payload.certifications;
      s.loaded = true;
    },
    upsertEnrollment(s, a: PayloadAction<TrainingEnrollment>) {
      const idx = s.enrollments.findIndex((e) => e.courseId === a.payload.courseId);
      if (idx >= 0) s.enrollments[idx] = a.payload;
      else s.enrollments.push(a.payload);
    },
    upsertCertification(s, a: PayloadAction<TrainingCertification>) {
      const idx = s.certifications.findIndex((c) => c.courseId === a.payload.courseId);
      if (idx >= 0) s.certifications[idx] = a.payload;
      else s.certifications.unshift(a.payload);
    },
    clearTraining(s) {
      s.enrollments = [];
      s.certifications = [];
      s.loaded = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(auth.actions.logout, (s) => {
      s.enrollments = [];
      s.certifications = [];
      s.loaded = false;
    });
  },
});

export const { setTraining, upsertEnrollment, upsertCertification, clearTraining } = training.actions;

export const store = configureStore({ reducer: { auth: auth.reducer, training: training.reducer } });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export async function loadSession() {
  const [at, rt, userRaw] = await Promise.all([
    storage.getItem('at'),
    storage.getItem('rt'),
    storage.getItem('user'),
  ]);
  store.dispatch(hydrate({
    accessToken: at,
    refreshToken: rt,
    user: userRaw ? (JSON.parse(userRaw) as AuthUser) : null,
  }));
}
