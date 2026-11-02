import { Router } from 'express';
import {
  authController, registerSchema, loginSchema, refreshSchema, phoneStartSchema, phoneVerifySchema, phoneRegisterSchema,
} from './auth.controller';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { authRequired } from '../../middleware/auth';

const r = Router();
r.post('/register', validate(registerSchema), authController.register);
// Per account on top of the per-IP limit: 10 wrong passwords in 15 minutes pause that email.
// ponytail: in-memory store, one API process; a shared store (Redis) if the API runs on several.
const perAccount = rateLimit({
  windowMs: 15 * 60_000, max: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => `login:${String(req.body?.email ?? '').toLowerCase()}`,
  message: { error: 'Too many failed sign-ins for this account. Try again in 15 minutes.' },
});
r.post('/login', validate(loginSchema), perAccount, authController.login);
r.post('/logout', authRequired, authController.logout);
r.post('/phone/start', validate(phoneStartSchema), authController.phoneStart);
r.post('/phone/verify', validate(phoneVerifySchema), authController.phoneVerify);
r.post('/phone/register', validate(phoneRegisterSchema), authController.phoneRegister);
r.post('/refresh', validate(refreshSchema), authController.refresh);
export default r;
