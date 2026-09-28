import { AppState, Appearance } from 'react-native';
import { reloadAppAsync } from 'expo';
import { scheme } from './theme';

// Styles are built once from the launch-time palette, so a light/dark switch needs a reload.
// Never mid-use: an automatic sunset switch must not interrupt an SOS or the CPR coach.
// We reload when the user comes back to the app, unless a screen holds it (the emergency screen).
let holds = 0;
let last = AppState.currentState;

AppState.addEventListener('change', (next) => {
  const returning = last !== 'active' && next === 'active';
  last = next;
  if (returning && holds === 0 && (Appearance.getColorScheme() ?? 'light') !== scheme) {
    reloadAppAsync('Colour scheme changed').catch(() => {});
  }
});

/** Keep the current palette while the returned release function has not been called. */
export const holdAppearanceReload = () => {
  holds += 1;
  return () => { holds -= 1; };
};
