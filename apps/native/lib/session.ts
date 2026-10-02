import { logout, store } from './store';
import { unregisterPush } from './push';
import { stopDutyTracking } from './dutyLocation';

/** Full sign-out: stop alerts and tracking for this account before dropping the session. */
export async function signOut() {
  await Promise.all([unregisterPush(), stopDutyTracking().catch(() => {})]);
  store.dispatch(logout());
}
