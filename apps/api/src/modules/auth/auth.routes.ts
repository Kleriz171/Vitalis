import { Router } from 'express';
import { authController, registerSchema, loginSchema, refreshSchema } from './auth.controller';
import { validate } from '../../middleware/validate';

const r = Router();
r.post('/register', validate(registerSchema), authController.register);
r.post('/login', validate(loginSchema), authController.login);
r.post('/refresh', validate(refreshSchema), authController.refresh);
export default r;
