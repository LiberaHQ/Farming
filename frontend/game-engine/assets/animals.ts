import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Animal sheets: 2 frames side by side, facing left (mirrored in-game for right). */

const FUR = { base: '#b89a7a', dark: '#8f735a', light: '#d8c2a6' };
const HEN = { base: '#f4f1ea', dark: '#d6d0c4', comb: '#d2404c', beak: '#e8a33a' };

function ellipse(p: PixelCanvas, ox: number, cx: number, cy: number, rx: number, ry: number, color: (nx: number, ny: number) => string) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) p.set(ox + x, y, color(nx, ny));
    }
  }
}

/** Rabbit, 14x12 per frame. Frame 0 sitting, frame 1 mid-hop. Base row 10. */
export function drawRabbitSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 12);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    const lift = f === 1 ? 1 : 0;
    const shade = (nx: number, ny: number) => (ny > 0.4 ? FUR.dark : nx < -0.2 && ny < 0 ? FUR.light : FUR.base);
    ellipse(p, ox, 7.5, 7.5 - lift, f === 1 ? 4.5 : 4, 2.5, shade);
    ellipse(p, ox, 3.5, 5 - lift, 2.2, 2, shade);
    p.rect(ox + 2, 1, 1, 3 - lift, FUR.base);
    p.rect(ox + 4, 1, 1, 3 - lift, FUR.dark);
    p.set(ox + 12, 7 - lift, '#ffffff');
    p.set(ox + 2, 5 - lift, P.eye);
    if (f === 1) {
      p.rect(ox + 9, 10, 3, 1, FUR.dark);
      p.rect(ox + 3, 9, 2, 1, FUR.dark);
    } else {
      p.rect(ox + 4, 10, 6, 1, FUR.dark);
    }
  }
  p.outline(P.outline);
  return p;
}

/** Hen, 14x13 per frame. Frame 0 standing, frame 1 pecking. Base row 11. */
export function drawChickenSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 13);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    const shade = (nx: number, ny: number) => (ny > 0.45 || nx > 0.5 ? HEN.dark : HEN.base);
    ellipse(p, ox, 7.5, 7, 4.5, 3, shade);
    p.rect(ox + 11, 4, 2, 3, HEN.base); // tail
    const hx = f === 1 ? 3 : 4;
    const hy = f === 1 ? 6 : 4;
    ellipse(p, ox, hx, hy, 2, 2, () => HEN.base);
    p.rect(ox + hx - 1, hy - 3, 2, 1, HEN.comb);
    p.set(ox + hx - 2, hy + 1, HEN.comb);
    p.rect(ox + hx - 3, hy, 1, 1, HEN.beak);
    p.set(ox + hx - 1, hy - 1, P.eye);
    p.rect(ox + 6, 10, 1, 2, HEN.beak);
    p.rect(ox + 9, 10, 1, 2, HEN.beak);
  }
  p.outline(P.outline);
  return p;
}

/** Cow, 22x16 per frame (facing left). Frame 1 has its head down, grazing. Base row 15. */
export function drawCowSheet(): PixelCanvas {
  const p = new PixelCanvas(44, 16);
  const white = '#f3efe6';
  const shade = '#c8c0b4';
  const patch = '#3a2e2a';
  for (let f = 0; f < 2; f++) {
    const ox = f * 22;
    ellipse(p, ox, 12, 8, 7.5, 4.5, (nx, ny) => (ny > 0.5 ? shade : white));
    // Patches.
    p.rect(ox + 9, 5, 4, 3, patch);
    p.rect(ox + 15, 7, 3, 3, patch);
    // Legs.
    for (const x of [6, 9, 15, 18]) p.rect(ox + x, 12, 2, 4, x % 2 ? shade : white);
    for (const x of [6, 9, 15, 18]) p.rect(ox + x, 15, 2, 1, patch);
    // Head.
    const hy = f === 1 ? 9 : 5;
    ellipse(p, ox, 3.5, hy, 3, 2.8, () => white);
    p.rect(ox + 1, hy + 1, 3, 2, '#e8a8a0');
    p.set(ox + 3, hy - 1, P.eye);
    p.rect(ox + 4, hy - 3, 2, 1, '#d8cfc2');
    // Tail.
    p.rect(ox + 20, 6, 1, 5, shade);
  }
  p.outline(P.outline);
  return p;
}

/** Sheep, 18x14 per frame (facing left). Frame 1 grazing. Base row 13. */
export function drawSheepSheet(): PixelCanvas {
  const p = new PixelCanvas(36, 14);
  const wool = '#f6f2ea';
  const woolShade = '#d8d0c4';
  const face = '#4a3a34';
  for (let f = 0; f < 2; f++) {
    const ox = f * 18;
    for (const [cx, cy, r] of [[9, 6, 4.5], [13, 6.5, 4], [6, 7, 3.5], [10, 9, 4]] as const) ellipse(p, ox, cx, cy, r, r * 0.8, (nx, ny) => (ny > 0.4 ? woolShade : wool));
    for (const x of [5, 8, 12, 14]) p.rect(ox + x, 11, 1, 3, face);
    const hy = f === 1 ? 8 : 5;
    ellipse(p, ox, 2.5, hy, 2.2, 2.4, () => face);
    p.set(ox + 2, hy - 1, '#ffffff');
    p.rect(ox + 3, hy - 3, 2, 1, woolShade);
  }
  p.outline(P.outline);
  return p;
}
