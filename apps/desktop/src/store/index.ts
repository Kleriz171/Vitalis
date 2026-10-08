import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: any | null;
}

const auth = createSlice({
  name: 'auth',
  initialState: {
    accessToken: localStorage.getItem('at'),
    refreshToken: localStorage.getItem('rt'),
    user: JSON.parse(localStorage.getItem('user') ?? 'null'),
  } as AuthState,
  reducers: {
    setSession(s, a: PayloadAction<{ accessToken: string; refreshToken: string; user: any }>) {
      s.accessToken = a.payload.accessToken;
      s.refreshToken = a.payload.refreshToken;
      s.user = a.payload.user;
      localStorage.setItem('at', a.payload.accessToken);
      localStorage.setItem('rt', a.payload.refreshToken);
      localStorage.setItem('user', JSON.stringify(a.payload.user));
    },
    logout(s) {
      s.accessToken = null;
      s.refreshToken = null;
      s.user = null;
      localStorage.clear();
    },
  },
});

export const { setSession, logout } = auth.actions;
export const store = configureStore({ reducer: { auth: auth.reducer } });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
