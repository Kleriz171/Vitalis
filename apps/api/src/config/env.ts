import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/vitalis',
  jwtAccess: process.env.JWT_ACCESS ?? 'dev-access',
  jwtRefresh: process.env.JWT_REFRESH ?? 'dev-refresh',
  accessTtl: process.env.ACCESS_TTL ?? '15m',
  refreshTtl: process.env.REFRESH_TTL ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:5174',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Public website (apps/landing): certificate QR codes link to its /verify page.
  publicWebUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:5175',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  // Shared secret the drone bridge presents on connect. Empty = drone bridges disabled.
  droneBridgeKey: process.env.DRONE_BRIDGE_KEY ?? '',
  // OSRM server for road ETAs. Patient locations must not go to a third party, so the public
  // demo is used only outside production; for launch, self-host OSRM with the Albania extract
  // (free) and set OSRM_URL. Empty = straight-line estimate.
  osrmUrl: process.env.OSRM_URL ?? (process.env.NODE_ENV === 'production' ? '' : 'https://router.project-osrm.org'),
};

if (env.nodeEnv === 'production') {
  const weak = (s: string) => s.length < 32 || s.startsWith('dev-') || s.startsWith('replace-me');
  if (weak(env.jwtAccess) || weak(env.jwtRefresh)) {
    throw new Error('JWT_ACCESS and JWT_REFRESH must be set to strong secrets (32+ chars) in production');
  }
}
