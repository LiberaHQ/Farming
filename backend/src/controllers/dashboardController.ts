import type { RequestHandler } from 'express';
import {
  isItemId,
  MINE_DASH_VARIANTS,
  normalizeAppearance,
  TOURNAMENT_TIERS,
  type CoopPlayerState,
  type DashboardView,
  type MineDashVariant,
  type SaveData,
  type TournamentTier,
} from '@farming/shared';
import { HttpError } from '../api/errors';
import { query } from '../database/db';
import { listFriends } from '../models/friendModel';
import { findResident, monthlyRanking } from '../models/openWorldModel';
import { findProfile } from '../models/profileModel';
import { findWorldSave, listWorlds } from '../models/worldModel';
import { openWorldStatus, presenceOf } from '../realtime';

/** Timestamps as epoch milliseconds, straight from SQL (no driver date parsing). */
const ms = (v: unknown): number | null => (v === null || v === undefined ? null : Math.round(Number(v)));

/** The character shown on the dashboard, from an Open World character or a world save. */
function character(player: CoopPlayerState['player'] | SaveData['player'], social: CoopPlayerState['social'], day: number): DashboardView['character'] {
  const items = new Map<string, number>();
  for (const s of player.inventory?.slots ?? []) if (s && isItemId(s.itemId)) items.set(s.itemId, (items.get(s.itemId) ?? 0) + s.quantity);
  const pets = [social?.pet, social?.pet2].filter((p): p is NonNullable<typeof p> => !!p).map((p) => ({ kind: p.kind, name: p.name, love: p.love }));
  return {
    gold: player.gold ?? 0,
    lifetimeEarnings: player.lifetimeEarnings ?? 0,
    items: [...items.entries()].map(([itemId, quantity]) => ({ itemId: itemId as never, quantity })),
    skills: { ...(social?.skills ?? {}) },
    mineDepth: player.mineDepth ?? 0,
    equipment: { ...(player.equipment ?? {}) },
    pets,
    horse: social?.horse?.name ?? null,
    spouse: social?.spouse ?? null,
    day,
  };
}

/** Everything the dashboard page shows, in one request. */
export const dashboardHandler: RequestHandler = async (req, res) => {
  const userId = req.user!.id;
  const profile = await findProfile(userId);
  if (!profile) throw new HttpError(404, 'Profile not found');

  const [worlds, resident, ranking, friends, member, world] = await Promise.all([
    listWorlds(userId),
    findResident(userId),
    monthlyRanking(500),
    listFriends(userId).catch(() => []),
    query<{ created: string }>('SELECT extract(epoch FROM created_at) * 1000 AS created FROM users WHERE id = $1', [userId]),
    openWorldStatus(userId),
  ]);

  // The character: the Open World one if they have it, otherwise their latest world.
  let source: DashboardView['source'] = null;
  let char: DashboardView['character'] = null;
  if (resident?.state) {
    source = { kind: 'openworld', valley: world.resident?.valley ?? 'Open World' };
    char = character(resident.state.player, resident.state.social, 0);
  } else if (worlds.length) {
    const latest = worlds[0];
    const save = await findWorldSave(userId, latest.seed);
    if (save) {
      source = { kind: 'world', seed: latest.seed };
      char = character(save.player, save.social, save.time?.day ?? latest.day);
    }
  }
  const residentSeen = resident ? await query<{ t: string }>('SELECT extract(epoch FROM updated_at) * 1000 AS t FROM open_world_players WHERE user_id = $1', [userId]) : null;
  const lastPlayed = Math.max(worlds[0]?.savedAt ?? 0, ms(residentSeen?.rows[0]?.t) ?? 0) || null;

  // Tournaments.
  const { rows: entries } = await query<{ tier: string; variant: string; ends: string; rank: number | null; prize: number; best_score: number | null; entries: number; entrants: string }>(
    `SELECT t.tier, t.variant, extract(epoch FROM t.ends_at) * 1000 AS ends, e.rank, e.prize, e.best_score, e.entries,
            (SELECT count(*) FROM tournament_entries x WHERE x.tournament_id = e.tournament_id AND x.entries > 0) AS entrants
       FROM tournament_entries e JOIN tournaments t ON t.id = e.tournament_id
      WHERE e.user_id = $1 AND e.entries > 0
      ORDER BY t.ends_at DESC LIMIT 50`,
    [userId],
  );
  const myRank = ranking.findIndex((r) => r.user_id === userId);
  const scores = entries.map((e) => e.best_score).filter((s): s is number => s !== null);

  const friendList = friends.map((f) => ({ name: f.display_name ?? f.username, online: !!presenceOf(f.id) }));
  const view: DashboardView = {
    profile: {
      displayName: profile.display_name,
      appearance: normalizeAppearance(profile.appearance),
      motto: profile.motto ?? '',
      memberSince: ms(member.rows[0]?.created) ?? 0,
      lastPlayed,
    },
    source,
    character: char,
    worlds: {
      count: worlds.length,
      longestDays: worlds.reduce((m, w) => Math.max(m, w.day), 0),
      totalEarnings: worlds.reduce((sum, w) => sum + w.lifetimeEarnings, 0),
    },
    friends: { total: friendList.length, online: friendList.filter((f) => f.online).length, list: friendList.slice(0, 12) },
    tournaments: {
      entries: entries.reduce((n, e) => n + e.entries, 0),
      best: scores.length ? Math.max(...scores) : null,
      prizes: entries.reduce((n, e) => n + e.prize, 0),
      rank: myRank >= 0 ? myRank + 1 : null,
      points: myRank >= 0 ? ranking[myRank].points : 0,
      recent: entries.slice(0, 6).map((e) => ({
        name: `${TOURNAMENT_TIERS[e.tier as TournamentTier]?.name ?? e.tier} ${MINE_DASH_VARIANTS[e.variant as MineDashVariant]?.name ?? 'Mine Dash'}`,
        rank: e.rank,
        entrants: Number(e.entrants),
        score: e.best_score,
        prize: e.prize,
        endsAt: ms(e.ends) ?? 0,
      })),
    },
    leaderboard: ranking.slice(0, 10).map((r) => ({ name: r.name, points: r.points, me: r.user_id === userId })),
    openWorld: { online: world.online, valleys: world.valleys },
  };
  res.json(view);
};
