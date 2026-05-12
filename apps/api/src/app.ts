import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/error';

import authRoutes from './modules/auth/auth.routes';
import emergencyRoutes from './modules/emergency/emergency.routes';
import medicineRoutes from './modules/medicine/medicine.routes';
import bioRoutes from './modules/biopassport/biopassport.routes';
import droneRoutes from './modules/drone/drone.routes';
import blockchainRoutes from './modules/blockchain/blockchain.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';

export function buildApp() {
  const app = express();
  app.use(helmet());
  const origins = env.corsOrigin.split(',').map(s => s.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length > 1 ? origins : origins[0], credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit({ windowMs: 60_000, max: 200 }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/emergencies', emergencyRoutes);
  app.use('/api/medicine', medicineRoutes);
  app.use('/api/biopassport', bioRoutes);
  app.use('/api/drones', droneRoutes);
  app.use('/api/blockchain', blockchainRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.use(errorHandler);
  return app;
}
