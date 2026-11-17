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

/** Hair styles, hats and outfits the player can pick (the art for each lives in the engine). */
export const HAIR_STYLES = ['short', 'long', 'ponytail', 'bun', 'curly', 'spiky', 'bob'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HATS = ['none', 'straw', 'cap', 'beanie', 'bandana', 'flower'] as const;
export type HatStyle = (typeof HATS)[number];
export const OUTFITS = ['shirt', 'tee', 'overalls', 'dress'] as const;
export type OutfitStyle = (typeof OUTFITS)[number];

/**
 * Character customisation presets. A look is one index per part. New options
 * are only ever appended, so a saved index always means the same thing; parts
 * an older save doesn't have default to option 0 (the original look).
 */
export const APPEARANCE_OPTIONS = {
  skin: [
    { skin: '#f2c39c', skinShade: '#d99d78' },
    { skin: '#e0ab83', skinShade: '#c28a63' },
    { skin: '#c98e68', skinShade: '#a8704f' },
    { skin: '#8d5a3c', skinShade: '#70442c' },
    { skin: '#fbdcc4', skinShade: '#e6b898' },
    { skin: '#b07850', skinShade: '#8e5c3a' },
    { skin: '#5e3a26', skinShade: '#47291a' },
  ],
  eyes: [{ eyes: '#3a2a24' }, { eyes: '#7a4a28' }, { eyes: '#3a6ab8' }, { eyes: '#3a8a4a' }, { eyes: '#8a7a2a' }, { eyes: '#6a7a8a' }],
  hairStyle: HAIR_STYLES.map((hairStyle) => ({ hairStyle })),
  hair: [
    { hair: '#6e3f22', hairLight: '#925a32' },
    { hair: '#2d2433', hairLight: '#4a3b52' },
    { hair: '#d9a441', hairLight: '#f0c96a' },
    { hair: '#b8492e', hairLight: '#d86c4c' },
    { hair: '#c9c2b5', hairLight: '#e6e1d8' },
    { hair: '#1c1820', hairLight: '#3a3240' },
    { hair: '#7a2a1e', hairLight: '#a8402c' },
    { hair: '#d86a9e', hairLight: '#f4a2c4' },
    { hair: '#3f6ab0', hairLight: '#6a92d4' },
  ],
  hat: HATS.map((hat) => ({ hat })),
  outfit: OUTFITS.map((outfit) => ({ outfit })),
  shirt: [
    { shirt: '#d2553f', shirtDark: '#a7402f' },
    { shirt: '#3f8c6e', shirtDark: '#2c6a52' },
    { shirt: '#5a6f9e', shirtDark: '#435580' },
    { shirt: '#e0b84a', shirtDark: '#b8912e' },
    { shirt: '#8a5aa8', shirtDark: '#6a4084' },
    { shirt: '#e8e2d4', shirtDark: '#bdb5a3' },
    { shirt: '#e8749a', shirtDark: '#c04e74' },
    { shirt: '#4aa8c8', shirtDark: '#2f84a2' },
    { shirt: '#f08a3a', shirtDark: '#c46a22' },
    { shirt: '#3d3d46', shirtDark: '#26262c' },
  ],
  pants: [
    { pants: '#3f5c8c', pantsDark: '#2e466c' },
    { pants: '#5e5243', pantsDark: '#463d31' },
    { pants: '#3d3d46', pantsDark: '#2a2a31' },
    { pants: '#6b7a3a', pantsDark: '#4f5a2a' },
    { pants: '#a8703d', pantsDark: '#7c512c' },
    { pants: '#8a3a4a', pantsDark: '#662a36' },
    { pants: '#e8e2d4', pantsDark: '#bdb5a3' },
  ],
  shoes: [
    { shoes: '#4b3123', shoesLight: '#6e4a34' },
    { shoes: '#2a2a30', shoesLight: '#4a4a54' },
    { shoes: '#e8e2d4', shoesLight: '#ffffff' },
    { shoes: '#a8302a', shoesLight: '#d04a3a' },
    { shoes: '#4a6a2a', shoesLight: '#6a8a3a' },
  ],
} as const;

export type AppearancePart = keyof typeof APPEARANCE_OPTIONS;
export type AppearanceChoice = Record<AppearancePart, number>;
export const APPEARANCE_PARTS = Object.keys(APPEARANCE_OPTIONS) as AppearancePart[];
/** Parts picked by name (shown as chips) rather than by colour. */
export const APPEARANCE_STYLE_PARTS: readonly AppearancePart[] = ['hairStyle', 'hat', 'outfit'];
export const DEFAULT_APPEARANCE_CHOICE: AppearanceChoice = { skin: 0, eyes: 0, hairStyle: 0, hair: 0, hat: 0, outfit: 0, shirt: 0, pants: 0, shoes: 0 };

/** A look from loose data (an older save, a profile, another player): missing or invalid parts become option 0. */
export function normalizeAppearance(value: unknown): AppearanceChoice {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_APPEARANCE_CHOICE };
  for (const part of APPEARANCE_PARTS) {
    const i = v[part];
    if (typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < APPEARANCE_OPTIONS[part].length) out[part] = i;
  }
  return out;
}

export function resolveAppearance(choice: Partial<AppearanceChoice>): CharacterAppearance {
  const c = normalizeAppearance(choice);
  const skin = APPEARANCE_OPTIONS.skin[c.skin];
  const hair = APPEARANCE_OPTIONS.hair[c.hair];
  const shirt = APPEARANCE_OPTIONS.shirt[c.shirt];
  const pants = APPEARANCE_OPTIONS.pants[c.pants];
  const shoes = APPEARANCE_OPTIONS.shoes[c.shoes];
  return {
    skin: skin.skin,
    skinShade: skin.skinShade,
    hair: hair.hair,
    hairLight: hair.hairLight,
    shirt: shirt.shirt,
    shirtDark: shirt.shirtDark,
    pants: pants.pants,
    pantsDark: pants.pantsDark,
    shoes: shoes.shoes,
    shoesLight: shoes.shoesLight,
    eyes: APPEARANCE_OPTIONS.eyes[c.eyes].eyes,
    hairStyle: APPEARANCE_OPTIONS.hairStyle[c.hairStyle].hairStyle,
    hat: APPEARANCE_OPTIONS.hat[c.hat].hat,
    outfit: APPEARANCE_OPTIONS.outfit[c.outfit].outfit,
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
export * from './nightMarket';
export * from './heirloom';
export * from './ecosystem';
