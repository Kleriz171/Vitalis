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
  // Self-registration is limited to public roles. Doctors come via approved applications,
  // dispatchers are created by admins.
  role: z.enum(['citizen','blood_donor']).optional(),
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
// E.164. The app normalises local Albanian numbers (069…) before sending.
const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use the international format, e.g. +355691234567');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00.000Z`);
  const years = (Date.now() - d.getTime()) / (365.25 * 24 * 3600_000);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v) && years >= 0 && years <= 130;
}, 'Enter a real date of birth');

export const phoneStartSchema = z.object({ phone: phoneSchema }).strict();
export const phoneVerifySchema = z.object({ phone: phoneSchema, code: z.string().regex(/^\d{6}$/) }).strict();
// Every passport field is required; an empty list is the honest "None", 'unknown' the honest "I don't know".
export const phoneRegisterSchema = z.object({
  signupToken: z.string().min(1),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  dateOfBirth: isoDate,
  emergencyContact: z.object({ name: z.string().trim().min(1).max(80), phone: phoneSchema }).strict(),
  bloodType: z.enum([...BLOOD_TYPES, 'unknown']),
  allergies: z.array(z.object({ allergen: z.string().trim().min(1).max(80), severity: z.enum(['mild', 'moderate', 'severe']) }).strict()).max(50),
  medications: z.array(z.object({ name: z.string().trim().min(1).max(80), dosage: z.string().trim().max(80).optional() }).strict()).max(50),
  conditions: z.array(z.string().trim().min(1).max(120)).max(50),
}).strict();

export const loginSchema = z.object({ email: z.string().email(), password: z.string() });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const authController = {
  register: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.register(req.body)); } catch (e) { next(e); }
  },
  login: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.login(req.body.email, req.body.password)); } catch (e) { next(e); }
  },
  phoneStart: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.startPhone(req.body.phone)); } catch (e) { next(e); }
  },
  phoneVerify: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.verifyPhone(req.body.phone, req.body.code)); } catch (e) { next(e); }
  },
  phoneRegister: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.registerPhone(req.body)); } catch (e) { next(e); }
  },
  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await authService.refresh(req.body.refreshToken)); } catch (e) { next(e); }
  },
};
