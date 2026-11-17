import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDatabase, openDatabase, type Database } from './db';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Applies any `migrations/*.sql` files not yet recorded in schema_migrations,
 * in filename order, each in its own transaction. Safe to run on every start.
 */
export async function migrate(db: Database): Promise<string[]> {
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const done = new Set((await db.query<{ version: string }>('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];

  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      });
      applied.push(file);
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return applied;
}

// `npm run migrate -w backend` (stop the dev server first when using the embedded database)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  openDatabase()
    .then(async (db) => {
      const applied = await migrate(db);
      console.log(applied.length ? `Applied: ${applied.join(', ')}` : `Database is up to date (${db.description}).`);
      await closeDatabase();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
