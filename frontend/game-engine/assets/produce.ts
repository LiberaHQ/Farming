import type { CropId } from '@farming/shared';
import { P } from './palette';
import type { PixelCanvas } from './PixelCanvas';

/** Colours and shapes for the newer crops: icons, seed packet pictures and ripe plants. */
type Shape = 'berry' | 'round' | 'root' | 'long' | 'cob' | 'grain' | 'cluster';

interface Produce {
  shape: Shape;
  base: string;
  light: string;
  dark: string;
  /** How the growing plant looks. */
  plant: 'bush' | 'stalk' | 'leafy';
}

export const PRODUCE: Partial<Record<CropId, Produce>> = {
  strawberry: { shape: 'berry', base: '#e0443e', light: '#ff8a7a', dark: '#a02a2a', plant: 'leafy' },
  potato: { shape: 'root', base: '#c49a62', light: '#e2c08a', dark: '#8e6a3c', plant: 'leafy' },
  tomato: { shape: 'round', base: '#e8473a', light: '#ff8f6e', dark: '#a8302a', plant: 'bush' },
  corn: { shape: 'cob', base: '#f2cc45', light: '#fff09a', dark: '#c69a24', plant: 'stalk' },
  wheat: { shape: 'grain', base: '#e2b85a', light: '#f8e09a', dark: '#a8823a', plant: 'stalk' },
  blueberry: { shape: 'cluster', base: '#4a62c8', light: '#8ea2f0', dark: '#2a3a8a', plant: 'bush' },
  eggplant: { shape: 'long', base: '#6a3a8a', light: '#a06ac4', dark: '#42205a', plant: 'bush' },
  snow_yam: { shape: 'root', base: '#c8b4e0', light: '#ece2f8', dark: '#8a76a8', plant: 'leafy' },
};

function ellipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, c: Produce): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const l = -(nx * 0.6 + ny * 0.8);
      p.set(x, y, l > 0.4 ? c.light : l < -0.4 ? c.dark : c.base);
    }
  }
}

/** One piece of produce centred at (cx, cy), scaled (1 = icon size). */
export function drawProducePiece(p: PixelCanvas, crop: CropId, cx: number, cy: number, s = 1): void {
  const c = PRODUCE[crop];
  if (!c) return;
  switch (c.shape) {
    case 'berry':
      ellipse(p, cx, cy, 3.5 * s, 4 * s, c);
      for (const [dx, dy] of [[-1, -1], [1, 0], [-1, 2], [1, 2]]) p.set(Math.round(cx + dx * s), Math.round(cy + dy * s), '#ffe27a');
      p.rect(Math.round(cx - 2 * s), Math.round(cy - 4.5 * s), Math.max(1, Math.round(4 * s)), 1, P.leaf);
      break;
    case 'round':
      ellipse(p, cx, cy, 4.5 * s, 4 * s, c);
      p.rect(Math.round(cx - 1), Math.round(cy - 4 * s - 1), 3, 1, P.leafDark);
      break;
    case 'root':
      ellipse(p, cx, cy, 5 * s, 3.5 * s, c);
      p.set(Math.round(cx - 2 * s), Math.round(cy), c.dark);
      p.set(Math.round(cx + 2 * s), Math.round(cy - 1 * s), c.dark);
      break;
    case 'long':
      ellipse(p, cx, cy + 1 * s, 3 * s, 5 * s, c);
      p.rect(Math.round(cx - 2 * s), Math.round(cy - 4.5 * s), Math.max(2, Math.round(4 * s)), Math.max(1, Math.round(2 * s)), P.leafDark);
      break;
    case 'cob':
      ellipse(p, cx, cy, 2.5 * s, 5.5 * s, c);
      for (let y = -4; y <= 4; y += 2) p.set(Math.round(cx), Math.round(cy + y * s), c.dark);
      p.rect(Math.round(cx + 2 * s), Math.round(cy - 2 * s), 1, Math.max(2, Math.round(7 * s)), P.leaf);
      break;
    case 'grain':
      for (let i = -1; i <= 1; i++) {
        const x = Math.round(cx + i * 2.5 * s);
        p.rect(x, Math.round(cy - 1 * s), 1, Math.max(2, Math.round(7 * s)), '#a8823a');
        ellipse(p, x + 0.5, cy - 3 * s, 1.5 * s, 3 * s, c);
      }
      break;
    case 'cluster':
      for (const [dx, dy] of [[-2.5, 1], [2.5, 1], [0, -1.5], [0, 3]]) ellipse(p, cx + dx * s, cy + dy * s, 2.2 * s, 2.2 * s, c);
      p.rect(Math.round(cx - 1), Math.round(cy - 4.5 * s), 3, 1, P.leafDark);
      break;
  }
}

/** Icon for a harvested crop. */
export function produceIcon(p: PixelCanvas, crop: CropId): void {
  drawProducePiece(p, crop, 7.5, 8.5, 1);
}

/** The small picture on a seed packet. */
export function seedPicture(p: PixelCanvas, crop: CropId): void {
  drawProducePiece(p, crop, 8, 8.5, 0.55);
}

/** A ripe plant of one of the newer crops (16x16, standing on row 14). */
export function drawRipePlant(p: PixelCanvas, crop: CropId, leaves: (growth: number, wide: boolean) => void): void {
  const c = PRODUCE[crop];
  if (!c) return;
  if (c.plant === 'stalk') {
    for (let y = 3; y <= 14; y++) {
      p.set(7, y, P.leafDark);
      p.set(8, y, P.leaf);
    }
    for (const [x, y, w] of [[3, 9, 4], [9, 7, 4], [4, 5, 3]]) p.rect(x, y, w, 1, P.leafLight);
    drawProducePiece(p, crop, crop === 'corn' ? 10.5 : 8, crop === 'corn' ? 8 : 4, crop === 'corn' ? 0.6 : 0.7);
    return;
  }
  leaves(c.plant === 'bush' ? 0.9 : 0.7, c.plant === 'bush');
  if (c.shape === 'root') drawProducePiece(p, crop, 7.5, 13, 0.55);
  else if (c.plant === 'bush') {
    drawProducePiece(p, crop, 4.5, 9, 0.45);
    drawProducePiece(p, crop, 10.5, 7, 0.45);
    drawProducePiece(p, crop, 8, 11.5, 0.45);
  } else {
    drawProducePiece(p, crop, 5, 11.5, 0.4);
    drawProducePiece(p, crop, 10.5, 12, 0.4);
  }
}
