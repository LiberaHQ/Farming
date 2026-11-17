import type { Season } from './time';
import { createRng } from '../world/random';

/*
 * A living ecosystem: deer wander in from the wild some nights and graze
 * crops they can reach, foxes creep up to the coop at dawn, and flower beds
 * draw pollinators that make nearby harvests better. Fences, scarecrows and
 * a dog keep the wildlife in check — nothing is ever lost for good.
 */

export const DEER = {
  /** Chance a deer comes onto the farm on a given night (spring to fall). */
  chance: 0.3,
  /** No deer before this day (time to settle in). */
  startDay: 5,
  /** Most crops one deer eats in a night. */
  maxEaten: 3,
} as const;

export const FOX = {
  /** Chance a fox comes to the coop at dawn. */
  chance: 0.25,
  startDay: 4,
  /** Most coop animals one fox spooks (they lay nothing that morning). */
  maxSpooked: 2,
} as const;

/** Scarecrows keep deer off crops within this many tiles. */
export const SCARECROW_RADIUS = 4;

/** Flower beds and pots draw pollinators to crops within these distances (tiles). */
export const POLLINATOR_RADIUS = { flower_bed: 3, flower_pot: 2 } as const;
/** Extra chance of a gold and of a silver harvest for pollinated crops. */
export const POLLINATION_BONUS = { gold: 0.08, silver: 0.1 } as const;

/** Does a deer come tonight? (The same answer for a world, a day and a season.) */
export function deerVisits(seed: string, day: number, season: Season): boolean {
  if (day < DEER.startDay || season === 'winter') return false;
  return createRng(`${seed}:deer:${day}`).next() < DEER.chance;
}

/** Does a fox come to the coop at dawn? */
export function foxVisits(seed: string, day: number): boolean {
  if (day < FOX.startDay) return false;
  return createRng(`${seed}:fox:${day}`).next() < FOX.chance;
}

/**
 * Which tiles wild animals can reach: everything connected to the edge of the
 * map without crossing a blocked tile (water, fences, buildings). A crop or a
 * coop inside a closed fence is out of reach. Returns 1 for reachable tiles.
 */
export function wildReach(width: number, height: number, blocked: (tx: number, ty: number) => boolean): Uint8Array {
  const seen = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (seen[i] || blocked(x, y)) return;
    seen[i] = 1;
    queue.push(i);
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % width;
    const y = (i - x) / width;
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }
  return seen;
}

const near = (tx: number, ty: number, p: { tx: number; ty: number }, radius: number) => Math.hypot(tx - p.tx, ty - p.ty) <= radius + 0.01;

/** Within reach of a scarecrow (deer won't come close). */
export function scaredOff(tx: number, ty: number, scarecrows: ReadonlyArray<{ tx: number; ty: number }>): boolean {
  return scarecrows.some((s) => near(tx, ty, s, SCARECROW_RADIUS));
}

/** Within reach of a flower bed or pot's pollinators. */
export function pollinatedBy(tx: number, ty: number, flowers: ReadonlyArray<{ tx: number; ty: number; kind: keyof typeof POLLINATOR_RADIUS }>): boolean {
  return flowers.some((f) => near(tx, ty, f, POLLINATOR_RADIUS[f.kind]));
}

/**
 * Picks the crops a deer eats: up to `maxEaten` of the plots it can reach,
 * ripe ones first, in an order fixed by the world and the day.
 */
export function deerMeal<T extends { tx: number; ty: number; ripe: boolean }>(seed: string, day: number, candidates: readonly T[]): T[] {
  const rng = createRng(`${seed}:deer-meal:${day}`);
  const count = rng.int(1, DEER.maxEaten);
  const shuffled = [...candidates].sort((a, b) => a.ty - b.ty || a.tx - b.tx);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.sort((a, b) => Number(b.ripe) - Number(a.ripe));
  return shuffled.slice(0, count);
}

/** Picks the coop animals a fox spooks (indices into the list given). */
export function foxScare(seed: string, day: number, exposed: readonly number[]): number[] {
  const rng = createRng(`${seed}:fox-scare:${day}`);
  const pool = [...exposed];
  const out: number[] = [];
  const count = Math.min(pool.length, rng.int(1, FOX.maxSpooked));
  while (out.length < count) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out.sort((a, b) => a - b);
}
