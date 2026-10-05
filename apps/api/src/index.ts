import http from 'http';
import { buildApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocket } from './realtime/socket';
import { User } from './models/User';
import { startRedispatch } from './modules/emergency/redispatch';
import { startCheckInSweep } from './modules/checkin/checkin.service';

async function main() {
  await connectDB();
  // Email and phone are unique only where present (partial indexes). Replaces the old strict
  // email index on existing databases; a no-op once they match.
  await User.syncIndexes();
  // Dispatcher and admin became one role, the emergency services operator. A no-op once done.
  const merged = await User.updateMany({ role: { $in: ['dispatcher', 'admin'] } }, { $set: { role: 'eso' } });
  if (merged.modifiedCount) logger.info(`${merged.modifiedCount} dispatcher/admin accounts are now operators (eso)`);
  const app = buildApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.port, () => logger.info(`API on :${env.port}`));
  startRedispatch();
  startCheckInSweep();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
