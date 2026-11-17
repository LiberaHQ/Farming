import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runtime configuration from environment variables. A `.env` file in the
 * backend folder is loaded automatically if present (see .env.example).
 */
try {
  process.loadEnvFile?.();
} catch {
  // No .env file: use the environment and defaults.
}

const isProduction = process.env.NODE_ENV === 'production';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(process.env.PORT ?? 4000),
  isProduction,
  /** A PostgreSQL server to use. When unset, the backend runs an embedded PostgreSQL (PGlite). */
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  /** Where the embedded database keeps its files. */
  embeddedDataDir: process.env.PGLITE_DATA_DIR ?? path.join(backendRoot, '.data', 'pglite'),
  /** Session lifetime. */
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  /** Largest save upload accepted. */
  maxSaveBytes: 2 * 1024 * 1024,
} as const;
