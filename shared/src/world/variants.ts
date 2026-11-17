import type { WorldObjectKind } from '../types/world';

/** How many art variants each world object has (the generator picks one per object). */
export const OBJECT_VARIANTS: Record<WorldObjectKind, number> = {
  oak: 3,
  pine: 2,
  rock: 2,
  copperRock: 1,
  bush: 2,
  stump: 1,
  tallGrass: 2,
  stall: 5,
  board: 1,
  mine: 1,
};

/** Plain grass tile variants, and flower-meadow variants after them. */
export const GRASS_VARIANTS = 8;
export const FLOWER_VARIANTS = 4;
