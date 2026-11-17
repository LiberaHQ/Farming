import { query } from '../database/db';

export interface SessionUser {
  id: string;
  username: string;
  /** Checksum-less, lower-case address for wallet accounts. */
  wallet?: string | null;
}

export async function insertSession(tokenHash: string, userId: string, expiresAt: Date): Promise<void> {
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt]);
}

export async function findSessionUser(tokenHash: string): Promise<SessionUser | null> {
  const { rows } = await query<SessionUser>(
    `SELECT u.id, u.username, u.wallet_address AS wallet FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ? { id: String(rows[0].id), username: rows[0].username, wallet: rows[0].wallet ?? null } : null;
}

export async function deleteSession(tokenHash: string): Promise<void> {
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteExpiredSessions(): Promise<number> {
  const { rowCount } = await query('DELETE FROM sessions WHERE expires_at <= now()');
  return rowCount ?? 0;
}
