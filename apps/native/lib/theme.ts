import { Appearance } from 'react-native';

// Soft teal on warm off-white — must mirror apps/web tokens.
// Web defines these as HSL CSS vars; we materialize the same values here:
//   --primary:    173 80% 40%  → #14A897
//   --background: 36  33% 97%  → #F7F5F0
//   --accent:     173 60% 92%  → #D4F1ED
//   --accent-fg:  173 80% 24%  → #0C5D57
//   --muted:      210 20% 96%  → #F0F2F5
//   --border:     210 16% 90%  → #E1E5EA
//   --foreground: 200 25% 12%  → #172026
export const lightColors = {
  background: '#F7F5F0',
  foreground: '#172026',
  card: '#FFFFFF',
  cardForeground: '#172026',
  muted: '#F0F2F5',
  soft: '#F4F6F8',
  mutedForeground: '#647585',
  border: '#E1E5EA',
  primary: '#14A897',
  primaryForeground: '#FFFFFF',
  primaryStrong: '#0C5D57',
  // Teal as a filled surface under white text (wallet card, selected chips).
  primarySurface: '#0C5D57',
  accent: '#D4F1ED',
  accentForeground: '#0C5D57',
  destructive: '#E14545',
  destructiveForeground: '#FFFFFF',
  destructiveSoft: '#FDECEC',
  info: '#2F6FED',
  infoSoft: '#EBF2FF',
  success: '#0E9F6E',
  successSoft: '#E7FAF2',
  purple: '#7C3AED',
  purpleSoft: '#F4EEFF',
  warning: '#F59E0B',
  warningSoft: '#FFF4DA',
  dark: '#10272D',
  darkSoft: '#18363F',
  overlay: 'rgba(16, 39, 45, 0.08)',
};

// Same roles, tuned for dark: raised surfaces get lighter, teal text gets brighter,
// soft tints become deep tints. White text on primary/primarySurface/destructive stays ≥ 4.5:1 or large.
export const darkColors: typeof lightColors = {
  background: '#101517',
  foreground: '#E6EBEE',
  card: '#182024',
  cardForeground: '#E6EBEE',
  muted: '#222B30',
  soft: '#1C2429',
  mutedForeground: '#96A4AF',
  border: '#2B363C',
  primary: '#12917F',
  primaryForeground: '#FFFFFF',
  primaryStrong: '#5AD3C2',
  primarySurface: '#0F6E65',
  accent: '#16403B',
  accentForeground: '#8BE3D6',
  destructive: '#E5484D',
  destructiveForeground: '#FFFFFF',
  destructiveSoft: '#3B1D1F',
  info: '#79A6FF',
  infoSoft: '#1A2742',
  success: '#3CC48E',
  successSoft: '#12302A',
  purple: '#B39DFA',
  purpleSoft: '#2A2142',
  warning: '#F5B83D',
  warningSoft: '#3A2F14',
  dark: '#1E2D32',
  darkSoft: '#27393F',
  overlay: 'rgba(0, 0, 0, 0.3)',
};

// Chosen once at launch: every StyleSheet in the app is built from it at import time.
// lib/appearance.ts reloads the app when the system scheme changes (only between uses).
export const scheme: 'light' | 'dark' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const colors = scheme === 'dark' ? darkColors : lightColors;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

export const shadows = {
  card: {
    shadowColor: '#10272D',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  floating: {
    shadowColor: '#10272D',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

// System font carries the UI; Schibsted Grotesk only for display moments (SOS, countdown, passport card).
export const fonts = {
  display: 'SchibstedGrotesk_800ExtraBold',
  displayBold: 'SchibstedGrotesk_700Bold',
};

export const type = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24 },
  callout: { fontSize: 15, lineHeight: 21 },
  footnote: { fontSize: 13, lineHeight: 18 },
};
