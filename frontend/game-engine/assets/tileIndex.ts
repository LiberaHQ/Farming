/**
 * Layout of the generated tileset. Water and path each have 16 variants,
 * one per combination of edges (N/E/S/W) that border a different terrain,
 * which gives clean autotiled shorelines and path borders.
 */
export const TILESET_COLUMNS = 16;
export const TILESET_ROWS = 9;
/** The tileset is extruded (1px margin, 2px spacing) to prevent seams at any zoom. */
export const TILE_MARGIN = 1;
export const TILE_SPACING = 2;

export const EDGE = { N: 1, E: 2, S: 4, W: 8 } as const;

export const TILE = {
  GRASS_START: 0, // 0..7 grass variants
  FLOWER_START: 8, // 8..11 flower meadow variants
  WATER_BASE: 16, // 16..31, + edge mask
  PATH_BASE: 32, // 32..47, + edge mask
  BRIDGE_TOP: 48,
  BRIDGE_BOTTOM: 49,
  BRIDGE_SINGLE: 50,
  SOIL_DRY: 51, // tilled soil (separate layer above ground)
  SOIL_WET: 52,
  WOOD_PATH: 53, // floor layer
  STONE_PATH: 54,
  SNOW_START: 64, // 64..71 snow-covered grass (winter versions of 0..7)
  WATER_FALL_BASE: 80, // 80..95: water edged with autumn grass
  PATH_FALL_BASE: 96, // 96..111
  WATER_SNOW_BASE: 112, // 112..127: water edged with snow
  PATH_SNOW_BASE: 128, // 128..143
} as const;

/** Edge tiles per season: shores and paths fade into that season's ground. */
export const SEASON_EDGES = {
  spring: { water: TILE.WATER_BASE, path: TILE.PATH_BASE },
  summer: { water: TILE.WATER_BASE, path: TILE.PATH_BASE },
  fall: { water: TILE.WATER_FALL_BASE, path: TILE.PATH_FALL_BASE },
  winter: { water: TILE.WATER_SNOW_BASE, path: TILE.PATH_SNOW_BASE },
} as const;

/** Which edge set (if any) a tile index belongs to, and its edge mask. */
export function edgeTileInfo(index: number): { kind: 'water' | 'path'; mask: number } | null {
  for (const base of [TILE.WATER_BASE, TILE.WATER_FALL_BASE, TILE.WATER_SNOW_BASE]) if (index >= base && index < base + 16) return { kind: 'water', mask: index - base };
  for (const base of [TILE.PATH_BASE, TILE.PATH_FALL_BASE, TILE.PATH_SNOW_BASE]) if (index >= base && index < base + 16) return { kind: 'path', mask: index - base };
  return null;
}

export { FLOWER_VARIANTS, GRASS_VARIANTS } from '@farming/shared';
import { FLOWER_VARIANTS, GRASS_VARIANTS } from '@farming/shared';

export const WATER_TILE_INDICES: number[] = [TILE.WATER_BASE, TILE.WATER_FALL_BASE, TILE.WATER_SNOW_BASE].flatMap((base) => Array.from({ length: 16 }, (_, i) => base + i));
