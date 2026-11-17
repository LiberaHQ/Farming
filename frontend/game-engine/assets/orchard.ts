import type { FruitTreeKind, Season } from '@farming/shared';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/*
 * Original pixel art for fruit trees: a sapling growing into a round little
 * tree over a season, with seasonal leaves, blossoms, and fruit.
 */

export const FRUIT_TREE_W = 32;
export const FRUIT_TREE_H = 44;

const FRUIT: Record<FruitTreeKind, { main: string; light: string; dark: string }> = {
  apple: { main: '#d8302a', light: '#ff8a70', dark: '#901c18' },
  cherry: { main: '#a01430', light: '#e05a6a', dark: '#5a0818' },
  peach: { main: '#f49a6a', light: '#ffd8b0', dark: '#c86a48' },
};

const BLOSSOM: Record<FruitTreeKind, string> = { apple: '#fff4f8', cherry: '#ffc0d8', peach: '#ff9ab8' };

const LEAVES: Record<Season, { main: string; light: string; dark: string } | null> = {
  spring: { main: '#5aac48', light: '#8ad064', dark: '#3a7a32' },
  summer: { main: '#3f8c3c', light: '#64b04a', dark: '#2a6430' },
  fall: { main: '#c8862a', light: '#e8b04a', dark: '#8a5420' },
  winter: null,
};

const TRUNK = { main: P.trunk, light: P.trunkLight, dark: P.trunkDark };

/** Deterministic little hash for dappled leaves. */
const h = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function canopy(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, leaves: { main: string; light: string; dark: string }): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      // A bumpy edge so it reads as foliage, not a ball.
      if (d > 1 - (h(x, y) % 5) * 0.03) continue;
      const lit = x - cx < -rx * 0.2 && y - cy < -ry * 0.1;
      const shade = y - cy > ry * 0.45 || x - cx > rx * 0.55;
      let c = lit ? leaves.light : shade ? leaves.dark : leaves.main;
      if (h(x, y) % 9 === 0) c = shade ? leaves.main : leaves.dark;
      p.set(x, y, c);
    }
  }
}

function trunk(p: PixelCanvas, cx: number, top: number, bottom: number, w: number): void {
  const x0 = Math.round(cx - w / 2);
  p.rect(x0, top, w, bottom - top, TRUNK.main);
  p.rect(x0, top, 1, bottom - top, TRUNK.light);
  p.rect(x0 + w - 1, top, 1, bottom - top, TRUNK.dark);
  // Roots.
  p.rect(x0 - 1, bottom - 2, 1, 2, TRUNK.dark);
  p.rect(x0 + w, bottom - 2, 1, 2, TRUNK.dark);
}

function fruitAt(p: PixelCanvas, kind: FruitTreeKind, x: number, y: number): void {
  const c = FRUIT[kind];
  if (kind === 'cherry') {
    // A pair on a stem.
    p.set(x + 1, y - 2, '#3a6a2a');
    p.set(x + 2, y - 1, '#3a6a2a');
    p.rect(x, y, 2, 2, c.main);
    p.rect(x + 3, y, 2, 2, c.main);
    p.set(x, y, c.light);
    p.set(x + 3, y, c.light);
    p.set(x + 1, y + 1, c.dark);
    p.set(x + 4, y + 1, c.dark);
    return;
  }
  p.rect(x, y, 4, 4, c.main);
  p.set(x, y, '#000000', 0);
  p.set(x + 3, y + 3, c.dark);
  p.set(x + 1, y + 1, c.light);
  p.set(x + 2, y - 1, '#5a3a1a');
  if (kind === 'peach') p.set(x + 2, y + 2, '#e8806a');
}

/** Bare winter branches spreading from the top of the trunk, with a dusting of snow. */
function branches(p: PixelCanvas, cx: number, top: number, spread: number): void {
  const line = (x0: number, y0: number, angle: number, len: number, w: number) => {
    const end = { x: x0, y: y0 };
    for (let i = 0; i <= len; i++) {
      const x = x0 + Math.sin(angle) * i;
      const y = y0 - Math.cos(angle) * i;
      p.rect(Math.round(x), Math.round(y), i < len * 0.5 ? w : 1, 1, i < len * 0.4 ? TRUNK.main : TRUNK.dark);
      end.x = x;
      end.y = y;
    }
    return end;
  };
  const base = top + spread + 4;
  p.rect(cx - 1, top + 2, 2, base - top, TRUNK.main);
  const s = spread / 9;
  const limbs: Array<[number, number, number]> = [
    [-0.95, 9, base - 2],
    [-0.45, 11, base - 5],
    [0.05, 10, base - 6],
    [0.55, 11, base - 4],
    [1.0, 8, base - 1],
  ];
  for (const [angle, len, y] of limbs) {
    const tip = line(cx, y, angle, Math.round(len * s), 2);
    // A twig off each limb, and snow resting on it.
    line(tip.x, tip.y, angle + (angle < 0 ? 0.7 : -0.7), Math.max(2, Math.round(3 * s)), 1);
    p.set(Math.round(tip.x), Math.round(tip.y) - 1, '#f4f8ff');
    p.set(Math.round(tip.x) + 1, Math.round(tip.y) - 1, '#e0ecf8');
  }
}

/**
 * A fruit tree, 32x44, anchored at the bottom centre. `stage` 0 sapling …
 * 3 grown. `blossom` shows flowers (the start of its fruiting season, before
 * fruit sets); `fruit` is how many hang on it (0–3).
 */
export function drawFruitTree(kind: FruitTreeKind, stage: number, season: Season, fruit: number, blossom: boolean): PixelCanvas {
  const p = new PixelCanvas(FRUIT_TREE_W, FRUIT_TREE_H);
  const cx = 16;
  const base = FRUIT_TREE_H - 1;
  const leaves = LEAVES[season];
  if (stage === 0) {
    // A twig in a little mound of dirt, with a pair of leaves (or bare in winter).
    p.rect(cx - 3, base - 1, 6, 2, P.dirtDark);
    p.rect(cx, base - 10, 1, 9, TRUNK.main);
    if (leaves) {
      p.rect(cx - 3, base - 9, 3, 2, leaves.main);
      p.rect(cx + 1, base - 11, 3, 2, leaves.light);
      p.set(cx - 2, base - 6, leaves.dark);
    }
  } else if (stage === 1) {
    trunk(p, cx, base - 12, base, 2);
    if (leaves) canopy(p, cx, base - 16, 6, 5, leaves);
    else branches(p, cx, base - 14, 4);
  } else if (stage === 2) {
    trunk(p, cx, base - 16, base, 3);
    if (leaves) canopy(p, cx, base - 22, 9, 8, leaves);
    else branches(p, cx, base - 20, 6);
  } else {
    trunk(p, cx, base - 18, base, 4);
    if (leaves) {
      canopy(p, cx, base - 27, 14, 12, leaves);
      if (blossom) {
        for (const [x, y] of [[8, 12], [14, 9], [21, 11], [11, 18], [19, 17], [25, 19], [6, 21], [16, 22], [23, 24], [10, 25]]) {
          p.set(x, y, BLOSSOM[kind]);
          p.set(x + 1, y, BLOSSOM[kind]);
          p.set(x, y + 1, BLOSSOM[kind]);
          p.set(x + 1, y + 1, '#f4e070');
        }
      }
      const spots: Array<[number, number]> = [[9, 18], [20, 14], [15, 24]];
      for (let i = 0; i < Math.min(fruit, spots.length); i++) fruitAt(p, kind, spots[i][0], spots[i][1]);
    } else branches(p, cx, base - 24, 9);
  }
  p.outline(P.outline);
  return p;
}

/** Item icons: saplings and fruit (16x16). */
export function drawSaplingIcon(p: PixelCanvas, kind: FruitTreeKind): void {
  p.rect(5, 12, 6, 3, '#a85e3a');
  p.rect(5, 12, 6, 1, '#c87a50');
  p.rect(7, 4, 2, 8, TRUNK.main);
  p.rect(3, 5, 4, 3, '#5aac48');
  p.rect(9, 3, 4, 3, '#8ad064');
  p.set(4, 6, '#3a7a32');
  const c = FRUIT[kind];
  p.rect(10, 8, 3, 3, c.main);
  p.set(10, 8, c.light);
}

export function drawFruitIcon(p: PixelCanvas, kind: FruitTreeKind): void {
  const c = FRUIT[kind];
  if (kind === 'cherry') {
    p.rect(7, 2, 1, 4, '#3a6a2a');
    p.rect(8, 2, 3, 1, '#3a6a2a');
    p.rect(10, 3, 1, 4, '#3a6a2a');
    p.rect(5, 6, 1, 3, '#3a6a2a');
    p.rect(6, 5, 1, 1, '#3a6a2a');
    for (const [x, y] of [[3, 9], [9, 7]]) {
      p.rect(x, y, 5, 5, c.main);
      p.rect(x + 1, y + 1, 2, 1, c.light);
      p.rect(x + 3, y + 3, 2, 2, c.dark);
    }
    return;
  }
  for (let y = 4; y <= 14; y++) for (let x = 2; x <= 13; x++) if (((x - 7.5) / 5.6) ** 2 + ((y - 9.3) / 5) ** 2 <= 1) p.set(x, y, x > 9 && y > 10 ? c.dark : c.main);
  p.rect(4, 6, 2, 2, c.light);
  p.rect(7, 1, 2, 4, '#5a3a1a');
  p.rect(9, 2, 4, 2, '#5aac48');
  if (kind === 'peach') {
    for (let y = 5; y < 14; y++) p.set(7 + (y % 2), y, '#e8806a');
  }
}
