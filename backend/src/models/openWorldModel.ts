import type { CoopPlayerState, SharedWorldState } from '@farming/shared';
import { query } from '../database/db';

// ---------- Valleys and characters ----------

export async function findValley(id: string): Promise<SharedWorldState | null> {
  const { rows } = await query<{ state: SharedWorldState }>('SELECT state FROM open_world_valleys WHERE id = $1', [id]);
  return rows[0]?.state ?? null;
}

export async function saveValley(id: string, state: SharedWorldState): Promise<void> {
  await query(
    `INSERT INTO open_world_valleys (id, state) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [id, JSON.stringify(state)],
  );
}

/** Residents per valley. */
export async function valleyCounts(): Promise<Map<string, number>> {
  const { rows } = await query<{ valley_id: string; n: string }>('SELECT valley_id, count(*) AS n FROM open_world_players GROUP BY valley_id');
  return new Map(rows.map((r) => [r.valley_id, Number(r.n)]));
}

export interface ResidentRow {
  user_id: string;
  valley_id: string;
  name: string;
  state: CoopPlayerState | null;
}

export async function findResident(userId: string): Promise<ResidentRow | null> {
  const { rows } = await query<ResidentRow>('SELECT user_id, valley_id, name, state FROM open_world_players WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function residentValleys(userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { rows } = await query<{ user_id: string; valley_id: string }>('SELECT user_id, valley_id FROM open_world_players WHERE user_id = ANY($1)', [userIds]);
  return new Map(rows.map((r) => [r.user_id, r.valley_id]));
}

export async function addResident(userId: string, valleyId: string, name: string): Promise<void> {
  await query('INSERT INTO open_world_players (user_id, valley_id, name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING', [userId, valleyId, name]);
}

export async function saveResident(userId: string, state: CoopPlayerState): Promise<void> {
  await query('UPDATE open_world_players SET state = $2, updated_at = now() WHERE user_id = $1', [userId, JSON.stringify(state)]);
}

/** Gold for a player who isn't online (a prize or a refund): written straight into their saved character. */
export async function addOfflineGold(userId: string, amount: number): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE open_world_players
        SET state = jsonb_set(state, '{player,gold}', to_jsonb(GREATEST(0, COALESCE((state->'player'->>'gold')::int, 0) + $2))), updated_at = now()
      WHERE user_id = $1 AND state IS NOT NULL`,
    [userId, amount],
  );
  return rowCount > 0;
}

// ---------- Tournaments ----------

export interface TournamentRow {
  id: string;
  tier: string;
  variant: string;
  seed: string;
  fee: number;
  starts_at: Date;
  ends_at: Date;
  status: string;
  pool: number;
  burned: number;
}

export async function createTournament(t: Omit<TournamentRow, 'status' | 'pool' | 'burned'>): Promise<void> {
  await query(
    `INSERT INTO tournaments (id, tier, variant, seed, fee, starts_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [t.id, t.tier, t.variant, t.seed, t.fee, t.starts_at, t.ends_at],
  );
}

export async function findTournament(id: string): Promise<TournamentRow | null> {
  const { rows } = await query<TournamentRow>('SELECT * FROM tournaments WHERE id = $1', [id]);
  return rows[0] ?? null;
}

/** Open and upcoming tournaments, and those settled in the last day. */
export async function listTournaments(): Promise<TournamentRow[]> {
  const { rows } = await query<TournamentRow>(
    `SELECT * FROM tournaments
      WHERE status = 'open' OR ends_at > now() - interval '1 day'
      ORDER BY ends_at ASC LIMIT 40`,
  );
  return rows;
}

export async function dueTournaments(): Promise<TournamentRow[]> {
  const { rows } = await query<TournamentRow>(`SELECT * FROM tournaments WHERE status = 'open' AND ends_at <= now()`);
  return rows;
}

export async function setTournamentResult(id: string, status: string, pool: number, burned: number): Promise<void> {
  await query('UPDATE tournaments SET status = $2, pool = $3, burned = $4 WHERE id = $1', [id, status, pool, burned]);
}

export async function addToPool(id: string, amount: number): Promise<void> {
  await query('UPDATE tournaments SET pool = pool + $2 WHERE id = $1', [id, amount]);
}

export interface EntryRow {
  tournament_id: string;
  user_id: string;
  name: string;
  entries: number;
  runs_used: number;
  best_score: number | null;
  best_at: Date | null;
  rank: number | null;
  prize: number;
  points: number;
}

export async function findEntry(tournamentId: string, userId: string): Promise<EntryRow | null> {
  const { rows } = await query<EntryRow>('SELECT * FROM tournament_entries WHERE tournament_id = $1 AND user_id = $2', [tournamentId, userId]);
  return rows[0] ?? null;
}

export async function entriesFor(tournamentIds: string[]): Promise<EntryRow[]> {
  if (!tournamentIds.length) return [];
  const { rows } = await query<EntryRow>('SELECT * FROM tournament_entries WHERE tournament_id = ANY($1)', [tournamentIds]);
  return rows;
}

export async function addEntry(tournamentId: string, userId: string, name: string): Promise<number> {
  const { rows } = await query<{ entries: number }>(
    `INSERT INTO tournament_entries (tournament_id, user_id, name, entries) VALUES ($1, $2, $3, 1)
     ON CONFLICT (tournament_id, user_id) DO UPDATE SET entries = tournament_entries.entries + 1, name = EXCLUDED.name
     RETURNING entries`,
    [tournamentId, userId, name],
  );
  return rows[0].entries;
}

/** Uses one paid attempt; false if none are left. */
export async function useAttempt(tournamentId: string, userId: string): Promise<boolean> {
  const { rowCount } = await query(
    'UPDATE tournament_entries SET runs_used = runs_used + 1 WHERE tournament_id = $1 AND user_id = $2 AND runs_used < entries',
    [tournamentId, userId],
  );
  return rowCount > 0;
}

export async function recordBest(tournamentId: string, userId: string, score: number): Promise<void> {
  await query(
    `UPDATE tournament_entries SET best_score = $3, best_at = now()
      WHERE tournament_id = $1 AND user_id = $2 AND (best_score IS NULL OR best_score < $3)`,
    [tournamentId, userId, score],
  );
}

export async function settleEntry(tournamentId: string, userId: string, rank: number | null, prize: number, points: number): Promise<void> {
  await query('UPDATE tournament_entries SET rank = $3, prize = $4, points = $5, settled_at = now() WHERE tournament_id = $1 AND user_id = $2', [
    tournamentId,
    userId,
    rank,
    prize,
    points,
  ]);
}

/** This month's ranking: ranking points from every settled tournament. */
export async function monthlyRanking(limit: number): Promise<Array<{ user_id: string; name: string; points: number }>> {
  const { rows } = await query<{ user_id: string; name: string; points: string }>(
    `SELECT e.user_id, max(e.name) AS name, sum(e.points) AS points
       FROM tournament_entries e JOIN tournaments t ON t.id = e.tournament_id
      WHERE t.ends_at >= date_trunc('month', now()) AND e.points > 0
      GROUP BY e.user_id ORDER BY sum(e.points) DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({ user_id: r.user_id, name: r.name, points: Number(r.points) }));
}

export interface RunRow {
  id: string;
  tournament_id: string | null;
  user_id: string;
  kit: string;
  started_ms: string;
  finished_at: Date | null;
}

export async function createRun(id: string, tournamentId: string | null, userId: string, kit: string): Promise<void> {
  await query('INSERT INTO tournament_runs (id, tournament_id, user_id, kit, started_ms) VALUES ($1, $2, $3, $4, $5)', [id, tournamentId, userId, kit, Date.now()]);
}

export async function findRun(id: string): Promise<RunRow | null> {
  const { rows } = await query<RunRow>('SELECT id, tournament_id, user_id, kit, started_ms::text AS started_ms, finished_at FROM tournament_runs WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function finishRun(id: string, score: number, summary: unknown): Promise<boolean> {
  const { rowCount } = await query('UPDATE tournament_runs SET finished_at = now(), score = $2, summary = $3 WHERE id = $1 AND finished_at IS NULL', [
    id,
    score,
    JSON.stringify(summary),
  ]);
  return rowCount > 0;
}

export async function ledger(userId: string | null, tournamentId: string | null, kind: 'entry' | 'refund' | 'prize' | 'burn', amount: number): Promise<void> {
  await query('INSERT INTO gold_ledger (user_id, tournament_id, kind, amount) VALUES ($1, $2, $3, $4)', [userId, tournamentId, kind, amount]);
}
