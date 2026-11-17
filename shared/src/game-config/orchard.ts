import type { ItemId } from './items';
import type { Season } from './time';

/*
 * Crop quality and fruit trees.
 */

/** Item quality: 0 normal, 1 silver, 2 gold. Only crops and fruit have it. */
export type Quality = 0 | 1 | 2;

export const QUALITY_NAMES = ['', 'Silver', 'Gold'] as const;
/** Sale price and food energy multipliers per quality. */
export const QUALITY_MULTIPLIER = [1, 1.25, 1.5] as const;

/** A price (or energy) at a quality. */
export function withQuality(base: number, q: Quality | undefined): number {
  return Math.round(base * QUALITY_MULTIPLIER[q ?? 0]);
}

export function isQuality(v: unknown): v is 1 | 2 {
  return v === 1 || v === 2;
}

/**
 * Rolls a harvest's quality. Better with farming level (0–10), fertilized
 * soil, an older fruit tree, and luck.
 */
export function rollQuality(opts: { level: number; fed?: boolean; lucky?: boolean; ageBonus?: number }, random: () => number = Math.random): Quality {
  const gold = 0.02 + opts.level * 0.025 + (opts.fed ? 0.2 : 0) + (opts.lucky ? 0.05 : 0) + (opts.ageBonus ?? 0);
  const silver = 0.12 + opts.level * 0.03 + (opts.fed ? 0.15 : 0) + (opts.ageBonus ?? 0);
  const r = random();
  if (r < gold) return 2;
  if (r < gold + silver) return 1;
  return 0;
}

export type FruitTreeKind = 'apple' | 'cherry' | 'peach';

export interface FruitTreeDef {
  kind: FruitTreeKind;
  name: string;
  sapling: ItemId;
  fruit: ItemId;
  /** The season it bears fruit (one fruit a morning, up to 3 on the tree). */
  season: Season;
}

export const FRUIT_TREES: Record<FruitTreeKind, FruitTreeDef> = {
  cherry: { kind: 'cherry', name: 'Cherry Tree', sapling: 'cherry_sapling', fruit: 'cherry', season: 'spring' },
  peach: { kind: 'peach', name: 'Peach Tree', sapling: 'peach_sapling', fruit: 'peach', season: 'summer' },
  apple: { kind: 'apple', name: 'Apple Tree', sapling: 'apple_sapling', fruit: 'apple', season: 'fall' },
};

export const FRUIT_TREE_KINDS = Object.keys(FRUIT_TREES) as FruitTreeKind[];

export function isFruitTreeKind(v: unknown): v is FruitTreeKind {
  return typeof v === 'string' && (FRUIT_TREE_KINDS as string[]).includes(v);
}

export function fruitTreeForSapling(itemId: ItemId): FruitTreeDef | undefined {
  return FRUIT_TREE_KINDS.map((k) => FRUIT_TREES[k]).find((d) => d.sapling === itemId);
}

/** Days from planting until a fruit tree is fully grown (one season). */
export const FRUIT_TREE_GROW_DAYS = 10;
/** Most fruit a tree holds at once. */
export const FRUIT_TREE_MAX_FRUIT = 3;
/** Growth stage (0 sapling … 3 grown) after this many days. */
export function fruitTreeStage(ageDays: number): 0 | 1 | 2 | 3 {
  if (ageDays >= FRUIT_TREE_GROW_DAYS) return 3;
  if (ageDays >= 6) return 2;
  if (ageDays >= 3) return 1;
  return 0;
}

/** Older trees give better fruit: +4% gold per season after it's grown, up to +20%. */
export function fruitTreeAgeBonus(ageDays: number): number {
  return Math.min(0.2, Math.max(0, Math.floor((ageDays - FRUIT_TREE_GROW_DAYS) / 10)) * 0.04);
}
