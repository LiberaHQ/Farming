import type { ItemId } from './items';
import type { ItemAmount } from './recipes';
import { createRng } from '../world/random';

/*
 * The ghost night market: once Elsie is at rest, three spirits set up in the
 * old graveyard from 10pm until the day ends. One buys strange things, one
 * swaps curiosities for curiosities, and the ferryman sells a few rare goods
 * each night — for a coin, as ferrymen do.
 */

export type SpiritId = 'wick' | 'moth' | 'ferryman';

export interface SpiritDef {
  id: SpiritId;
  name: string;
  title: string;
  emoji: string;
  /** Tint over the ghost sprite. */
  tint: number;
  greeting: string;
  /** Where they float, in graveyard cells (column 0–6 from the west fence, row 0–4 from the north fence). */
  cell: { c: number; r: number };
}

export const SPIRITS: Record<SpiritId, SpiritDef> = {
  wick: {
    id: 'wick',
    name: 'Old Wick',
    title: 'Lamplighter',
    emoji: '🕯',
    tint: 0xffe8a0,
    greeting: 'Evening. I light the lamps on the other side, and lamps want strange fuel. Bring me the odd things the living throw away — I pay in coin. We have no use for it.',
    cell: { c: 4, r: 1 },
  },
  moth: {
    id: 'moth',
    name: 'Madame Moth',
    title: 'Collector of curiosities',
    emoji: '🦋',
    tint: 0xd8c0ff,
    greeting: 'Ooh, a living one. I collect curiosities, darling, and I only trade curiosities for curiosities. Coins are so… solid.',
    cell: { c: 5, r: 2 },
  },
  ferryman: {
    id: 'ferryman',
    name: 'The Ferryman',
    title: 'Keeper of the toll',
    emoji: '⛵',
    tint: 0xa8e8e0,
    greeting: 'A coin for the crossing. Always a coin. Tonight my boat carries a few rare things — one of each, and gone by dawn.',
    cell: { c: 2, r: 3 },
  },
};

export const SPIRIT_IDS = Object.keys(SPIRITS) as SpiritId[];

/** Open from 10pm until the day ends (2am). */
export const NIGHT_MARKET_HOURS = { from: 22 * 60, to: 26 * 60 } as const;

/** Elsie's quest stage at which she's at rest and the market opens. */
export const NIGHT_MARKET_GHOST_STAGE = 3;

export function nightMarketOpen(ghostStage: number, minute: number): boolean {
  return ghostStage >= NIGHT_MARKET_GHOST_STAGE && minute >= NIGHT_MARKET_HOURS.from && minute < NIGHT_MARKET_HOURS.to;
}

/** Old Wick buys these, above what any stall pays. */
export const WICK_BUYS: ReadonlyArray<{ itemId: ItemId; price: number }> = [
  { itemId: 'ectoplasm', price: 100 },
  { itemId: 'bat_wing', price: 35 },
  { itemId: 'slime', price: 12 },
  { itemId: 'coal', price: 35 },
  { itemId: 'charcoal', price: 70 },
  { itemId: 'fossil', price: 420 },
  { itemId: 'rainbow_shell', price: 320 },
  { itemId: 'meteorite', price: 750 },
  { itemId: 'golden_spike', price: 1100 },
  { itemId: 'glacierfish', price: 1100 },
];

/** Madame Moth's swaps. */
export const MOTH_TRADES: ReadonlyArray<{ give: ItemAmount[]; get: ItemAmount }> = [
  { give: [{ itemId: 'ectoplasm', quantity: 2 }], get: { itemId: 'wisp_tea', quantity: 1 } },
  { give: [{ itemId: 'bat_wing', quantity: 4 }, { itemId: 'ectoplasm', quantity: 2 }], get: { itemId: 'moon_bloom', quantity: 1 } },
  { give: [{ itemId: 'meteorite', quantity: 1 }, { itemId: 'ectoplasm', quantity: 6 }], get: { itemId: 'phantom_ring', quantity: 1 } },
];

/** What the ferryman might carry (three a night, one of each). */
export const FERRY_GOODS: ReadonlyArray<{ itemId: ItemId; price: number }> = [
  { itemId: 'wisp_tea', price: 240 },
  { itemId: 'moon_bloom', price: 400 },
  { itemId: 'pearl', price: 600 },
  { itemId: 'rainbow_shell', price: 450 },
  { itemId: 'stone_tablet', price: 650 },
  { itemId: 'meteorite', price: 900 },
  { itemId: 'swordfish', price: 950 },
  { itemId: 'golden_spike', price: 1400 },
  { itemId: 'glacierfish', price: 1400 },
  { itemId: 'phantom_ring', price: 2500 },
];

export const FERRY_OFFERS_PER_NIGHT = 3;

/** Tonight's three goods: the same for everyone in the world on a given night. */
export function ferryOffers(seed: string, day: number): Array<{ itemId: ItemId; price: number }> {
  const rng = createRng(`${seed}:ferry:${day}`);
  const pool = [...FERRY_GOODS];
  const out: Array<{ itemId: ItemId; price: number }> = [];
  while (out.length < FERRY_OFFERS_PER_NIGHT && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

export interface NightMarketSave {
  /** Elsie's note about the market has been delivered. */
  intro?: boolean;
  /** The night (game day) the ferryman's goods were bought on, and which of them. */
  day: number;
  bought: number[];
}

export function freshNightMarket(): NightMarketSave {
  return { day: 0, bought: [] };
}
