import { api } from './api';
import { logout, setSession, store } from './store';
import { unregisterPush } from './push';
import { stopDutyTracking } from './dutyLocation';

/** Full sign-out: stop alerts and tracking for this account before dropping the session. */
export async function signOut() {
  await Promise.all([unregisterPush(), stopDutyTracking().catch(() => {})]);
  store.dispatch(logout());
}

/**
 * Reload the account from the server. A role changed elsewhere (course passed, application
 * approved, responder status removed) then shows at once instead of on the next sign-in.
 */
export async function refreshUser() {
  const { data } = await api.get('/health/profile');
  const { accessToken, refreshToken } = store.getState().auth;
  if (accessToken && refreshToken && data?.user) store.dispatch(setSession({ accessToken, refreshToken, user: data.user }));
}
