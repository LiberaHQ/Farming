import type { RequestHandler, Response } from 'express';
import { config } from '../config';
import type { SessionUser } from '../models/sessionModel';
import { userForToken } from '../services/authService';
import { isDatabaseReady } from '../database/db';
import { HttpError } from './errors';

declare module 'express-serve-static-core' {
  interface Request {
    user?: SessionUser | null;
    sessionToken?: string;
  }
}

export const SESSION_COOKIE = 'farm_sid';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header?.split(';') ?? []) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    try {
      out[name] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // ignore malformed cookie values
    }
  }
  return out;
}

/** Resolves the session cookie (if any) to `req.user`. Never fails the request. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  req.sessionToken = token;
  req.user = null;
  if (token && isDatabaseReady()) {
    try {
      req.user = await userForToken(token);
    } catch (err) {
      console.error('[auth] session lookup failed:', (err as Error).message);
    }
  }
  next();
};

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.user) next(new HttpError(401, 'Please log in.'));
  else next();
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Small fixed-window rate limiter (per IP), e.g. for login attempts. */
export function rateLimit(limit: number, windowMs: number): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > limit) next(new HttpError(429, 'Too many attempts. Please wait a minute and try again.'));
    else next();
  };
}
