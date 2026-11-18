import type { ItemId } from './items';
import type { NpcId } from './npcs';
import type { Season, WeatherKind } from './time';
import { hashSeed } from '../world/random';
import { mineScale, mineZone } from './mineZones';

/** Fish you can catch, and when. Weights are relative chances among the fish that are biting. */
export interface FishDef {
  itemId: ItemId;
  weight: number;
  seasons?: Season[];
  /** Only between these minutes of day (wraps past midnight if from > to). */
  hours?: { from: number; to: number };
  weather?: WeatherKind[];
  /** Where it lives (default: ponds and the river). */
  water?: 'fresh' | 'ocean' | 'island';
  /** 1 (lazy) to 5 (wild): how hard it fights in the reeling minigame. */
  difficulty?: number;
}

export const FISH: FishDef[] = [
  { itemId: 'sunfish', weight: 60, difficulty: 1 },
  { itemId: 'trout', weight: 30, seasons: ['spring', 'fall'], difficulty: 2 },
  { itemId: 'catfish', weight: 25, hours: { from: 19 * 60, to: 26 * 60 }, difficulty: 3 },
  { itemId: 'catfish', weight: 25, weather: ['rain'], difficulty: 3 },
  { itemId: 'golden_carp', weight: 3, difficulty: 5 },
  // Ice fishing: in winter the ponds freeze over and you fish through a hole.
  { itemId: 'icefish', weight: 55, seasons: ['winter'], difficulty: 2 },
  { itemId: 'glacierfish', weight: 4, seasons: ['winter'], difficulty: 5 },
  { itemId: 'sunfish', weight: 30, water: 'ocean', difficulty: 1 },
  { itemId: 'tuna', weight: 40, water: 'ocean', difficulty: 4 },
  { itemId: 'pufferfish', weight: 20, water: 'ocean', hours: { from: 12 * 60, to: 17 * 60 }, weather: ['sunny'], difficulty: 4 },
  { itemId: 'tuna', weight: 25, water: 'island', difficulty: 4 },
  { itemId: 'parrotfish', weight: 45, water: 'island', hours: { from: 6 * 60, to: 19 * 60 }, difficulty: 3 },
  { itemId: 'lionfish', weight: 35, water: 'island', hours: { from: 18 * 60, to: 26 * 60 }, difficulty: 4 },
  { itemId: 'swordfish', weight: 6, water: 'island', difficulty: 5 },
];

export const FISHING = {
  energyCost: 3,
  /** Wait for a bite, in real milliseconds. */
  biteDelay: [1400, 5200] as const,
  /** How long the "!" lasts — press Use within this window. */
  reactionWindow: 900,
  /** Chance a bite is junk (no fight). */
  trashChance: 0.12,
  trash: ['driftwood', 'old_boot', 'seaweed'] as readonly ItemId[],
} as const;

/** Daily requests on the village notice board. */
export interface RequestDef {
  npc: NpcId;
  itemId: ItemId;
  quantity: number;
  reward: number;
  seasons?: Season[];
  text: string;
}

export const REQUESTS: RequestDef[] = [
  { npc: 'rosa', itemId: 'egg', quantity: 3, reward: 150, text: 'I need eggs for a big batch of cakes!' },
  { npc: 'rosa', itemId: 'berries', quantity: 8, reward: 110, text: 'Berries for jam, please!' },
  { npc: 'rosa', itemId: 'pumpkin', quantity: 1, reward: 260, seasons: ['summer', 'fall'], text: 'One perfect pumpkin for a pie contest.' },
  { npc: 'bram', itemId: 'copper_ore', quantity: 5, reward: 110, text: 'Running low on copper. Bring ore!' },
  { npc: 'bram', itemId: 'stone', quantity: 15, reward: 80, text: 'Need stone to rebuild the forge wall.' },
  { npc: 'finn', itemId: 'sunfish', quantity: 3, reward: 110, text: 'Caught nothing all week. Spare a few sunfish?' },
  { npc: 'finn', itemId: 'trout', quantity: 1, reward: 120, seasons: ['spring', 'fall'], text: 'Looking for a nice trout for supper.' },
  { npc: 'willa', itemId: 'wood', quantity: 20, reward: 120, text: 'Big order of furniture — I need timber!' },
  { npc: 'willa', itemId: 'fiber', quantity: 10, reward: 70, text: 'Fiber for rope, please.' },
  { npc: 'mira', itemId: 'turnip', quantity: 4, reward: 160, seasons: ['spring', 'fall'], text: 'Customers keep asking for turnips!' },
  { npc: 'mira', itemId: 'carrot', quantity: 3, reward: 200, seasons: ['spring', 'summer', 'fall'], text: 'Carrots, carrots, carrots!' },
  { npc: 'tobin', itemId: 'veggie_soup', quantity: 1, reward: 180, text: 'A bowl of veggie soup would warm these old bones.' },
  { npc: 'tobin', itemId: 'bread', quantity: 2, reward: 90, text: "My oven's broken. Could you bring me bread?" },
];

/** Requests posted per day. */
export const REQUESTS_PER_DAY = 2;
/** Friendship gained with the requester when a request is completed. */
export const REQUEST_FRIENDSHIP = 40;

/** Kinds of rock in the mine. */
export type MineRockKind = 'stone' | 'copper' | 'iron' | 'gold' | 'gem';

export interface MineRockDef {
  hp: number;
  drops: Array<{ itemId: ItemId; min: number; max: number; chance?: number }>;
}

/** The mine: floors, what's in the rock at each depth, and the slimes that live there. */
export const MINE = {
  floors: 30,
  /** The elevator stops every this many floors (once you've reached them). */
  elevatorEvery: 5,
  maxHealth: 100,
  /** Floor size in tiles. */
  width: 30,
  height: 22,
  rocks: {
    stone: { hp: 2, drops: [{ itemId: 'stone', min: 1, max: 2 }] },
    copper: { hp: 3, drops: [{ itemId: 'copper_ore', min: 1, max: 3 }] },
    iron: { hp: 5, drops: [{ itemId: 'iron_ore', min: 1, max: 2 }] },
    gold: { hp: 7, drops: [{ itemId: 'gold_ore', min: 1, max: 2 }] },
    gem: { hp: 5, drops: [{ itemId: 'amethyst', min: 1, max: 1 }, { itemId: 'stone', min: 1, max: 1 }] },
  } satisfies Record<MineRockKind, MineRockDef>,
  /** Chance of a broken rock revealing the ladder down (one rock per floor always hides it). */
  ladderChance: 0.04,
  /** Health lost when a slime catches you, and the gold you drop if you faint. */
  faintGoldLoss: 0.1,
  faintGoldLossMax: 250,
} as const;

/** Relative chances of each rock kind on a floor. Deeper floors hold rarer ore. */
export function mineRockWeights(floor: number): Record<MineRockKind, number> {
  return {
    stone: 60,
    copper: floor < 15 ? 22 : 10,
    iron: floor >= 5 ? Math.min(22, 6 + floor) : 0,
    gold: floor >= 12 ? Math.min(16, floor - 8) : 0,
    gem: floor >= 3 ? 3 + Math.floor(floor / 6) : 0,
  };
}

/** A floor's slimes: how many, how tough, how hard they hit. */
export function slimeStats(floor: number): { count: number; hp: number; damage: number; speed: number } {
  return {
    count: Math.min(9, 2 + Math.floor(floor / 3)),
    hp: Math.round(3 + floor * 0.7),
    damage: Math.round(6 + floor * 0.6),
    speed: Math.min(52, 24 + floor),
  };
}

// ---------- Mine monsters ----------

export type MonsterKind = 'slime' | 'bat' | 'crab' | 'ghost' | 'spitter' | 'burrower' | 'beetle' | 'eel' | 'fusecap' | 'thief' | 'mimic' | 'imp';

export interface MonsterDef {
  kind: MonsterKind;
  name: string;
  minFloor: number;
  /** Flies over rocks (and walls, for ghosts). */
  flies?: 'rocks' | 'walls';
  /** Its trick, and how to beat it (shown in the handbook). */
  blurb: string;
  hp: (floor: number) => number;
  damage: (floor: number) => number;
  speed: (floor: number) => number;
  drops: ReadonlyArray<{ itemId: ItemId; chance: number }>;
}

export const MONSTERS: Record<MonsterKind, MonsterDef> = {
  slime: {
    kind: 'slime',
    name: 'Slime',
    minFloor: 1,
    blurb: 'Hops after you when you get close.',
    hp: (f) => Math.round(3 + f * 0.7),
    damage: (f) => Math.round(6 + f * 0.6),
    speed: (f) => Math.min(52, 24 + f),
    drops: [{ itemId: 'slime', chance: 0.65 }],
  },
  spitter: {
    kind: 'spitter',
    name: 'Spitter Slime',
    minFloor: 2,
    blurb: 'Keeps its distance and spits goo that slows you. It swells up before it spits, and can’t spit at point-blank range.',
    hp: (f) => Math.round(3 + f * 0.6),
    damage: (f) => Math.round(4 + f * 0.4),
    speed: (f) => Math.min(44, 22 + f),
    drops: [{ itemId: 'slime', chance: 0.8 }],
  },
  bat: {
    kind: 'bat',
    name: 'Cave Bat',
    minFloor: 6,
    flies: 'rocks',
    blurb: 'Swoops at you erratically over the rocks.',
    hp: (f) => Math.round(2 + f * 0.4),
    damage: (f) => Math.round(5 + f * 0.5),
    speed: (f) => Math.min(70, 40 + f),
    drops: [{ itemId: 'bat_wing', chance: 0.6 }],
  },
  burrower: {
    kind: 'burrower',
    name: 'Burrower',
    minFloor: 7,
    blurb: 'Tunnels under the floor as a moving mound and pops up beside you. Watch the mound shake, then hit it as it surfaces.',
    hp: (f) => Math.round(5 + f * 0.6),
    damage: (f) => Math.round(7 + f * 0.5),
    speed: (f) => Math.min(60, 34 + f),
    drops: [
      { itemId: 'stone', chance: 0.6 },
      { itemId: 'clay_pot', chance: 0.06 },
    ],
  },
  crab: {
    kind: 'crab',
    name: 'Rock Crab',
    minFloor: 11,
    blurb: 'A tough rock on legs that scuttles after you.',
    hp: (f) => Math.round(10 + f * 1.1),
    damage: (f) => Math.round(9 + f * 0.6),
    speed: (f) => Math.min(34, 18 + f * 0.5),
    drops: [
      { itemId: 'iron_ore', chance: 0.5 },
      { itemId: 'stone', chance: 0.6 },
    ],
  },
  beetle: {
    kind: 'beetle',
    name: 'Crystal Beetle',
    minFloor: 11,
    blurb: 'Its crystal shell blocks hits from the front. Get round to its side or back.',
    hp: (f) => Math.round(8 + f * 0.9),
    damage: (f) => Math.round(8 + f * 0.6),
    speed: (f) => Math.min(30, 16 + f * 0.5),
    drops: [
      { itemId: 'amethyst', chance: 0.25 },
      { itemId: 'iron_ore', chance: 0.4 },
    ],
  },
  eel: {
    kind: 'eel',
    name: 'Cave Eel',
    minFloor: 16,
    blurb: 'Hides in pools and lunges at anyone on the edge. Ripples give it away; hit it mid-lunge.',
    hp: (f) => Math.round(9 + f * 0.7),
    damage: (f) => Math.round(11 + f * 0.6),
    speed: () => 0,
    drops: [
      { itemId: 'seaweed', chance: 0.5 },
      { itemId: 'pearl', chance: 0.05 },
    ],
  },
  fusecap: {
    kind: 'fusecap',
    name: 'Fuse Cap',
    minFloor: 16,
    blurb: 'A mushroom that explodes two seconds after it’s hit, hurting everything nearby, rocks included. Hit it and step back, or use it to blast through rock.',
    hp: () => 1,
    damage: (f) => Math.round(16 + f * 0.6),
    speed: () => 0,
    drops: [{ itemId: 'coal', chance: 0.5 }],
  },
  ghost: {
    kind: 'ghost',
    name: 'Ghost',
    minFloor: 21,
    flies: 'walls',
    blurb: 'Drifts straight through walls towards you.',
    hp: (f) => Math.round(8 + f * 0.8),
    damage: (f) => Math.round(12 + f * 0.6),
    speed: (f) => Math.min(40, 20 + f * 0.6),
    drops: [
      { itemId: 'ectoplasm', chance: 0.5 },
      { itemId: 'amethyst', chance: 0.12 },
    ],
  },
  thief: {
    kind: 'thief',
    name: 'Lantern Thief',
    minFloor: 21,
    blurb: 'Steals your lantern light and runs off giggling. Follow the glow it carries and catch it to get your light back.',
    hp: (f) => Math.round(4 + f * 0.4),
    damage: () => 0,
    speed: (f) => Math.min(58, 36 + f * 0.6),
    drops: [
      { itemId: 'amethyst', chance: 0.3 },
      { itemId: 'ruby', chance: 0.08 },
    ],
  },
  mimic: {
    kind: 'mimic',
    name: 'Mimic',
    minFloor: 21,
    blurb: 'Looks just like a treasure chest and bites when opened. A real chest never breathes: watch for the lid twitching. Drops extra treasure.',
    hp: (f) => Math.round(14 + f * 1.0),
    damage: (f) => Math.round(14 + f * 0.6),
    speed: (f) => Math.min(48, 26 + f * 0.5),
    drops: [],
  },
  imp: {
    kind: 'imp',
    name: 'Magma Imp',
    minFloor: 26,
    blurb: 'Throws fireballs that leave the floor burning for a few seconds. It glows before each throw; dodge sideways and close in.',
    hp: (f) => Math.round(9 + f * 0.7),
    damage: (f) => Math.round(10 + f * 0.6),
    speed: (f) => Math.min(46, 24 + f * 0.5),
    drops: [
      { itemId: 'coal', chance: 0.6 },
      { itemId: 'ruby', chance: 0.1 },
    ],
  },
};

/** Which monsters roam a floor, and how many (the zone decides the mix). */
export function floorMonsters(floor: number): { count: number; kinds: MonsterKind[] } {
  const scale = mineScale(floor);
  return { count: Math.min(14, 2 + Math.floor(Math.min(floor, 36) / 3) + (scale > 1 ? 1 : 0)), kinds: [...mineZone(floor).monsters] };
}

/** Bosses: the big three on floors 10, 20 and 30, mini-bosses on 5, 15 and 25, and a random one every 5th Abyss floor. */
export type BossId = 'matron' | 'king' | 'queen' | 'golem' | 'wraith' | 'shade';

export interface BossDef {
  id: BossId;
  floor: number;
  name: string;
  base: MonsterKind;
  scale: number;
  hp: number;
  damage: number;
  speed: number;
  tint: number;
  /** A mini-boss (floors 5, 15, 25): a smaller fight, a smaller prize. */
  mini?: boolean;
  /** What changes at half health (shown in the handbook). */
  phase: string;
}

export const BOSSES: readonly BossDef[] = [
  { id: 'matron', floor: 5, name: 'Slime Matron', base: 'slime', scale: 2.4, hp: 34, damage: 9, speed: 26, tint: 0x9ae07a, mini: true, phase: 'Calls four slimelings to her side.' },
  { id: 'king', floor: 10, name: 'King Slime', base: 'slime', scale: 3, hp: 60, damage: 14, speed: 30, tint: 0x6ab8f0, phase: 'Leaps into the air and lands with a shockwave: move away when its shadow grows.' },
  { id: 'queen', floor: 15, name: 'Crystal Queen', base: 'beetle', scale: 2.4, hp: 90, damage: 17, speed: 20, tint: 0xd8a0ff, mini: true, phase: 'Crystals shield her: break them first. At half health they grow back.' },
  { id: 'golem', floor: 20, name: 'Stone Golem', base: 'crab', scale: 2.6, hp: 140, damage: 22, speed: 22, tint: 0xb0a090, phase: 'Throws boulders, then curls into armour: only its glowing back takes damage.' },
  { id: 'wraith', floor: 25, name: 'Lantern Wraith', base: 'ghost', scale: 2.2, hp: 150, damage: 22, speed: 30, tint: 0x6a5aa0, mini: true, phase: 'Snuffs out your light every few seconds; follow its glowing eyes.' },
  { id: 'shade', floor: 30, name: 'The Shade', base: 'ghost', scale: 2.6, hp: 220, damage: 28, speed: 32, tint: 0xc07ae0, phase: 'Vanishes and reappears elsewhere, then starts calling ghosts.' },
];

/** The boss on a floor, if any (deep in the Abyss they're tougher). */
export function bossOf(floor: number): BossDef | undefined {
  const fixed = BOSSES.find((b) => b.floor === floor);
  if (fixed) return fixed;
  if (floor <= MINE.floors || floor % 5 !== 0) return undefined;
  const base = BOSSES[hashSeed(`abyss-boss:${floor}`) % BOSSES.length];
  const s = mineScale(floor);
  return { ...base, floor, mini: floor % 10 !== 0, hp: Math.round(Math.max(base.hp, 150) * s), damage: Math.round(Math.max(base.damage, 24) * s) };
}

/** What a treasure chest can hold (deeper = better). */
export function treasureTable(floor: number): ReadonlyArray<{ itemId: ItemId; quantity: number; weight: number }> {
  const table: Array<{ itemId: ItemId; quantity: number; weight: number }> = [
    { itemId: 'copper_ore', quantity: 8, weight: floor < 10 ? 30 : 5 },
    { itemId: 'iron_ore', quantity: 6, weight: floor >= 5 ? 25 : 0 },
    { itemId: 'gold_ore', quantity: 4, weight: floor >= 15 ? 20 : 0 },
    { itemId: 'amethyst', quantity: 2, weight: floor >= 10 ? 15 : 3 },
    { itemId: 'leather_armor', quantity: 1, weight: floor >= 3 && floor < 20 ? 10 : 2 },
    { itemId: 'iron_armor', quantity: 1, weight: floor >= 15 ? 8 : 0 },
    { itemId: 'power_ring', quantity: 1, weight: floor >= 8 ? 8 : 0 },
    { itemId: 'guard_ring', quantity: 1, weight: floor >= 8 ? 8 : 0 },
    { itemId: 'lucky_ring', quantity: 1, weight: floor >= 18 ? 5 : 0 },
  ];
  return table.filter((t) => t.weight > 0);
}

// ---------- Foraging ----------

/** Wild things that grow by season, in the forest and around the farm. */
export const FORAGE: Record<Season, ItemId[]> = {
  spring: ['wild_herb', 'morel', 'salmonberry', 'wild_herb'],
  summer: ['wild_herb', 'salmonberry', 'mushroom', 'salmonberry'],
  fall: ['mushroom', 'hazelnut', 'wild_herb', 'mushroom'],
  winter: ['winter_root', 'mushroom', 'winter_root'],
};
