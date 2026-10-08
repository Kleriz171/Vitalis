import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Malformed ObjectIds / schema violations are client errors, not crashes.
  if (err?.name === 'CastError' || err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Invalid request' });
  }
  if (err?.name === 'MulterError') {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10 MB)' : 'Invalid upload' });
  }
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  const status = err.status ?? 500;
  if (status >= 500) logger.error(err.stack || err.message);
  // Never leak internal error messages to clients.
  res.status(status).json({ error: status >= 500 ? 'Internal error' : err.message });
};
