import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Sprinkler upgrades: same shape, metal colours, 12x14. */
export function drawMetalSprinkler(metal: string, light: string): PixelCanvas {
  const p = new PixelCanvas(12, 14);
  p.rect(2, 10, 8, 3, '#5a4a3a');
  p.rect(4, 4, 4, 7, metal);
  p.rect(4, 4, 1, 7, light);
  p.rect(1, 3, 10, 2, metal);
  p.rect(1, 3, 10, 1, light);
  for (const x of [1, 4, 7, 10]) p.set(x, 2, '#8ec4e4');
  p.outline(P.outline);
  return p;
}

/** Silo: a tall stone cylinder with a dome, 32x46. */
export function drawSilo(): PixelCanvas {
  const p = new PixelCanvas(32, 46);
  for (let y = 10; y < 44; y++) for (let x = 4; x < 28; x++) p.set(x, y, x < 9 ? '#a8a29a' : x > 23 ? '#6a645e' : '#8a847c');
  for (let y = 14; y < 44; y += 6) p.rect(4, y, 24, 1, '#5a544e');
  for (let y = 0; y < 12; y++) for (let x = 4; x < 28; x++) if (((x - 15.5) / 12) ** 2 + ((y - 11) / 11) ** 2 <= 1) p.set(x, y, y < 5 ? '#c8452e' : '#a8302a');
  p.rect(12, 32, 8, 12, '#5a3a22');
  p.rect(12, 32, 8, 1, '#8a5a32');
  p.outline(P.outline);
  return p;
}

/** Well: stone ring, wooden roof and bucket, 32x32. */
export function drawWell(): PixelCanvas {
  const p = new PixelCanvas(32, 32);
  for (let y = 18; y < 30; y++) for (let x = 4; x < 28; x++) if (((x - 15.5) / 12) ** 2 + ((y - 24) / 6) ** 2 <= 1) p.set(x, y, (x + y) % 5 === 0 ? '#6a645e' : '#9a948c');
  for (let y = 20; y < 25; y++) for (let x = 8; x < 24; x++) if (((x - 15.5) / 8) ** 2 + ((y - 22) / 2.5) ** 2 <= 1) p.set(x, y, '#2a4a6a');
  p.rect(6, 6, 2, 16, P.woodDark);
  p.rect(24, 6, 2, 16, P.woodDark);
  for (let i = 0; i < 6; i++) p.rect(3 + i, 6 - i, 26 - i * 2, 1, i % 2 ? '#a8302a' : '#c8452e');
  p.rect(8, 9, 16, 1, P.wood);
  p.rect(15, 10, 1, 6, '#c8c0b0');
  p.rect(13, 15, 5, 4, P.wood);
  p.outline(P.outline);
  return p;
}

/** Shed: a little wooden storage building, 48x40. */
export function drawShed(): PixelCanvas {
  const p = new PixelCanvas(48, 40);
  p.rect(4, 16, 40, 22, '#9a6a3a');
  for (let x = 4; x < 44; x += 4) p.rect(x, 16, 1, 22, '#7a5028');
  for (let i = 0; i < 14; i++) p.rect(2 + i * 0.5, 16 - i, 44 - i, 1, i % 3 === 0 ? '#5a4a8a' : '#6a5aa0');
  p.rect(18, 24, 12, 14, '#5a3a22');
  p.rect(23, 24, 1, 14, '#3a2414');
  p.rect(18, 24, 12, 1, '#8a5a32');
  p.rect(7, 22, 7, 6, '#8ec4e4');
  p.rect(34, 22, 7, 6, '#8ec4e4');
  p.rect(10, 22, 1, 6, '#5a3a22');
  p.rect(37, 22, 1, 6, '#5a3a22');
  p.outline(P.outline);
  return p;
}

export function drawStatue(): PixelCanvas {
  const p = new PixelCanvas(16, 28);
  p.rect(2, 22, 12, 5, '#8a847c');
  p.rect(2, 22, 12, 1, '#b8b2aa');
  p.rect(5, 10, 6, 12, '#a8a29a');
  p.rect(4, 12, 1, 6, '#a8a29a');
  p.rect(11, 12, 1, 6, '#a8a29a');
  for (let y = 2; y < 10; y++) for (let x = 4; x < 12; x++) if (((x - 7.5) / 3.5) ** 2 + ((y - 6) / 4) ** 2 <= 1) p.set(x, y, '#b8b2aa');
  p.set(6, 6, '#6a645e');
  p.set(9, 6, '#6a645e');
  p.outline(P.outline);
  return p;
}

export function drawFlowerBed(): PixelCanvas {
  const p = new PixelCanvas(16, 12);
  p.rect(0, 6, 16, 6, P.wood);
  p.rect(0, 6, 16, 1, P.woodLight);
  p.rect(1, 4, 14, 3, '#5a3a22');
  const colors = ['#e0443e', '#f2cc45', '#c46ad8', '#f4a6c6', '#4a8fd8'];
  for (let i = 0; i < 7; i++) {
    const x = 1 + i * 2;
    p.rect(x, 2 + (i % 2), 1, 3, '#3f7a3a');
    p.rect(x - (i % 2 ? 0 : 1), 1 + (i % 2), 2, 2, colors[i % colors.length]);
  }
  p.outline(P.outline);
  return p;
}

export function drawBirdbath(): PixelCanvas {
  const p = new PixelCanvas(14, 18);
  p.rect(4, 14, 6, 3, '#8a847c');
  p.rect(6, 6, 2, 9, '#9a948c');
  p.rect(1, 3, 12, 4, '#a8a29a');
  p.rect(2, 4, 10, 2, '#8ec4e4');
  p.rect(3, 4, 3, 1, '#c8e4f4');
  p.outline(P.outline);
  return p;
}

export function drawGnome(): PixelCanvas {
  const p = new PixelCanvas(10, 16);
  for (let i = 0; i < 6; i++) p.rect(5 - Math.ceil(i / 2), i, 1 + Math.ceil(i / 2) * 2, 1, '#e0443e');
  p.rect(3, 6, 4, 2, '#f2c8a0');
  p.rect(2, 8, 6, 3, '#f4f0e8');
  p.rect(2, 10, 6, 4, '#4a8fd8');
  p.rect(2, 14, 2, 2, '#5a3a22');
  p.rect(6, 14, 2, 2, '#5a3a22');
  p.set(4, 7, '#1a1412');
  p.outline(P.outline);
  return p;
}

/** Auto-collector: a little metal hopper with a glowing light, 14x16. */
export function drawCollector(): PixelCanvas {
  const p = new PixelCanvas(14, 16);
  for (let y = 2; y < 9; y++) p.rect(1 + Math.floor((y - 2) / 2), y, 12 - Math.floor((y - 2) / 2) * 2, 1, y < 4 ? '#c8ccd2' : '#8a9098');
  p.rect(4, 9, 6, 5, '#6a7078');
  p.rect(2, 13, 10, 2, '#4a5058');
  p.rect(6, 10, 2, 2, '#8be06a');
  p.outline(P.outline);
  return p;
}

/** A co-op guest's cabin: a small log cabin, 32x36. */
export function drawCabin(): PixelCanvas {
  const p = new PixelCanvas(32, 36);
  for (let y = 14; y < 35; y++) for (let x = 3; x < 29; x++) p.set(x, y, (y - 14) % 4 === 0 ? '#7a5028' : '#9a6a3a');
  for (let i = 0; i < 13; i++) p.rect(1 + i, 14 - i, 30 - i * 2, 1, i % 3 === 0 ? '#3a6a4a' : '#4a7a5a');
  p.rect(13, 23, 7, 12, '#5a3a22');
  p.rect(13, 23, 7, 1, '#8a5a32');
  p.set(18, 29, '#e8c25a');
  p.rect(5, 20, 6, 5, '#8ec4e4');
  p.rect(22, 20, 6, 5, '#8ec4e4');
  p.rect(23, 3, 3, 8, '#6a645e');
  p.outline(P.outline);
  return p;
}
