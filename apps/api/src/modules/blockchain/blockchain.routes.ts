import { Router } from 'express';
import { BlockchainLog } from '../../models/BlockchainLog';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { blockchainService } from './blockchain.service';

const r = Router();
r.use(authRequired, allow('eso','doctor'));

// 200 entries, oldest first: the newest ones, or with ?before=<index> the ones before that entry.
r.get('/', async (req, res) => {
  const before = Number(req.query.before);
  const filter = Number.isInteger(before) && before > 0 ? { index: { $lt: before } } : {};
  res.json((await BlockchainLog.find(filter).sort('-index').limit(200)).reverse());
});
r.get('/verify', async (_req, res) => res.json(await blockchainService.verifyChain()));

export default r;
