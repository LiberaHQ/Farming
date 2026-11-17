/**
 * Rare creatures you can spot around the valley. Each one is logged in the
 * collection the first time you see it.
 */
export const WILDLIFE_IDS = ['fox', 'owl', 'dolphin', 'fireflies', 'turtle'] as const;
export type WildlifeId = (typeof WILDLIFE_IDS)[number];

export interface WildlifeDef {
  id: WildlifeId;
  name: string;
  emoji: string;
  /** Where and when to look (shown once spotted, as a hint before). */
  hint: string;
  description: string;
}

export const WILDLIFE: Record<WildlifeId, WildlifeDef> = {
  fox: { id: 'fox', name: 'Red Fox', emoji: '🦊', hint: 'The old forest, just after dawn (6–8am).', description: 'Trots along the forest trail at first light, and stops to look at you.' },
  owl: { id: 'owl', name: 'Barn Owl', emoji: '🦉', hint: 'The old forest at night (after 8pm).', description: 'Watches from an old oak, blinking slowly.' },
  dolphin: { id: 'dolphin', name: 'Dolphins', emoji: '🐬', hint: 'Out at sea from the beach, on a dry day (10am–5pm).', description: 'A little pod leaping through the waves beyond the pier.' },
  turtle: { id: 'turtle', name: 'Sea Turtle', emoji: '🐢', hint: 'The island beach in the morning (6–11am).', description: 'Hauls itself up the island sand to rest in the sun, then paddles back out.' },
  fireflies: { id: 'fireflies', name: 'Fireflies', emoji: '✨', hint: 'The carnival after dark (8pm on), on a dry night.', description: 'Drift around the fairground once the lights come on.' },
};

export const isWildlifeId = (v: unknown): v is WildlifeId => typeof v === 'string' && (WILDLIFE_IDS as readonly string[]).includes(v);

/** How far out the tide is, from 0 (high) to 1 (low): two tides a day, low around 9am and 9pm. */
export function tideLevel(minute: number): number {
  return 0.5 + 0.5 * Math.cos(((minute - 9 * 60) / (12 * 60)) * Math.PI * 2);
}
