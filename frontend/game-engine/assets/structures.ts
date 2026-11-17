import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import type { Rng } from '../utils/random';

const METAL = { base: '#3b3b45', light: '#5c5c6a' };
const GLASS = { day: '#9fd3ea', glow: '#ffe9a8', glowLight: '#fff6d6' };
const ROOF = { base: '#a3483a', dark: '#7e3329', light: '#c45f4c' };

/**
 * Fence segment, 16x22, standing on row 21. `east`/`west` draw rails toward
 * neighbouring fences; vertical neighbours meet naturally post-to-post.
 * No outline, so rails join seamlessly across tiles.
 */
export function drawFence(east: boolean, west: boolean): PixelCanvas {
  const p = new PixelCanvas(16, 22);
  for (const rowTop of [9, 14]) {
    for (const [on, x0, x1] of [
      [west, 0, 6],
      [east, 9, 15],
    ] as const) {
      if (!on) continue;
      p.rect(x0, rowTop, x1 - x0 + 1, 1, P.woodLight);
      p.rect(x0, rowTop + 1, x1 - x0 + 1, 1, P.wood);
      p.rect(x0, rowTop + 2, x1 - x0 + 1, 1, P.woodDark);
    }
  }
  p.rect(6, 5, 4, 17, P.wood);
  p.rect(6, 5, 1, 17, P.woodLight);
  p.rect(9, 5, 1, 17, P.woodDark);
  p.rect(6, 4, 4, 1, P.woodDark);
  p.rect(7, 3, 2, 1, P.woodDark);
  p.rect(6, 21, 4, 1, P.trunkDark);
  return p;
}

/** Lamp post, 16x34, base row 32. */
export function drawLampPost(): PixelCanvas {
  const p = new PixelCanvas(16, 34);
  p.rect(7, 9, 2, 22, METAL.base);
  p.rect(7, 9, 1, 22, METAL.light);
  p.rect(5, 30, 6, 3, P.stoneDark);
  p.rect(5, 30, 6, 1, P.stone);
  // lantern
  p.rect(4, 3, 8, 1, METAL.base);
  p.rect(5, 2, 6, 1, METAL.base);
  p.rect(4, 4, 8, 5, METAL.base);
  p.rect(5, 4, 6, 4, GLASS.glow);
  p.rect(5, 4, 2, 2, GLASS.glowLight);
  p.rect(7, 4, 1, 4, METAL.base);
  p.rect(5, 9, 6, 1, METAL.base);
  p.outline(P.outline);
  return p;
}

/** Storage chest, 16x16, base row 14. */
export function drawChest(): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  p.rect(2, 7, 12, 8, P.wood);
  p.rect(2, 14, 12, 1, P.woodDark);
  p.rect(2, 3, 12, 4, P.woodLight);
  p.rect(2, 6, 12, 1, P.woodDark);
  for (const x of [4, 11]) p.rect(x, 3, 1, 12, '#9c5525');
  p.rect(7, 6, 2, 3, '#e8c25a');
  p.set(7, 8, P.outline);
  p.outline(P.outline);
  return p;
}

/**
 * The player's cottage, 64x76 over a three-tile footprint (it overhangs half a
 * tile each side), base row 74: a log cabin with a shingled roof and a dormer
 * over the door, a stone chimney, two windows with flower boxes, a lantern by
 * the door, and a front porch with a bench, a potted fern and steps down.
 */
export function drawCottage(rng: Rng): PixelCanvas {
  const p = new PixelCanvas(64, 76);
  const LOG = [P.trunkLight, P.trunk, P.trunkDark] as const;

  // Stone foundation under the porch.
  for (let x = 2; x < 62; x++) {
    for (let y = 68; y < 75; y++) {
      const brick = (Math.floor((x + (Math.floor((y - 68) / 3) % 2) * 3) / 6) + Math.floor((y - 68) / 3)) % 3;
      p.set(x, y, (y - 68) % 3 === 2 || (x + (Math.floor((y - 68) / 3) % 2) * 3) % 6 === 0 ? P.stoneDark : brick === 0 ? P.stoneLight : P.stone);
    }
  }

  // Log walls: rounded logs stacked, with the log ends showing at both corners.
  for (let y = 33; y < 61; y++) {
    const band = (y - 33) % 4;
    p.rect(5, y, 54, 1, band === 0 ? LOG[0] : band === 3 ? LOG[2] : LOG[1]);
  }
  for (let i = 0; i < 18; i++) p.rect(rng.int(6, 56), rng.int(34, 59), 2, 1, P.trunkDark);
  for (const cx of [4, 59]) {
    for (let y = 33; y < 61; y += 4) {
      p.rect(cx - 2, y, 5, 4, P.trunk);
      p.rect(cx - 1, y + 1, 3, 2, '#c99a62');
      p.set(cx, y + 1, '#a87a48');
    }
  }

  // Windows with crossbars and flower boxes.
  for (const wx of [10, 43]) {
    p.rect(wx - 1, 38, 13, 12, P.woodDark);
    p.rect(wx, 39, 11, 10, GLASS.day);
    p.rect(wx, 39, 4, 3, '#d9f0f8');
    p.rect(wx + 5, 39, 1, 10, P.woodDark);
    p.rect(wx, 43, 11, 1, P.woodDark);
    p.rect(wx - 2, 49, 15, 1, P.woodLight);
    // Flower box.
    p.rect(wx - 1, 50, 13, 3, '#8a5a32');
    p.rect(wx - 1, 50, 13, 1, '#a8723f');
    const flowers = [P.flowerPink, P.flowerYellow, P.flowerWhite, P.berry];
    for (let i = 0; i < 6; i++) {
      p.set(wx + i * 2, 49, flowers[(i + wx) % flowers.length]);
      p.set(wx + i * 2 + 1, 49, P.leafLight);
    }
  }

  // Door with an arched top, panels and a brass knob; a lantern beside it.
  p.rect(26, 38, 12, 23, P.woodDark);
  p.rect(28, 37, 8, 1, P.woodDark);
  p.rect(27, 39, 10, 22, '#3f7a6a');
  p.rect(29, 38, 6, 1, '#3f7a6a');
  p.rect(28, 41, 8, 7, '#4a8a78');
  p.rect(28, 50, 8, 9, '#4a8a78');
  p.rect(29, 42, 6, 1, '#5aa08c');
  p.set(35, 51, '#f2cc45');
  p.set(35, 52, '#c8982a');
  p.rect(40, 41, 3, 5, '#3a3a42');
  p.rect(41, 42, 1, 3, '#f4d24a');
  p.set(41, 40, '#3a3a42');

  // Porch: boards across the front, a bench and a fern, a mat, and steps down.
  for (let y = 60; y < 68; y++) {
    p.rect(2, y, 60, 1, (y - 60) % 3 === 2 ? P.woodDark : y === 60 ? P.woodLight : P.wood);
  }
  for (let x = 6; x < 60; x += 9) p.rect(x, 61, 1, 6, '#8a5a32');
  p.rect(2, 67, 60, 1, '#5a3a20');
  // Bench against the wall.
  p.rect(8, 56, 12, 2, P.woodLight);
  p.rect(8, 58, 12, 1, P.woodDark);
  for (const bx of [9, 18]) p.rect(bx, 59, 1, 3, P.woodDark);
  // Potted fern.
  p.rect(48, 58, 6, 4, '#b8613a');
  p.rect(48, 58, 6, 1, '#d47a4a');
  for (const [fx, fy] of [[47, 55], [49, 53], [51, 52], [53, 53], [55, 55], [50, 56], [52, 56]]) p.rect(fx, fy, 2, 3, P.leafLight);
  p.set(51, 54, P.leafDark);
  // Doormat.
  p.rect(27, 61, 10, 3, '#b8463a');
  p.rect(28, 62, 8, 1, '#d8664a');
  // Steps.
  for (const [y, inset] of [[68, 0], [71, 2]] as const) {
    p.rect(24 + inset, y, 16 - inset * 2, 3, P.wood);
    p.rect(24 + inset, y, 16 - inset * 2, 1, P.woodLight);
    p.rect(24 + inset, y + 2, 16 - inset * 2, 1, P.woodDark);
  }

  // Roof: rows of scalloped shingles over the walls, overhanging both sides.
  for (let y = 8; y <= 34; y++) {
    const inset = Math.round((34 - y) * 0.36);
    const row = Math.floor((y - 8) / 3);
    const inRow = (y - 8) % 3;
    for (let x = inset; x <= 63 - inset; x++) {
      const shift = row % 2 ? 2 : 0;
      const cell = (x + shift) % 5;
      let c: string = ROOF.base;
      if (inRow === 2) c = cell === 0 || cell === 4 ? ROOF.dark : '#8e3c30';
      else if (inRow === 0 && cell === 2) c = ROOF.light;
      if (x <= inset + 1) c = ROOF.light;
      if (x >= 62 - inset) c = ROOF.dark;
      if (y === 34) c = '#5e2620';
      p.set(x, y, c);
    }
  }
  // Ridge cap.
  p.rect(9, 7, 46, 2, ROOF.dark);
  p.rect(9, 7, 46, 1, ROOF.light);

  // Dormer over the door: little log gable with an attic window.
  for (let y = 16; y <= 31; y++) {
    const half = Math.round((y - 14) * 0.62);
    for (let x = 32 - half; x <= 31 + half; x++) p.set(x, y, (y - 16) % 3 === 0 ? P.trunkLight : (y - 16) % 3 === 2 ? P.trunkDark : P.trunk);
  }
  p.rect(28, 22, 8, 6, P.woodDark);
  p.rect(29, 23, 6, 4, GLASS.day);
  p.rect(29, 23, 2, 1, '#d9f0f8');
  p.rect(31, 23, 1, 4, P.woodDark);
  // Dormer roof: two sloping eaves meeting at a peak.
  for (let i = 0; i <= 13; i++) {
    for (let t = 0; t < 3; t++) {
      p.set(31 - i, 12 + i + t, t === 0 ? ROOF.light : ROOF.base);
      p.set(32 + i, 12 + i + t, t === 0 ? ROOF.base : ROOF.dark);
    }
  }
  p.rect(31, 11, 2, 2, ROOF.dark);

  // Stone chimney poking through the roof.
  for (let y = 0; y < 16; y++) {
    for (let x = 45; x < 52; x++) {
      const course = Math.floor(y / 3);
      const joint = y % 3 === 2 || (x + (course % 2) * 2) % 4 === 0;
      p.set(x, y, joint ? P.stoneDark : course % 2 ? P.stone : P.stoneLight);
    }
  }
  p.rect(44, 0, 9, 2, P.stoneDark);
  p.rect(44, 0, 9, 1, P.stoneHi);

  p.outline(P.outline);
  return p;
}

/** Floor tiles for the tileset (no transparency). */
export function woodPathTile(rng: Rng): PixelCanvas {
  const t = new PixelCanvas(16, 16);
  for (let y = 0; y < 16; y++) {
    const c = y % 4 === 3 ? P.woodDark : y % 4 === 0 ? P.woodLight : P.wood;
    t.rect(0, y, 16, 1, c);
  }
  for (let row = 0; row < 4; row++) {
    const x = (row * 7 + rng.int(0, 3)) % 16;
    t.rect(x, row * 4, 1, 3, P.woodDark);
  }
  for (let i = 0; i < 4; i++) t.set(rng.int(0, 15), rng.int(0, 15), P.trunk);
  return t;
}

export function stonePathTile(rng: Rng): PixelCanvas {
  const t = new PixelCanvas(16, 16);
  t.rect(0, 0, 16, 16, P.stoneDark);
  const stones: Array<[number, number, number, number]> = [
    [1, 1, 6, 5],
    [8, 1, 7, 4],
    [1, 7, 4, 4],
    [6, 6, 5, 5],
    [12, 6, 3, 5],
    [1, 12, 7, 3],
    [9, 12, 6, 3],
  ];
  for (const [x, y, w, h] of stones) {
    t.rect(x, y, w, h, rng.chance(0.5) ? P.stone : P.stoneLight);
    t.rect(x, y, w, 1, P.stoneHi);
    t.rect(x, y + h - 1, w, 1, P.stone);
  }
  return t;
}

/** Soft radial light used to cut through the night overlay. */
export function drawLight(size: number): PixelCanvas {
  const p = new PixelCanvas(size, size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      if (d >= 1) continue;
      const a = 1 - d * d * (3 - 2 * d); // smoothstep falloff
      p.set(x, y, '#ffffff', Math.round(a * 255));
    }
  }
  return p;
}
