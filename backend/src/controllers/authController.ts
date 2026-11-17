import type { RequestHandler } from 'express';
import { clearSessionCookie, setSessionCookie } from '../api/middleware';
import { findProfile } from '../models/profileModel';
import { login, logout, parseCredentials, register } from '../services/authService';
import { issueNonce, verifySiwe } from '../services/siweService';

export const registerHandler: RequestHandler = async (req, res) => {
  const { user, session } = await register(parseCredentials(req.body));
  setSessionCookie(res, session.token, session.expiresAt);
  res.status(201).json({ user: { ...user, displayName: user.username } });
};

export const loginHandler: RequestHandler = async (req, res) => {
  const { user, session } = await login(parseCredentials(req.body));
  setSessionCookie(res, session.token, session.expiresAt);
  const profile = await findProfile(user.id);
  res.json({ user: { ...user, displayName: profile?.display_name ?? user.username } });
};

export const logoutHandler: RequestHandler = async (req, res) => {
  await logout(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
};

export const meHandler: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  const profile = await findProfile(req.user.id);
  res.json({ user: { ...req.user, displayName: profile?.display_name ?? req.user.username } });
};

export const siweNonceHandler: RequestHandler = (_req, res) => {
  res.set('Cache-Control', 'no-store').type('text/plain').send(issueNonce());
};

/** The host the browser is on (the game proxies /api through Next, which forwards it). */
function browserHost(req: Parameters<RequestHandler>[0]): string {
  const origin = req.get('origin');
  if (origin) {
    try {
      return new URL(origin).host;
    } catch {
      /* fall through */
    }
  }
  return req.get('x-forwarded-host')?.split(',')[0].trim() ?? req.get('host') ?? '';
}

export const siweVerifyHandler: RequestHandler = async (req, res) => {
  const { user, session } = await verifySiwe(req.body, browserHost(req));
  setSessionCookie(res, session.token, session.expiresAt);
  const profile = await findProfile(user.id);
  res.json({ user: { id: user.id, username: user.username, displayName: profile?.display_name ?? user.username, wallet: user.wallet } });
};
