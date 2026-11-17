/**
 * Terrain is stored as a compact Uint8Array, so values are plain numbers.
 * A const object (rather than a TS enum) keeps it serialisable and tree-shakeable.
 */
export const Terrain = {
  Grass: 0,
  Water: 1,
  Path: 2,
  Bridge: 3,
} as const;

export type TerrainType = (typeof Terrain)[keyof typeof Terrain];

export type TerrainName = 'grass' | 'water' | 'path' | 'bridge';

export const TERRAIN_NAMES: Record<TerrainType, TerrainName> = {
  [Terrain.Grass]: 'grass',
  [Terrain.Water]: 'water',
  [Terrain.Path]: 'path',
  [Terrain.Bridge]: 'bridge',
};

export type WorldObjectKind = 'oak' | 'pine' | 'rock' | 'copperRock' | 'bush' | 'stump' | 'tallGrass' | 'stall' | 'board' | 'mine';

/** A placed environmental object, addressed by the tile its base stands on. */
export interface WorldObjectSpec {
  kind: WorldObjectKind;
  tx: number;
  ty: number;
  variant: number;
}

export interface TilePoint {
  tx: number;
  ty: number;
}
