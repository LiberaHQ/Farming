import { PLAYER_RUN_SPEED, PLAYER_WALK_SPEED } from '../constants/player';
import { TILE_SIZE, WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../constants/world';
import type { CharacterAppearance } from '../types/player';
import type { ItemAmount } from './recipes';

export * from './items';
export * from './crops';
export * from './recipes';
export * from './resources';
export * from './time';
export * from './placeables';
export * from './npcs';
export * from './activities';
export * from './machines';
export * from './livestock';
export * from './village';
export * from './interior';

export const DEFAULT_WORLD_SEED = 'meadowbrook';

export const GAME_CONFIG = {
  tileSize: TILE_SIZE,
  world: {
    widthTiles: WORLD_WIDTH_TILES,
    heightTiles: WORLD_HEIGHT_TILES,
  },
  player: {
    walkSpeed: PLAYER_WALK_SPEED,
    runSpeed: PLAYER_RUN_SPEED,
    /** Radius (tiles) around spawn kept free of obstacles. */
    spawnClearingRadius: 6,
  },
  camera: {
    followLerp: 0.14,
    /** Zoom is chosen so roughly this many tiles fit vertically. */
    targetVisibleTilesY: 14,
    minZoom: 2,
    maxZoom: 6,
  },
  inventory: {
    size: 30,
    hotbarSize: 10,
  },
  farming: {
    wateringCanCapacity: 20,
  },
  energy: {
    max: 100,
    /** Energy per tool use. Bare-handed actions are free. */
    toolCost: 2,
    wateringCost: 1,
    /** Fraction of max energy restored after passing out instead of sleeping. */
    passOutRestore: 0.6,
  },
  economy: {
    startingGold: 100,
  },
} as const;

export const STARTER_KIT: readonly ItemAmount[] = [
  { itemId: 'axe', quantity: 1 },
  { itemId: 'pickaxe', quantity: 1 },
  { itemId: 'hoe', quantity: 1 },
  { itemId: 'watering_can', quantity: 1 },
  { itemId: 'turnip_seeds', quantity: 12 },
  { itemId: 'berries', quantity: 6 },
];

/** Character customisation presets. A look is one index per part. */
export const APPEARANCE_OPTIONS = {
  skin: [
    { skin: '#f2c39c', skinShade: '#d99d78' },
    { skin: '#e0ab83', skinShade: '#c28a63' },
    { skin: '#c98e68', skinShade: '#a8704f' },
    { skin: '#8d5a3c', skinShade: '#70442c' },
  ],
  hair: [
    { hair: '#6e3f22', hairLight: '#925a32' },
    { hair: '#2d2433', hairLight: '#4a3b52' },
    { hair: '#d9a441', hairLight: '#f0c96a' },
    { hair: '#b8492e', hairLight: '#d86c4c' },
    { hair: '#c9c2b5', hairLight: '#e6e1d8' },
  ],
  shirt: [
    { shirt: '#d2553f', shirtDark: '#a7402f' },
    { shirt: '#3f8c6e', shirtDark: '#2c6a52' },
    { shirt: '#5a6f9e', shirtDark: '#435580' },
    { shirt: '#e0b84a', shirtDark: '#b8912e' },
    { shirt: '#8a5aa8', shirtDark: '#6a4084' },
    { shirt: '#e8e2d4', shirtDark: '#bdb5a3' },
  ],
  pants: [
    { pants: '#3f5c8c', pantsDark: '#2e466c' },
    { pants: '#5e5243', pantsDark: '#463d31' },
    { pants: '#3d3d46', pantsDark: '#2a2a31' },
    { pants: '#6b7a3a', pantsDark: '#4f5a2a' },
  ],
} as const;

export type AppearancePart = keyof typeof APPEARANCE_OPTIONS;
export type AppearanceChoice = Record<AppearancePart, number>;
export const APPEARANCE_PARTS = Object.keys(APPEARANCE_OPTIONS) as AppearancePart[];
export const DEFAULT_APPEARANCE_CHOICE: AppearanceChoice = { skin: 0, hair: 0, shirt: 0, pants: 0 };

export function resolveAppearance(choice: AppearanceChoice): CharacterAppearance {
  const index = (part: AppearancePart) => {
    const n = APPEARANCE_OPTIONS[part].length;
    const i = choice[part];
    return Number.isInteger(i) ? Math.max(0, Math.min(n - 1, i)) : 0;
  };
  const skin = APPEARANCE_OPTIONS.skin[index('skin')];
  const hair = APPEARANCE_OPTIONS.hair[index('hair')];
  const shirt = APPEARANCE_OPTIONS.shirt[index('shirt')];
  const pants = APPEARANCE_OPTIONS.pants[index('pants')];
  return {
    skin: skin.skin,
    skinShade: skin.skinShade,
    hair: hair.hair,
    hairLight: hair.hairLight,
    shirt: shirt.shirt,
    shirtDark: shirt.shirtDark,
    pants: pants.pants,
    pantsDark: pants.pantsDark,
    shoes: '#4b3123',
  };
}

export const DEFAULT_APPEARANCE: CharacterAppearance = resolveAppearance(DEFAULT_APPEARANCE_CHOICE);
export * from './community';
export * from './achievements';
export * from './story';
export * from './sources';
export * from './carnival';
export * from './wildlife';
export * from './places';
export * from './skills';
export * from './events';
export * from './orchard';
export * from './daily';
export * from './freight';
export * from './tidal';
