import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/*
 * Original pixel art for the railway through the valley and the old graveyard.
 */

const IRON = '#3a3a44';
const IRON_LIGHT = '#6a6a78';
const STEEL = '#9aa0ac';
const STEEL_LIGHT = '#d4d8e0';
const SLEEPER = '#6a4428';
const SLEEPER_DARK = '#4a2e1a';
const BALLAST = ['#8a8478', '#a29c8e', '#6e6a60'];

/** One 16x16 tile of track running east–west. `trestle` = a wooden bridge over water. */
export function drawRailTile(trestle: boolean): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  if (trestle) {
    // Deck beams and posts down into the water.
    p.rect(0, 3, 16, 2, SLEEPER_DARK);
    p.rect(0, 11, 16, 2, SLEEPER_DARK);
    p.rect(2, 13, 2, 3, SLEEPER_DARK);
    p.rect(11, 13, 2, 3, SLEEPER_DARK);
    p.rect(4, 13, 7, 1, SLEEPER);
  } else {
    // A bed of grey gravel.
    for (let y = 3; y <= 13; y++) {
      for (let x = 0; x < 16; x++) {
        const edge = y === 3 || y === 13;
        if (edge && (x * 7 + y) % 3 === 0) continue;
        p.set(x, y, BALLAST[(x * 13 + y * 7) % 3]);
      }
    }
  }
  // Sleepers.
  for (const x of [1, 6, 11]) {
    p.rect(x, 3, 3, 10, SLEEPER);
    p.rect(x, 3, 1, 10, '#80562e');
    p.rect(x + 2, 3, 1, 10, SLEEPER_DARK);
  }
  // Two steel rails.
  for (const y of [5, 10]) {
    p.rect(0, y, 16, 1, STEEL_LIGHT);
    p.rect(0, y + 1, 16, 1, STEEL);
  }
  return p;
}

/** Spoked wheel at (cx, cy), radius 3; `frame` turns the spokes. */
function wheel(p: PixelCanvas, cx: number, cy: number, frame: number): void {
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    p.set(Math.round(cx + Math.cos(t) * 3), Math.round(cy + Math.sin(t) * 3), IRON);
  }
  p.rect(cx - 2, cy - 2, 5, 5, '#55555f');
  if (frame === 0) {
    p.rect(cx - 2, cy, 5, 1, IRON_LIGHT);
    p.rect(cx, cy - 2, 1, 5, IRON_LIGHT);
  } else {
    for (let d = -2; d <= 2; d++) {
      p.set(cx + d, cy + d, IRON_LIGHT);
      p.set(cx + d, cy - d, IRON_LIGHT);
    }
  }
  p.set(cx, cy, '#c8b060');
}

/** The steam locomotive, facing right, 44x26. Frame 0/1 turns the wheels. */
export function drawLocomotive(frame: number): PixelCanvas {
  const p = new PixelCanvas(44, 26);
  const body = '#2e5a3e';
  const bodyLight = '#4a8a5e';
  const bodyDark = '#1e3c2a';
  const brass = '#d8a830';
  // Boiler.
  p.rect(14, 9, 24, 9, body);
  p.rect(14, 9, 24, 2, bodyLight);
  p.rect(14, 16, 24, 2, bodyDark);
  for (const x of [20, 28]) p.rect(x, 9, 1, 9, brass);
  // Smokestack and dome.
  p.rect(32, 2, 5, 7, IRON);
  p.rect(31, 1, 7, 2, IRON_LIGHT);
  p.rect(24, 6, 5, 3, brass);
  p.rect(25, 5, 3, 1, '#f0d070');
  // Front: buffer beam and cow-catcher.
  p.rect(38, 11, 3, 7, IRON);
  p.set(40, 12, '#fff0a0');
  p.set(40, 13, '#f0c84a');
  for (let i = 0; i < 4; i++) p.rect(39 + i, 18 + i, 1, 1, '#a8302a');
  p.rect(38, 18, 2, 3, '#a8302a');
  // Cab.
  p.rect(2, 4, 13, 14, '#a8302a');
  p.rect(2, 4, 13, 2, '#c84a3a');
  p.rect(1, 2, 15, 2, '#5a1a16');
  p.rect(5, 7, 6, 5, '#f0d890');
  p.rect(5, 7, 6, 1, '#b8985a');
  p.rect(2, 16, 13, 2, '#7a2018');
  // Frame and wheels.
  p.rect(1, 18, 41, 2, IRON);
  wheel(p, 8, 21, frame);
  wheel(p, 20, 21, frame);
  wheel(p, 30, 21, frame);
  // Connecting rod.
  const rodY = frame === 0 ? 21 : 20;
  p.rect(8, rodY, 23, 1, STEEL);
  p.outline(P.outline);
  return p;
}

export type CarKind = 'coal' | 'box' | 'tank' | 'caboose';

/** A train car, 36x22, coupled on both ends. Frame 0/1 turns the wheels. */
export function drawTrainCar(kind: CarKind, frame: number): PixelCanvas {
  const p = new PixelCanvas(36, 22);
  const top = 4;
  if (kind === 'coal') {
    p.rect(3, 8, 30, 9, '#5a5a66');
    p.rect(3, 8, 30, 1, '#7a7a88');
    p.rect(3, 15, 30, 2, '#40404a');
    for (let x = 4; x < 32; x++) {
      const h = 2 + ((x * 5) % 3);
      p.rect(x, 8 - h + 1, 1, h, x % 3 === 0 ? '#3a3640' : '#1e1c22');
    }
    for (const x of [8, 18, 28]) p.rect(x, 9, 1, 7, '#40404a');
  } else if (kind === 'box') {
    p.rect(3, top, 30, 13, '#b05a30');
    p.rect(3, top, 30, 2, '#d07a48');
    p.rect(3, top + 11, 30, 2, '#7a3a1a');
    for (let x = 6; x < 32; x += 4) p.rect(x, top + 2, 1, 9, '#8a4422');
    p.rect(14, top + 3, 8, 8, '#8a4422');
    p.rect(17, top + 6, 2, 1, STEEL);
  } else if (kind === 'tank') {
    p.rect(4, 7, 28, 10, '#d8d0b8');
    p.rect(4, 7, 28, 2, '#f4eedc');
    p.rect(4, 15, 28, 2, '#a8a088');
    p.rect(2, 9, 2, 6, '#c8c0a8');
    p.rect(32, 9, 2, 6, '#c8c0a8');
    p.rect(16, 4, 4, 3, '#a8a088');
    p.rect(8, 11, 20, 1, '#3a6aa8');
  } else {
    p.rect(3, top + 2, 30, 11, '#a8302a');
    p.rect(3, top + 2, 30, 2, '#c84a3a');
    p.rect(12, 0, 12, 6, '#a8302a');
    p.rect(11, 0, 14, 1, '#5a1a16');
    p.rect(14, 2, 3, 2, '#f0d890');
    p.rect(19, 2, 3, 2, '#f0d890');
    for (const x of [6, 25]) p.rect(x, top + 5, 5, 4, '#f0d890');
    p.rect(1, top + 4, 2, 8, IRON);
    p.rect(33, top + 4, 2, 8, IRON);
  }
  // Frame, couplers, wheels.
  p.rect(2, 17, 32, 2, IRON);
  p.rect(0, 17, 2, 1, IRON_LIGHT);
  p.rect(34, 17, 2, 1, IRON_LIGHT);
  wheel(p, 8, 19, frame);
  wheel(p, 27, 19, frame);
  p.outline(P.outline);
  return p;
}

/** A puff of steam, 8x8. */
export function drawSteamPuff(): PixelCanvas {
  const p = new PixelCanvas(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x - 3.5) ** 2 + (y - 3.5) ** 2 <= 12) p.set(x, y, (x + y) % 3 === 0 ? '#d8dce4' : '#f4f6fa');
  return p;
}

/** Wrought-iron graveyard fence: one 16x16 tile, `horizontal` or vertical (a run seen from the side). */
export function drawGraveFence(horizontal: boolean): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  if (horizontal) {
    p.rect(0, 6, 16, 1, IRON_LIGHT);
    p.rect(0, 12, 16, 1, IRON);
    for (let x = 1; x < 16; x += 3) {
      p.rect(x, 5, 1, 9, IRON);
      p.set(x, 4, IRON_LIGHT);
    }
  } else {
    p.rect(7, 0, 2, 16, IRON);
    p.rect(7, 0, 1, 16, IRON_LIGHT);
    for (let y = 2; y < 16; y += 4) p.rect(6, y, 4, 1, IRON);
  }
  p.outline(P.outline);
  return p;
}

/** Gate posts with a lantern hook, 16x24 (stands on the gate's left edge). */
export function drawGravePost(): PixelCanvas {
  const p = new PixelCanvas(16, 24);
  p.rect(5, 6, 6, 18, '#7a7468');
  p.rect(5, 6, 6, 2, '#9a9486');
  p.rect(4, 4, 8, 3, '#8a8478');
  p.rect(7, 1, 2, 3, '#8a8478');
  p.rect(10, 9, 4, 1, IRON);
  p.rect(12, 10, 3, 4, '#3a3a44');
  p.rect(13, 11, 1, 2, '#f0c84a');
  p.outline(P.outline);
  return p;
}

/**
 * A headstone, 14x18. Variants: 0 rounded, 1 cross, 2 small mossy slab,
 * 3 Elsie's (rounded, pale, with flowers at its foot).
 */
export function drawTombstone(variant: number): PixelCanvas {
  const p = new PixelCanvas(14, 18);
  const stone = variant === 3 ? '#c8c4d0' : '#8a8478';
  const light = variant === 3 ? '#e8e4f0' : '#a8a294';
  const dark = variant === 3 ? '#9a96a4' : '#6a645a';
  // A little mound of earth.
  p.rect(1, 15, 12, 3, '#6a4a30');
  p.rect(2, 15, 10, 1, '#80603e');
  if (variant === 1) {
    p.rect(6, 2, 3, 13, stone);
    p.rect(3, 5, 9, 3, stone);
    p.rect(6, 2, 1, 13, light);
    p.rect(3, 5, 9, 1, light);
  } else if (variant === 2) {
    p.rect(3, 8, 8, 7, stone);
    p.rect(3, 8, 8, 1, light);
    p.rect(3, 12, 3, 3, '#5a8a4a');
    p.set(9, 9, '#5a8a4a');
  } else {
    p.rect(3, 4, 8, 11, stone);
    p.rect(4, 3, 6, 1, stone);
    p.rect(5, 2, 4, 1, stone);
    p.rect(3, 4, 1, 11, light);
    p.rect(10, 4, 1, 11, dark);
    p.rect(5, 6, 4, 1, dark);
    p.rect(5, 8, 4, 1, dark);
    p.rect(6, 10, 2, 1, dark);
  }
  if (variant === 3) {
    for (const [x, c] of [[2, '#e86a8a'], [5, '#f0e070'], [9, '#9a7ae0'], [11, '#e86a8a']] as const) {
      p.set(x, 14, c);
      p.set(x, 15, '#4a8a3a');
    }
  }
  p.outline(P.outline);
  return p;
}

/** A bare, twisted old tree for the graveyard corner, 24x34. */
export function drawDeadTree(): PixelCanvas {
  const p = new PixelCanvas(24, 34);
  const bark = '#5a4636';
  const barkLight = '#7a6250';
  p.rect(10, 16, 5, 18, bark);
  p.rect(10, 16, 1, 18, barkLight);
  const branch = (x: number, y: number, dx: number, dy: number, n: number) => {
    for (let i = 0; i < n; i++) p.rect(x + dx * i, y + dy * i, 2, 2, bark);
  };
  branch(12, 16, -1, -1, 8);
  branch(13, 16, 1, -1, 9);
  branch(12, 12, 0, -1, 9);
  branch(6, 9, -1, 0, 4);
  branch(19, 9, 1, -1, 3);
  branch(12, 5, 1, -1, 4);
  p.rect(8, 32, 9, 2, '#4a3628');
  p.outline(P.outline);
  return p;
}

/** Elsie the ghost, 16x18, two bobbing frames. She wears a little bow. */
export function drawFriendlyGhost(frame: number): PixelCanvas {
  const p = new PixelCanvas(16, 18);
  const body = '#e8f2ff';
  const shade = '#b8cce8';
  const off = frame === 0 ? 0 : 1;
  for (let y = 2; y < 15; y++) {
    for (let x = 2; x < 14; x++) {
      const head = (x - 8) ** 2 + (y - 7) ** 2 <= 30;
      const skirt = y >= 7 && x >= 2 && x <= 13;
      if (head || skirt) p.set(x, y, x >= 11 ? shade : body);
    }
  }
  // Wavy hem.
  for (let x = 2; x <= 13; x++) {
    const h = ((x + off) % 4 < 2 ? 2 : 0) + 15;
    for (let y = 15; y < h; y++) p.set(x, y, x >= 11 ? shade : body);
  }
  // Face: eyes and a small "o" mouth, and rosy cheeks.
  p.rect(5, 6, 2, 3, '#2a2a40');
  p.rect(9, 6, 2, 3, '#2a2a40');
  p.set(5, 6, '#ffffff');
  p.set(9, 6, '#ffffff');
  p.rect(7, 10, 2, 2, '#4a4a68');
  p.set(4, 9, '#f4b8c8');
  p.set(11, 9, '#f4b8c8');
  // A bow.
  p.rect(10, 1, 2, 2, '#e86a8a');
  p.rect(13, 1, 2, 2, '#e86a8a');
  p.rect(12, 2, 1, 1, '#c84a6a');
  // Little arms.
  p.set(1, 9 + off, body);
  p.set(14, 9 + (1 - off), shade);
  p.outline('#7a8ab0');
  return p;
}
