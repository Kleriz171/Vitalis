import { Router } from 'express';
import {
  authController, registerSchema, loginSchema, refreshSchema, phoneStartSchema, phoneVerifySchema, phoneRegisterSchema,
} from './auth.controller';
import { validate } from '../../middleware/validate';

const r = Router();
r.post('/register', validate(registerSchema), authController.register);
r.post('/login', validate(loginSchema), authController.login);
r.post('/phone/start', validate(phoneStartSchema), authController.phoneStart);
r.post('/phone/verify', validate(phoneVerifySchema), authController.phoneVerify);
r.post('/phone/register', validate(phoneRegisterSchema), authController.phoneRegister);
r.post('/refresh', validate(refreshSchema), authController.refresh);
export default r;
