import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  const r = schema.safeParse(req.body);
  if (!r.success) {
    const issues = r.error.issues.map(i => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    }));
    logger.warn(`validation failed ${req.method} ${req.originalUrl} ${JSON.stringify(issues)}`);
    return res.status(400).json({ error: 'Validation failed', issues });
  }
  req.body = r.data;
  next();
};
