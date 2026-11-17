import express from 'express';
import { api } from './api/routes';
import { errorHandler, notFound } from './api/errors';
import { loadSession } from './api/middleware';
import { config } from './config';
import { migrate } from './database/migrate';
import { closeDatabase, isDatabaseReady, openDatabase, query, setDatabaseReady } from './database/db';
import { deleteExpiredSessions } from './models/sessionModel';
import { attachRealtime, closeAllRooms } from './realtime';

/**
 * Backend entry point: accounts, profiles, cloud saves and game data over
 * HTTP, and co-op play over Socket.IO on the same server.
 */
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // requests arrive via the Next.js proxy
app.use(loadSession);
app.use('/api', api);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[backend] listening on http://localhost:${config.port} (API + co-op)`);
});
attachRealtime(server);

/** Open + migrate; if the database can't be reached yet, keep retrying in the background. */
async function connectDatabase(attempt = 1): Promise<void> {
  try {
    const db = await openDatabase();
    const applied = await migrate(db);
    setDatabaseReady(true);
    console.log(`[db] using ${db.description}${applied.length ? `, applied ${applied.join(', ')}` : ''}`);
    await deleteExpiredSessions();
  } catch (err) {
    setDatabaseReady(false);
    await closeDatabase().catch(() => undefined);
    if (attempt === 1) {
      console.warn(`[db] can't open the database (${(err as Error).message}).`);
      console.warn('[db] Accounts and cloud saves are offline; the game still works with browser saves.');
      if (config.databaseUrl) console.warn('[db] Check that the PostgreSQL server in DATABASE_URL is running. Retrying every 10s…');
    }
    setTimeout(() => void connectDatabase(attempt + 1), 10_000);
  }
}
void connectDatabase();

// If a database server drops out later, report it via /api/health and reconnect when it's back.
setInterval(() => {
  if (!isDatabaseReady()) return;
  query('SELECT 1').catch(() => {
    console.warn('[db] lost connection to the database; retrying…');
    setDatabaseReady(false);
    void closeDatabase()
      .catch(() => undefined)
      .then(() => connectDatabase(2));
  });
}, 15_000).unref();

// Clean up expired sessions hourly.
setInterval(() => void deleteExpiredSessions().catch(() => undefined), 60 * 60 * 1000).unref();

function shutdown(): void {
  void closeAllRooms()
    .catch(() => undefined)
    .finally(() => server.close(() => void closeDatabase().finally(() => process.exit(0))));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
