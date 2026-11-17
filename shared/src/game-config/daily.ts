import type { ItemId } from './items';

/*
 * Daily goals: three small things to do each day, with a reward for each and a
 * bonus (and a streak) for finishing all three.
 */

export type DailyKind = 'harvest' | 'water' | 'fish' | 'wood' | 'stone' | 'fiber' | 'forage' | 'talk' | 'gift' | 'ship' | 'cook' | 'mine';
export const DAILY_KINDS: readonly DailyKind[] = ['harvest', 'water', 'fish', 'wood', 'stone', 'fiber', 'forage', 'talk', 'gift', 'ship', 'cook', 'mine'];

export interface DailyGoalSave {
  kind: DailyKind;
  need: number;
  have: number;
  /** Gold for finishing it (before the streak bonus). */
  gold: number;
  done: boolean;
}

export interface DailySave {
  /** The day these goals are for. */
  day: number;
  goals: DailyGoalSave[];
  /** Villagers already talked to today (each counts once). */
  talked: string[];
  /** Days in a row with every goal done, as of `lastFullDay`. */
  streak: number;
  best: number;
  /** Last day all three were finished (0 = never). */
  lastFullDay: number;
}

/** Words for each goal: `text(n)` reads like "Catch 2 fish". */
export const DAILY_TEXT: Record<DailyKind, { icon: string; text: (n: number) => string; hint: string }> = {
  harvest: { icon: '🥕', text: (n) => `Harvest ${n} crops`, hint: 'Pick ripe crops on your farm (or fruit from your trees).' },
  water: { icon: '💧', text: (n) => `Water ${n} crops`, hint: 'Use the watering can on dry soil with something growing.' },
  fish: { icon: '🎣', text: (n) => `Catch ${n} fish`, hint: 'Cast into a pond, the river or the sea.' },
  wood: { icon: '🪵', text: (n) => `Gather ${n} wood`, hint: 'Chop trees and stumps with your axe.' },
  stone: { icon: '🪨', text: (n) => `Gather ${n} stone`, hint: 'Break rocks with your pickaxe.' },
  fiber: { icon: '🌾', text: (n) => `Cut ${n} fiber`, hint: 'Clear tall grass (any tool, or bare hands).' },
  forage: { icon: '🍄', text: (n) => `Forage ${n} wild things`, hint: 'Berries, mushrooms, herbs, nuts and shells in the forest, on the farm and on the beach.' },
  talk: { icon: '💬', text: (n) => `Chat with ${n} villagers`, hint: 'Talk to anyone in the village (each counts once).' },
  gift: { icon: '🎁', text: () => 'Give someone a gift', hint: 'Hold an item and use it on a villager.' },
  ship: { icon: '📦', text: (n) => `Ship ${n}g of goods`, hint: 'Put things in the shipping bin by your cottage.' },
  cook: { icon: '🍳', text: () => 'Cook a dish', hint: 'Crafting (C) → Cooking.' },
  mine: { icon: '⛏', text: (n) => `Reach mine floor ${n}`, hint: 'Go down into the mine.' },
};

/** Wild things that count as foraging. */
export const FORAGE_ITEMS: readonly ItemId[] = [
  'berries',
  'mushroom',
  'morel',
  'wild_herb',
  'hazelnut',
  'winter_root',
  'salmonberry',
  'seashell',
  'coral',
] as const;

/** Streak milestones: what finishing every goal on that many days in a row brings. */
export const STREAK_REWARDS: Array<{ days: number; text: string; items: Array<{ itemId: ItemId; quantity: number }>; gold: number; lucky?: boolean }> = [
  { days: 3, text: 'Lucky for the rest of the day', items: [], gold: 300, lucky: true },
  { days: 7, text: '2 iron sprinklers', items: [{ itemId: 'iron_sprinkler', quantity: 2 }], gold: 500 },
  { days: 14, text: 'a gold sprinkler', items: [{ itemId: 'gold_sprinkler', quantity: 1 }], gold: 1000 },
  { days: 30, text: 'a golden spike', items: [{ itemId: 'golden_spike', quantity: 1 }], gold: 3000 },
];

/** Extra gold on each goal for a running streak: +10% a day, up to +50%. */
export function streakBonus(streak: number): number {
  return Math.min(5, Math.max(0, streak)) * 0.1;
}

/** Gold for finishing all three goals in a day. */
export const DAILY_FULL_BONUS = 100;
