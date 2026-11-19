import { createPublicKey, randomBytes, verify, type JsonWebKey } from 'node:crypto';
import { HttpError } from '../api/errors';
import { config } from '../config';
import { transaction } from '../database/db';
import { insertProfile } from '../models/profileModel';
import { findUserByGoogle, findUserByUsername, insertGoogleUser, linkGoogle } from '../models/userModel';
import { startSession } from './authService';

/**
 * Sign in with Google. The browser gets an ID token (a signed JWT) from
 * Google's own sign-in button and sends it here; we check Google's signature
 * against Google's published keys, that it was issued for our client ID, that
 * it hasn't expired, and that the email is verified. The same request logs in
 * an existing player, links Google to the account you're signed in to, or
 * creates a new account on first use.
 */

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
/** Allowed clock difference between us and Google (seconds). */
const SKEW = 60;

interface GoogleClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
}

let keys: { byKid: Map<string, JsonWebKey>; until: number } | null = null;

/** Google's signing keys, cached for as long as Google says (they rotate). */
async function googleKey(kid: string): Promise<JsonWebKey | null> {
  if (!keys || keys.until < Date.now() || !keys.byKid.has(kid)) {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new HttpError(502, 'Could not reach Google. Try again.');
    const body = (await res.json()) as { keys: Array<JsonWebKey & { kid: string }> };
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
    keys = { byKid: new Map(body.keys.map((k) => [k.kid, k])), until: Date.now() + maxAge * 1000 };
  }
  return keys.byKid.get(kid) ?? null;
}

const part = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Record<string, unknown>;

/** Checks a Google ID token and returns its claims (throws 401 if anything is off). */
export async function verifyGoogleCredential(credential: unknown): Promise<GoogleClaims> {
  const clientId = config.googleClientId;
  if (!clientId) throw new HttpError(503, 'Google sign-in is not set up on this server.');
  if (typeof credential !== 'string' || credential.length > 4096) throw new HttpError(400, 'Missing Google credential.');
  const pieces = credential.split('.');
  if (pieces.length !== 3) throw new HttpError(400, 'That is not a Google credential.');
  const [headerText, payloadText, signatureText] = pieces;
  let header: Record<string, unknown>;
  let claims: GoogleClaims;
  try {
    header = part(headerText);
    claims = part(payloadText) as unknown as GoogleClaims;
  } catch {
    throw new HttpError(400, 'That is not a Google credential.');
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new HttpError(401, 'Unexpected Google credential.');
  const jwk = await googleKey(header.kid);
  if (!jwk) throw new HttpError(401, 'Unknown Google signing key. Try again.');
  const ok = verify('RSA-SHA256', Buffer.from(`${headerText}.${payloadText}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signatureText, 'base64url'));
  if (!ok) throw new HttpError(401, 'Google’s signature did not check out.');
  const now = Math.floor(Date.now() / 1000);
  if (!ISSUERS.has(claims.iss)) throw new HttpError(401, 'That credential was not issued by Google.');
  if (claims.aud !== clientId) throw new HttpError(401, 'That credential was made for another app.');
  if (typeof claims.exp !== 'number' || claims.exp + SKEW < now) throw new HttpError(401, 'The Google sign-in expired. Please try again.');
  if (typeof claims.iat === 'number' && claims.iat - SKEW > now) throw new HttpError(401, 'The Google sign-in is not valid yet.');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new HttpError(401, 'Missing Google account id.');
  if (claims.email && claims.email_verified !== true) throw new HttpError(401, 'Please verify your Google email address first.');
  return claims;
}

/** A free username based on the email (letters, digits and _ only, 3–20 long). */
async function usernameFor(claims: GoogleClaims): Promise<string> {
  const base = ((claims.email?.split('@')[0] ?? claims.given_name ?? 'farmer').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'farmer').padEnd(3, '0');
  if (!(await findUserByUsername(base))) return base;
  for (let i = 0; i < 5; i++) {
    const candidate = `${base.slice(0, 15)}_${randomBytes(2).toString('hex')}`;
    if (!(await findUserByUsername(candidate))) return candidate;
  }
  return `farmer_${randomBytes(4).toString('hex')}`;
}

/**
 * Logs in with Google. Signed in already? Google is linked to that account.
 * Known Google account? That player is logged in. Otherwise a new account
 * (and profile, named after the Google name) is created.
 */
export async function googleSignIn(body: unknown, currentUserId: string | null) {
  const claims = await verifyGoogleCredential((body as { credential?: unknown } | null)?.credential);
  const email = claims.email ?? null;
  const existing = await findUserByGoogle(claims.sub);
  if (currentUserId) {
    if (existing && existing.id !== currentUserId) throw new HttpError(409, 'That Google account is already linked to another player.');
    if (!existing && !(await linkGoogle(currentUserId, claims.sub, email))) throw new HttpError(409, 'This account is already linked to a different Google account.');
    return { userId: currentUserId, created: false, session: await startSession(currentUserId) };
  }
  if (existing) return { userId: existing.id, created: false, session: await startSession(existing.id) };
  const username = await usernameFor(claims);
  const displayName = (claims.name ?? username).trim().slice(0, 24) || username;
  try {
    const user = await transaction(async (client) => {
      const created = await insertGoogleUser(client, username, claims.sub, email);
      await insertProfile(client, created.id, displayName);
      return created;
    });
    return { userId: user.id, created: true, session: await startSession(user.id) };
  } catch (err) {
    // Two sign-ins racing for the same new account: the other one won, so log in to it.
    if ((err as { code?: string }).code === '23505') {
      const again = await findUserByGoogle(claims.sub);
      if (again) return { userId: again.id, created: false, session: await startSession(again.id) };
    }
    throw err;
  }
}
