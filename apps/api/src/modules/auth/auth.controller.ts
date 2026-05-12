import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['citizen','blood_donor','doctor','nurse','student_responder','dispatcher','admin']).optional(),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string() });

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.register(req.body)); } catch (e) { next(e); }
  },
  login: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.login(req.body.email, req.body.password)); } catch (e) { next(e); }
  },
};
