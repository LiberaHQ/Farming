import type { ItemId } from './items';
import type { NpcId } from './npcs';
import type { Season, WeatherKind } from './time';

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

export type MonsterKind = 'slime' | 'bat' | 'crab' | 'ghost';

export interface MonsterDef {
  kind: MonsterKind;
  name: string;
  minFloor: number;
  /** Flies over rocks (and walls, for ghosts). */
  flies?: 'rocks' | 'walls';
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
    hp: (f) => Math.round(3 + f * 0.7),
    damage: (f) => Math.round(6 + f * 0.6),
    speed: (f) => Math.min(52, 24 + f),
    drops: [{ itemId: 'slime', chance: 0.65 }],
  },
  bat: {
    kind: 'bat',
    name: 'Cave Bat',
    minFloor: 6,
    flies: 'rocks',
    hp: (f) => Math.round(2 + f * 0.4),
    damage: (f) => Math.round(5 + f * 0.5),
    speed: (f) => Math.min(70, 40 + f),
    drops: [{ itemId: 'bat_wing', chance: 0.6 }],
  },
  crab: {
    kind: 'crab',
    name: 'Rock Crab',
    minFloor: 11,
    hp: (f) => Math.round(10 + f * 1.1),
    damage: (f) => Math.round(9 + f * 0.6),
    speed: (f) => Math.min(34, 18 + f * 0.5),
    drops: [
      { itemId: 'iron_ore', chance: 0.5 },
      { itemId: 'stone', chance: 0.6 },
    ],
  },
  ghost: {
    kind: 'ghost',
    name: 'Ghost',
    minFloor: 21,
    flies: 'walls',
    hp: (f) => Math.round(8 + f * 0.8),
    damage: (f) => Math.round(12 + f * 0.6),
    speed: (f) => Math.min(40, 20 + f * 0.6),
    drops: [
      { itemId: 'ectoplasm', chance: 0.5 },
      { itemId: 'amethyst', chance: 0.12 },
    ],
  },
};

/** Which monsters roam a floor, and how many. */
export function floorMonsters(floor: number): { count: number; kinds: MonsterKind[] } {
  const kinds = (Object.keys(MONSTERS) as MonsterKind[]).filter((k) => floor >= MONSTERS[k].minFloor);
  return { count: Math.min(10, 2 + Math.floor(floor / 3)), kinds };
}

/** A boss guards every tenth floor; the way down opens when it falls. */
export interface BossDef {
  floor: number;
  name: string;
  base: MonsterKind;
  scale: number;
  hp: number;
  damage: number;
  speed: number;
  tint: number;
}

export const BOSSES: readonly BossDef[] = [
  { floor: 10, name: 'King Slime', base: 'slime', scale: 3, hp: 60, damage: 14, speed: 30, tint: 0x6ab8f0 },
  { floor: 20, name: 'Stone Golem', base: 'crab', scale: 2.6, hp: 140, damage: 22, speed: 22, tint: 0xb0a090 },
  { floor: 30, name: 'The Shade', base: 'ghost', scale: 2.6, hp: 220, damage: 28, speed: 32, tint: 0xc07ae0 },
];

export const bossOf = (floor: number): BossDef | undefined => BOSSES.find((b) => b.floor === floor);

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
