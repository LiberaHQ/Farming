import { randomBytes } from 'node:crypto';
import {
  forecastWeather,
  GAME_CONFIG,
  generateWorld,
  MINE_DASH_KITS,
  MINE_DASH_VARIANTS,
  OPEN_WORLD,
  PRIZES,
  prizeShares,
  rankingPoints,
  scoreMineDash,
  TIME_CONFIG,
  TOURNAMENT_TIERS,
  type CoopJoin,
  type DashStart,
  type MineDashKit,
  type MineDashScore,
  type MineDashSummary,
  type MineDashVariant,
  type Result,
  type SharedWorldState,
  type TournamentTier,
  type TournamentView,
} from '@farming/shared';
import { listFriends } from '../models/friendModel';
import * as db from '../models/openWorldModel';
import { Room } from './Room';
import type { CoopSocket } from './types';

/**
 * The Open World: any number of valleys (copies of the same map, up to 40
 * residents each) and the tournaments run inside it. The server holds the gold
 * that tournaments move: entry fees, refunds and prizes go through the valley
 * room the player is in (or straight into their saved character if they're
 * away), and every movement is written to the gold ledger.
 */

const valleyCode = (id: string) => `VALLEY-${id.toUpperCase()}`;
const valleyName = (id: string) => `Valley ${id.replace(/^v/, '')}`;

/** A brand-new valley: the Open World map with its trees and rocks, on day 1. */
function freshValley(): SharedWorldState {
  const { widthTiles, heightTiles } = GAME_CONFIG.world;
  const world = generateWorld(OPEN_WORLD.seed, widthTiles, heightTiles);
  return {
    seed: OPEN_WORLD.seed,
    time: { day: 1, minute: TIME_CONFIG.dayStartMinute },
    weather: forecastWeather(OPEN_WORLD.seed, 1),
    resources: {
      nodes: world.objects.map((spec) => ({ spec, hasBerries: spec.kind === 'bush' && spec.variant === 1, berryDueDay: null, regrowsInto: null })),
      pending: [],
    },
    farm: [],
    placed: [],
    chickens: [],
    drops: [],
    claims: [],
  };
}

export class OpenWorld {
  /** Valleys loading right now (so two players arriving together share one load). */
  private readonly loading = new Map<string, Promise<Room>>();
  private settling = false;

  constructor(private readonly rooms: Map<string, Room>) {
    setInterval(() => void this.tick(), 30_000).unref();
    setTimeout(() => void this.tick(), 4_000).unref();
  }

  /** Live valley rooms. */
  private valleys(): Room[] {
    return [...this.rooms.values()].filter((r) => r.valley);
  }

  /** The valley room a player is in right now. */
  roomOf(userId: string): Room | null {
    return this.valleys().find((r) => r.has(userId)) ?? null;
  }

  online(): number {
    return this.valleys().reduce((n, r) => n + r.size, 0);
  }

  async status(userId: string | null): Promise<{ online: number; valleys: number; resident: { valley: string } | null }> {
    const counts = await db.valleyCounts();
    const me = userId ? await db.findResident(userId) : null;
    return { online: this.online(), valleys: Math.max(counts.size, 1), resident: me ? { valley: valleyName(me.valley_id) } : null };
  }

  // ---------- Joining ----------

  /** Puts a player in their valley (choosing one on their first visit) and returns what the game needs. */
  async join(socket: CoopSocket, user: { id: string; name: string }): Promise<{ room: Room; join: CoopJoin }> {
    let resident = await db.findResident(user.id);
    if (!resident) {
      const valleyId = await this.chooseValley(user.id);
      await db.addResident(user.id, valleyId, user.name);
      resident = { user_id: user.id, valley_id: valleyId, name: user.name, state: null };
    }
    const room = await this.load(resident.valley_id);
    const join = room.join(socket, user, resident.state);
    return { room, join };
  }

  /** A friend's valley if there's room; otherwise the fullest one that isn't full; otherwise a new one. */
  private async chooseValley(userId: string): Promise<string> {
    const counts = await db.valleyCounts();
    const space = (id: string) => (counts.get(id) ?? 0) < OPEN_WORLD.valleySize;
    try {
      const friends = await listFriends(userId);
      const theirs = await db.residentValleys(friends.map((f) => f.id));
      for (const v of theirs.values()) if (space(v)) return v;
    } catch {
      // No friends list (or no database): pick by size.
    }
    const open = [...counts.entries()].filter(([id]) => space(id)).sort((a, b) => b[1] - a[1]);
    if (open.length) return open[0][0];
    return `v${counts.size + 1}`;
  }

  private load(id: string): Promise<Room> {
    const live = this.rooms.get(valleyCode(id));
    if (live) return Promise.resolve(live);
    const pending = this.loading.get(id);
    if (pending) return pending;
    const p = (async () => {
      const shared = (await db.findValley(id)) ?? freshValley();
      if (!shared.claims) shared.claims = [];
      const code = valleyCode(id);
      const placeholder = { player: { gold: 0 } } as never;
      const room = new Room(code, `valley:${id}`, valleyName(id), shared, placeholder, (r) => this.rooms.delete(r.code), false, 'world', {
        id,
        name: valleyName(id),
        maxPlayers: OPEN_WORLD.valleySize + 10,
        saveWorld: (s) => db.saveValley(id, s),
        savePlayer: (userId, state) => db.saveResident(userId, state),
      });
      this.rooms.set(code, room);
      await db.saveValley(id, shared);
      console.log(`[world] ${valleyName(id)} is open`);
      return room;
    })();
    this.loading.set(id, p);
    p.finally(() => this.loading.delete(id)).catch(() => undefined);
    return p;
  }

  // ---------- Tournaments ----------

  private async tick(): Promise<void> {
    try {
      await this.schedule();
      await this.settleDue();
    } catch (err) {
      console.error('[tournaments] tick failed:', (err as Error).message);
    }
  }

  /** Keeps the current and next tournament of every tier on the board. */
  private async schedule(): Promise<void> {
    const now = Date.now();
    for (const tier of Object.keys(TOURNAMENT_TIERS) as TournamentTier[]) {
      const def = TOURNAMENT_TIERS[tier];
      const every = def.every * 60_000;
      const first = Math.floor(now / every) * every;
      for (const start of [first, first + every]) {
        await db.createTournament({
          id: `${tier}-${start}`,
          tier,
          variant: def.variant,
          seed: randomBytes(9).toString('hex'),
          fee: def.fee,
          starts_at: new Date(start),
          ends_at: new Date(start + def.window * 60_000),
        });
      }
    }
  }

  async list(userId: string): Promise<{ tournaments: TournamentView[]; ranking: Array<{ name: string; points: number }> }> {
    const rows = await db.listTournaments();
    const entries = await db.entriesFor(rows.map((r) => r.id));
    const ranking = await db.monthlyRanking(50);
    const now = Date.now();
    const tournaments = rows
      .filter((t) => t.status !== 'open' || t.starts_at.getTime() <= now + TOURNAMENT_TIERS[t.tier as TournamentTier].every * 60_000)
      .map((t): TournamentView => {
        const mine = entries.filter((e) => e.tournament_id === t.id);
        const me = mine.find((e) => e.user_id === userId);
        const tier = t.tier as TournamentTier;
        const qualify = TOURNAMENT_TIERS[tier].qualify;
        return {
          id: t.id,
          tier,
          variant: t.variant as MineDashVariant,
          name: `${TOURNAMENT_TIERS[tier].name} ${MINE_DASH_VARIANTS[t.variant as MineDashVariant].name}`,
          fee: t.fee,
          startsAt: t.starts_at.getTime(),
          endsAt: t.ends_at.getTime(),
          status: t.status as TournamentView['status'],
          entrants: mine.filter((e) => e.entries > 0).length,
          pool: t.pool,
          myEntries: me?.entries ?? 0,
          myBest: me?.best_score ?? null,
          eligible: !qualify || ranking.slice(0, qualify).some((r) => r.user_id === userId),
          top: mine
            .filter((e) => e.best_score !== null)
            .sort((a, b) => b.best_score! - a.best_score!)
            .slice(0, 5)
            .map((e) => ({ name: e.name, score: e.best_score! })),
        };
      });
    return { tournaments, ranking: ranking.slice(0, 20).map((r) => ({ name: r.name, points: r.points })) };
  }

  /** Pays the entry fee (from the gold the server holds) for one attempt. */
  async enter(userId: string, name: string, id: string): Promise<Result<{ entries: number; gold: number }>> {
    const t = await db.findTournament(id);
    const now = Date.now();
    if (!t || t.status !== 'open') return { ok: false, error: 'That tournament is closed.' };
    if (t.starts_at.getTime() > now) return { ok: false, error: 'That tournament hasn’t started yet.' };
    const minutes = MINE_DASH_VARIANTS[t.variant as MineDashVariant].minutes;
    if (t.ends_at.getTime() - now < minutes * 60_000) return { ok: false, error: 'Too late to enter: there isn’t time left for a full run.' };
    const tier = t.tier as TournamentTier;
    const qualify = TOURNAMENT_TIERS[tier].qualify;
    if (qualify) {
      const top = await db.monthlyRanking(qualify);
      if (!top.some((r) => r.user_id === userId)) return { ok: false, error: `Only this month’s top ${qualify} may enter the Champion tier.` };
    }
    const entry = await db.findEntry(id, userId);
    if ((entry?.entries ?? 0) >= PRIZES.maxEntries) return { ok: false, error: `You’ve entered ${PRIZES.maxEntries} times already (the best run counts).` };
    const room = this.roomOf(userId);
    if (!room) return { ok: false, error: 'Enter tournaments from inside the Open World.' };
    if (!room.grantGold(userId, -t.fee)) return { ok: false, error: `The entry fee is ${t.fee}g. You don’t have enough gold.` };
    try {
      const entries = await db.addEntry(id, userId, name);
      await db.addToPool(id, t.fee);
      await db.ledger(userId, id, 'entry', -t.fee);
      return { ok: true, entries, gold: room.goldOf(userId) ?? 0 };
    } catch (err) {
      room.grantGold(userId, t.fee); // give it back if the entry couldn't be written
      throw err;
    }
  }

  /** Starts a Mine Dash run: a tournament attempt (uses one paid entry) or free practice. */
  async startRun(userId: string, tournamentId: string | null, kit: MineDashKit): Promise<Result<DashStart>> {
    if (!(kit in MINE_DASH_KITS)) return { ok: false, error: 'Pick a kit.' };
    if (!this.roomOf(userId)) return { ok: false, error: 'Start runs from inside the Open World.' };
    const runId = randomBytes(12).toString('hex');
    if (!tournamentId) {
      await db.createRun(runId, null, userId, kit);
      return { ok: true, runId, seed: `practice-${randomBytes(6).toString('hex')}`, variant: 'dash', kit, practice: true, tournamentId: null };
    }
    const t = await db.findTournament(tournamentId);
    if (!t || t.status !== 'open' || t.ends_at.getTime() <= Date.now()) return { ok: false, error: 'That tournament is closed.' };
    if (!(await db.useAttempt(tournamentId, userId))) return { ok: false, error: 'Enter (pay the fee) first: each entry is one run.' };
    await db.createRun(runId, tournamentId, userId, kit);
    return { ok: true, runId, seed: t.seed, variant: t.variant as MineDashVariant, kit, practice: false, tournamentId };
  }

  /**
   * A run is over. The server doesn't take the client's score: it checks the
   * summary against the clock (how many floors could anyone reach in that
   * time, which floors have bosses…), clamps what doesn't add up, and scores it.
   */
  async finishRun(userId: string, runId: string, raw: unknown): Promise<Result<{ score: MineDashScore; best: number | null }>> {
    const run = await db.findRun(String(runId));
    if (!run || run.user_id !== userId) return { ok: false, error: 'Unknown run.' };
    if (run.finished_at) return { ok: false, error: 'That run is already over.' };
    const t = run.tournament_id ? await db.findTournament(run.tournament_id) : null;
    const variant = (t?.variant ?? 'dash') as MineDashVariant;
    const v = MINE_DASH_VARIANTS[variant];
    const elapsed = (Date.now() - Number(run.started_ms)) / 1000;
    const summary = checkSummary(raw, v.startFloor, Math.min(v.lastFloor, 999), v.minutes * 60, elapsed);
    const score = scoreMineDash(summary, v.startFloor);
    if (!(await db.finishRun(run.id, score.total, summary))) return { ok: false, error: 'That run is already over.' };
    // Late runs (past the tournament's end) don't count.
    if (t && t.status === 'open' && Date.now() <= t.ends_at.getTime() + 60_000) await db.recordBest(t.id, userId, score.total);
    const entry = t ? await db.findEntry(t.id, userId) : null;
    return { ok: true, score, best: entry?.best_score ?? null };
  }

  /** Tournaments past their end: refund (too few entrants) or pay out, burn the rest, rank everyone. */
  private async settleDue(): Promise<void> {
    if (this.settling) return;
    this.settling = true;
    try {
      for (const t of await db.dueTournaments()) await this.settle(t);
    } finally {
      this.settling = false;
    }
  }

  private async settle(t: db.TournamentRow): Promise<void> {
    const tier = t.tier as TournamentTier;
    const name = `${TOURNAMENT_TIERS[tier].name} ${MINE_DASH_VARIANTS[t.variant as MineDashVariant].name}`;
    const entries = (await db.entriesFor([t.id])).filter((e) => e.entries > 0);
    const pool = entries.reduce((sum, e) => sum + e.entries * t.fee, 0);
    if (entries.length < PRIZES.minEntrants) {
      for (const e of entries) {
        const refund = e.entries * t.fee;
        await this.pay(e.user_id, refund);
        await db.ledger(e.user_id, t.id, 'refund', refund);
        await db.settleEntry(t.id, e.user_id, null, 0, 0);
        this.notify(e.user_id, { id: t.id, name, rank: null, entrants: entries.length, prize: 0, refund });
      }
      await db.setTournamentResult(t.id, 'cancelled', pool, 0);
      if (entries.length) console.log(`[tournaments] ${t.id} cancelled (${entries.length} entrants), refunded ${pool}g`);
      return;
    }
    const ranked = entries.filter((e) => e.best_score !== null).sort((a, b) => b.best_score! - a.best_score! || a.best_at!.getTime() - b.best_at!.getTime());
    const payout = Math.floor(pool * PRIZES.payout);
    const shares = prizeShares(entries.length).slice(0, ranked.length);
    const total = shares.reduce((a, b) => a + b, 0) || 1;
    let paid = 0;
    for (let i = 0; i < ranked.length; i++) {
      const e = ranked[i];
      const prize = i < shares.length ? Math.floor((payout * shares[i]) / total) : 0;
      paid += prize;
      const points = rankingPoints(tier, i + 1, entries.length);
      if (prize > 0) {
        await this.pay(e.user_id, prize);
        await db.ledger(e.user_id, t.id, 'prize', prize);
      }
      await db.settleEntry(t.id, e.user_id, i + 1, prize, points);
      this.notify(e.user_id, { id: t.id, name, rank: i + 1, entrants: entries.length, prize, refund: 0 });
    }
    // Entered but never finished a run: no placing.
    for (const e of entries.filter((x) => x.best_score === null)) {
      await db.settleEntry(t.id, e.user_id, null, 0, 0);
      this.notify(e.user_id, { id: t.id, name, rank: null, entrants: entries.length, prize: 0, refund: 0 });
    }
    const burned = pool - paid;
    await db.ledger(null, t.id, 'burn', burned);
    await db.setTournamentResult(t.id, 'settled', pool, burned);
    console.log(`[tournaments] ${t.id} settled: ${entries.length} entrants, pool ${pool}g, paid ${paid}g, burned ${burned}g`);
  }

  /** Gold to a player: through their valley if they're online, otherwise into their saved character. */
  private async pay(userId: string, amount: number): Promise<void> {
    const room = this.roomOf(userId);
    if (room && room.grantGold(userId, amount)) return;
    if (!(await db.addOfflineGold(userId, amount))) console.warn(`[tournaments] could not pay ${amount}g to ${userId} (no character)`);
  }

  private notify(userId: string, p: { id: string; name: string; rank: number | null; entrants: number; prize: number; refund: number }): void {
    this.roomOf(userId)?.socketOf(userId)?.emit('tournament:result', p);
  }
}

/** Clamps a run's summary to what's possible in the time it took. */
function checkSummary(raw: unknown, startFloor: number, lastFloor: number, seconds: number, elapsed: number): MineDashSummary {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MineDashSummary>;
  const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : min);
  // Nobody clears a floor in under 6 seconds.
  const reachable = startFloor + Math.floor(Math.min(elapsed, seconds + 30) / 6);
  const depth = int(r.depth, startFloor, Math.min(lastFloor, reachable));
  const visited = depth - startFloor + 1;
  const bosses = [...new Set(Array.isArray(r.bosses) ? r.bosses : [])].filter((f): f is number => typeof f === 'number' && Number.isInteger(f) && f % 5 === 0 && f >= startFloor && f <= depth);
  const earned = int(r.earned, 0, visited * 600);
  const end = (['time', 'bank', 'faint', 'quit'] as const).includes(r.end as never) ? (r.end as MineDashSummary['end']) : 'quit';
  return {
    depth,
    bosses,
    elites: int(r.elites, 0, visited * 3),
    vaults: int(r.vaults, 0, visited),
    clean: int(r.clean, 0, visited),
    earned,
    spent: int(r.spent, 0, earned),
    end,
    // The server's clock, not the client's.
    timeLeft: end === 'bank' ? Math.max(0, Math.floor(seconds - elapsed)) : 0,
  };
}
