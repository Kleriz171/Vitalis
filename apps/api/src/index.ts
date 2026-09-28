import http from 'http';
import { buildApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { initSocket } from './realtime/socket';
import { User } from './models/User';

async function main() {
  await connectDB();
  // Email and phone are unique only where present (partial indexes). Replaces the old strict
  // email index on existing databases; a no-op once they match.
  await User.syncIndexes();
  const app = buildApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.port, () => logger.info(`API on :${env.port}`));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
