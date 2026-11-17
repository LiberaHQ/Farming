import { Terrain } from '@farming/shared';
import { EDGE, GRASS_VARIANTS, TILE } from '../assets/tileIndex';
import { terrainAt, type WorldData } from './WorldData';

type Same = (t: number) => boolean;

function edgeMask(world: WorldData, x: number, y: number, same: Same): number {
  let mask = 0;
  if (!same(terrainAt(world, x, y - 1))) mask |= EDGE.N;
  if (!same(terrainAt(world, x + 1, y))) mask |= EDGE.E;
  if (!same(terrainAt(world, x, y + 1))) mask |= EDGE.S;
  if (!same(terrainAt(world, x - 1, y))) mask |= EDGE.W;
  return mask;
}

// Out-of-bounds (-1) counts as "same" so the world edge has no artificial border.
const waterLike: Same = (t) => t === Terrain.Water || t === Terrain.Bridge || t === -1;
const pathLike: Same = (t) => t === Terrain.Path || t === Terrain.Bridge || t === -1;

/** Converts terrain data into tileset indices, picking autotile variants per neighbour. */
export function buildGroundIndices(world: WorldData): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < world.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < world.width; x++) {
      const t = terrainAt(world, x, y);
      switch (t) {
        case Terrain.Water:
          row.push(TILE.WATER_BASE + edgeMask(world, x, y, waterLike));
          break;
        case Terrain.Path:
          row.push(TILE.PATH_BASE + edgeMask(world, x, y, pathLike));
          break;
        case Terrain.Bridge: {
          const up = terrainAt(world, x, y - 1) === Terrain.Bridge;
          const down = terrainAt(world, x, y + 1) === Terrain.Bridge;
          row.push(!up && down ? TILE.BRIDGE_TOP : up && !down ? TILE.BRIDGE_BOTTOM : TILE.BRIDGE_SINGLE);
          break;
        }
        default: {
          const v = world.groundVariant[y * world.width + x];
          row.push(v < GRASS_VARIANTS ? TILE.GRASS_START + v : TILE.FLOWER_START + (v - GRASS_VARIANTS));
        }
      }
    }
    rows.push(row);
  }
  return rows;
}
