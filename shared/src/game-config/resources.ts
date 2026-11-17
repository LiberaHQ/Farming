import type { WorldObjectKind } from '../types/world';
import type { ItemId, ToolKind } from './items';

export interface ResourceDrop {
  itemId: ItemId;
  min: number;
  max: number;
  /** Probability (0–1) the drop happens at all. Defaults to 1. */
  chance?: number;
}

export interface ResourceDef {
  /** Tool needed to break it; 'any' = any tool or bare hands, in one hit. */
  tool: ToolKind | 'any';
  hp: number;
  drops: readonly ResourceDrop[];
  /** In-game days until it grows back. */
  respawnDays: number;
  /** Object left behind when broken (e.g. trees leave stumps). */
  leaves?: WorldObjectKind;
}

export const RESOURCES: Partial<Record<WorldObjectKind, ResourceDef>> = {
  oak: { tool: 'axe', hp: 5, drops: [{ itemId: 'wood', min: 4, max: 6 }], respawnDays: 3, leaves: 'stump' },
  pine: { tool: 'axe', hp: 5, drops: [{ itemId: 'wood', min: 3, max: 5 }], respawnDays: 3, leaves: 'stump' },
  stump: { tool: 'axe', hp: 3, drops: [{ itemId: 'wood', min: 1, max: 2 }], respawnDays: 4 },
  bush: {
    tool: 'axe',
    hp: 2,
    drops: [
      { itemId: 'wood', min: 1, max: 1 },
      { itemId: 'fiber', min: 1, max: 2 },
    ],
    respawnDays: 2,
  },
  rock: { tool: 'pickaxe', hp: 3, drops: [{ itemId: 'stone', min: 2, max: 3 }], respawnDays: 2 },
  copperRock: {
    tool: 'pickaxe',
    hp: 5,
    drops: [
      { itemId: 'copper_ore', min: 1, max: 3 },
      { itemId: 'stone', min: 1, max: 1 },
    ],
    respawnDays: 4,
  },
  tallGrass: { tool: 'any', hp: 1, drops: [{ itemId: 'fiber', min: 1, max: 1, chance: 0.75 }], respawnDays: 1 },
};

/** Berry bushes regrow their berries this many days after being picked (not in winter). */
export const BERRY_REGROW_DAYS = 2;
export const BERRY_YIELD: readonly [number, number] = [2, 3];
