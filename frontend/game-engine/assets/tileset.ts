import { TILE_SIZE } from '@farming/shared';
import { createRng, type Rng } from '../utils/random';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import { stonePathTile, woodPathTile } from './structures';
import {
  EDGE,
  FLOWER_VARIANTS,
  GRASS_VARIANTS,
  SEASON_EDGES,
  TILE,
  TILE_MARGIN,
  TILE_SPACING,
  TILESET_COLUMNS,
  TILESET_ROWS,
} from './tileIndex';

const T = TILE_SIZE;

type Side = 'N' | 'E' | 'S' | 'W';
// N is drawn last so its bank sits on top of side edges at corners.
const SIDES: ReadonlyArray<readonly [Side, number]> = [
  ['S', EDGE.S],
  ['E', EDGE.E],
  ['W', EDGE.W],
  ['N', EDGE.N],
];

/** Maps (position along an edge, depth into the tile) to tile coordinates. */
function sidePoint(side: Side, along: number, depth: number): [number, number] {
  switch (side) {
    case 'N':
      return [along, depth];
    case 'S':
      return [along, T - 1 - depth];
    case 'W':
      return [depth, along];
    case 'E':
      return [T - 1 - depth, along];
  }
}

function pebble(t: PixelCanvas, x: number, y: number): void {
  t.set(x, y, P.stoneLight);
  t.set(x + 1, y, P.stone);
  t.set(x, y + 1, P.stone);
  t.set(x + 1, y + 1, P.stoneDark);
}

function grassTile(rng: Rng, variant: number): PixelCanvas {
  const t = new PixelCanvas(T, T);
  t.rect(0, 0, T, T, P.grass);
  for (let i = 0; i < 18; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.grassShade);
  for (let i = 0; i < 6; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.grassLight);

  // 0-3: plain mottled grass (most common, kept subtle so repetition hides),
  // 4-5: grass blades, 6: a pebble, 7: clover.
  const blades = variant === 4 ? 4 : variant === 5 ? 6 : variant < 4 ? rng.int(0, 1) : 0;
  for (let i = 0; i < blades; i++) {
    const x = rng.int(1, 14);
    const y = rng.int(1, 12);
    t.set(x, y, P.grassHi);
    t.set(x, y + 1, P.grassLight);
    t.set(x, y + 2, P.grassDark);
  }
  if (variant === 6) pebble(t, rng.int(2, 12), rng.int(3, 12));
  if (variant === 7) {
    const x = rng.int(3, 11);
    const y = rng.int(3, 11);
    t.set(x, y, P.leafLight);
    t.set(x + 1, y, P.leafLight);
    t.set(x, y + 1, P.leafLight);
    t.set(x + 1, y + 1, P.leafDark);
    t.set(x + 2, y + 1, P.leafLight);
  }
  return t;
}

function flowerTile(rng: Rng, variant: number): PixelCanvas {
  const t = grassTile(rng, variant % 4);
  const colors = variant % 2 === 0 ? [P.flowerYellow, P.flowerWhite] : [P.flowerPink, P.flowerBlue];
  const count = rng.int(1, 3);
  for (let i = 0; i < count; i++) {
    const x = rng.int(2, 13);
    const y = rng.int(2, 11);
    const c = rng.pick(colors);
    t.set(x, y + 2, P.grassDark);
    t.set(x - 1, y, c);
    t.set(x + 1, y, c);
    t.set(x, y - 1, c);
    t.set(x, y + 1, c);
    t.set(x, y, P.flowerCenter);
  }
  return t;
}

/** The ground next to water and paths: what their edges fade into (grass, autumn grass or snow). */
export interface Fringe {
  base: string;
  light: string;
  shade: string;
}

const tintHex = (hex: string, tint: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round((((n >> shift) & 255) * ((tint >> shift) & 255)) / 255);
  return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`;
};
export const FRINGES = {
  grass: { base: P.grass, light: P.grassLight, shade: P.grassShade },
  fall: { base: tintHex(P.grass, 0xf2cf8e), light: tintHex(P.grassLight, 0xf2cf8e), shade: tintHex(P.grassShade, 0xf2cf8e) },
  snow: { base: '#e9eff3', light: '#ffffff', shade: '#dbe4ea' },
} satisfies Record<string, Fringe>;

/**
 * How far the neighbouring ground reaches into an edge at each position:
 * a ragged, dithered line rather than a straight strip, so the two blend.
 */
function raggedDepth(rng: Rng, a: number, prev: number): number {
  // Wander by at most one pixel from the previous column, between 1 and 4.
  const step = rng.chance(0.45) ? (rng.chance(0.5) ? 1 : -1) : 0;
  return Math.max(1, Math.min(4, (a === 0 ? 2 : prev) + step));
}

function waterTile(rng: Rng, mask: number, fringe: Fringe): PixelCanvas {
  const t = new PixelCanvas(T, T);
  t.rect(0, 0, T, T, P.water);
  for (let i = 0; i < 10; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.waterDeep);
  for (let i = 0; i < 3; i++) {
    const y = rng.int(2, 13);
    const x = rng.int(1, 10);
    const len = rng.int(2, 4);
    for (let k = 0; k < len; k++) t.set(x + k, y, P.waterLight);
  }

  for (const [side, bit] of SIDES) {
    if (!(mask & bit)) continue;
    let depth = 2;
    for (let a = 0; a < T; a++) {
      depth = raggedDepth(rng, a, depth);
      // Where a north bank meets a side edge, keep the corner as land.
      const cornerOfSide = side === 'N' && (((mask & EDGE.W) && a < 2) || ((mask & EDGE.E) && a > T - 3));
      const landDepth = cornerOfSide ? 5 : depth;
      for (let d = 0; d < landDepth; d++) {
        const [x, y] = sidePoint(side, a, d);
        t.set(x, y, rng.chance(0.15) ? fringe.shade : rng.chance(0.12) ? fringe.light : fringe.base);
      }
      if (cornerOfSide) continue;
      let d = landDepth;
      // A thin wet-earth lip where land meets water (thicker on the far bank, seen from the south).
      const [x1, y1] = sidePoint(side, a, d);
      t.set(x1, y1, side === 'N' ? P.bank : P.bankDark);
      d += 1;
      if (side === 'N') {
        const [x2, y2] = sidePoint(side, a, d);
        t.set(x2, y2, P.bankDark);
        d += 1;
      }
      // Foam, broken up.
      if (rng.chance(0.55)) {
        const [fx, fy] = sidePoint(side, a, d);
        t.set(fx, fy, P.foam);
      }
    }
  }
  return t;
}

function pathTile(rng: Rng, mask: number, fringe: Fringe): PixelCanvas {
  const t = new PixelCanvas(T, T);
  t.rect(0, 0, T, T, P.dirt);
  for (let i = 0; i < 12; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.dirtDark);
  for (let i = 0; i < 10; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.dirtLight);
  if (rng.chance(0.5)) pebble(t, rng.int(3, 11), rng.int(3, 11));

  for (const [side, bit] of SIDES) {
    if (!(mask & bit)) continue;
    let depth = 2;
    for (let a = 0; a < T; a++) {
      depth = raggedDepth(rng, a, depth);
      for (let d = 0; d < depth; d++) {
        const [x, y] = sidePoint(side, a, d);
        t.set(x, y, rng.chance(0.15) ? fringe.shade : fringe.base);
      }
      // Dithered blend: a few stray tufts on the dirt, and dirt showing through the edge.
      if (rng.chance(0.4)) {
        const [x, y] = sidePoint(side, a, depth + (rng.chance(0.5) ? 1 : 0));
        t.set(x, y, fringe.light);
      }
      if (rng.chance(0.18) && depth > 1) {
        const [x, y] = sidePoint(side, a, depth - 1);
        t.set(x, y, P.dirtLight);
      }
    }
  }
  return t;
}

function bridgeTile(rng: Rng, top: boolean, bottom: boolean): PixelCanvas {
  const t = new PixelCanvas(T, T);
  // Cross planks 4px wide (3px board, 1px gap), each with its own tone, grain and nails.
  const tones = [P.wood, '#b47a44', '#9c6636', P.woodLight];
  for (let x = 0; x < T; x += 4) {
    const tone = tones[rng.int(0, tones.length - 1)];
    t.rect(x, 0, 3, T, tone);
    t.rect(x, 0, 1, T, P.woodLight);
    t.rect(x + 3, 0, 1, T, '#4a2e18');
    // Grain.
    const g = rng.int(2, 12);
    t.rect(x + 1 + rng.int(0, 1), g, 1, 3, P.woodDark);
    // Nails where the boards cross the beams underneath.
    t.set(x + 1, 3, '#3a3a42');
    t.set(x + 1, T - 4, '#3a3a42');
  }
  // A knot here and there.
  if (rng.chance(0.5)) {
    const x = rng.int(0, 3) * 4 + 1;
    t.rect(x, rng.int(6, 9), 2, 2, P.trunkDark);
  }
  // Under the railings: a dark beam edge (the railing sprites stand on it).
  if (top) {
    t.rect(0, 0, T, 2, '#4a2e18');
    t.rect(0, 2, T, 1, P.woodDark);
  }
  if (bottom) {
    t.rect(0, T - 1, T, 1, '#4a2e18');
    t.rect(0, T - 2, T, 1, P.woodDark);
  }
  return t;
}

/** Winter ground: snow with a few tufts of grass poking through. */
function snowTile(rng: Rng, variant: number): PixelCanvas {
  const t = new PixelCanvas(T, T);
  t.rect(0, 0, T, T, '#e9eff3');
  for (let i = 0; i < 16; i++) t.set(rng.int(0, 15), rng.int(0, 15), '#dbe4ea');
  for (let i = 0; i < 6; i++) t.set(rng.int(0, 15), rng.int(0, 15), '#ffffff');
  const tufts = variant >= 4 && variant <= 5 ? 3 : variant < 4 ? rng.int(0, 1) : 1;
  for (let i = 0; i < tufts; i++) {
    const x = rng.int(1, 14);
    const y = rng.int(2, 13);
    t.set(x, y, P.grassDark);
    t.set(x + 1, y - 1, P.grassDark);
    t.set(x, y + 1, '#c3cfd8');
  }
  if (variant === 6) pebble(t, rng.int(2, 12), rng.int(3, 12));
  return t;
}

const SOIL = {
  dry: { base: '#8a5f38', dark: '#6b4628', light: '#a4774a' },
  wet: { base: '#5e3e24', dark: '#4a2f1b', light: '#76502f' },
};

/** Tilled soil: a rounded patch with furrows, transparent at the corners. */
function soilTile(rng: Rng, wet: boolean): PixelCanvas {
  const c = wet ? SOIL.wet : SOIL.dry;
  const t = new PixelCanvas(T, T);
  t.rect(1, 1, T - 2, T - 2, c.base);
  t.rect(2, 0, T - 4, 1, c.dark);
  t.rect(2, T - 1, T - 4, 1, c.dark);
  t.rect(0, 2, 1, T - 4, c.dark);
  t.rect(T - 1, 2, 1, T - 4, c.dark);
  t.set(1, 1, c.dark);
  t.set(T - 2, 1, c.dark);
  t.set(1, T - 2, c.dark);
  t.set(T - 2, T - 2, c.dark);
  for (const y of [4, 8, 12]) {
    for (let x = 2; x < T - 2; x++) {
      t.set(x, y, c.dark);
      if (rng.chance(0.3)) t.set(x, y - 1, c.light);
    }
  }
  for (let i = 0; i < 6; i++) t.set(rng.int(2, 13), rng.int(2, 13), c.light);
  return t;
}

/** Builds the full, extruded tileset atlas. Art is fixed (not world-seed dependent). */
export function buildTilesetCanvas(): HTMLCanvasElement {
  const rng = createRng('tileset-v1');
  const tiles = new Map<number, PixelCanvas>();

  for (let v = 0; v < GRASS_VARIANTS; v++) tiles.set(TILE.GRASS_START + v, grassTile(rng, v));
  for (let v = 0; v < FLOWER_VARIANTS; v++) tiles.set(TILE.FLOWER_START + v, flowerTile(rng, v));
  for (let m = 0; m < 16; m++) tiles.set(TILE.WATER_BASE + m, waterTile(rng, m, FRINGES.grass));
  for (let m = 0; m < 16; m++) tiles.set(TILE.PATH_BASE + m, pathTile(rng, m, FRINGES.grass));
  // The same edges for autumn and winter, so shores and paths blend into the season's ground.
  for (const [season, fringe] of [['fall', FRINGES.fall], ['winter', FRINGES.snow]] as const) {
    const sr = createRng(`edges-${season}`);
    for (let m = 0; m < 16; m++) tiles.set(SEASON_EDGES[season].water + m, waterTile(sr, m, fringe));
    for (let m = 0; m < 16; m++) tiles.set(SEASON_EDGES[season].path + m, pathTile(sr, m, fringe));
  }
  tiles.set(TILE.BRIDGE_TOP, bridgeTile(rng, true, false));
  tiles.set(TILE.BRIDGE_BOTTOM, bridgeTile(rng, false, true));
  tiles.set(TILE.BRIDGE_SINGLE, bridgeTile(rng, true, true));
  const soilRng = createRng('soil-v1');
  tiles.set(TILE.SOIL_DRY, soilTile(soilRng, false));
  tiles.set(TILE.SOIL_WET, soilTile(createRng('soil-v1'), true));
  const snowRng = createRng('snow-v1');
  for (let v = 0; v < GRASS_VARIANTS; v++) tiles.set(TILE.SNOW_START + v, snowTile(snowRng, v));
  tiles.set(TILE.WOOD_PATH, woodPathTile(createRng('wood-path')));
  tiles.set(TILE.STONE_PATH, stonePathTile(createRng('stone-path')));

  const slot = T + TILE_SPACING;
  const atlas = new PixelCanvas(TILESET_COLUMNS * slot, TILESET_ROWS * slot);
  const clamp = (v: number) => Math.max(0, Math.min(T - 1, v));

  for (const [index, tile] of tiles) {
    const ox = TILE_MARGIN + (index % TILESET_COLUMNS) * slot;
    const oy = TILE_MARGIN + Math.floor(index / TILESET_COLUMNS) * slot;
    for (let y = -1; y <= T; y++) {
      for (let x = -1; x <= T; x++) atlas.copyPixel(tile, clamp(x), clamp(y), ox + x, oy + y);
    }
  }
  return atlas.toCanvas();
}
