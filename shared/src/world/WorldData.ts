import type { TilePoint, WorldObjectSpec } from '../types/world';

/**
 * Engine-agnostic description of a world. Pure data: it can be generated on
 * the client today, and later be loaded from / saved to the backend.
 */
export interface WorldData {
  seed: string;
  width: number;
  height: number;
  /** Row-major Terrain values. */
  terrain: Uint8Array;
  /** Row-major cosmetic variant for grass tiles (0-7 grass, 8-11 flowers). */
  groundVariant: Uint8Array;
  objects: WorldObjectSpec[];
  spawn: TilePoint;
  /** Left tile of the player's cottage footprint (3 tiles wide). Its door faces south. */
  home: TilePoint;
  /** The village market area (kept clear of trees and rocks), in tiles, inclusive. */
  market: { x0: number; y0: number; x1: number; y1: number };
  /** Left tile of the mine entrance (2 tiles wide). */
  mine: TilePoint;
}

/** The shipping bin stands east of the mailbox: anything in it is sold overnight. */
export function shippingBinTile(world: Pick<WorldData, 'home'>): TilePoint {
  return { tx: world.home.tx + 4, ty: world.home.ty };
}

/** The player's mailbox stands just east of the cottage. */
export function mailboxTile(world: Pick<WorldData, 'home'>): TilePoint {
  return { tx: world.home.tx + 3, ty: world.home.ty };
}

/** Terrain at a tile, or -1 when outside the world. */
export function terrainAt(world: WorldData, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return -1;
  return world.terrain[y * world.width + x];
}
