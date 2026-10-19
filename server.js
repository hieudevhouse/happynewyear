import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { createApp } from './server/app.js';
import { MongoStore } from './server/mongo-store.js';
import { PRIZES } from './src/data/prizes.js';

export { createApp } from './server/app.js';

export async function startServer() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const config = {
    production: process.env.NODE_ENV === 'production',
    clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map(value => value.trim()).filter(Boolean),
    sessionDays: 30,
  };
  const uri = process.env.MONGO_URI;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!uri) throw new Error('MONGO_URI is required. Configure MongoDB in .env.');
  if (!username || !password || password.length < 12) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters) are required.');
  const store = new MongoStore();
  await store.connect(uri);
  await store.initialize({ username, password, prizes: PRIZES });
  const app = createApp({ store, config });
  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, '0.0.0.0', () => console.log(`LuckyMoney API listening on port ${port}`));
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    server.close(async () => { await store.close(); process.exit(0); });
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  return { app, server, store };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch(() => {
    // Connection errors may contain database credentials. Do not log the raw exception.
    console.error('API startup failed. Check MONGO_URI, MongoDB access, and administrator configuration in .env.');
    process.exitCode = 1;
  });
}
