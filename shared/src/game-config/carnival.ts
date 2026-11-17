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

// ---------- People ----------

const look = (skin: string, hair: string, shirt: string, pants: string): CharacterAppearance => ({
  skin,
  skinShade: shade(skin),
  hair,
  hairLight: lighten(hair),
  shirt,
  shirtDark: shade(shirt),
  pants,
  pantsDark: shade(pants),
  shoes: '#2b1f1a',
});

function mix(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const shade = (hex: string) => mix(hex, -0.22);
const lighten = (hex: string) => mix(hex, 0.25);

export type CarnivalStaffId = 'pip' | 'dot' | 'gus' | 'zara' | 'jojo' | 'host_ring' | 'host_whack' | 'host_ducks' | 'host_memory' | 'host_strength';

export interface CarnivalStaffDef {
  id: CarnivalStaffId;
  name: string;
  title: string;
  look: CharacterAppearance;
  /** What they say when you talk to them (cycled). */
  lines: string[];
  /** What they call out now and then (speech bubbles). */
  calls: string[];
}

export const CARNIVAL_STAFF: Record<CarnivalStaffId, CarnivalStaffDef> = {
  pip: {
    id: 'pip',
    name: 'Pip',
    title: 'Carnival barker',
    look: CARNIVAL_BARKER.look,
    lines: [
      'Step right up, step right up! Tokens are 25 gold apiece, and every game pays out in prize tickets!',
      'Play all five games in one day and the carnival card pays a bonus. Check the board by the arch!',
      "Golden hour is six to nine in the evening: every ticket counts double. Don't miss it!",
      'Ring the bell on the High Striker and the whole valley hears it. Not many manage it, mind.',
      'Save your tickets for the grand prize: the Carnival Trophy. Shines like the sun on a mantelpiece.',
    ],
    calls: ['Step right up!', 'Tokens here!', 'Win a prize!', 'Fun for all!'],
  },
  dot: {
    id: 'dot',
    name: 'Dot',
    title: 'Prize keeper',
    look: look('#f2c39c', '#e8812f', '#8a5aa8', '#3a3a5a'),
    lines: [
      "Every prize on this shelf was hand-picked. Well, the trophy was hand-polished. Twice.",
      'The plush bears are the most popular. Something about those little ribbons.',
      'A golden carp from the carnival? Finn will be ever so jealous.',
    ],
    calls: ['Prizes!', 'Shiny trophy!', 'Cuddly bears!'],
  },
  gus: {
    id: 'gus',
    name: 'Gus',
    title: 'Treat seller',
    look: look('#c98e68', '#2d2433', '#f6efe0', '#d2404c'),
    lines: [
      "Cotton candy, spun fresh! It'll put a spring in your step, I promise.",
      'Candy apples are lucky. Say what you like, my granny swore by them.',
      "I tried a candy apple on the Ferris wheel once. Dropped it from the top. Don't do that.",
    ],
    calls: ['Cotton candy!', 'Candy apples!', 'Sweet treats!'],
  },
  zara: {
    id: 'zara',
    name: 'Madame Zara',
    title: 'Fortune teller',
    look: look('#a8704f', '#5a2a6a', '#5a2a6a', '#2b1d22'),
    lines: ['The crystal ball speaks once a day. Come back tomorrow, dear.', 'The stars remember every farmer who passes through.'],
    calls: ['Your future awaits…', 'The stars are restless…', 'Cross my palm…'],
  },
  jojo: {
    id: 'jojo',
    name: 'Jojo',
    title: 'Juggler',
    look: look('#f2c39c', '#d2404c', '#f4d24a', '#3a83b5'),
    lines: [
      "Five balls! Well, three. The other two are in the river. Long story.",
      "A tip for the juggler? It's good luck, you know. Everybody knows that.",
      'I practise on turnips at home. Mira says it bruises them.',
    ],
    calls: ['Ta-daa!', 'Watch this!', 'Hup! Hup!', 'Applause please!'],
  },
  host_ring: {
    id: 'host_ring',
    name: 'Rory',
    title: 'Ring Toss host',
    look: look('#e8b48a', '#8a5a32', '#d2404c', '#2b2b3a'),
    lines: [],
    calls: ['Three rings, three chances!', 'Ring a bottle!', 'Steady hands!'],
  },
  host_whack: {
    id: 'host_whack',
    name: 'Moss',
    title: 'Whack-a-Slime host',
    look: look('#c98e68', '#3f8c3c', '#3f8c3c', '#6b4a3a'),
    lines: [],
    calls: ['Bop those slimes!', 'Golden ones are worth three!', 'Quick quick quick!'],
  },
  host_ducks: {
    id: 'host_ducks',
    name: 'Wren',
    title: 'Duck Shoot host',
    look: look('#f2c39c', '#f4d24a', '#3a83b5', '#2b2b3a'),
    lines: [],
    calls: ['Pop a duck!', 'Ten corks!', 'Aim for gold!'],
  },
  host_memory: {
    id: 'host_memory',
    name: 'Sage',
    title: 'Memory Cards host',
    look: look('#a8704f', '#2b1d1a', '#8a5aa8', '#2b2b3a'),
    lines: [],
    calls: ['Test your memory!', 'Eight pairs!', 'Match them all!'],
  },
  host_strength: {
    id: 'host_strength',
    name: 'Brutus',
    title: 'High Striker host',
    look: look('#c98e68', '#6b4a3a', '#f6efe0', '#3a3a5a'),
    lines: [],
    calls: ['Ring the bell!', 'Who’s the strongest?', 'Swing hard!'],
  },
};

/** Looks for the folk who come to enjoy the carnival (shuffled by seed). */
export const CARNIVAL_VISITOR_LOOKS: CharacterAppearance[] = [
  look('#f2c39c', '#e8c47a', '#ea7194', '#3a3a5a'),
  look('#c98e68', '#2b1d1a', '#5aac46', '#6b4a3a'),
  look('#a8704f', '#2d2433', '#e8812f', '#2b2b3a'),
  look('#e8b48a', '#b8492e', '#58a4d2', '#3a3a5a'),
  look('#f2c39c', '#6b4a3a', '#f4d24a', '#3f8c3c'),
  look('#8a5a3a', '#2b1d1a', '#d2404c', '#2b2b3a'),
  look('#e8b48a', '#c8ccd2', '#8a5aa8', '#6b4a3a'),
  look('#c98e68', '#e8812f', '#2f9a8a', '#3a3a5a'),
];

export const VISITOR_CALLS = [
  'Wheee!',
  'I won a bear!',
  'One more go!',
  'Look at the wheel!',
  'Cotton candy!',
  'So much fun!',
  'Did you see that?',
  'Again! Again!',
  'Best day ever!',
  "I'm dizzy!",
];

// ---------- Daily extras ----------

/** Play every game once in a day and the carnival card pays this many tickets. */
export const CARD_BONUS = 15;

/** Golden hour: every ticket from games counts double. Minutes of the day. */
export const GOLDEN_HOUR = { from: 18 * 60, to: 21 * 60, multiplier: 2 };

export const isGoldenHour = (minute: number) => minute >= GOLDEN_HOUR.from && minute < GOLDEN_HOUR.to;

/** Fireworks light up the sky after dark. */
export const FIREWORKS_FROM = 19 * 60 + 30;

/** Today's challenge: one game, a score to beat, and the bonus for beating it. */
export function dailyChallenge(day: number): { game: CarnivalGameId; target: number; tickets: number } {
  const order: CarnivalGameId[] = ['whack', 'ring_toss', 'ducks', 'memory', 'strength'];
  const game = order[(day * 7 + 3) % order.length];
  const target = { ring_toss: 2, whack: 22, ducks: 10, memory: 6, strength: 80 }[game];
  return { game, target, tickets: 12 };
}

/** Madame Zara's fortunes: a line and the little blessing that comes with it. */
export const FORTUNES: Array<{ text: string; buff: 'speed' | 'luck' | 'fishing' | 'mining'; minutes: number }> = [
  { text: 'I see… a great harvest. The soil will be generous with you today.', buff: 'luck', minutes: 360 },
  { text: 'The river whispers your name. Cast your line, the fish are waiting.', buff: 'fishing', minutes: 360 },
  { text: 'Deep under the hills, stone is softer than it looks today.', buff: 'mining', minutes: 360 },
  { text: 'Swift feet carry good news. Go quickly, and go far.', buff: 'speed', minutes: 360 },
  { text: 'A four-leafed day. Luck walks beside you, so take a chance.', buff: 'luck', minutes: 480 },
];

/** Jojo's tip jar: once a day, a small tip brings luck. */
export const JUGGLER_TIP = 10;
