import type { Rng } from '../utils/random';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

export interface Foliage {
  base: string;
  dark: string;
  light: string;
  hi: string;
}

export const OAK_FOLIAGE: Record<'spring' | 'summer' | 'fall' | 'winter', Foliage> = {
  spring: { base: P.leaf, dark: P.leafDark, light: P.leafLight, hi: P.leafHi },
  summer: { base: '#3a8236', dark: '#28602f', light: '#519e40', hi: '#77bd52' },
  fall: { base: '#d07a2c', dark: '#a4521f', light: '#e89a3c', hi: '#f4c35a' },
  winter: { base: '#dfe7ec', dark: '#a7b6c2', light: '#f3f7fa', hi: '#ffffff' },
};

export const PINE_FOLIAGE: Record<'spring' | 'summer' | 'fall' | 'winter', Foliage> = {
  spring: { base: P.pine, dark: P.pineDark, light: P.pineLight, hi: P.pineHi },
  summer: { base: P.pine, dark: P.pineDark, light: P.pineLight, hi: P.pineHi },
  fall: { base: '#3d7a4c', dark: '#2a5a3a', light: '#5c9460', hi: '#9ab86a' },
  winter: { base: P.pine, dark: P.pineDark, light: '#e9f0f4', hi: '#ffffff' },
};

export const GRASS_FOLIAGE: Record<'spring' | 'summer' | 'fall' | 'winter', Foliage> = {
  spring: { base: P.grassLight, dark: P.grassDark, light: P.grassLight, hi: P.grassHi },
  summer: { base: '#6aa846', dark: '#3f742c', light: '#6aa846', hi: '#8cc256' },
  fall: { base: '#c49a45', dark: '#8a6a2c', light: '#c49a45', hi: '#e3c26a' },
  winter: { base: '#b8c4bd', dark: '#7f8f86', light: '#b8c4bd', hi: '#e4ebe7' },
};

/** Positive = lit (light comes from the top-left), negative = in shade. */
const lightLevel = (dx: number, dy: number, radius: number) => -(dx * 0.6 + dy * 0.8) / radius;

type Circle = readonly [cx: number, cy: number, r: number];
const inCircles = (circles: readonly Circle[], x: number, y: number) =>
  circles.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r);

/** Broadleaf tree, 32x44. Base of trunk sits on row 40. */
export function drawOak(rng: Rng, f: Foliage = OAK_FOLIAGE.spring, blossom = false): PixelCanvas {
  const p = new PixelCanvas(32, 44);

  for (let y = 24; y <= 40; y++) {
    for (let x = 13; x <= 18; x++) p.set(x, y, x <= 14 ? P.trunkLight : x >= 17 ? P.trunkDark : P.trunk);
  }
  p.set(12, 40, P.trunkDark);
  p.set(19, 40, P.trunkDark);
  p.set(12, 39, P.trunk);
  p.set(19, 39, P.trunkDark);
  for (let i = 0; i < 4; i++) p.set(rng.int(14, 17), rng.int(31, 38), P.trunkDark);

  const j = () => rng.int(-1, 1);
  const canopy: Circle[] = [
    [16 + j(), 14, 11],
    [8, 19 + j(), 6.5],
    [24, 19 + j(), 6.5],
    [16, 21, 8],
    [10 + j(), 10, 6],
    [22 + j(), 10, 6],
  ];
  const inCanopy = (x: number, y: number) => inCircles(canopy, x, y);

  for (let y = 1; y < 31; y++) {
    for (let x = 1; x < 31; x++) {
      if (!inCanopy(x, y)) continue;
      const l = lightLevel(x - 16, y - 15, 12);
      let c: string = l > 0.45 ? f.light : l < -0.45 ? f.dark : f.base;
      if (!inCanopy(x, y + 1)) c = f.dark; // underside rim
      p.set(x, y, c);
    }
  }
  // Leaf clusters and texture.
  for (let i = 0; i < 16; i++) {
    const x = rng.int(4, 26);
    const y = rng.int(3, 24);
    if (inCanopy(x, y) && inCanopy(x + 1, y) && lightLevel(x - 16, y - 15, 12) > 0.15) {
      p.set(x, y, f.hi);
      p.set(x + 1, y, f.hi);
      p.set(x, y + 1, f.light);
    }
  }
  for (let i = 0; i < 20; i++) {
    const x = rng.int(3, 28);
    const y = rng.int(4, 27);
    if (inCanopy(x, y) && inCanopy(x, y + 1) && lightLevel(x - 16, y - 15, 12) < 0.3) p.set(x, y, f.dark);
  }
  // Spring blossom: pink and white flowers across the canopy.
  if (blossom) {
    for (let i = 0; i < 34; i++) {
      const x = rng.int(3, 28);
      const y = rng.int(3, 26);
      if (!inCanopy(x, y) || !inCanopy(x + 1, y)) continue;
      const c = i % 3 === 0 ? '#ffffff' : i % 2 ? '#f4a6c6' : '#f7c4d9';
      p.set(x, y, c);
      if (i % 2) p.set(x + 1, y, c);
    }
  }
  // Canopy casts shade on the top of the trunk.
  for (let x = 13; x <= 18; x++) {
    for (let y = 20; y < 32; y++) {
      if (!inCanopy(x, y) && inCanopy(x, y - 1)) {
        p.set(x, y, P.trunkDark);
        break;
      }
    }
  }
  p.outline(P.outline);
  return p;
}

/** Conifer, 28x46. Base of trunk sits on row 43. */
export function drawPine(rng: Rng, f: Foliage = PINE_FOLIAGE.spring): PixelCanvas {
  const p = new PixelCanvas(28, 46);
  for (let y = 36; y <= 43; y++) {
    for (let x = 12; x <= 15; x++) p.set(x, y, x === 12 ? P.trunkLight : x === 15 ? P.trunkDark : P.trunk);
  }
  p.set(11, 43, P.trunkDark);
  p.set(16, 43, P.trunkDark);

  const cx = 13.5;
  // Bottom tier first so upper tiers overlap it, producing layered boughs.
  const tiers = [
    { top: 27, bottom: 39, half: 12 },
    { top: 18, bottom: 31, half: 9.5 },
    { top: 9, bottom: 22, half: 7 },
    { top: 2, bottom: 13, half: 4.5 },
  ];
  for (const tier of tiers) {
    for (let y = tier.top; y <= tier.bottom; y++) {
      const t = (y - tier.top) / (tier.bottom - tier.top);
      const hw = 0.8 + (tier.half - 0.8) * t;
      for (let x = 0; x < 28; x++) {
        const dx = x - cx;
        if (Math.abs(dx) > hw) continue;
        if (y === tier.bottom && rng.chance(0.3)) continue; // ragged hem
        const rel = dx / hw;
        let c: string = rel < -0.35 ? f.light : rel > 0.45 ? f.dark : f.base;
        if (y >= tier.bottom - 1) c = f.dark;
        p.set(x, y, c);
      }
    }
    for (let i = 0; i < 3; i++) {
      const y = rng.int(tier.top + 3, tier.bottom - 3);
      const t = (y - tier.top) / (tier.bottom - tier.top);
      const hw = 0.8 + (tier.half - 0.8) * t;
      const x = Math.round(cx - hw * rng.range(0.2, 0.7));
      p.set(x, y, f.hi);
    }
  }
  p.outline(P.outline);
  return p;
}

/** Boulder, 16x14. Base row 12. Variant 1 is mossy. */
export function drawRock(rng: Rng, variant: number): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  const cx = 7.5;
  const cy = 8;
  for (let y = 0; y <= 12; y++) {
    for (let x = 0; x < 16; x++) {
      const nx = (x - cx) / 6.5;
      const ny = (y - cy) / 5;
      if (nx * nx + ny * ny > 1) continue;
      const l = -(nx * 0.55 + ny * 0.85);
      let c: string = l > 0.45 ? P.stoneLight : l < -0.35 ? P.stoneDark : P.stone;
      if (y === 12) c = P.stoneDark;
      p.set(x, y, c);
    }
  }
  p.set(5, 5, P.stoneHi);
  p.set(6, 5, P.stoneHi);
  p.set(5, 6, P.stoneLight);
  p.set(9, 7, P.stoneDark);
  p.set(10, 8, P.stoneDark);
  p.set(10, 9, P.stoneDark);
  if (variant === 2) {
    // Copper vein
    for (const [x, y] of [
      [4, 7],
      [7, 9],
      [10, 6],
      [11, 9],
      [6, 11],
    ] as const) {
      p.set(x, y, '#d9823b');
      p.set(x + 1, y, '#9c5525');
      p.set(x, y - 1, '#f4b07a');
    }
  }
  if (variant === 1) {
    for (let i = 0; i < 6; i++) {
      const x = rng.int(4, 11);
      const y = rng.int(3, 5);
      if (p.filled(x, y)) p.set(x, y, rng.chance(0.5) ? P.leafLight : P.leaf);
    }
  }
  p.outline(P.outline);
  return p;
}

/** Shrub, 16x14. Base row 12. Variant 1 has berries. */
export function drawBush(rng: Rng, variant: number, f: Foliage = OAK_FOLIAGE.spring): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  const blobs: Circle[] = [
    [8, 7, 5.5],
    [4.5, 9, 3.5],
    [11.5, 9, 3.5],
  ];
  const inBush = (x: number, y: number) => y <= 12 && inCircles(blobs, x, y);
  for (let y = 0; y <= 12; y++) {
    for (let x = 0; x < 16; x++) {
      if (!inBush(x, y)) continue;
      const l = lightLevel(x - 8, y - 8, 6);
      let c: string = l > 0.4 ? f.light : l < -0.4 ? f.dark : f.base;
      if (!inBush(x, y + 1)) c = f.dark;
      p.set(x, y, c);
    }
  }
  for (let i = 0; i < 4; i++) {
    const x = rng.int(4, 10);
    const y = rng.int(3, 7);
    if (inBush(x, y)) p.set(x, y, f.hi);
  }
  if (variant === 1) {
    for (let i = 0; i < 5; i++) {
      const x = rng.int(3, 12);
      const y = rng.int(5, 10);
      if (inBush(x, y) && inBush(x - 1, y - 1)) {
        p.set(x, y, P.berry);
        p.set(x - 1, y - 1, P.berryHi);
      }
    }
  }
  p.outline(P.outline);
  return p;
}

/** Tree stump, 16x12. Base row 10. */
export function drawStump(): PixelCanvas {
  const p = new PixelCanvas(16, 12);
  for (let y = 5; y <= 10; y++) {
    for (let x = 3; x <= 12; x++) p.set(x, y, x <= 4 ? P.trunkLight : x >= 11 ? P.trunkDark : P.trunk);
  }
  p.set(2, 10, P.trunkDark);
  p.set(13, 10, P.trunkDark);
  for (let y = 2; y <= 8; y++) {
    for (let x = 2; x <= 13; x++) {
      const nx = (x - 7.5) / 4.5;
      const ny = (y - 5) / 2.5;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1) continue;
      p.set(x, y, d > 0.8 ? P.trunkLight : d > 0.5 ? P.woodLight : d > 0.3 ? P.wood : P.woodLight);
    }
  }
  p.outline(P.outline);
  return p;
}

/** Tall grass tuft, 16x12, anchored at the bottom. Walkable; sways when stepped through. */
export function drawTallGrass(rng: Rng, variant: number, f: Foliage = GRASS_FOLIAGE.spring): PixelCanvas {
  const p = new PixelCanvas(16, 12);
  for (let i = 0; i < 7; i++) {
    const x0 = 1 + i * 2 + rng.int(0, 1);
    const h = rng.int(5, variant === 1 ? 11 : 9);
    const lean = rng.pick([-1, 0, 1]);
    for (let k = 0; k < h; k++) {
      const y = 11 - k;
      const x = Math.max(0, Math.min(15, x0 + (k > h * 0.6 ? lean : 0)));
      const c = k < 2 ? f.dark : k >= h - 2 ? f.hi : f.base;
      p.set(x, y, c);
    }
    if (variant === 1 && rng.chance(0.5)) p.set(Math.max(0, Math.min(15, x0 + lean)), 11 - h, P.grassSeed);
  }
  return p;
}

/** Soft elliptical ground shadow. */
export function drawShadow(width: number, height: number): PixelCanvas {
  const p = new PixelCanvas(width, height);
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (x - cx) / (width / 2);
      const ny = (y - cy) / (height / 2);
      if (nx * nx + ny * ny <= 1) p.set(x, y, '#000000', 62);
    }
  }
  return p;
}

/** Tiny glint used for animated light on water. */
export function drawSparkle(): PixelCanvas {
  const p = new PixelCanvas(5, 5);
  p.set(2, 2, '#ffffff');
  p.set(1, 2, P.foam, 210);
  p.set(3, 2, P.foam, 210);
  p.set(2, 1, P.foam, 210);
  p.set(2, 3, P.foam, 210);
  return p;
}

interface StallStyle {
  stripeA: string;
  stripeB: string;
  trim: string;
  goods: (p: PixelCanvas) => void;
}

const STALL_STYLES: StallStyle[] = [
  // 0 Mira — produce
  {
    stripeA: '#c8483c',
    stripeB: '#f1e3c4',
    trim: '#9b3329',
    goods: (p) => {
      p.rect(6, 17, 4, 3, '#e8812f');
      p.set(7, 17, '#f6a95c');
      p.rect(12, 18, 3, 2, '#a35bb5');
      p.rect(12, 17, 3, 1, P.leaf);
      p.rect(17, 17, 4, 3, P.leafLight);
      p.set(18, 17, P.leafHi);
      p.rect(23, 18, 3, 2, P.berry);
    },
  },
  // 1 Rosa — bakery
  {
    stripeA: '#e07a9a',
    stripeB: '#fbeef0',
    trim: '#b0506e',
    goods: (p) => {
      for (const x of [5, 11]) {
        p.rect(x, 17, 5, 3, '#d9a05a');
        p.rect(x, 17, 5, 1, '#f0d199');
      }
      p.rect(18, 17, 6, 3, '#e58a2c');
      p.rect(18, 19, 6, 1, '#c08442');
      p.rect(25, 18, 2, 2, '#f6d65a');
    },
  },
  // 2 Bram — forge
  {
    stripeA: '#4a4a55',
    stripeB: '#8a8a95',
    trim: '#2e2e36',
    goods: (p) => {
      // anvil
      p.rect(6, 16, 8, 2, '#5c5c6a');
      p.rect(8, 18, 4, 2, '#3b3b45');
      p.rect(5, 16, 1, 1, '#5c5c6a');
      // copper ingots
      p.rect(17, 18, 4, 2, '#d9823b');
      p.rect(17, 18, 4, 1, '#f4b07a');
      p.rect(22, 18, 4, 2, '#b9c0c6');
      p.rect(22, 18, 4, 1, '#eef1f3');
    },
  },
  // 3 Finn — fish
  {
    stripeA: '#4a7fb5',
    stripeB: '#eaf3fa',
    trim: '#2f5f8f',
    goods: (p) => {
      for (const [x, c] of [
        [5, '#e8b83a'],
        [12, '#7a9a6a'],
        [19, '#6b5a4a'],
      ] as const) {
        p.rect(x, 18, 5, 2, c);
        p.set(x + 5, 17, c);
        p.set(x + 5, 20, c);
      }
      p.rect(25, 16, 3, 4, '#8a8a95');
      p.rect(25, 16, 3, 1, '#58a4d2');
    },
  },
  // 4 Willa — carpentry
  {
    stripeA: '#5a8a3a',
    stripeB: '#f1e3c4',
    trim: '#3f6a28',
    goods: (p) => {
      for (const y of [17, 19]) {
        p.rect(5, y, 9, 2, P.woodLight);
        p.rect(5, y + 1, 9, 1, P.wood);
      }
      // tiny chair
      p.rect(18, 15, 1, 5, P.woodDark);
      p.rect(18, 17, 5, 1, P.wood);
      p.rect(22, 17, 1, 3, P.woodDark);
      p.rect(25, 17, 2, 3, P.trunk);
    },
  },
];

/**
 * Market stall, 40x46. Base row 44. Variants are different merchants. A sign
 * board on top (the scene writes what's sold on it), a striped scalloped
 * awning with pennants, and goods on the counter.
 */
export function drawStall(variant = 0): PixelCanvas {
  const style = STALL_STYLES[variant] ?? STALL_STYLES[0];
  const p = new PixelCanvas(40, 46);
  // Sign board on two short posts above the awning.
  for (const x of [8, 30]) p.rect(x, 7, 2, 6, P.woodDark);
  p.rect(2, 0, 36, 9, style.trim);
  p.rect(3, 1, 34, 7, '#f6efe0');
  p.rect(3, 1, 34, 1, '#ffffff');
  // Posts.
  p.rect(5, 18, 2, 26, P.woodDark);
  p.rect(33, 18, 2, 26, P.woodDark);
  // Counter.
  p.rect(3, 30, 34, 14, P.wood);
  p.rect(3, 30, 34, 1, P.woodLight);
  p.rect(3, 43, 34, 1, P.woodDark);
  for (let x = 3; x < 37; x += 5) p.rect(x, 32, 1, 11, P.woodDark);
  // The counter front gets a strip in the stall's colours.
  for (let x = 3; x < 37; x++) p.set(x, 37, Math.floor((x - 3) / 3) % 2 ? style.stripeA : style.stripeB);
  // Goods (drawn for a 32-wide counter, so shifted onto this one).
  const goods = new PixelCanvas(32, 34);
  style.goods(goods);
  for (let y = 0; y < 34; y++) for (let x = 0; x < 32; x++) if (goods.filled(x, y)) p.copyPixel(goods, x, y, x + 4, y + 10);
  // Bunting strung under the awning.
  for (let x = 8; x < 33; x += 6) {
    p.rect(x, 22, 3, 1, style.trim);
    p.set(x + 1, 23, style.trim);
  }
  // Awning: stripes and a scalloped hem.
  for (let x = 1; x <= 38; x++) {
    const a = Math.floor((x - 1) / 4) % 2 === 0;
    p.rect(x, 13, 1, 7, a ? style.stripeA : style.stripeB);
    if (x % 4 !== 0) p.set(x, 20, a ? style.stripeA : style.stripeB);
    if (x % 4 === 2) p.set(x, 21, a ? style.stripeA : style.stripeB);
  }
  p.rect(1, 12, 38, 1, style.trim);
  p.rect(1, 19, 38, 1, style.trim);
  p.outline(P.outline);
  return p;
}

/** Village notice board, 16x26. Base row 24. */
export function drawNoticeBoard(): PixelCanvas {
  const p = new PixelCanvas(16, 26);
  p.rect(2, 10, 2, 15, P.woodDark);
  p.rect(12, 10, 2, 15, P.woodDark);
  p.rect(1, 2, 14, 11, P.wood);
  p.rect(1, 2, 14, 1, P.woodLight);
  p.rect(1, 12, 14, 1, P.woodDark);
  p.rect(0, 1, 16, 1, P.trunkDark);
  // pinned notes
  p.rect(3, 4, 4, 5, '#f6f3e8');
  p.rect(4, 5, 2, 1, '#9aa0a6');
  p.rect(4, 7, 2, 1, '#9aa0a6');
  p.rect(9, 5, 4, 5, '#f4e3a8');
  p.rect(10, 6, 2, 1, '#9aa0a6');
  p.set(5, 4, P.berry);
  p.set(11, 5, P.berry);
  p.outline(P.outline);
  return p;
}

/** Sprinkler, 16x16. Base row 14. */
export function drawSprinkler(): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  p.rect(6, 7, 4, 7, '#9c5525');
  p.rect(6, 7, 1, 7, '#d9823b');
  p.rect(4, 5, 8, 2, '#b9c0c6');
  p.rect(4, 5, 8, 1, '#eef1f3');
  p.rect(7, 3, 2, 2, '#8a8a95');
  p.rect(5, 13, 6, 1, '#6b4628');
  p.outline(P.outline);
  return p;
}

/** Wooden bench, 16x14. Base row 12. */
export function drawBench(): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  p.rect(1, 2, 14, 2, P.wood);
  p.rect(1, 2, 14, 1, P.woodLight);
  p.rect(2, 4, 1, 3, P.woodDark);
  p.rect(13, 4, 1, 3, P.woodDark);
  p.rect(1, 7, 14, 2, P.woodLight);
  p.rect(1, 9, 14, 1, P.woodDark);
  p.rect(2, 10, 2, 3, P.woodDark);
  p.rect(12, 10, 2, 3, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** Terracotta flower pot, 16x18. Base row 16. */
export function drawFlowerPot(): PixelCanvas {
  const p = new PixelCanvas(16, 18);
  p.rect(4, 10, 8, 6, '#b8603a');
  p.rect(3, 9, 10, 2, '#d07a4a');
  p.rect(10, 11, 1, 5, '#8f4a2c');
  p.rect(7, 4, 2, 5, P.leaf);
  p.rect(5, 6, 2, 2, P.leafLight);
  p.rect(9, 5, 2, 2, P.leafLight);
  for (const [x, y, c] of [
    [4, 3, P.flowerPink],
    [10, 2, P.flowerYellow],
    [7, 1, P.flowerBlue],
  ] as const) {
    p.rect(x, y, 2, 2, c);
    p.set(x, y, '#ffffff');
  }
  p.outline(P.outline);
  return p;
}

/** Scarecrow, 16x28. Base row 26. */
export function drawScarecrow(): PixelCanvas {
  const p = new PixelCanvas(16, 28);
  p.rect(7, 12, 2, 15, P.woodDark);
  p.rect(1, 13, 14, 2, P.wood);
  p.rect(4, 12, 8, 8, '#8a5aa8');
  p.rect(4, 12, 1, 8, '#a87ac4');
  p.rect(6, 15, 2, 2, '#6a4084');
  p.rect(1, 15, 2, 3, P.grassSeed);
  p.rect(13, 15, 2, 3, P.grassSeed);
  p.rect(5, 6, 6, 6, '#e8c47a');
  p.set(6, 8, P.eye);
  p.set(9, 8, P.eye);
  p.rect(6, 10, 4, 1, '#b8603a');
  p.rect(3, 4, 10, 2, '#8a6a2c');
  p.rect(5, 2, 6, 2, '#a8823a');
  p.outline(P.outline);
  return p;
}

/** Duck sheet: 2 frames of 12x10, facing left. */
export function drawDuckSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 10);
  for (let f = 0; f < 2; f++) {
    const o = f * 12;
    const bob = f;
    p.rect(o + 3, 5 + bob, 7, 3, '#f4f1ea');
    p.rect(o + 4, 7 + bob, 6, 1, '#d6d0c4');
    p.rect(o + 9, 4 + bob, 2, 2, '#f4f1ea');
    p.rect(o + 2, 2 + bob, 3, 3, '#3f8c3c');
    p.set(o + 3, 3 + bob, P.eye);
    p.rect(o + 0, 3 + bob, 2, 1, '#e8a33a');
    p.rect(o + 2, 5 + bob, 2, 1, '#f4f1ea');
  }
  p.outline(P.outline);
  return p;
}

/** Butterfly sheet: 2 frames of 7x5 (wings open/closed), white so it can be tinted. */
export function drawButterflySheet(): PixelCanvas {
  const p = new PixelCanvas(14, 5);
  // open
  p.rect(0, 0, 3, 2, '#ffffff');
  p.rect(4, 0, 3, 2, '#ffffff');
  p.rect(1, 2, 2, 2, '#ffffff');
  p.rect(4, 2, 2, 2, '#ffffff');
  p.rect(3, 1, 1, 3, '#3b3b45');
  // closed
  p.rect(9, 0, 3, 3, '#ffffff');
  p.rect(10, 1, 1, 3, '#3b3b45');
  return p;
}

/** Firefly: a soft glowing dot. */
export function drawFirefly(): PixelCanvas {
  const p = new PixelCanvas(5, 5);
  p.rect(1, 1, 3, 3, '#fff6a8', 120);
  p.rect(0, 2, 5, 1, '#fff6a8', 70);
  p.rect(2, 0, 1, 5, '#fff6a8', 70);
  p.set(2, 2, '#ffffff');
  return p;
}

/** Falling leaf, white for tinting. */
export function drawLeaf(): PixelCanvas {
  const p = new PixelCanvas(4, 3);
  p.rect(0, 1, 3, 1, '#ffffff');
  p.rect(1, 0, 2, 1, '#ffffff');
  p.set(3, 2, '#ffffff');
  return p;
}

/** Fishing bobber, 5x6. */
export function drawBobber(): PixelCanvas {
  const p = new PixelCanvas(5, 6);
  p.rect(1, 0, 3, 2, P.berry);
  p.rect(1, 2, 3, 2, '#ffffff');
  p.rect(2, 4, 1, 1, '#3b3b45');
  p.outline(P.outline);
  return p;
}

/** "!" bite alert, 7x11. */
export function drawAlert(): PixelCanvas {
  const p = new PixelCanvas(7, 11);
  p.rect(1, 0, 5, 10, '#ffffff');
  p.rect(3, 1, 1, 5, P.berry);
  p.rect(3, 7, 1, 1, P.berry);
  p.outline(P.outline);
  return p;
}

/** Tiny particle chips for hit and splash effects. */
export function drawChip(colors: readonly string[]): PixelCanvas {
  const p = new PixelCanvas(3, 3);
  p.rect(0, 0, 2, 2, colors[0]);
  p.set(2, 1, colors[1] ?? colors[0]);
  p.set(1, 2, colors[1] ?? colors[0]);
  return p;
}
