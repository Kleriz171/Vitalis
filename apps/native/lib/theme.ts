// Soft teal on warm off-white — must mirror apps/web tokens.
// Web defines these as HSL CSS vars; we materialize the same values here:
//   --primary:    173 80% 40%  → #14A897
//   --background: 36  33% 97%  → #F7F5F0
//   --accent:     173 60% 92%  → #D4F1ED
//   --accent-fg:  173 80% 24%  → #0C5D57
//   --muted:      210 20% 96%  → #F0F2F5
//   --border:     210 16% 90%  → #E1E5EA
//   --foreground: 200 25% 12%  → #172026
export const colors = {
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
