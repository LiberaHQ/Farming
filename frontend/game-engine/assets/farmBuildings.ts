import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Keg, 16x22, base row 20. */
export function drawKeg(): PixelCanvas {
  const p = new PixelCanvas(16, 22);
  for (let y = 4; y <= 20; y++) {
    const bulge = y > 7 && y < 17 ? 1 : 0;
    p.rect(3 - bulge, y, 10 + bulge * 2, 1, P.wood);
    p.set(3 - bulge, y, P.woodLight);
    p.set(12 + bulge, y, P.woodDark);
  }
  for (const y of [6, 12, 18]) p.rect(2, y, 12, 1, '#7d858d');
  p.rect(4, 3, 8, 1, P.woodDark);
  p.rect(7, 14, 2, 2, '#9c5525');
  p.rect(7, 16, 1, 2, '#7d858d');
  p.outline(P.outline);
  return p;
}

/** Preserves jar, 16x18, base row 16. */
export function drawPreservesJar(): PixelCanvas {
  const p = new PixelCanvas(16, 18);
  p.rect(3, 6, 10, 11, '#dfeee4');
  p.rect(3, 6, 1, 11, '#ffffff');
  p.rect(12, 6, 1, 11, '#a8b4b8');
  p.rect(4, 9, 8, 7, '#c4a24a');
  p.rect(4, 9, 8, 1, '#e2c66a');
  p.rect(4, 3, 8, 3, P.woodDark);
  p.rect(4, 3, 8, 1, P.wood);
  p.rect(3, 16, 10, 1, '#a8b4b8');
  p.outline(P.outline);
  return p;
}

/** Greenhouse, 48x44, base row 42: a glass house with a wooden frame. */
export function drawGreenhouse(): PixelCanvas {
  const p = new PixelCanvas(48, 44);
  const glass = '#bfe6e8';
  const glassLight = '#e8f8f8';
  const frame = P.wood;
  // Walls.
  p.rect(2, 20, 44, 23, glass);
  // Roof (gable).
  for (let i = 0; i < 18; i++) p.rect(24 - i - 2, 3 + i, (i + 2) * 2, 1, i % 4 === 0 ? glassLight : glass);
  // Frame lines.
  for (let x = 2; x <= 46; x += 9) p.rect(x, 20, 2, 23, frame);
  p.rect(2, 20, 44, 2, frame);
  p.rect(2, 41, 44, 2, P.woodDark);
  for (let i = 0; i < 19; i++) {
    p.set(23 - i, 2 + i, frame);
    p.set(24 + i, 2 + i, frame);
  }
  // Reflections and plants inside.
  for (let i = 0; i < 6; i++) p.set(6 + i, 24 + i, glassLight);
  for (let i = 0; i < 6; i++) p.set(33 + i, 25 + i, glassLight);
  for (const x of [8, 18, 30, 40]) {
    p.rect(x, 34, 3, 6, P.leaf);
    p.rect(x - 1, 32, 2, 3, P.leafLight);
    p.set(x + 1, 33, '#e0443e');
  }
  // Door.
  p.rect(20, 29, 8, 12, '#a8d4d8');
  p.rect(20, 29, 8, 1, frame);
  p.rect(23, 29, 1, 12, frame);
  p.outline(P.outline);
  return p;
}

/** A small "ready!" marker shown above a machine that has finished. */
export function drawReadyMarker(): PixelCanvas {
  const p = new PixelCanvas(9, 9);
  p.rect(1, 1, 7, 7, '#fff3c4');
  p.rect(4, 2, 1, 4, '#c47a1a');
  p.set(4, 7, '#c47a1a');
  p.outline(P.outline);
  return p;
}

/** Barn, 48x46, base row 44: a red barn with a big door and a hay loft. */
export function drawBarn(): PixelCanvas {
  const p = new PixelCanvas(48, 46);
  const red = '#b8443a';
  const redDark = '#8a2e28';
  const redLight = '#d2604f';
  const trim = '#f3ead8';
  p.rect(3, 18, 42, 26, red);
  for (let x = 3; x < 45; x += 3) p.rect(x, 18, 1, 26, redDark);
  p.rect(3, 18, 42, 1, redLight);
  // Roof.
  for (let i = 0; i < 16; i++) p.rect(24 - i - 4, 2 + i, (i + 4) * 2, 1, i % 3 === 0 ? '#5a3a30' : '#6e4638');
  p.rect(1, 17, 46, 2, '#4a2e26');
  // Loft window with hay.
  p.rect(20, 7, 8, 7, trim);
  p.rect(21, 8, 6, 5, '#e2b85a');
  // Big door with an X brace.
  p.rect(15, 26, 18, 18, trim);
  p.rect(16, 27, 16, 16, redDark);
  for (let i = 0; i < 16; i++) {
    p.set(16 + i, 27 + i, trim);
    p.set(31 - i, 27 + i, trim);
  }
  p.rect(23, 27, 2, 16, trim);
  p.rect(3, 43, 42, 1, '#5a2420');
  p.outline(P.outline);
  return p;
}

/** Cheese press, 16x20, base row 18. */
export function drawCheesePress(): PixelCanvas {
  const p = new PixelCanvas(16, 20);
  p.rect(3, 10, 10, 8, P.wood);
  p.rect(3, 10, 10, 1, P.woodLight);
  p.rect(2, 2, 2, 16, P.woodDark);
  p.rect(12, 2, 2, 16, P.woodDark);
  p.rect(2, 2, 12, 2, P.woodDark);
  p.rect(7, 4, 2, 5, '#7d858d');
  p.rect(5, 8, 6, 2, '#b9c0c6');
  p.rect(5, 12, 6, 3, '#f2d06a');
  p.outline(P.outline);
  return p;
}

/** Loom, 18x20, base row 18. */
export function drawLoom(): PixelCanvas {
  const p = new PixelCanvas(18, 20);
  p.rect(2, 3, 2, 16, P.woodDark);
  p.rect(14, 3, 2, 16, P.woodDark);
  p.rect(2, 3, 14, 2, P.wood);
  p.rect(2, 12, 14, 2, P.wood);
  for (let x = 5; x <= 12; x += 2) p.rect(x, 5, 1, 7, '#efe8dc');
  p.rect(4, 8, 10, 3, '#d8cfc2');
  p.rect(4, 15, 10, 2, P.woodLight);
  p.outline(P.outline);
  return p;
}

/** Mailbox, 12x20, base row 18. */
export function drawMailbox(): PixelCanvas {
  const p = new PixelCanvas(12, 20);
  p.rect(5, 9, 2, 10, P.woodDark);
  p.rect(1, 3, 10, 7, '#5f97bb');
  p.rect(1, 3, 10, 1, '#9cc8e0');
  p.rect(1, 9, 10, 1, '#3f6f8f');
  p.rect(2, 5, 1, 3, '#3f6f8f');
  p.rect(9, 1, 1, 5, P.woodDark);
  p.rect(9, 1, 2, 2, '#d2553f');
  p.outline(P.outline);
  return p;
}

/** The shipping bin: a lidded wooden crate, 16x16. */
export function drawShippingBin(): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  p.rect(1, 5, 14, 10, P.wood);
  p.rect(1, 3, 14, 3, P.woodDark);
  p.rect(1, 3, 14, 1, P.woodLight);
  for (const x of [1, 7, 14]) p.rect(x, 6, 1, 9, P.woodDark);
  p.rect(2, 9, 12, 1, P.woodDark);
  p.rect(6, 4, 4, 1, '#e8c25a');
  p.rect(4, 11, 8, 2, '#e8c25a');
  p.set(6, 11, P.woodDark);
  p.set(9, 12, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** A crab pot bobbing in the water, 16x14. */
export function drawCrabPot(): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  p.rect(2, 7, 12, 6, '#7a5a38');
  for (let x = 2; x <= 13; x += 3) p.rect(x, 7, 1, 6, '#4a3420');
  p.rect(2, 9, 12, 1, '#4a3420');
  p.rect(1, 11, 14, 2, 'rgba(90,160,210,0.7)');
  p.rect(7, 1, 2, 6, '#e6e1d8');
  p.rect(6, 0, 4, 3, '#d2553f');
  p.outline(P.outline);
  return p;
}

/** Festival bunting: a string of little flags, 32x10. */
export function drawBunting(): PixelCanvas {
  const p = new PixelCanvas(32, 10);
  const colors = ['#e0443e', '#f2cc45', '#4a8fd8', '#6cc45a', '#c46ad8'];
  for (let x = 0; x < 32; x++) p.set(x, 1 + Math.round(Math.sin((x / 31) * Math.PI) * 2), '#5a4030');
  for (let i = 0; i < 5; i++) {
    const x0 = 2 + i * 6;
    const y0 = 2 + Math.round(Math.sin(((x0 + 2) / 31) * Math.PI) * 2);
    for (let r = 0; r < 4; r++) p.rect(x0 + r / 2, y0 + r, 4 - r, 1, colors[i]);
  }
  return p;
}

/** A paper lantern on a post, 8x20 (Winter Lights). */
export function drawLantern(): PixelCanvas {
  const p = new PixelCanvas(8, 20);
  p.rect(3, 8, 2, 12, P.woodDark);
  p.rect(1, 1, 6, 7, '#f2a03a');
  p.rect(2, 2, 4, 5, '#ffd76a');
  p.rect(1, 0, 6, 1, '#a8302a');
  p.rect(1, 8, 6, 1, '#a8302a');
  p.outline(P.outline);
  return p;
}
