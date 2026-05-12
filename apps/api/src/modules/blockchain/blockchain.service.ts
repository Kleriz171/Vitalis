import { BlockchainLog } from '../../models/BlockchainLog';
import { sha256 } from '../../utils/hash';

const GENESIS_PREV = '0'.repeat(64);

const computeHash = (index: number, timestamp: Date, prevHash: string, payload: any, nonce: number) =>
  sha256(`${index}|${timestamp.toISOString()}|${prevHash}|${JSON.stringify(payload)}|${nonce}`);

const mine = (index: number, timestamp: Date, prevHash: string, payload: any, difficulty = 2) => {
  let nonce = 0;
  while (true) {
    const hash = computeHash(index, timestamp, prevHash, payload, nonce);
    if (hash.startsWith('0'.repeat(difficulty))) return { hash, nonce };
    nonce++;
  }
};

export const blockchainService = {
  async append(payload: Record<string, any>) {
    const last = await BlockchainLog.findOne().sort('-index');
    const index = ((last?.index as number | undefined) ?? -1) + 1;
    const prevHash = (last?.hash as string | undefined) ?? GENESIS_PREV;
    const timestamp = new Date();
    const { hash, nonce } = mine(index, timestamp, prevHash, payload);
    return BlockchainLog.create({ index, timestamp, prevHash, hash, nonce, payload });
  },

  async verifyChain() {
    const blocks = await BlockchainLog.find().sort('index');
    let prevHash = GENESIS_PREV;
    for (const b of blocks) {
      const recomputed = computeHash(b.index as number, b.timestamp as Date, b.prevHash as string, b.payload, b.nonce as number);
      if (b.prevHash !== prevHash || recomputed !== b.hash)
        return { valid: false, brokenAt: b.index };
      prevHash = b.hash as string;
    }
    return { valid: true, length: blocks.length };
  },
};
