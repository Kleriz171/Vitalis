import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { z } from 'zod';
import { BLOOD_TYPES, GENDERS } from '../../models/User';

const passwordSchema = z.string()
  .min(8)
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

const medicationSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  isActive: z.boolean().default(true),
});

const allergySchema = z.object({
  allergen: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'severe']).default('mild'),
});

const vaccinationSchema = z.object({
  name: z.string().min(1),
  date: z.string().datetime().optional(),
  provider: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['citizen','blood_donor','doctor','nurse','student_responder','dispatcher','admin']).optional(),
  bloodType: z.enum(BLOOD_TYPES).nullish(),
  age: z.number().int().min(0).max(130).nullish(),
  gender: z.enum(GENDERS).nullish(),
  heightCm: z.number().min(30).max(300).nullish(),
  weightKg: z.number().min(1).max(500).nullish(),
  illnesses: z.array(z.string().min(1)).default([]),
  disabilities: z.array(z.string().min(1)).default([]),
  medications: z.array(medicationSchema).default([]),
  allergies: z.array(allergySchema).default([]),
  vaccinations: z.array(vaccinationSchema).default([]),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string() });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.register(req.body)); } catch (e) { next(e); }
  },
  login: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.login(req.body.email, req.body.password)); } catch (e) { next(e); }
  },
  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.refresh(req.body.refreshToken)); } catch (e) { next(e); }
  },
};
