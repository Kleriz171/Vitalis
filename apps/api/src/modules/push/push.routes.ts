import { Router } from 'express';
import { z } from 'zod';
import { authRequired, AuthReq } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { User } from '../../models/User';
import { PUSH_TOKEN } from './push.service';

const r = Router();
r.use(authRequired);

const tokenSchema = z.object({ token: z.string().regex(PUSH_TOKEN) }).strict();
const registerSchema = tokenSchema.extend({ language: z.enum(['sq', 'en']).optional() }).strict();

// A device's token belongs to whoever is signed in on it: take it off any other account.
r.post('/token', validate(registerSchema), async (req: AuthReq, res, next) => {
  try {
    const { token, language } = req.body;
    await User.updateMany({ _id: { $ne: req.user!.id }, pushTokens: token }, { $pull: { pushTokens: token } });
    await User.updateOne({ _id: req.user!.id }, { $addToSet: { pushTokens: token }, ...(language ? { $set: { language } } : {}) });
    // ponytail: unbounded per user; cap to the last N devices if accounts start collecting tokens.
    res.status(204).end();
  } catch (e) { next(e); }
});

r.delete('/token', validate(tokenSchema), async (req: AuthReq, res, next) => {
  try {
    await User.updateOne({ _id: req.user!.id }, { $pull: { pushTokens: req.body.token } });
    res.status(204).end();
  } catch (e) { next(e); }
});

export default r;
