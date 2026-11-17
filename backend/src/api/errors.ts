import type { ErrorRequestHandler, RequestHandler } from 'express';
import { isDatabaseReady } from '../database/db';

/** An error with an HTTP status and a message safe to show the player. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Endpoints that need PostgreSQL answer 503 while it is unreachable. */
export const requireDatabase: RequestHandler = (_req, _res, next) => {
  if (!isDatabaseReady()) next(new HttpError(503, 'The database is unavailable. Accounts and cloud saves are offline.'));
  else next();
};

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, 'Not found'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Body parser errors (malformed JSON, too large) carry a status.
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ error: status === 413 ? 'Request too large' : status < 500 ? 'Invalid request' : 'Something went wrong' });
};
