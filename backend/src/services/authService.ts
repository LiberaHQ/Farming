import { createHash, randomBytes } from 'node:crypto';
import { config } from '../config';
import { transaction } from '../database/db';
import { HttpError } from '../api/errors';
import { insertProfile } from '../models/profileModel';
import { deleteSession, findSessionUser, insertSession, type SessionUser } from '../models/sessionModel';
import { findUserByUsername, insertUser } from '../models/userModel';
import { DUMMY_HASH, hashPassword, verifyPassword } from './password';

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export interface Credentials {
  username: string;
  password: string;
}

/** Validates the shape of a register/login body. */
export function parseCredentials(body: unknown): Credentials {
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof username !== 'string' || !USERNAME.test(username)) {
    throw new HttpError(400, 'Username must be 3–20 letters, numbers or underscores.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be 8–128 characters.');
  }
  return { username, password };
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the raw token (only ever sent to the client as a cookie). */
export async function startSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  await insertSession(hashToken(token), userId, expiresAt);
  return { token, expiresAt };
}

export async function register({ username, password }: Credentials) {
  if (await findUserByUsername(username)) throw new HttpError(409, 'That username is taken.');
  const passwordHash = await hashPassword(password);
  try {
    const user = await transaction(async (client) => {
      const created = await insertUser(client, username, passwordHash);
      await insertProfile(client, created.id, username);
      return created;
    });
    return { user: { id: user.id, username: user.username }, session: await startSession(user.id) };
  } catch (err) {
    if ((err as { code?: string }).code === '23505') throw new HttpError(409, 'That username is taken.');
    throw err;
  }
}

export async function login({ username, password }: Credentials) {
  const user = await findUserByUsername(username);
  // Always run a hash comparison so response time doesn't reveal whether the user exists.
  const ok = await verifyPassword(password, user?.password_hash ?? (await DUMMY_HASH));
  if (!user || !ok) throw new HttpError(401, 'Wrong username or password.');
  return { user: { id: user.id, username: user.username }, session: await startSession(user.id) };
}

export async function userForToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  return findSessionUser(hashToken(token));
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await deleteSession(hashToken(token));
}
