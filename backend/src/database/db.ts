import { mkdir } from 'node:fs/promises';
import type { Pool } from 'pg';
import { config } from '../config';

/**
 * The one database interface the app uses, with two interchangeable drivers:
 *
 * - **Embedded (default):** PGlite — real PostgreSQL compiled to WebAssembly,
 *   running inside the backend process and storing data in `backend/.data/`.
 *   Nothing to install.
 * - **Server:** any PostgreSQL server, used when `DATABASE_URL` is set.
 *
 * Both speak the same SQL, so models, migrations and queries are identical.
 */
export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Runs one or more statements without parameters (migrations). */
  exec(sql: string): Promise<void>;
}

export interface Database extends Queryable {
  readonly description: string;
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

async function createServerDatabase(url: string): Promise<Database> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  const wrap = (runner: { query: Pool['query'] }): Queryable => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await runner.query(sql, params);
      return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await runner.query(sql);
    },
  });
  await pool.query('SELECT 1');
  return {
    description: `PostgreSQL server (${new URL(url).host})`,
    ...wrap(pool),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await work(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

async function createEmbeddedDatabase(dir: string): Promise<Database> {
  await mkdir(dir, { recursive: true });
  const { PGlite } = await import('@electric-sql/pglite');
  const db = await PGlite.create(dir);
  type Runner = { query: typeof db.query; exec: typeof db.exec };
  const wrap = (runner: Runner): Queryable => ({
    async query<T>(sql: string, params: unknown[] = []) {
      const r = await runner.query<T>(sql, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql: string) {
      await runner.exec(sql);
    },
  });
  return {
    description: `embedded PostgreSQL (${dir})`,
    ...wrap(db),
    transaction: (work) => db.transaction((tx) => work(wrap(tx as unknown as Runner))),
    close: () => db.close(),
  };
}

let instance: Database | null = null;
let ready = false;

/** Opens the configured database (once). */
export async function openDatabase(): Promise<Database> {
  if (!instance) {
    instance = config.databaseUrl ? await createServerDatabase(config.databaseUrl) : await createEmbeddedDatabase(config.embeddedDataDir);
  }
  return instance;
}

export async function closeDatabase(): Promise<void> {
  ready = false;
  const db = instance;
  instance = null;
  await db?.close();
}

/** True once the database is open and migrated. */
export function isDatabaseReady(): boolean {
  return ready;
}

export function setDatabaseReady(value: boolean): void {
  ready = value;
}

function current(): Database {
  if (!instance) throw new Error('Database is not open');
  return instance;
}

export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return current().query<T>(sql, params);
}

/** Runs `work` in a transaction, rolling back on any error. */
export function transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T> {
  return current().transaction(work);
}
