import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error(err.stack || err.message);
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message ?? 'Internal error' });
};
