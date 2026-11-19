import type { RequestHandler } from 'express';
import { normalizeAppearance, type AppearanceChoice } from '@farming/shared';
import { HttpError } from '../api/errors';
import { findProfile, updateProfile, type ProfileRow } from '../models/profileModel';
import { listWorlds } from '../models/worldModel';

const view = (p: ProfileRow) => ({ displayName: p.display_name, appearance: p.appearance, motto: p.motto ?? '', updatedAt: p.updated_at.getTime() });

export const getProfile: RequestHandler = async (req, res) => {
  const profile = await findProfile(req.user!.id);
  if (!profile) throw new HttpError(404, 'Profile not found');
  const worlds = await listWorlds(req.user!.id);
  res.json({
    profile: view(profile),
    stats: {
      worlds: worlds.length,
      totalEarnings: worlds.reduce((sum, w) => sum + w.lifetimeEarnings, 0),
      longestWorldDays: worlds.reduce((max, w) => Math.max(max, w.day), 0),
    },
  });
};

/** Any parts left out (an older client) or out of range become the default option. */
function parseAppearance(value: unknown): AppearanceChoice {
  if (typeof value !== 'object' || value === null) throw new HttpError(400, 'Invalid appearance');
  return normalizeAppearance(value);
}

export const patchProfile: RequestHandler = async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const changes: { displayName?: string; appearance?: AppearanceChoice; motto?: string } = {};
  if (body.displayName !== undefined) {
    const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (name.length < 1 || name.length > 24) throw new HttpError(400, 'Display name must be 1–24 characters.');
    changes.displayName = name;
  }
  if (body.appearance !== undefined) changes.appearance = parseAppearance(body.appearance);
  if (body.motto !== undefined) {
    if (typeof body.motto !== 'string') throw new HttpError(400, 'Invalid motto.');
    const motto = body.motto.replace(/\s+/g, ' ').trim();
    if (motto.length > 80) throw new HttpError(400, 'Keep your motto under 80 characters.');
    changes.motto = motto;
  }
  res.json({ profile: view(await updateProfile(req.user!.id, changes)) });
};
