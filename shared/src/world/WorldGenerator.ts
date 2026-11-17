import { GAME_CONFIG } from '../game-config';
import { Terrain, type WorldObjectSpec } from '../types/world';
import { createValueNoise, fbm } from './noise';
import { createRng } from './random';
import { FLOWER_VARIANTS, GRASS_VARIANTS, OBJECT_VARIANTS } from './variants';
import type { WorldData } from './WorldData';

function quantile(values: Float32Array, q: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Removes single-tile water specks and fills pinholes so shorelines autotile cleanly. */
function smoothWater(terrain: Uint8Array, w: number, h: number, passes: number): void {
  for (let pass = 0; pass < passes; pass++) {
    const next = terrain.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let n = 0;
        if (y > 0 && terrain[i - w] === Terrain.Water) n++;
        if (y < h - 1 && terrain[i + w] === Terrain.Water) n++;
        if (x > 0 && terrain[i - 1] === Terrain.Water) n++;
        if (x < w - 1 && terrain[i + 1] === Terrain.Water) n++;
        if (terrain[i] === Terrain.Water && n < 2) next[i] = Terrain.Grass;
        else if (terrain[i] === Terrain.Grass && n >= 3) next[i] = Terrain.Water;
      }
    }
    terrain.set(next);
  }
}

/**
 * Procedurally generates a world from a seed: ponds, a winding river, a path
 * with a bridge, a clearing around spawn, forests, rocks and meadow details.
 * Fully deterministic — the same seed always yields the same world.
 */
export function generateWorld(seed: string, width: number, height: number): WorldData {
  const rng = createRng(seed);
  const elevationNoise = createValueNoise(rng.fork('elevation'));
  const forestNoise = createValueNoise(rng.fork('forest'));
  const meadowNoise = createValueNoise(rng.fork('meadow'));
  const riverNoise = createValueNoise(rng.fork('river'));
  const place = rng.fork('placement');

  const size = width * height;
  const terrain = new Uint8Array(size); // all Grass
  const groundVariant = new Uint8Array(size);
  const index = (x: number, y: number) => y * width + x;
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const spawn = { tx: Math.floor(width * 0.38), ty: Math.floor(height * 0.52) };
  const clearing = GAME_CONFIG.player.spawnClearingRadius;
  const spawnDist = (x: number, y: number) => Math.hypot(x - spawn.tx, y - spawn.ty);

  // 1. Ponds from low elevation.
  const elevation = new Float32Array(size);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) elevation[index(x, y)] = fbm(elevationNoise, x * 0.06, y * 0.06, 4);
  }
  const lakeLevel = quantile(elevation, 0.07);
  for (let i = 0; i < size; i++) if (elevation[i] < lakeLevel) terrain[i] = Terrain.Water;
  smoothWater(terrain, width, height, 2);

  // 2. A river winding north–south.
  const riverX = width * 0.7 + rng.range(-3, 3);
  const phase = rng.range(0, Math.PI * 2);
  for (let y = 0; y < height; y++) {
    const cx = riverX + Math.sin(y * 0.085 + phase) * 4.5 + (riverNoise(y * 0.07, 3.3) - 0.5) * 6;
    const half = riverNoise(y * 0.04, 11.7) > 0.55 ? 1.5 : 0.9;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (inBounds(x, y)) terrain[index(x, y)] = Terrain.Water;
    }
  }

  // 3. Spawn clearing, and the village market row along the north side of the path.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (spawnDist(x, y) <= clearing + 1.5) terrain[index(x, y)] = Terrain.Grass;
  }
  const market = { x0: spawn.tx - 21, y0: spawn.ty - 7, x1: spawn.tx + 4, y1: spawn.ty - 3 };
  const inMarket = (x: number, y: number) => x >= market.x0 && x <= market.x1 && y >= market.y0 && y <= market.y1;
  for (let y = market.y0; y <= market.y1; y++) {
    for (let x = market.x0; x <= market.x1; x++) if (inBounds(x, y)) terrain[index(x, y)] = Terrain.Grass;
  }

  // 4. A two-tile-wide path crossing the map; becomes a bridge over water.
  const waterNear = (x: number, y0: number, y1: number) => {
    for (let dx = -3; dx <= 3; dx++) {
      for (let y = y0; y <= y1; y++) {
        if (!inBounds(x + dx, y)) continue;
        const t = terrain[index(x + dx, y)];
        if (t === Terrain.Water || t === Terrain.Bridge) return true;
      }
    }
    return false;
  };
  let yc = spawn.ty;
  for (let x = 2; x < width - 2; x++) {
    const desired = spawn.ty + Math.round(Math.sin(x * 0.11 + phase) * 1.6);
    // Keep the path straight near water so bridges stay rectangular.
    if (desired !== yc && !waterNear(x, Math.min(yc, desired) - 1, Math.max(yc, desired) + 2)) {
      yc += Math.sign(desired - yc);
    }
    // If either row is wet the whole column becomes bridge (it spans the bank).
    const wet = [yc, yc + 1].some((y) => terrain[index(x, y)] === Terrain.Water);
    for (const y of [yc, yc + 1]) terrain[index(x, y)] = wet ? Terrain.Bridge : Terrain.Path;
  }

  // 5. Cosmetic grass variants and flower meadows.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = index(x, y);
      if (terrain[i] !== Terrain.Grass) continue;
      if (meadowNoise(x * 0.12, y * 0.12) > 0.66 && place.chance(0.3)) {
        groundVariant[i] = GRASS_VARIANTS + place.int(0, FLOWER_VARIANTS - 1);
      } else {
        const r = place.next();
        groundVariant[i] = r < 0.62 ? place.int(0, 3) : r < 0.84 ? place.int(4, 5) : r < 0.95 ? 7 : 6;
      }
    }
  }

  // 6. Environmental objects.
  const objects: WorldObjectSpec[] = [];
  const occupied = new Uint8Array(size);
  const near = (x: number, y: number, r: number, match: (t: number) => boolean) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (inBounds(x + dx, y + dy) && match(terrain[index(x + dx, y + dy)])) return true;
      }
    }
    return false;
  };
  const areaFree = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (!inBounds(x + dx, y + dy) || occupied[index(x + dx, y + dy)]) return false;
      }
    }
    return true;
  };
  const mark = (x: number, y: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) if (inBounds(x + dx, y + dy)) occupied[index(x + dx, y + dy)] = 1;
    }
  };
  const isPath = (t: number) => t === Terrain.Path || t === Terrain.Bridge;
  const isWater = (t: number) => t === Terrain.Water || t === Terrain.Bridge;
  const variant = (kind: WorldObjectSpec['kind']) => place.int(0, OBJECT_VARIANTS[kind] - 1);

  // The market: a short walk west of the cottage (a few tiles of open grass between them), all
  // stalls facing the path; the notice board between Mira's stall and the cottage.
  [-7, -10, -13, -16, -19].forEach((dx, variant) => {
    const stall = { kind: 'stall' as const, tx: spawn.tx + dx, ty: spawn.ty - 4, variant };
    objects.push(stall);
    mark(stall.tx, stall.ty, 1);
    mark(stall.tx + 1, stall.ty, 1);
  });
  const board = { kind: 'board' as const, tx: spawn.tx - 4, ty: spawn.ty - 4, variant: 0 };
  objects.push(board);
  mark(board.tx, board.ty, 0);

  // The player's cottage, east of the stall. Placed by the build system; reserved here.
  const home = { tx: spawn.tx + 1, ty: spawn.ty - 4 };
  for (let i = 0; i < 3; i++) mark(home.tx + i, home.ty, 1);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = index(x, y);
      if (terrain[i] !== Terrain.Grass || occupied[i]) continue;
      if (spawnDist(x, y) < clearing + 1.5 || inMarket(x, y)) continue;

      const nearPath = near(x, y, 1, isPath);
      const nearWater = near(x, y, 1, isWater);
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      const f = fbm(forestNoise, x * 0.07, y * 0.07, 3);
      const treeChance = edge < 3 ? 0.8 : f > 0.6 ? 0.5 : f > 0.52 ? 0.12 : 0.015;

      if (!nearPath && !nearWater && areaFree(x, y, 1) && place.chance(treeChance)) {
        const pine = f > 0.58 ? place.chance(0.55) : place.chance(0.15);
        const kind = pine ? 'pine' : 'oak';
        objects.push({ kind, tx: x, ty: y, variant: variant(kind) });
        mark(x, y, 1);
        continue;
      }
      if (!nearPath && place.chance(nearWater ? 0.045 : 0.008)) {
        if (place.chance(0.25)) objects.push({ kind: 'copperRock', tx: x, ty: y, variant: 0 });
        else objects.push({ kind: 'rock', tx: x, ty: y, variant: variant('rock') });
        occupied[i] = 1;
        continue;
      }
      if (!nearPath && !nearWater && place.chance(0.012)) {
        objects.push({ kind: 'bush', tx: x, ty: y, variant: variant('bush') });
        occupied[i] = 1;
        continue;
      }
      if (!nearPath && !nearWater && place.chance(0.003)) {
        objects.push({ kind: 'stump', tx: x, ty: y, variant: 0 });
        occupied[i] = 1;
        continue;
      }
      if (meadowNoise(x * 0.16 + 40, y * 0.16 + 40) > 0.62 && place.chance(0.6)) {
        objects.push({ kind: 'tallGrass', tx: x, ty: y, variant: variant('tallGrass') });
        occupied[i] = 1;
      }
    }
  }

  // The mine entrance: a clear, dry spot well away from the farm and village — off on its own,
  // preferably up north (its own random stream, so it doesn't reshuffle the rest of the world).
  const mineRng = createRng(`${seed}:mine`);
  const free = (x: number, y: number) =>
    inBounds(x, y) && terrain[index(x, y)] === Terrain.Grass && !inMarket(x, y) && spawnDist(x, y) > clearing + 2 && !near(x, y, 1, isWater);
  let mine = { tx: spawn.tx + 18, ty: spawn.ty - 12 };
  const candidates: Array<{ tx: number; ty: number; score: number }> = [];
  for (let y = 3; y < height - 4; y++) {
    for (let x = 3; x < width - 5; x++) {
      const d = spawnDist(x, y);
      if (d < 26 || d > 44) continue;
      // Room for the entrance and its yard (rails, cart, lamp, sign).
      let ok = true;
      for (let dy = -2; dy <= 4 && ok; dy++) for (let dx = -3; dx <= 4 && ok; dx++) ok = free(x + dx, y + dy);
      if (ok) candidates.push({ tx: x, ty: y, score: (y < spawn.ty - 6 ? 0 : 8) + Math.abs(d - 32) + mineRng.next() * 4 });
    }
  }
  if (candidates.length) {
    candidates.sort((a, b) => a.score - b.score);
    mine = { tx: candidates[0].tx, ty: candidates[0].ty };
  }
  // Clear whatever grew around the entrance and its yard.
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.tx >= mine.tx - 3 && o.tx <= mine.tx + 4 && o.ty >= mine.ty - 2 && o.ty <= mine.ty + 4) objects.splice(i, 1);
  }
  objects.push({ kind: 'mine', tx: mine.tx, ty: mine.ty, variant: 0 });

  return { seed, width, height, terrain, groundVariant, objects, spawn, home, market, mine };
}
