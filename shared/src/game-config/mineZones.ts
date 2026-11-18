import { hashSeed } from '../world/random';
import type { MonsterKind } from './activities';

/**
 * The mine, level by level: six zones of five floors, each with its own look,
 * hazard and monsters, and below floor 30 the Abyss, which has no bottom and
 * gets harder every floor. Floors can also be special (a monster den, a vault,
 * a cave-in…). Both the game and Mine Dash use these rules.
 */

/** The deepest floor anyone can reach (the Abyss is "endless", but saves need a limit). */
export const MINE_MAX_FLOOR = 999;

/** The last floor of the main mine; below it is the Abyss. */
export const MINE_MAIN_FLOORS = 30;

export type MineZoneId = 'tunnels' | 'caverns' | 'grotto' | 'flooded' | 'haunted' | 'molten' | 'abyss';

/** What the floor of a zone does to you. */
export type MineHazard = 'none' | 'crystal' | 'water' | 'lava';

export interface MinePalette {
  floor: string;
  floorLight: string;
  floorDark: string;
  wall: string;
  wallTop: string;
  wallFace: string;
  wallFaceDark: string;
}

export interface MineZoneDef {
  id: MineZoneId;
  name: string;
  first: number;
  last: number;
  /** How dark it is beyond the lantern (0–1). */
  darkness: number;
  /** Lantern radius in pixels. */
  lantern: number;
  hazard: MineHazard;
  /** Who lives here; later entries are rarer. */
  monsters: readonly MonsterKind[];
  palette: MinePalette;
  /** One line shown on arrival. */
  intro: string;
}

export const MINE_ZONES: readonly MineZoneDef[] = [
  {
    id: 'tunnels',
    name: 'Earth Tunnels',
    first: 1,
    last: 5,
    darkness: 0.86,
    lantern: 130,
    hazard: 'none',
    monsters: ['slime', 'spitter'],
    palette: { floor: '#4a3f38', floorLight: '#5a4d44', floorDark: '#3a312b', wall: '#2a2320', wallTop: '#5e5048', wallFace: '#433832', wallFaceDark: '#352c27' },
    intro: 'Soft earth and slimes. A good place to learn the ropes.',
  },
  {
    id: 'caverns',
    name: 'Bat Caverns',
    first: 6,
    last: 10,
    darkness: 0.9,
    lantern: 112,
    hazard: 'none',
    monsters: ['slime', 'bat', 'spitter', 'burrower'],
    palette: { floor: '#3e3a40', floorLight: '#4c4750', floorDark: '#302c32', wall: '#1f1c22', wallTop: '#55505c', wallFace: '#3a3540', wallFaceDark: '#2c2832' },
    intro: 'It’s darker here. Listen for wings, and watch the floor for moving mounds.',
  },
  {
    id: 'grotto',
    name: 'Crystal Grotto',
    first: 11,
    last: 15,
    darkness: 0.88,
    lantern: 120,
    hazard: 'crystal',
    monsters: ['crab', 'beetle', 'bat', 'beetle'],
    palette: { floor: '#3c3a50', floorLight: '#4a4862', floorDark: '#2e2c40', wall: '#1e1c2c', wallTop: '#5a5478', wallFace: '#383452', wallFaceDark: '#2a2740' },
    intro: 'Crystals glow in the dark. So do the beetles’ shells: hit them from behind.',
  },
  {
    id: 'flooded',
    name: 'Flooded Depths',
    first: 16,
    last: 20,
    darkness: 0.9,
    lantern: 115,
    hazard: 'water',
    monsters: ['crab', 'eel', 'fusecap', 'bat'],
    palette: { floor: '#34403e', floorLight: '#3f4d4a', floorDark: '#283331', wall: '#1a2322', wallTop: '#4a5a57', wallFace: '#2f3c3a', wallFaceDark: '#243030' },
    intro: 'Water fills the low caves. Keep away from the edges of the pools.',
  },
  {
    id: 'haunted',
    name: 'Haunted Halls',
    first: 21,
    last: 25,
    darkness: 0.96,
    lantern: 100,
    hazard: 'none',
    monsters: ['ghost', 'thief', 'crab', 'mimic'],
    palette: { floor: '#38333c', floorLight: '#443e4a', floorDark: '#2a262e', wall: '#16131a', wallTop: '#4a4252', wallFace: '#2c2632', wallFaceDark: '#211c26' },
    intro: 'Something giggles in the dark. Hold on to your lantern.',
  },
  {
    id: 'molten',
    name: 'Molten Core',
    first: 26,
    last: 30,
    darkness: 0.9,
    lantern: 118,
    hazard: 'lava',
    monsters: ['imp', 'crab', 'ghost', 'fusecap'],
    palette: { floor: '#4a3430', floorLight: '#5a403a', floorDark: '#3a2824', wall: '#24140f', wallTop: '#6a4034', wallFace: '#42261e', wallFaceDark: '#341e18' },
    intro: 'The rock is hot underfoot. Don’t stand on the glowing cracks.',
  },
];

/** The Abyss borrows a zone's look and hazard each floor, with everyone in it. */
const ABYSS_MONSTERS: readonly MonsterKind[] = ['slime', 'spitter', 'bat', 'burrower', 'crab', 'beetle', 'eel', 'fusecap', 'ghost', 'thief', 'mimic', 'imp'];

export function mineZone(floor: number): MineZoneDef {
  const f = Math.max(1, Math.floor(floor));
  const zone = MINE_ZONES.find((z) => f >= z.first && f <= z.last);
  if (zone) return zone;
  const like = MINE_ZONES[hashSeed(`abyss-zone:${f}`) % MINE_ZONES.length];
  return {
    ...like,
    id: 'abyss',
    name: 'The Abyss',
    first: MINE_MAIN_FLOORS + 1,
    last: MINE_MAX_FLOOR,
    darkness: Math.max(like.darkness, 0.93),
    lantern: Math.min(like.lantern, 108),
    monsters: ABYSS_MONSTERS,
    intro: 'Below the bottom of the mine. Every floor is harder than the last.',
  };
}

/** How much tougher monsters are: 1 in the main mine, +5% a floor in the Abyss. */
export function mineScale(floor: number): number {
  return floor <= MINE_MAIN_FLOORS ? 1 : 1 + 0.05 * (floor - MINE_MAIN_FLOORS);
}

/**
 * Special floors. Most floors are normal (find the ladder under a rock);
 * from the Bat Caverns on, some are:
 * - den: the ladder appears once every monster is defeated
 * - vault: a locked chest; one monster carries the key
 * - cavein: the roof is coming down: find the ladder in 45 seconds
 * - dark: just your lantern, and a small one
 * - vein: twice the ore and no monsters, a breather
 */
export type MineFloorKind = 'normal' | 'den' | 'vault' | 'cavein' | 'dark' | 'vein';

export const MINE_FLOOR_KINDS: Record<MineFloorKind, { name: string; intro: string }> = {
  normal: { name: 'Normal', intro: '' },
  den: { name: 'Monster Den', intro: 'A monster den! The way down opens when every monster is gone.' },
  vault: { name: 'Treasure Vault', intro: 'A locked vault chest. One of the monsters here carries its key.' },
  cavein: { name: 'Cave-in', intro: 'The roof is giving way! Find the ladder down in 45 seconds.' },
  dark: { name: 'Dark Floor', intro: 'Pitch dark. Your lantern is all you have.' },
  vein: { name: 'Ore Vein', intro: 'A rich vein of ore, and not a monster in sight.' },
};

/** Seconds you have on a cave-in floor. */
export const CAVE_IN_SECONDS = 45;

/** Picks a floor's kind from a roll (0–1). Boss floors, the first zone and every 5th floor stay normal. */
export function mineFloorKind(floor: number, roll: number): MineFloorKind {
  if (floor <= 5 || floor % 5 === 0) return 'normal';
  if (roll < 0.08) return 'den';
  if (roll < 0.15) return 'vault';
  if (roll < 0.21) return 'cavein';
  if (roll < 0.27) return 'dark';
  if (roll < 0.33) return 'vein';
  return 'normal';
}

/** Golden elite monsters: rarer near the top. Double health, a little more bite, always a prize. */
export const MINE_ELITE = {
  chance: (floor: number) => (floor <= 5 ? 0.02 : floor <= MINE_MAIN_FLOORS ? 0.05 : 0.1),
  hp: 2,
  damage: 1.2,
  tint: 0xffd75a,
} as const;

/** Hidden cracks in the wall that drop you two floors (never past a boss floor or a camp). */
export const MINE_SHORTCUT = { chance: 0.12, hp: 6, minFloor: 6 } as const;

export function shortcutAllowed(floor: number): boolean {
  if (floor < MINE_SHORTCUT.minFloor) return false;
  // Never from a boss floor (camps follow them in Mine Dash), and never over one.
  return floor % 5 !== 0 && (floor + 1) % 5 !== 0;
}
