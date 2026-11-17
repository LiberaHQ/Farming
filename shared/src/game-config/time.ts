export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export type WeatherKind = 'sunny' | 'cloudy' | 'rain' | 'snow';

export const TIME_CONFIG = {
  /** Real milliseconds per in-game minute. A full day (06:00 → 02:00) lasts ~8 real minutes. */
  msPerGameMinute: 400,
  /** Minute of day the player wakes up (06:00). */
  dayStartMinute: 6 * 60,
  /** Minute of day the player passes out (02:00 next morning, counted past 24:00). */
  dayEndMinute: 26 * 60,
  daysPerSeason: 10,
} as const;

/** Chance of each weather per season (remaining probability = sunny). */
export const WEATHER_CHANCES: Record<Season, { rain: number; cloudy: number; snow: number }> = {
  spring: { rain: 0.25, cloudy: 0.2, snow: 0 },
  summer: { rain: 0.15, cloudy: 0.15, snow: 0 },
  fall: { rain: 0.3, cloudy: 0.25, snow: 0 },
  winter: { rain: 0, cloudy: 0.25, snow: 0.45 },
};

/** Day numbers start at 1. */
export function seasonOfDay(day: number): Season {
  return SEASONS[Math.floor((day - 1) / TIME_CONFIG.daysPerSeason) % SEASONS.length];
}

export function dayOfSeason(day: number): number {
  return ((day - 1) % TIME_CONFIG.daysPerSeason) + 1;
}

export function yearOfDay(day: number): number {
  return Math.floor((day - 1) / (TIME_CONFIG.daysPerSeason * SEASONS.length)) + 1;
}

/** "6:00 am" style clock text for a minute of day (may exceed 24h). */
export function formatClock(minuteOfDay: number): string {
  const total = Math.floor(minuteOfDay) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = Math.floor((total % 60) / 10) * 10;
  const suffix = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}
