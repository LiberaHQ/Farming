import { CROPS, type CropId } from './crops';
import { ITEMS, type ItemId } from './items';
import { QUALITY_MULTIPLIER } from './orchard';
import { TIME_CONFIG, dayOfSeason, seasonOfDay, type Season } from './time';
import type { Rng } from '../world/random';

/*
 * Train contracts: towns down the railway post orders at the freight depot
 * ("40 Pumpkins by Fall 8"). You load the goods over as many trips as you
 * like; the next train after the order is full carries it away, and the
 * payment comes back on the first train of a later day.
 */

export type TownId = 'millbrook' | 'port_wren' | 'ironhollow';

/** Something a town orders: how many (scaled by your progress) and, for seasonal goods, when. */
export interface FreightWant {
  itemId: ItemId;
  min: number;
  max: number;
  /** Crops: must be in season with enough days left to grow. */
  crop?: CropId;
  /** Other seasonal goods (fish that only bite in some seasons). */
  seasons?: readonly Season[];
}

export interface TownDef {
  id: TownId;
  name: string;
  emoji: string;
  /** Who signs the letters. */
  sender: string;
  blurb: string;
  wants: readonly FreightWant[];
}

const crop = (id: CropId, min: number, max: number): FreightWant => ({ itemId: CROPS[id].harvestItem, min, max, crop: id });

export const TOWNS: Record<TownId, TownDef> = {
  millbrook: {
    id: 'millbrook',
    name: 'Millbrook',
    emoji: '🌾',
    sender: 'Millbrook Grocers',
    blurb: 'A market town two stops east. Always short of fresh food.',
    wants: [
      crop('turnip', 10, 40),
      crop('carrot', 10, 40),
      crop('potato', 10, 40),
      crop('strawberry', 10, 35),
      crop('tomato', 10, 35),
      crop('corn', 10, 30),
      crop('wheat', 20, 80),
      crop('blueberry', 15, 50),
      crop('eggplant', 10, 30),
      crop('pumpkin', 5, 25),
      crop('snow_yam', 10, 30),
      { itemId: 'egg', min: 10, max: 40 },
      { itemId: 'milk', min: 5, max: 25 },
      { itemId: 'cheese', min: 3, max: 15 },
      { itemId: 'juice', min: 3, max: 12 },
      { itemId: 'pickles', min: 3, max: 12 },
      { itemId: 'berry_jam', min: 5, max: 20 },
    ],
  },
  port_wren: {
    id: 'port_wren',
    name: 'Port Wren',
    emoji: '⚓',
    sender: 'Port Wren Fish Market',
    blurb: 'A harbour at the end of the line. Their boats come home light.',
    wants: [
      { itemId: 'sunfish', min: 5, max: 25 },
      { itemId: 'trout', min: 4, max: 15, seasons: ['spring', 'fall'] },
      { itemId: 'catfish', min: 3, max: 12 },
      { itemId: 'icefish', min: 3, max: 12, seasons: ['winter'] },
      { itemId: 'tuna', min: 2, max: 8 },
      { itemId: 'crab', min: 2, max: 10 },
      { itemId: 'shrimp', min: 3, max: 15 },
      { itemId: 'seaweed', min: 10, max: 40 },
      { itemId: 'oyster', min: 3, max: 15 },
    ],
  },
  ironhollow: {
    id: 'ironhollow',
    name: 'Ironhollow',
    emoji: '⛏',
    sender: 'Ironhollow Works',
    blurb: 'A mining town up in the hills, building faster than it can quarry.',
    wants: [
      { itemId: 'wood', min: 50, max: 200 },
      { itemId: 'stone', min: 50, max: 200 },
      { itemId: 'fiber', min: 30, max: 120 },
      { itemId: 'hardwood', min: 10, max: 40 },
      { itemId: 'copper_ore', min: 20, max: 80 },
      { itemId: 'iron_ore', min: 10, max: 50 },
      { itemId: 'gold_ore', min: 5, max: 25 },
      { itemId: 'coal', min: 10, max: 40 },
      { itemId: 'charcoal', min: 5, max: 20 },
    ],
  },
};

export const TOWN_IDS = Object.keys(TOWNS) as TownId[];

export function isTownId(v: unknown): v is TownId {
  return typeof v === 'string' && v in TOWNS;
}

/** Orders open at the depot at once. */
export const FREIGHT_SLOTS = 3;
/** The first day orders are posted. */
export const FREIGHT_START_DAY = 2;
/** Orders pay this much over the shipping price… */
export const FREIGHT_PREMIUM = 1.6;
/** …plus this much per order already delivered to that town, up to the cap. */
export const FREIGHT_STANDING_STEP = 0.02;
export const FREIGHT_STANDING_MAX = 0.2;
/** Most orders a save can hold (open, waiting for a train, or waiting for payment). */
export const FREIGHT_MAX_CONTRACTS = 12;
/** Goods anyone can gather from the first day, so they can be ordered before you've held them. */
const ALWAYS_AVAILABLE: readonly ItemId[] = ['wood', 'stone', 'fiber'];

/** 'open' = loading; 'ready' = loaded, waiting for a train; 'shipped' = on its way, payment to come. */
export type FreightStatus = 'open' | 'ready' | 'shipped';
export const FREIGHT_STATUSES: readonly FreightStatus[] = ['open', 'ready', 'shipped'];

export interface FreightContract {
  id: number;
  town: TownId;
  itemId: ItemId;
  quantity: number;
  /** Day it was posted, and the last day goods can be loaded. */
  posted: number;
  due: number;
  /** Gold for the full order at plain quality. */
  reward: number;
  loaded: number;
  /** Extra shipping value of the silver and gold goods loaded (gold). */
  bonus: number;
  status: FreightStatus;
  /** When the order closed (full, or its date passed): the next train after this collects it. */
  readyDay?: number;
  readyMinute?: number;
  /** The train that collected it. */
  shippedDay?: number;
  shippedMinute?: number;
  /** What it pays when the money comes back. */
  pay?: number;
  /** A part-filled order that missed its date: paid at shipping prices. */
  partial?: boolean;
}

export interface FreightSave {
  /** Last day orders were checked and posted. */
  day: number;
  nextId: number;
  contracts: FreightContract[];
  /** Orders delivered in full, per town. */
  done: Partial<Record<TownId, number>>;
  /** The rail company's welcome letter has been sent. */
  intro?: boolean;
}

export function freshFreight(): FreightSave {
  return { day: 0, nextId: 1, contracts: [], done: {} };
}

/** The price multiplier a town pays, from how many orders you've delivered to it. */
export function freightPremium(delivered: number): number {
  return FREIGHT_PREMIUM + Math.min(FREIGHT_STANDING_MAX, Math.max(0, delivered) * FREIGHT_STANDING_STEP);
}

/** Shipping-bin price of one item (plain quality). */
export function freightUnitPrice(itemId: ItemId): number {
  return ITEMS[itemId].sellPrice ?? 0;
}

/** Extra value silver and gold goods are worth over plain ones (gold), as the shipping bin pays it. */
export function freightQualityBonus(itemId: ItemId, silver: number, gold: number): number {
  const unit = freightUnitPrice(itemId);
  return Math.round(unit * (silver * (QUALITY_MULTIPLIER[1] - 1) + gold * (QUALITY_MULTIPLIER[2] - 1)));
}

/** A full order: the promised reward, plus the quality bonus at the order's own premium. */
export function freightFullPay(c: Pick<FreightContract, 'itemId' | 'quantity' | 'reward' | 'bonus'>): number {
  const plain = freightUnitPrice(c.itemId) * c.quantity;
  const premium = plain > 0 ? c.reward / plain : FREIGHT_PREMIUM;
  return c.reward + Math.round(c.bonus * premium);
}

/** A part-filled order that missed its date: what was loaded, at shipping prices. */
export function freightPartialPay(c: Pick<FreightContract, 'itemId' | 'loaded' | 'bonus'>): number {
  return freightUnitPrice(c.itemId) * c.loaded + c.bonus;
}

/** The last day of the season `day` falls in. */
export function seasonEnd(day: number): number {
  return day + (TIME_CONFIG.daysPerSeason - dayOfSeason(day));
}

export interface FreightPostContext {
  day: number;
  lifetimeEarnings: number;
  /** The player has held this item before (or can buy its seeds now). */
  canGet: (itemId: ItemId) => boolean;
  /** Orders already on the board (no two for the same item at once). */
  open: readonly FreightContract[];
  /** Orders delivered so far, per town. */
  done: Partial<Record<TownId, number>>;
}

/** Whether a want can be met by a deadline posted today; returns its due day, or null. */
function dueFor(want: FreightWant, day: number, rng: Rng): number | null {
  const season = seasonOfDay(day);
  const last = seasonEnd(day);
  if (want.crop) {
    const def = CROPS[want.crop];
    if (!def.seasons.includes(season)) return null;
    // Planted today, it's ready `matureStage` mornings later; one spare day for watering slips.
    const need = def.matureStage + 1;
    const due = Math.min(last, day + need + rng.int(0, 2));
    return due - day >= need ? due : null;
  }
  if (want.seasons && !want.seasons.includes(season)) return null;
  const due = Math.min(last, day + rng.int(3, 5));
  return due - day >= 2 ? due : null;
}

/**
 * Picks a new order for today, or null if nothing fits (late in the season,
 * or nothing the player can get yet). Prefers towns without an open order.
 */
export function postFreightContract(rng: Rng, id: number, ctx: FreightPostContext): FreightContract | null {
  const openItems = new Set(ctx.open.filter((c) => c.status === 'open').map((c) => c.itemId));
  const busyTowns = new Set(ctx.open.filter((c) => c.status === 'open').map((c) => c.town));
  // Shuffle (seeded), then towns without an open order first (the sort is stable).
  const towns = [...TOWN_IDS];
  for (let i = towns.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [towns[i], towns[j]] = [towns[j], towns[i]];
  }
  towns.sort((a, b) => Number(busyTowns.has(a)) - Number(busyTowns.has(b)));
  // Bigger orders as the farm grows: from a quarter of the range to all of it by 20,000g earned.
  const tier = 0.25 + 0.75 * Math.min(1, Math.max(0, ctx.lifetimeEarnings) / 20_000);
  for (const town of towns) {
    const options = TOWNS[town].wants
      .filter((w) => !openItems.has(w.itemId) && freightUnitPrice(w.itemId) > 0 && (ALWAYS_AVAILABLE.includes(w.itemId) || ctx.canGet(w.itemId)))
      .map((w) => ({ w, due: dueFor(w, ctx.day, rng) }))
      .filter((o): o is { w: FreightWant; due: number } => o.due !== null);
    if (options.length === 0) continue;
    const { w, due } = rng.pick(options);
    const step = w.max - w.min >= 20 ? 5 : 1;
    const raw = w.min + (w.max - w.min) * tier * rng.range(0.6, 1);
    const quantity = Math.max(w.min, Math.min(w.max, Math.round(raw / step) * step));
    const plain = freightUnitPrice(w.itemId) * quantity;
    const reward = Math.max(5, Math.round((plain * freightPremium(ctx.done[town] ?? 0)) / 5) * 5);
    return { id, town, itemId: w.itemId, quantity, posted: ctx.day, due, reward, loaded: 0, bonus: 0, status: 'open' };
  }
  return null;
}
