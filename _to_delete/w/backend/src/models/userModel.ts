import type { Queryable } from '../database/db';
import { query } from '../database/db';

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  wallet_address: string | null;
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

/** Placeholder password hash for wallet-only accounts: never matches a password. */
export const WALLET_ONLY = 'wallet-only';
