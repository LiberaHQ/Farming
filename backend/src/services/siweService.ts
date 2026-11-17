import { randomBytes } from 'node:crypto';
import { getAddress, isAddress, verifyMessage, type Hex } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { HttpError } from '../api/errors';
import { transaction } from '../database/db';
import { insertProfile } from '../models/profileModel';
import { findUserByUsername, findUserByWallet, insertWalletUser } from '../models/userModel';
import { startSession } from './authService';

/**
 * Sign-In with Ethereum (EIP-4361). The client asks for a one-time nonce, the
 * wallet signs a SIWE message containing it, and we check the signature,
 * nonce, domain and timestamps before starting an ordinary session.
 */

const NONCE_TTL_MS = 5 * 60_000;
const nonces = new Map<string, number>();

export function issueNonce(): string {
  const now = Date.now();
  for (const [n, exp] of nonces) if (exp < now) nonces.delete(n);
  if (nonces.size > 10_000) throw new HttpError(429, 'Too many sign-in attempts. Try again shortly.');
  const nonce = randomBytes(16).toString('hex');
  nonces.set(nonce, now + NONCE_TTL_MS);
  return nonce;
}

/** Turns an address into a username that fits the usual rules (3–20 letters, numbers, _). */
const walletUsername = (address: string) => `${address.slice(0, 8)}_${address.slice(-4)}`.toLowerCase();
const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

export async function verifySiwe(body: unknown, expectedHost: string) {
  const { message, signature } = (body ?? {}) as Record<string, unknown>;
  if (typeof message !== 'string' || message.length > 2000 || typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    throw new HttpError(400, 'Missing message or signature.');
  }
  const fields = parseSiweMessage(message);
  if (!fields.address || !isAddress(fields.address) || !fields.nonce || !fields.domain) throw new HttpError(400, 'That is not a sign-in message.');
  if (fields.domain !== expectedHost) throw new HttpError(401, 'This sign-in message was made for another site.');
  const now = new Date();
  if (fields.expirationTime && fields.expirationTime < now) throw new HttpError(401, 'The sign-in message has expired.');
  if (fields.notBefore && fields.notBefore > now) throw new HttpError(401, 'The sign-in message is not valid yet.');
  const expires = nonces.get(fields.nonce);
  if (!expires || expires < Date.now()) throw new HttpError(401, 'The sign-in request expired. Please try again.');
  nonces.delete(fields.nonce); // one use only

  const address = getAddress(fields.address);
  const ok = await verifyMessage({ address, message, signature: signature as Hex }).catch(() => false);
  if (!ok) throw new HttpError(401, 'The signature does not match the wallet.');

  let user = await findUserByWallet(address);
  if (!user) {
    let username = walletUsername(address);
    if (await findUserByUsername(username)) username = `${username.slice(0, 14)}_${randomBytes(2).toString('hex')}`;
    user = await transaction(async (client) => {
      const created = await insertWalletUser(client, username, address);
      await insertProfile(client, created.id, shortAddress(address));
      return created;
    });
  }
  return { user: { id: user.id, username: user.username, wallet: address }, session: await startSession(user.id) };
}
