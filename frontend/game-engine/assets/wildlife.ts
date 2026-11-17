import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Rare creatures: a red fox, a barn owl and a dolphin. Drawn in code like everything else. */

const FOX = '#d8743a';
const FOX_DARK = '#a8522a';
const FOX_LIGHT = '#f6e6d0';

/** Red fox facing right, 20x14. Frame 0/1 trotting, 2 sitting. */
export function drawFox(frame: number): PixelCanvas {
  const p = new PixelCanvas(20, 14);
  if (frame === 2) {
    // Sitting: upright body, tail curled round the front.
    p.rect(8, 4, 6, 8, FOX);
    p.rect(9, 7, 3, 4, FOX_LIGHT);
    p.rect(11, 0, 6, 5, FOX);
    p.rect(11, 0, 1, 2, FOX_DARK);
    p.rect(15, 0, 1, 2, FOX_DARK);
    p.rect(16, 3, 3, 2, FOX_LIGHT);
    p.set(18, 3, P.outline);
    p.set(14, 2, P.outline);
    p.rect(3, 10, 8, 3, FOX);
    p.rect(2, 11, 2, 2, FOX_LIGHT);
    for (const x of [9, 12]) p.rect(x, 12, 2, 2, '#3a2a22');
  } else {
    // Trotting: long body, bushy tail, legs alternating.
    p.rect(5, 5, 10, 5, FOX);
    p.rect(7, 8, 7, 2, FOX_LIGHT);
    p.rect(13, 2, 5, 5, FOX);
    p.rect(13, 0, 1, 2, FOX_DARK);
    p.rect(16, 0, 1, 2, FOX_DARK);
    p.rect(17, 5, 3, 2, FOX_LIGHT);
    p.set(19, 5, P.outline);
    p.set(16, 3, P.outline);
    p.rect(0, 3 + frame, 6, 3, FOX);
    p.rect(0, 3 + frame, 2, 3, FOX_LIGHT);
    const legs = frame === 0 ? [6, 13] : [8, 11];
    for (const x of legs) p.rect(x, 10, 2, 4, '#3a2a22');
  }
  p.outline(P.outline);
  return p;
}

/** Barn owl on a branch, 14x16. Frame 0 eyes open, 1 blinking. */
export function drawOwl(frame: number): PixelCanvas {
  const p = new PixelCanvas(14, 16);
  p.rect(0, 13, 14, 2, P.trunk);
  for (let y = 2; y < 13; y++) for (let x = 2; x < 12; x++) if (((x - 6.5) / 5) ** 2 + ((y - 7.5) / 5.8) ** 2 <= 1) p.set(x, y, '#c8a070');
  // Heart-shaped pale face.
  for (let y = 3; y < 9; y++) for (let x = 3; x < 11; x++) if (((x - 6.5) / 3.8) ** 2 + ((y - 5.8) / 3) ** 2 <= 1) p.set(x, y, '#f6ecd8');
  p.rect(4, 10, 6, 3, '#e8d8b8');
  if (frame === 0) {
    p.rect(4, 5, 2, 2, P.outline);
    p.rect(8, 5, 2, 2, P.outline);
    p.set(4, 5, '#ffffff');
    p.set(8, 5, '#ffffff');
  } else {
    p.rect(4, 6, 2, 1, P.outline);
    p.rect(8, 6, 2, 1, P.outline);
  }
  p.set(6, 7, '#c8902a');
  p.set(7, 7, '#c8902a');
  for (const x of [5, 8]) p.rect(x, 12, 1, 2, '#c8902a');
  p.outline(P.outline);
  return p;
}

/** A dolphin mid-leap, 24x12, nose to the right. */
export function drawDolphin(): PixelCanvas {
  const p = new PixelCanvas(24, 12);
  for (let x = 2; x < 22; x++) {
    const arc = Math.round(Math.sin(((x - 2) / 20) * Math.PI) * 4);
    const thick = x < 5 ? 1 : x > 18 ? 2 : 4;
    p.rect(x, 7 - arc, 1, thick, '#6a8aa8');
    p.set(x, 7 - arc + thick - 1, '#c8d8e4');
  }
  p.rect(10, 0, 3, 3, '#5a7a98');
  p.rect(0, 5, 3, 2, '#5a7a98');
  p.rect(1, 8, 2, 2, '#5a7a98');
  p.set(19, 4, P.outline);
  p.outline(P.outline);
  return p;
}

/** A deer facing right, 26x24. Frames 0/1 walking, 2 grazing (head down). */
export function drawDeer(frame: number): PixelCanvas {
  const p = new PixelCanvas(26, 24);
  const body = '#a8703d';
  const light = '#c8945a';
  const dark = '#6e4626';
  const white = '#f4ead8';
  // Legs.
  const s = frame === 1 ? 1 : 0;
  for (const [x, i] of [
    [6, 0],
    [8, 1],
    [16, 0],
    [18, 1],
  ] as const) {
    const fwd = s ? (i ? -1 : 1) : 0;
    p.rect(x + fwd, 15, 1, 8, i ? dark : body);
    p.set(x + fwd, 23, '#2b1d1a');
  }
  // Body with a pale belly and white spots (a young deer).
  p.rect(5, 10, 15, 6, body);
  p.rect(5, 10, 15, 1, light);
  p.rect(7, 15, 11, 1, white);
  for (const [x, y] of [[8, 12], [11, 11], [14, 12], [10, 13]]) p.set(x, y, white);
  // White tail.
  p.rect(3, 10, 2, 3, white);
  if (frame === 2) {
    // Head down to the grass.
    p.rect(18, 13, 3, 4, body);
    p.rect(20, 16, 4, 4, body);
    p.rect(22, 18, 2, 2, light);
    p.set(23, 19, '#2b1d1a');
    p.set(21, 17, '#2b1d1a');
    p.rect(19, 14, 1, 2, dark);
  } else {
    // Neck, head and big ears.
    p.rect(18, 5, 3, 6, body);
    p.rect(19, 2, 5, 4, body);
    p.rect(22, 4, 2, 2, light);
    p.set(24, 4, '#2b1d1a');
    p.set(21, 3, '#2b1d1a');
    p.rect(17, 1, 2, 3, dark);
    p.set(17, 0, dark);
    // Little antler nubs.
    p.set(19, 0, '#d8c8a2');
    p.set(20, 1, '#d8c8a2');
  }
  p.outline(P.outline);
  return p;
}

/** A red squirrel facing right, 12x12. Frame 0 sitting up, 1 running. */
export function drawSquirrel(frame: number): PixelCanvas {
  const p = new PixelCanvas(12, 12);
  const body = '#c8642a';
  const light = '#f0b080';
  const dark = '#8a3e1a';
  if (frame === 0) {
    // Sitting up, big bushy tail curled behind.
    for (let y = 1; y <= 9; y++) for (let x = 0; x <= 4; x++) if (((x - 2) / 2.6) ** 2 + ((y - 5) / 4.5) ** 2 <= 1) p.set(x, y, y < 4 ? light : body);
    p.rect(4, 5, 4, 5, body);
    p.rect(6, 7, 2, 3, light);
    p.rect(6, 2, 4, 4, body);
    p.set(8, 3, '#1a1412');
    p.set(9, 4, dark);
    p.set(6, 1, dark);
    p.rect(5, 10, 4, 1, dark);
  } else {
    p.rect(3, 6, 6, 3, body);
    p.rect(4, 8, 4, 1, light);
    p.rect(8, 4, 3, 3, body);
    p.set(10, 5, '#1a1412');
    p.set(8, 3, dark);
    for (let i = 0; i < 4; i++) p.rect(i, 3 + i, 3, 2, i < 2 ? light : body);
    for (const x of [3, 5, 7, 9]) p.set(x, 9, dark);
  }
  p.outline(P.outline);
  return p;
}

/** A little green frog facing right, 10x8. Frame 0 sitting, 1 mid-leap. */
export function drawFrog(frame: number): PixelCanvas {
  const p = new PixelCanvas(10, 8);
  const body = '#4aa040';
  const light = '#8ad06a';
  const dark = '#2a6a2a';
  if (frame === 0) {
    p.rect(2, 3, 6, 4, body);
    p.rect(3, 6, 4, 1, light);
    p.rect(5, 2, 3, 2, body);
    p.set(6, 1, light);
    p.set(6, 2, '#1a1412');
    p.rect(1, 6, 2, 1, dark);
    p.rect(7, 6, 2, 1, dark);
    p.set(3, 4, dark);
  } else {
    p.rect(2, 2, 6, 3, body);
    p.rect(3, 4, 4, 1, light);
    p.rect(7, 1, 2, 2, body);
    p.set(8, 1, '#1a1412');
    p.rect(0, 4, 2, 1, dark);
    p.rect(0, 5, 1, 2, dark);
    p.rect(8, 4, 2, 2, dark);
  }
  p.outline(P.outline);
  return p;
}
