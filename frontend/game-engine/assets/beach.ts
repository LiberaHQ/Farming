import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Pixel art for the beach: palms, umbrellas and towels, a lifeguard tower,
 * a sandcastle, a bonfire, a rowing boat, gulls and crabs. Drawn in code from
 * the game's palette like everything else.
 */

const SAND = '#ecd8a4';
const SAND_DARK = '#c9ad74';

/** A leaning coconut palm, 40x56, base row 55 (trunk base near x 18). */
export function drawPalm(lean = 1): PixelCanvas {
  const p = new PixelCanvas(40, 56);
  // Curved, ringed trunk.
  for (let y = 18; y < 55; y++) {
    const x = Math.round(18 + lean * Math.pow((55 - y) / 37, 1.6) * 5);
    p.rect(x, y, 4, 1, (y % 4 === 0 ? P.trunkDark : y % 4 === 1 ? P.trunkLight : P.trunk));
  }
  const top = { x: Math.round(18 + lean * 5) + 2, y: 18 };
  // Fronds: drooping arcs in four directions.
  const frond = (dx: number, dy: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = Math.round(top.x + dx * i);
      const y = Math.round(top.y + dy * i + t * t * 9);
      p.rect(x - 1, y - 1, 3, 3, i % 3 === 0 ? P.leafLight : P.leaf);
      p.set(x, y + 2, P.leafDark);
    }
  };
  frond(-1, -0.2, 16);
  frond(1, -0.2, 16);
  frond(-0.7, -0.7, 11);
  frond(0.7, -0.7, 11);
  frond(-0.9, 0.3, 12);
  frond(0.9, 0.3, 12);
  // Coconuts.
  for (const [cx, cy] of [[-2, 2], [1, 3], [3, 1]]) p.rect(top.x + cx - 1, top.y + cy, 3, 3, '#6a4a28');
  p.rect(top.x - 2, top.y - 2, 5, 3, P.leafHi);
  p.outline(P.outline);
  return p;
}

/** A striped beach umbrella on a pole, 34x38, base row 37. */
export function drawUmbrella(a: string, b: string): PixelCanvas {
  const p = new PixelCanvas(34, 38);
  p.rect(16, 10, 2, 27, '#e8e2d4');
  for (let y = 2; y < 13; y++) {
    const half = Math.round(4 + (y - 2) * 1.2);
    for (let x = 17 - half; x < 17 + half; x++) p.set(x, y, Math.floor((x - 17 + 40) / 4) % 2 ? a : b);
  }
  // Scalloped hem.
  for (let x = 4; x < 30; x += 4) p.rect(x, 13, 3, 1, Math.floor((x - 17 + 40) / 4) % 2 ? a : b);
  p.rect(16, 0, 2, 3, '#e8e2d4');
  p.outline(P.outline);
  return p;
}

/** A striped towel laid on the sand, 16x26 (flat, no outline on its base). */
export function drawTowel(a: string, b: string): PixelCanvas {
  const p = new PixelCanvas(16, 26);
  p.rect(1, 1, 14, 24, a);
  for (let y = 4; y < 24; y += 5) p.rect(1, y, 14, 2, b);
  for (let x = 2; x < 15; x += 2) {
    p.set(x, 0, b);
    p.set(x, 25, b);
  }
  p.outline(P.outline);
  return p;
}

/** A wooden deck chair, 18x18, base row 17. */
export function drawDeckChair(color: string): PixelCanvas {
  const p = new PixelCanvas(18, 18);
  for (let i = 0; i < 9; i++) p.rect(3 + Math.floor(i / 2), 2 + i, 8, 1, i % 3 === 2 ? '#f6efe0' : color);
  p.rect(6, 11, 10, 3, color);
  p.rect(6, 12, 10, 1, '#f6efe0');
  for (const x of [3, 7, 14]) p.rect(x, 13, 1, 4, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** A sandcastle with a little flag, 28x24, base row 23. */
export function drawSandcastle(): PixelCanvas {
  const p = new PixelCanvas(28, 24);
  p.rect(2, 14, 24, 9, SAND);
  p.rect(2, 20, 24, 3, SAND_DARK);
  for (const x of [2, 19]) {
    p.rect(x, 8, 7, 14, SAND);
    for (let i = 0; i < 7; i += 2) p.set(x + i, 7, SAND);
    p.rect(x + 2, 12, 2, 3, SAND_DARK);
  }
  p.rect(10, 4, 8, 12, '#e4cc94');
  for (let i = 0; i < 8; i += 2) p.set(10 + i, 3, '#e4cc94');
  p.rect(13, 11, 2, 5, '#9a7a48');
  p.rect(14, 0, 1, 4, P.woodDark);
  p.rect(15, 0, 4, 2, P.berry);
  p.outline(P.outline);
  return p;
}

/** A beach ball, 10x10. */
export function drawBeachBall(): PixelCanvas {
  const p = new PixelCanvas(10, 10);
  const cols = ['#d2404c', '#f6efe0', '#3a83b5', '#f6efe0', '#f4d24a', '#f6efe0'];
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const dx = x - 4.5;
      const dy = y - 4.5;
      if (dx * dx + dy * dy > 20) continue;
      const a = Math.atan2(dy, dx) + Math.PI;
      p.set(x, y, cols[Math.floor((a / (Math.PI * 2)) * 6) % 6]);
    }
  }
  p.rect(3, 2, 2, 1, '#ffffff');
  p.outline(P.outline);
  return p;
}

/** A lifeguard tower: stilts, a red hut and a flag, 30x52, base row 51. */
export function drawLifeguardTower(): PixelCanvas {
  const p = new PixelCanvas(30, 52);
  for (const x of [5, 23]) p.rect(x, 26, 2, 25, P.wood);
  p.rect(5, 38, 20, 2, P.woodDark);
  // Ladder.
  p.rect(11, 30, 1, 21, P.woodDark);
  p.rect(17, 30, 1, 21, P.woodDark);
  for (let y = 32; y < 51; y += 4) p.rect(11, y, 7, 1, P.woodLight);
  // Hut.
  p.rect(3, 14, 24, 13, '#d2404c');
  p.rect(3, 24, 24, 3, P.wood);
  p.rect(7, 17, 16, 6, '#3a5a7a');
  p.rect(8, 18, 6, 2, '#8ec4e4');
  // Roof.
  for (let y = 8; y < 14; y++) p.rect(3 - (y - 8) / 3, y, 24 + ((y - 8) * 2) / 3, 1, y % 2 ? '#f6efe0' : '#d2404c');
  // Flag.
  p.rect(15, 0, 1, 8, P.woodDark);
  p.rect(16, 0, 7, 4, '#f4d24a');
  p.rect(16, 2, 7, 1, '#d2404c');
  p.outline(P.outline);
  return p;
}

/** A bleached driftwood log, 30x10, base row 9. */
export function drawDriftwood(): PixelCanvas {
  const p = new PixelCanvas(30, 10);
  p.rect(1, 3, 27, 5, '#b8a488');
  p.rect(1, 3, 27, 1, '#d6c6aa');
  p.rect(1, 7, 27, 1, '#8a7a62');
  p.rect(20, 0, 2, 4, '#b8a488');
  p.rect(22, 0, 3, 1, '#b8a488');
  p.rect(0, 4, 2, 3, '#d6c6aa');
  for (const x of [6, 13, 17]) p.set(x, 5, '#8a7a62');
  p.outline(P.outline);
  return p;
}

/** A wet shore rock, 20x14, base row 13. */
export function drawShoreRock(): PixelCanvas {
  const p = new PixelCanvas(20, 14);
  p.rect(2, 4, 16, 9, P.stoneDark);
  p.rect(4, 2, 11, 3, P.stone);
  p.rect(3, 4, 12, 4, P.stone);
  p.rect(5, 3, 5, 2, P.stoneLight);
  p.rect(2, 11, 16, 2, '#4f6a5a');
  p.set(14, 6, '#4f8a5a');
  p.set(15, 7, '#4f8a5a');
  p.outline(P.outline);
  return p;
}

/** A ring of stones with logs and flames (two frames), 22x24, base row 23. */
export function drawBonfire(frame: number): PixelCanvas {
  const p = new PixelCanvas(22, 24);
  for (const [x, y] of [[2, 19], [6, 21], [11, 22], [16, 21], [19, 19], [4, 17], [17, 17]]) p.rect(x, y, 3, 2, P.stone);
  p.rect(5, 17, 12, 2, P.trunk);
  p.rect(7, 15, 8, 2, P.trunkDark);
  const lean = frame ? 1 : -1;
  p.rect(7, 8, 8, 8, '#e8642a');
  p.rect(8 + lean, 4, 6, 5, '#e8642a');
  p.rect(10 + lean * 2, 1, 2, 4, '#f29a3a');
  p.rect(9, 9, 4, 6, '#f6c84a');
  p.rect(10 + lean, 6, 2, 4, '#fff1a8');
  p.outline(P.outline);
  return p;
}

/** A little rowing boat seen from above, 34x16. */
export function drawBoat(): PixelCanvas {
  const p = new PixelCanvas(34, 16);
  for (let x = 1; x < 33; x++) {
    const half = Math.round(6.5 * Math.sin(((x - 1) / 31) * Math.PI) ** 0.6);
    p.rect(x, 8 - half, 1, half * 2, '#d2404c');
    if (half > 2) p.rect(x, 9 - half, 1, half * 2 - 2, P.wood);
  }
  for (const x of [10, 22]) p.rect(x, 3, 2, 10, P.woodDark);
  p.rect(14, 2, 3, 1, P.woodLight);
  p.rect(26, 7, 6, 2, P.woodLight);
  p.outline(P.outline);
  return p;
}

/** A seagull in flight, two wing frames, 13x7. */
export function drawGull(frame: number): PixelCanvas {
  const p = new PixelCanvas(13, 7);
  if (frame === 0) {
    for (let i = 0; i < 6; i++) p.set(i, 3 - Math.min(i, 5 - i) / 2, '#f6f3e8');
    for (let i = 0; i < 6; i++) p.set(7 + i, 3 - Math.min(i, 5 - i) / 2, '#f6f3e8');
  } else {
    for (let i = 0; i < 6; i++) p.set(i, 3 + Math.min(i, 5 - i) / 3, '#f6f3e8');
    for (let i = 0; i < 6; i++) p.set(7 + i, 3 + Math.min(i, 5 - i) / 3, '#f6f3e8');
  }
  p.rect(5, 3, 3, 2, '#f6f3e8');
  p.set(8, 3, '#f4a83a');
  p.rect(0, 2, 1, 1, '#8a9098');
  p.rect(12, 2, 1, 1, '#8a9098');
  p.outline(P.outline);
  return p;
}

/** A red crab, two leg frames, 12x9. */
export function drawCrab(frame: number): PixelCanvas {
  const p = new PixelCanvas(12, 9);
  p.rect(3, 3, 6, 4, '#d2503c');
  p.rect(4, 2, 4, 1, '#e8705a');
  p.set(4, 1, P.outline);
  p.set(7, 1, P.outline);
  // Claws.
  p.rect(0, 2 + frame, 2, 2, '#d2503c');
  p.rect(10, 2 + (1 - frame), 2, 2, '#d2503c');
  // Legs.
  for (const x of [3, 5, 6, 8]) p.set(x, 7 + ((x + frame) % 2), '#a8382a');
  p.outline(P.outline);
  return p;
}

/** A starfish lying on the sand, 9x9. */
export function drawStarfish(): PixelCanvas {
  const p = new PixelCanvas(9, 9);
  const c = '#f08a4a';
  p.rect(3, 3, 3, 3, c);
  p.rect(4, 0, 1, 3, c);
  p.rect(0, 3, 3, 1, c);
  p.rect(6, 3, 3, 1, c);
  p.rect(2, 6, 1, 2, c);
  p.rect(6, 6, 1, 2, c);
  p.set(4, 4, '#f8c08a');
  p.outline(P.outline);
  return p;
}

/** Tufts of dune grass, 16x12, base row 11. */
export function drawDuneGrass(): PixelCanvas {
  const p = new PixelCanvas(16, 12);
  for (const [x, h] of [[2, 7], [4, 10], [6, 8], [9, 11], [11, 7], [13, 9]]) {
    for (let y = 0; y < h; y++) p.set(x + Math.round((y / h) * (x < 8 ? -1 : 1)), 11 - y, y > h - 3 ? '#b8c46a' : '#7a9a48');
  }
  return p;
}

/** A wooden welcome sign on two posts, 36x26, base row 25. */
export function drawBeachSign(): PixelCanvas {
  const p = new PixelCanvas(36, 26);
  for (const x of [5, 29]) p.rect(x, 12, 2, 13, P.woodDark);
  p.rect(1, 2, 34, 12, P.wood);
  p.rect(1, 2, 34, 1, P.woodLight);
  p.rect(1, 13, 34, 1, P.woodDark);
  p.rect(3, 4, 30, 8, '#3a83b5');
  p.rect(3, 10, 30, 2, '#ecd8a4');
  p.outline(P.outline);
  return p;
}

/** A pier bollard with rope, 8x10, base row 9. */
export function drawBollard(): PixelCanvas {
  const p = new PixelCanvas(8, 10);
  p.rect(2, 1, 4, 8, P.woodDark);
  p.rect(2, 1, 4, 1, P.woodLight);
  p.rect(1, 4, 6, 1, '#e8d8a8');
  p.outline(P.outline);
  return p;
}

/** A pier lantern post, 8x30, base row 29. */
export function drawPierLantern(): PixelCanvas {
  const p = new PixelCanvas(8, 30);
  p.rect(3, 7, 2, 22, P.woodDark);
  p.rect(1, 1, 6, 6, '#3a3a42');
  p.rect(2, 2, 4, 4, '#f4d24a');
  p.rect(2, 2, 2, 2, '#fff8d0');
  p.rect(2, 0, 4, 1, '#3a3a42');
  p.outline(P.outline);
  return p;
}
