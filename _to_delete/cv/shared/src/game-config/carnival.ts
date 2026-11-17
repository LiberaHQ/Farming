import type { CharacterAppearance } from '../types/player';
import type { ItemId } from './items';

/**
 * The carnival: buy tokens with gold, spend them on games and rides, win
 * prize tickets, and trade tickets for prizes. Pure data and scoring, so the
 * rules live in one place (the scene, the panel and the docs all read them).
 */

/** Gold per carnival token at the ticket booth. */
export const TOKEN_PRICE = 25;

export type CarnivalGameId = 'ring_toss' | 'whack' | 'ducks' | 'strength' | 'memory';

export interface CarnivalGameDef {
  id: CarnivalGameId;
  name: string;
  icon: string;
  /** Tokens per play. */
  cost: number;
  /** One line for the booth and the docs. */
  blurb: string;
  /** How to play, shown before the game starts. */
  howTo: string;
  /** Best possible score, for the scoring text. */
  maxScore: number;
  /** Prize tickets for a final score. */
  tickets: (score: number) => number;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

export const CARNIVAL_GAMES: Record<CarnivalGameId, CarnivalGameDef> = {
  ring_toss: {
    id: 'ring_toss',
    name: 'Ring Toss',
    icon: '⭕',
    cost: 2,
    blurb: 'Land rings on the bottles. Three throws.',
    howTo: 'A marker swings across the bar. Press Space (or click) when it is on the green to land the ring. The green gets smaller each throw.',
    maxScore: 3,
    tickets: (s) => [0, 3, 7, 15][clamp(s, 0, 3)],
  },
  whack: {
    id: 'whack',
    name: 'Whack-a-Slime',
    icon: '🔨',
    cost: 2,
    blurb: 'Bop slimes as they pop up. 20 seconds.',
    howTo: 'Slimes pop out of the holes. Click them, or press the number keys 1–9 that match the holes. Golden slimes are worth 3.',
    maxScore: 40,
    tickets: (s) => clamp(s / 2.5, 0, 16),
  },
  ducks: {
    id: 'ducks',
    name: 'Duck Shoot',
    icon: '🦆',
    cost: 2,
    blurb: 'Pop the ducks floating past. Ten corks.',
    howTo: 'Ducks float along the lanes. Click a duck to fire a cork at it. You have ten corks; golden ducks are worth 3.',
    maxScore: 20,
    tickets: (s) => clamp(s * 0.8, 0, 16),
  },
  strength: {
    id: 'strength',
    name: 'High Striker',
    icon: '🔔',
    cost: 1,
    blurb: 'Swing the hammer and ring the bell.',
    howTo: 'The power meter sweeps up and down. Press Space (or click) at the very top to send the puck to the bell.',
    maxScore: 100,
    tickets: (s) => (s >= 96 ? 10 : s >= 80 ? 5 : s >= 55 ? 2 : s >= 30 ? 1 : 0),
  },
  memory: {
    id: 'memory',
    name: 'Memory Cards',
    icon: '🃏',
    cost: 2,
    blurb: 'Match the pairs before the clock runs out.',
    howTo: 'Flip two cards at a time to find matching pairs of valley things. Find all eight pairs in 45 seconds; the faster, the better.',
    maxScore: 8,
    tickets: (s) => [0, 1, 1, 2, 3, 4, 6, 8, 14][clamp(s, 0, 8)],
  },
};

export const CARNIVAL_GAME_IDS = Object.keys(CARNIVAL_GAMES) as CarnivalGameId[];

/** What the prize booth trades for tickets. */
export const CARNIVAL_PRIZES: Array<{ itemId: ItemId; tickets: number; quantity?: number }> = [
  { itemId: 'cotton_candy', tickets: 6 },
  { itemId: 'candy_apple', tickets: 10 },
  { itemId: 'carnival_token', tickets: 8, quantity: 3 },
  { itemId: 'balloons', tickets: 18 },
  { itemId: 'plush_bear', tickets: 30 },
  { itemId: 'golden_carp', tickets: 40 },
  { itemId: 'carnival_trophy', tickets: 75 },
];

/** The free daily spin on the Wheel of Fortune. */
export type WheelPrize = { label: string; itemId: ItemId; quantity: number } | { label: string; nothing: true };

export const WHEEL_SLICES: WheelPrize[] = [
  { label: '5 tickets', itemId: 'prize_ticket', quantity: 5 },
  { label: 'Cotton candy', itemId: 'cotton_candy', quantity: 1 },
  { label: '2 tokens', itemId: 'carnival_token', quantity: 2 },
  { label: 'So close!', nothing: true },
  { label: '10 tickets', itemId: 'prize_ticket', quantity: 10 },
  { label: 'Candy apple', itemId: 'candy_apple', quantity: 1 },
  { label: '3 tickets', itemId: 'prize_ticket', quantity: 3 },
  { label: 'JACKPOT 25', itemId: 'prize_ticket', quantity: 25 },
];

/** How likely each slice is (the jackpot is rare). */
export const WHEEL_WEIGHTS = [18, 14, 12, 14, 10, 10, 18, 4];

/** Pick a slice from a random number in [0, 1). */
export function spinWheel(roll: number): number {
  const total = WHEEL_WEIGHTS.reduce((a, b) => a + b, 0);
  let at = roll * total;
  for (let i = 0; i < WHEEL_WEIGHTS.length; i++) {
    at -= WHEEL_WEIGHTS[i];
    if (at < 0) return i;
  }
  return WHEEL_WEIGHTS.length - 1;
}

/** Rides: a token for a little treat. */
export const CARNIVAL_RIDES = {
  ferris: { name: 'Ferris Wheel', cost: 1, energy: 30, text: 'From the top you can see the whole valley — your farm, the river, the sea. You feel rested.' },
  carousel: { name: 'Carousel', cost: 1, buffMinutes: 120, text: 'Round and round on a painted horse. You hop off with a spring in your step.' },
} as const;

/** Pip, who runs the ticket booth and calls out to passers-by. */
export const CARNIVAL_BARKER: { name: string; title: string; look: CharacterAppearance } = {
  name: 'Pip',
  title: 'Carnival barker',
  look: {
    skin: '#e8b48a',
    skinShade: '#c8906a',
    hair: '#2b1d1a',
    hairLight: '#4a3328',
    shirt: '#d2404c',
    shirtDark: '#a02a34',
    pants: '#2b2b3a',
    pantsDark: '#1c1c28',
    shoes: '#2b1f1a',
  },
};

/** Gold prices at the treat cart. */
export const CARNIVAL_TREATS = { cotton_candy: 60, candy_apple: 90 } as const;
