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
  publicWebUrl: process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
};
