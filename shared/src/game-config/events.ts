import type { NpcId } from './npcs';
import { dayOfSeason, seasonOfDay, type Season } from './time';
import { createRng } from '../world/random';

// ---------- Storms and rainbows ----------

/** Some rainy days are thunderstorms (never in winter): lightning, thunder, strikes on trees. */
export function isStormDay(seed: string, day: number, weather: string): boolean {
  if (weather !== 'rain' || seasonOfDay(day) === 'winter') return false;
  return createRng(`${seed}:storm:${day}`).next() < 0.45;
}

/** A rainbow shows the morning after a storm, if that morning is dry. */
export const RAINBOW_HOURS = { from: 6 * 60, to: 12 * 60 } as const;
/** Seeing it makes you Lucky for this long (game minutes). */
export const RAINBOW_LUCK_MINUTES = 8 * 60;

// ---------- The meteor shower ----------

/** One night each summer, shooting stars fill the sky; meteorites land on the farm by morning. */
export const METEOR_SHOWER = { season: 'summer' as Season, day: 7, from: 21 * 60, to: 26 * 60 } as const;

export function isMeteorNight(day: number): boolean {
  return seasonOfDay(day) === METEOR_SHOWER.season && dayOfSeason(day) === METEOR_SHOWER.day;
}

// ---------- Villager birthdays ----------

export const BIRTHDAYS: Record<NpcId, { season: Season; day: number }> = {
  mira: { season: 'spring', day: 4 },
  finn: { season: 'summer', day: 2 },
  tobin: { season: 'summer', day: 5 },
  rosa: { season: 'fall', day: 3 },
  willa: { season: 'fall', day: 10 },
  bram: { season: 'winter', day: 6 },
};

/** Gifts on a villager's birthday count this many times over. */
export const BIRTHDAY_GIFT_MULTIPLIER = 2;

export function birthdayOn(day: number): NpcId | undefined {
  const season = seasonOfDay(day);
  const d = dayOfSeason(day);
  return (Object.keys(BIRTHDAYS) as NpcId[]).find((id) => BIRTHDAYS[id].season === season && BIRTHDAYS[id].day === d);
}
