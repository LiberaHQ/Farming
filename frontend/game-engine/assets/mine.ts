import type { MinePalette, MineRockKind } from '@farming/shared';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import type { Rng } from '../utils/random';

/** Art for the mine: entrance, cave floor and walls, rocks, ladders and slimes. */

const DEFAULT_CAVE: MinePalette = {
  floor: '#4a3f38',
  floorLight: '#5a4d44',
  floorDark: '#3a312b',
  wall: '#2a2320',
  wallTop: '#5e5048',
  wallFace: '#433832',
  wallFaceDark: '#352c27',
};

const ORE: Record<MineRockKind, { base: string; light: string } | null> = {
  stone: null,
  copper: { base: '#d9823b', light: '#f4b07a' },
  iron: { base: '#8f9eb0', light: '#d8e2ee' },
  gold: { base: '#e8b83a', light: '#fff0a8' },
  gem: { base: '#9b5ccf', light: '#e2bcff' },
};

/**
 * The mine entrance in the overworld: a shaft going underground. Stone steps
 * lead down into the dark between two timber posts and a crossbeam, set into a
 * low pile of boulders. 48x40, base row 38 (two tiles wide, overhanging).
 */
export function drawMineEntrance(): PixelCanvas {
  const p = new PixelCanvas(48, 40);
  // Boulders heaped behind and around the shaft.
  const boulders: Array<[number, number, number, number]> = [
    [10, 12, 9, 7],
    [24, 9, 11, 8],
    [37, 13, 8, 6],
    [4, 20, 6, 6],
    [43, 21, 5, 5],
    [16, 6, 7, 5],
    [31, 4, 6, 5],
  ];
  for (const [cx, cy, rx, ry] of boulders) {
    for (let y = cy - ry; y <= cy + ry; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const l = -(nx * 0.6 + ny * 0.8);
        p.set(x, y, l > 0.45 ? P.stoneLight : l < -0.35 ? P.stoneDark : P.stone);
      }
    }
  }
  // A few glints of ore in the rocks.
  for (const [x, y, c] of [[20, 9, '#d9823b'], [29, 7, '#e8b83a'], [38, 12, '#9b5ccf'], [8, 13, '#d9823b']] as const) {
    p.set(x, y, c);
    p.set(x + 1, y, c);
  }
  // The shaft: a stone-rimmed opening with steps going down into darkness (deepest at the back).
  const x0 = 12;
  const x1 = 36;
  for (let y = 16; y <= 37; y++) {
    const depth = (37 - y) / 21; // 0 at the top step, 1 at the bottom of the stairs
    const step = Math.floor((37 - y) / 3);
    const riser = (37 - y) % 3 === 2;
    const shade = Math.round(150 - depth * 140);
    const tread = riser ? Math.max(8, shade - 40) : shade;
    const c = `#${[tread, tread - 8, tread - 14].map((v) => Math.max(6, v).toString(16).padStart(2, '0')).join('')}`;
    const inset = Math.round(depth * 4);
    for (let x = x0 + inset; x <= x1 - inset; x++) p.set(x, y, c);
    if (!riser && step < 4) p.set(x0 + inset + 2 + (step % 3) * 5, y, '#8a8078');
  }
  // Rim stones round the opening.
  for (let y = 16; y <= 37; y++) {
    const inset = Math.round(((37 - y) / 21) * 4);
    p.set(x0 + inset - 1, y, P.stoneDark);
    p.set(x1 - inset + 1, y, P.stoneDark);
  }
  for (let x = x0 - 2; x <= x1 + 2; x += 3) p.rect(x, 37, 3, 2, x % 2 ? P.stone : P.stoneLight);
  // Timber posts and crossbeam.
  p.rect(9, 12, 3, 26, P.woodDark);
  p.rect(10, 12, 1, 26, P.wood);
  p.rect(37, 12, 3, 26, P.woodDark);
  p.rect(38, 12, 1, 26, P.wood);
  p.rect(7, 10, 35, 3, P.wood);
  p.rect(7, 10, 35, 1, P.woodLight);
  p.rect(7, 12, 35, 1, P.woodDark);
  // Rails running down the steps.
  for (const rx of [19, 29]) {
    for (let y = 18; y <= 38; y++) {
      const inset = Math.round(((37 - Math.min(37, y)) / 21) * 3) * (rx < 24 ? 1 : -1);
      p.set(rx + inset, y, y > 30 ? '#8a9098' : '#4a4e54');
    }
  }
  // Lanterns hanging from the beam.
  for (const lx of [13, 34]) {
    p.set(lx + 1, 13, P.woodDark);
    p.rect(lx, 14, 3, 4, '#3a3a42');
    p.rect(lx + 1, 15, 1, 2, '#ffd76a');
  }
  p.outline(P.outline);
  return p;
}

/** A mine cart loaded with ore, 20x15, base row 14. */
export function drawMineCart(): PixelCanvas {
  const p = new PixelCanvas(20, 15);
  p.rect(2, 4, 16, 7, '#6a5040');
  p.rect(2, 4, 16, 1, '#8a6a52');
  p.rect(1, 3, 18, 2, '#5a5e64');
  for (const x of [6, 13]) p.rect(x, 5, 1, 6, '#4a3a2e');
  for (const [x, y, c] of [[4, 1, '#d9823b'], [8, 0, P.stone], [11, 1, '#8f9eb0'], [14, 0, '#e8b83a'], [6, 2, P.stoneLight], [12, 2, '#d9823b']] as const) p.rect(x, y, 3, 3, c);
  for (const x of [4, 13]) {
    p.rect(x, 11, 4, 4, '#2e2e34');
    p.rect(x + 1, 12, 2, 2, '#8a9098');
  }
  p.outline(P.outline);
  return p;
}

/** A breakable mine rock, 16x14 (same footprint as the overworld rock). */
export function drawMineRock(rng: Rng, kind: MineRockKind): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  const dark = '#4f4742';
  const mid = '#6e655e';
  const light = '#8e847b';
  for (let y = 1; y <= 12; y++) {
    for (let x = 0; x < 16; x++) {
      const nx = (x - 7.5) / (6.2 + rng.range(-0.3, 0.3));
      const ny = (y - 8) / 5;
      if (nx * nx + ny * ny > 1) continue;
      const l = -(nx * 0.55 + ny * 0.85);
      p.set(x, y, y === 12 ? dark : l > 0.45 ? light : l < -0.35 ? dark : mid);
    }
  }
  p.set(5, 5, '#aea397');
  const ore = ORE[kind];
  if (ore) {
    const spots = kind === 'gem' ? 3 : 5;
    for (let i = 0; i < spots; i++) {
      const x = rng.int(3, 11);
      const y = rng.int(5, 10);
      p.rect(x, y, kind === 'gem' ? 2 : 1, kind === 'gem' ? 2 : 1, ore.base);
      p.set(x, y, ore.light);
    }
  }
  p.outline(P.outline);
  return p;
}

/** A hole with a ladder leading down, 16x16 (flat on the floor). */
export function drawLadderDown(): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  for (let y = 2; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      const nx = (x - 7.5) / 6.5;
      const ny = (y - 8) / 6;
      if (nx * nx + ny * ny <= 1) p.set(x, y, y < 5 ? '#1e1816' : '#0c0908');
    }
  }
  p.rect(5, 3, 1, 11, P.wood);
  p.rect(10, 3, 1, 11, P.wood);
  for (let y = 4; y <= 12; y += 3) p.rect(5, y, 6, 1, P.woodLight);
  p.outline(P.outline);
  return p;
}

/** The ladder back up to daylight, 16x26, base row 24. */
export function drawLadderUp(): PixelCanvas {
  const p = new PixelCanvas(16, 26);
  p.rect(3, 0, 2, 25, P.woodDark);
  p.rect(11, 0, 2, 25, P.woodDark);
  for (let y = 2; y <= 22; y += 4) {
    p.rect(3, y, 10, 2, P.wood);
    p.rect(3, y, 10, 1, P.woodLight);
  }
  // A shaft of daylight.
  p.rect(5, 0, 6, 2, '#fff3c4', 150);
  p.outline(P.outline);
  return p;
}

/** Slime sheet: 2 frames of 14x11 (squash, stretch), drawn white so it can be tinted. */
export function drawSlimeSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 11);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    const h = f === 0 ? 6 : 8;
    const w = f === 0 ? 6.5 : 5.5;
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 14; x++) {
        const nx = (x - 6.5) / w;
        const ny = (y - 10) / h;
        if (y > 10 || nx * nx + ny * ny > 1) continue;
        const shade = y < 10 - h * 0.6 ? 255 : y > 8 ? 170 : 215;
        const v = shade.toString(16).padStart(2, '0');
        p.set(ox + x, y, `#${v}${v}${v}`);
      }
    }
    // Eyes.
    const ey = f === 0 ? 7 : 5;
    p.set(ox + 4, ey, '#1a1412');
    p.set(ox + 8, ey, '#1a1412');
    p.set(ox + 4, ey - 1, '#ffffff');
  }
  p.outline(P.outline);
  return p;
}

/**
 * One floor of the mine as a single image: floor tiles with pebbles and
 * cracks, walls with a lit top edge. `wall(x, y)` says which tiles are rock.
 */
export function drawCaveFloor(
  rng: Rng,
  width: number,
  height: number,
  wall: (x: number, y: number) => boolean,
  size = 16,
  opts: { palette?: MinePalette; tile?: (x: number, y: number) => 'water' | 'lava' | null } = {},
): HTMLCanvasElement {
  const CAVE = opts.palette ?? DEFAULT_CAVE;
  const p = new PixelCanvas(width * size, height * size);
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const x0 = tx * size;
      const y0 = ty * size;
      if (wall(tx, ty)) {
        const openBelow = ty + 1 < height && !wall(tx, ty + 1);
        p.rect(x0, y0, size, size, CAVE.wall);
        if (openBelow) {
          // The visible rock face, lit from above.
          p.rect(x0, y0 + 4, size, size - 4, CAVE.wallFace);
          p.rect(x0, y0 + 4, size, 2, CAVE.wallTop);
          for (let i = 0; i < 3; i++) p.rect(x0 + rng.int(1, 13), y0 + rng.int(7, 13), 2, 1, CAVE.wallFaceDark);
        } else if (rng.chance(0.2)) {
          p.set(x0 + rng.int(2, 13), y0 + rng.int(2, 13), CAVE.wallFace);
        }
        continue;
      }
      const special = opts.tile?.(tx, ty);
      if (special === 'water') {
        p.rect(x0, y0, size, size, '#1e4a5a');
        for (let i = 0; i < 4; i++) p.rect(x0 + rng.int(1, 11), y0 + rng.int(2, 13), rng.int(2, 4), 1, '#3a7a8a');
        // A lip of wet rock where the pool meets the floor above.
        if (ty > 0 && opts.tile?.(tx, ty - 1) !== 'water') p.rect(x0, y0, size, 2, wall(tx, ty - 1) ? CAVE.floorDark : '#2a5866');
        continue;
      }
      p.rect(x0, y0, size, size, special === 'lava' ? CAVE.floorDark : CAVE.floor);
      for (let i = 0; i < 7; i++) p.set(x0 + rng.int(0, 15), y0 + rng.int(0, 15), rng.chance(0.5) ? CAVE.floorDark : CAVE.floorLight);
      if (rng.chance(0.12)) p.rect(x0 + rng.int(2, 11), y0 + rng.int(2, 11), 3, 2, '#62564c');
      // Shadow under a wall above, ragged rather than a straight band.
      if (ty > 0 && wall(tx, ty - 1)) for (let x = 0; x < size; x++) p.rect(x0 + x, y0, 1, 2 + rng.int(0, 2), CAVE.floorDark);
    }
  }
  // Rock edges: loose stones spill onto the floor and the rock's sides crumble, so walls aren't square.
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (wall(tx, ty)) continue;
      const x0 = tx * size;
      const y0 = ty * size;
      for (const [dx, side] of [[-1, 0], [1, size - 1]] as const) {
        if (!wall(tx + dx, ty)) continue;
        let depth = 1;
        for (let y = 0; y < size; y++) {
          depth = Math.max(1, Math.min(3, depth + (rng.chance(0.3) ? (rng.chance(0.5) ? 1 : -1) : 0)));
          for (let d = 0; d < depth; d++) p.set(x0 + (dx < 0 ? side + d : side - d), y0 + y, d === depth - 1 ? CAVE.wallFaceDark : CAVE.wall);
        }
      }
      if (ty > 0 && wall(tx, ty - 1)) for (let i = 0; i < 3; i++) p.rect(x0 + rng.int(1, 13), y0 + rng.int(2, 4), 2, 1, CAVE.wallFaceDark);
    }
  }
  return p.toCanvas();
}

/** Cave bat, two wing frames, 14x10 each (sheet 28x10). Drawn white-grey to tint. */
export function drawBatSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 10);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    p.rect(ox + 5, 3, 4, 4, '#6a5a7a');
    p.rect(ox + 6, 2, 1, 1, '#6a5a7a');
    p.rect(ox + 8, 2, 1, 1, '#6a5a7a');
    const wy = f === 0 ? 2 : 5;
    p.rect(ox + 1, wy, 4, 2, '#4a3a5a');
    p.rect(ox + 9, wy, 4, 2, '#4a3a5a');
    p.rect(ox + 0, wy + (f === 0 ? -1 : 1), 2, 1, '#4a3a5a');
    p.rect(ox + 12, wy + (f === 0 ? -1 : 1), 2, 1, '#4a3a5a');
    p.set(ox + 6, 4, '#f05a4a');
    p.set(ox + 8, 4, '#f05a4a');
  }
  p.outline(P.outline);
  return p;
}

/** Rock crab: a rock with legs, two frames 16x12 (sheet 32x12). */
export function drawCrabSheet(): PixelCanvas {
  const p = new PixelCanvas(32, 12);
  for (let f = 0; f < 2; f++) {
    const ox = f * 16;
    for (let y = 1; y <= 8; y++) for (let x = 2; x <= 13; x++) if (((x - 7.5) / 6) ** 2 + ((y - 6) / 5) ** 2 <= 1) p.set(ox + x, y, y < 4 ? '#b0a8a0' : '#8a8078');
    p.set(ox + 5, 3, '#6a625a');
    p.set(ox + 10, 5, '#6a625a');
    const leg = f === 0 ? 0 : 1;
    for (const x of [3, 5, 10, 12]) p.rect(ox + x + (x < 8 ? -leg : leg), 9, 1, 2, '#c8452e');
    p.set(ox + 6, 6, '#1a1412');
    p.set(ox + 9, 6, '#1a1412');
  }
  p.outline(P.outline);
  return p;
}

/** A floating ghost, two frames 12x14 (sheet 24x14). */
export function drawGhostSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 14);
  for (let f = 0; f < 2; f++) {
    const ox = f * 12;
    for (let y = 0; y < 12; y++) for (let x = 1; x < 11; x++) if (y > 5 || ((x - 5.5) / 4.5) ** 2 + ((y - 5) / 5) ** 2 <= 1) p.set(ox + x, y, y < 3 ? '#f4f0ff' : '#d8d0f0');
    for (let x = 1; x < 11; x++) if ((x + f) % 3 === 0) p.set(ox + x, 12, '#d8d0f0');
    p.rect(ox + 3, 4, 2, 2, '#2a2040');
    p.rect(ox + 7, 4, 2, 2, '#2a2040');
    p.rect(ox + 5, 8, 2, 1, '#2a2040');
  }
  p.outline(P.outline);
  return p;
}

/** A treasure chest, closed and open (sheet 32x14). */
export function drawTreasureSheet(): PixelCanvas {
  const p = new PixelCanvas(32, 14);
  for (let f = 0; f < 2; f++) {
    const ox = f * 16;
    p.rect(ox + 1, 6, 14, 8, '#8a5a2a');
    p.rect(ox + 1, 9, 14, 1, '#e8c25a');
    if (f === 0) {
      p.rect(ox + 1, 2, 14, 4, '#a86a32');
      p.rect(ox + 1, 2, 14, 1, '#c8884a');
      p.rect(ox + 7, 5, 2, 3, '#e8c25a');
    } else {
      p.rect(ox + 1, 0, 14, 3, '#6a4220');
      p.rect(ox + 2, 6, 12, 2, '#2a1a0e');
      p.set(ox + 5, 6, '#ffe27a');
      p.set(ox + 10, 7, '#ffe27a');
    }
  }
  p.outline(P.outline);
  return p;
}
