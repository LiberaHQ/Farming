import type { Queryable } from '../database/db';
import { query } from '../database/db';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  wallet_address: string | null;
  google_sub?: string | null;
  email?: string | null;
  created_at: Date;
}

const normalise = (row: UserRow | undefined): UserRow | null => (row ? { ...row, id: String(row.id) } : null);

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
  return normalise(rows[0]);
}

export async function insertUser(client: Queryable, username: string, passwordHash: string): Promise<UserRow> {
  const { rows } = await client.query<UserRow>('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *', [username, passwordHash]);
  return normalise(rows[0])!;
}

export async function findUserByWallet(address: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE wallet_address = $1', [address.toLowerCase()]);
  return normalise(rows[0]);
}

export async function insertWalletUser(client: Queryable, username: string, address: string): Promise<UserRow> {
  const { rows } = await client.query<UserRow>(
    'INSERT INTO users (username, password_hash, wallet_address) VALUES ($1, $2, $3) RETURNING *',
    [username, WALLET_ONLY, address.toLowerCase()],
  );
  return normalise(rows[0])!;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return normalise(rows[0]);
}

export async function findUserByGoogle(sub: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>('SELECT * FROM users WHERE google_sub = $1', [sub]);
  return normalise(rows[0]);
}

export async function insertGoogleUser(client: Queryable, username: string, sub: string, email: string | null): Promise<UserRow> {
  const { rows } = await client.query<UserRow>('INSERT INTO users (username, password_hash, google_sub, email) VALUES ($1, $2, $3, $4) RETURNING *', [
    username,
    GOOGLE_ONLY,
    sub,
    email,
  ]);
  return normalise(rows[0])!;
}

/** Ties a Google account to an existing user (false if that user already has a different one). */
export async function linkGoogle(userId: string, sub: string, email: string | null): Promise<boolean> {
  const { rowCount } = await query('UPDATE users SET google_sub = $2, email = COALESCE(email, $3) WHERE id = $1 AND (google_sub IS NULL OR google_sub = $2)', [userId, sub, email]);
  return rowCount > 0;
}

/** Placeholder password hash for Google-only accounts: never matches a password. */
export const GOOGLE_ONLY = 'google-only';

/** Placeholder password hash for wallet-only accounts: never matches a password. */
export const WALLET_ONLY = 'wallet-only';
