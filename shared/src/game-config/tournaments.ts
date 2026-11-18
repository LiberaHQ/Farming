import { MINE_MAIN_FLOORS } from './mineZones';
import type { ItemId } from './items';

/**
 * The Open World and its tournaments: the rules both the server (which runs
 * them and holds the gold) and the game (which shows them) follow.
 */

export const OPEN_WORLD = {
  /** Every valley is a copy of the same map. */
  seed: 'open-world',
  /** Players who live in one valley. */
  valleySize: 40,
  /** Each player's plot of land. */
  claim: { w: 8, h: 8 },
  /** A claim whose owner hasn't visited for this long goes back to the valley. */
  inactiveDays: 14,
  /** Nearby players only: positions are sent for players within this many tiles. */
  viewTiles: 30,
  /** Most gold a player's own report may gain between two reports (the rest is the server's to grant). */
  maxGoldJump: 5_000,
} as const;

export type TournamentTier = 'bronze' | 'silver' | 'gold' | 'champion';

export interface TierDef {
  name: string;
  fee: number;
  /** A new tournament of this tier starts this often (minutes). */
  every: number;
  /** How long entries and runs stay open (minutes). */
  window: number;
  variant: MineDashVariant;
  /** Champion: only the month's top players may enter. */
  qualify?: number;
}

export const TOURNAMENT_TIERS: Record<TournamentTier, TierDef> = {
  bronze: { name: 'Bronze', fee: 250, every: 60, window: 60, variant: 'sprint' },
  silver: { name: 'Silver', fee: 1_500, every: 240, window: 180, variant: 'dash' },
  gold: { name: 'Gold', fee: 7_500, every: 1_440, window: 720, variant: 'dash' },
  champion: { name: 'Champion', fee: 25_000, every: 10_080, window: 2_880, variant: 'deep', qualify: 20 },
};

export const PRIZES = {
  /** Share of entry fees paid out; the rest is burned (removed from the game). */
  payout: 0.9,
  /** Roughly this share of entrants is paid. */
  paidShare: 0.2,
  /** Fewer entrants than this and the tournament is cancelled and refunded. */
  minEntrants: 4,
  /** Paid attempts per tournament (the best one counts). */
  maxEntries: 3,
} as const;

/**
 * How a prize pool splits between the paid places: 1st 30%, 2nd 18%, 3rd 12%,
 * 4th–10th share 25%, 11th onwards share 15% (shares of places that don't
 * exist go to the places that do).
 */
export function prizeShares(entrants: number): number[] {
  const paid = Math.max(1, Math.min(entrants, Math.round(entrants * PRIZES.paidShare)));
  const raw: number[] = [];
  for (let i = 0; i < paid; i++) {
    if (i === 0) raw.push(30);
    else if (i === 1) raw.push(18);
    else if (i === 2) raw.push(12);
    else if (i < 10) raw.push(25 / 7);
    else raw.push(15 / Math.max(1, paid - 10));
  }
  const total = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / total);
}

/** Monthly ranking points for a placing (higher tiers and bigger fields are worth more). */
export function rankingPoints(tier: TournamentTier, rank: number, entrants: number): number {
  const weight = { bronze: 1, silver: 2, gold: 4, champion: 8 }[tier];
  return Math.round(weight * 100 * ((entrants - rank + 1) / entrants) * Math.min(2, 1 + entrants / 50));
}

// ---------- Mine Dash ----------

export type MineDashVariant = 'sprint' | 'dash' | 'deep';

export const MINE_DASH_VARIANTS: Record<MineDashVariant, { name: string; minutes: number; startFloor: number; lastFloor: number; blurb: string }> = {
  sprint: { name: 'Mine Dash Sprint', minutes: 5, startFloor: 1, lastFloor: 10, blurb: 'Five minutes, floors 1–10, King Slime as the finale.' },
  dash: { name: 'Mine Dash', minutes: 15, startFloor: 1, lastFloor: 999, blurb: 'Fifteen minutes: as deep as you dare, with a camp every five floors.' },
  deep: { name: 'Deep Dive', minutes: 25, startFloor: 11, lastFloor: 999, blurb: 'Twenty-five minutes from floor 11. The Abyss is the goal.' },
};

export type MineDashKit = 'brawler' | 'prospector' | 'scout';

export interface KitDef {
  name: string;
  blurb: string;
  items: Array<{ itemId: ItemId; quantity: number }>;
  /** Worn from the start. */
  armor?: ItemId;
  /** Lantern radius bonus (pixels). */
  lantern?: number;
  /** Moves faster all run. */
  swift?: boolean;
  /** Floors on which the ladder's rock glints. */
  maps?: number;
}

export const MINE_DASH_KITS: Record<MineDashKit, KitDef> = {
  brawler: {
    name: 'Brawler',
    blurb: 'Iron sword, leather armour and two meals. Fights through dens and bosses fast.',
    items: [
      { itemId: 'iron_sword', quantity: 1 },
      { itemId: 'pickaxe', quantity: 1 },
      { itemId: 'omelette', quantity: 2 },
    ],
    armor: 'leather_armor',
  },
  prospector: {
    name: 'Prospector',
    blurb: 'Gold pickaxe, extra lantern oil and a meal. Finds ladders fast and earns lots of run money.',
    items: [
      { itemId: 'gold_pickaxe', quantity: 1 },
      { itemId: 'sword', quantity: 1 },
      { itemId: 'omelette', quantity: 1 },
    ],
    lantern: 40,
  },
  scout: {
    name: 'Scout',
    blurb: 'A basic sword, quick feet all run, and a map that shows the ladder on three floors.',
    items: [
      { itemId: 'sword', quantity: 1 },
      { itemId: 'pickaxe', quantity: 1 },
      { itemId: 'bread', quantity: 1 },
    ],
    swift: true,
    maps: 3,
  },
};

export const MINE_DASH_POINTS = {
  floor: 100,
  abyssFloor: 200,
  miniBoss: 250,
  boss: 500,
  shade: 1_000,
  elite: 50,
  vault: 100,
  clean: 25,
  /** Ore and gems carried out: their value divided by this. */
  lootDivisor: 10,
  /** Per second left when you bank at a camp. */
  timeBonus: 1,
} as const;

/** Camp prices, paid in run money (the value of ore and gems found this run). */
export const MINE_DASH_CAMP = {
  meal: { cost: 60, heal: 50 },
  fullHeal: { cost: 150 },
  sharpen: { cost: 120, attack: 1 },
  lantern: { cost: 80, radius: 30 },
  armour: { cost: 150, defense: 0.1 },
} as const;

/** What a run reports when it ends; the server checks it and works out the score itself. */
export interface MineDashSummary {
  /** Deepest floor reached. */
  depth: number;
  /** Boss floors cleared, by floor. */
  bosses: number[];
  elites: number;
  vaults: number;
  /** Floors left without taking a hit. */
  clean: number;
  /** Run money earned (ore and gem value) and spent at camps. */
  earned: number;
  spent: number;
  end: 'time' | 'bank' | 'faint' | 'quit';
  /** Seconds left on the clock when the run ended. */
  timeLeft: number;
}

export interface MineDashScore {
  total: number;
  lines: Array<{ label: string; points: number }>;
}

/** Mine Dash points for a run (the same sum on the server and in the game). */
export function scoreMineDash(s: MineDashSummary, startFloor = 1): MineDashScore {
  const P = MINE_DASH_POINTS;
  const lines: MineDashScore['lines'] = [];
  const main = Math.max(0, Math.min(s.depth, MINE_MAIN_FLOORS) - startFloor + 1);
  const abyss = Math.max(0, s.depth - Math.max(MINE_MAIN_FLOORS, startFloor - 1));
  if (main) lines.push({ label: `${main} floor${main > 1 ? 's' : ''} reached`, points: main * P.floor });
  if (abyss) lines.push({ label: `${abyss} Abyss floor${abyss > 1 ? 's' : ''}`, points: abyss * P.abyssFloor });
  for (const f of s.bosses) lines.push({ label: `Boss on floor ${f}`, points: f === MINE_MAIN_FLOORS ? P.shade : f % 10 === 0 ? P.boss : P.miniBoss });
  if (s.elites) lines.push({ label: `${s.elites} elite${s.elites > 1 ? 's' : ''}`, points: s.elites * P.elite });
  if (s.vaults) lines.push({ label: `${s.vaults} vault${s.vaults > 1 ? 's' : ''}`, points: s.vaults * P.vault });
  if (s.clean) lines.push({ label: `${s.clean} floor${s.clean > 1 ? 's' : ''} without a scratch`, points: s.clean * P.clean });
  const kept = Math.max(0, s.earned - s.spent);
  let loot = Math.floor(kept / P.lootDivisor);
  if (s.end === 'faint' || s.end === 'quit') loot = Math.floor(loot / 2);
  if (loot) lines.push({ label: `Ore and gems${s.end === 'faint' || s.end === 'quit' ? ' (half: you didn’t make it out)' : ''}`, points: loot });
  if (s.end === 'bank' && s.timeLeft > 0) lines.push({ label: `${s.timeLeft}s left on the clock`, points: s.timeLeft * P.timeBonus });
  return { total: lines.reduce((sum, l) => sum + l.points, 0), lines };
}
