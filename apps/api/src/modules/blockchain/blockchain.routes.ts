import { Router } from 'express';
import { BlockchainLog } from '../../models/BlockchainLog';
import { authRequired } from '../../middleware/auth';
import { allow } from '../../middleware/rbac';
import { blockchainService } from './blockchain.service';

const r = Router();
r.use(authRequired, allow('dispatcher','admin','doctor'));

r.get('/', async (_req, res) => res.json(await BlockchainLog.find().sort('index').limit(200)));
r.get('/verify', async (_req, res) => res.json(await blockchainService.verifyChain()));

export default r;
