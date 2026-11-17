import { blendTileEdges } from './blend';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Pixel art for the carnival: striped game tents, booths, the Ferris wheel,
 * the carousel, the High Striker, the Wheel of Fortune and the entrance arch.
 * Everything is drawn in code from the same palette as the rest of the game.
 */

export const CARNIVAL_COLORS = {
  red: '#d2404c',
  redLight: '#f26a72',
  cream: '#f6efe0',
  creamDark: '#d8cbb0',
  gold: '#f4d24a',
  goldDark: '#c8982a',
  blue: '#3a83b5',
  blueLight: '#58a4d2',
  purple: '#8a5aa8',
  purpleLight: '#b07ad0',
  green: '#3f8c3c',
  greenLight: '#5aac46',
  teal: '#2f9a8a',
  pink: '#ea7194',
};
const C = CARNIVAL_COLORS;

/** A striped game tent with a scalloped canopy and a counter, 48x46, base row 45. */
export function drawTent(stripe: string, stripeLight: string): PixelCanvas {
  const p = new PixelCanvas(48, 46);
  // Pennant on top.
  p.rect(23, 0, 2, 9, P.woodDark);
  p.rect(25, 1, 6, 2, C.gold);
  p.rect(25, 3, 4, 1, C.gold);
  // Peaked roof: stripes fanning out.
  for (let y = 8; y < 22; y++) {
    const half = Math.round(4 + (y - 8) * 1.45);
    for (let x = 24 - half; x < 24 + half; x++) {
      const band = Math.floor(((x - 24) / Math.max(1, half)) * 4 + 4);
      p.set(x, y, band % 2 ? stripe : C.cream);
    }
  }
  // Scalloped valance.
  for (let x = 3; x < 45; x++) {
    const seg = Math.floor((x - 3) / 6);
    const c = seg % 2 ? C.cream : stripe;
    p.set(x, 22, c);
    p.set(x, 23, c);
    const dx = ((x - 3) % 6) - 2.5;
    if (Math.abs(dx) < 2.2) p.set(x, 24, c);
    if (Math.abs(dx) < 1.2) p.set(x, 25, c);
  }
  p.rect(3, 22, 42, 1, stripeLight);
  // Posts and the dark inside of the booth.
  p.rect(5, 24, 2, 21, P.woodDark);
  p.rect(41, 24, 2, 21, P.woodDark);
  p.rect(7, 25, 34, 10, '#3a2a30');
  p.rect(7, 25, 34, 2, '#2b1d22');
  // Counter.
  p.rect(4, 34, 40, 4, P.wood);
  p.rect(4, 34, 40, 1, P.woodLight);
  p.rect(6, 38, 36, 7, stripe);
  for (let x = 8; x < 42; x += 6) p.rect(x, 38, 3, 7, C.cream);
  p.rect(6, 44, 36, 1, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** Little prizes hanging inside a tent (drawn over the dark back wall), 34x8. */
export function drawPrizeShelf(): PixelCanvas {
  const p = new PixelCanvas(34, 8);
  const colors = [C.pink, C.blueLight, C.gold, C.greenLight, C.purpleLight];
  for (let i = 0; i < 6; i++) {
    const x = 2 + i * 5;
    p.rect(x, 2, 3, 4, colors[i % colors.length]);
    p.set(x + 1, 1, colors[i % colors.length]);
    p.set(x, 3, '#2b1d1a');
  }
  p.rect(0, 7, 34, 1, P.woodLight);
  return p;
}

/** A small booth with a ticket window, 34x40, base row 39. */
export function drawBooth(roof: string, roofLight: string): PixelCanvas {
  const p = new PixelCanvas(34, 40);
  // Rounded roof.
  for (let y = 2; y < 12; y++) {
    const inset = Math.max(0, 6 - y);
    for (let x = 1 + inset; x < 33 - inset; x++) p.set(x, y, Math.floor((x - 1) / 4) % 2 ? roof : C.cream);
  }
  p.rect(1, 11, 32, 2, roofLight);
  // Walls.
  p.rect(3, 13, 28, 26, C.cream);
  p.rect(3, 13, 28, 1, C.creamDark);
  p.rect(3, 33, 28, 6, roof);
  p.rect(3, 33, 28, 1, roofLight);
  // Window with a little awning.
  p.rect(8, 16, 18, 13, '#3a2a30');
  p.rect(9, 17, 16, 11, '#5a4048');
  p.rect(8, 28, 18, 3, P.wood);
  p.rect(8, 28, 18, 1, P.woodLight);
  // Bulbs along the roof edge.
  for (let x = 4; x < 31; x += 4) p.set(x, 13, C.gold);
  p.outline(P.outline);
  return p;
}

/** The Ferris wheel's legs and base, 80x92, base row 91 (wheel hub at 40,38). */
export function drawFerrisFrame(): PixelCanvas {
  const p = new PixelCanvas(80, 92);
  const leg = (x0: number, x1: number) => {
    for (let y = 38; y < 86; y++) {
      const t = (y - 38) / 48;
      const x = Math.round(x0 + (x1 - x0) * t);
      p.rect(x, y, 3, 1, '#8a9098');
      p.set(x, y, '#c8ccd2');
    }
  };
  leg(39, 14);
  leg(39, 63);
  p.rect(22, 64, 36, 2, '#8a9098');
  // Platform and steps.
  p.rect(8, 84, 64, 6, P.wood);
  p.rect(8, 84, 64, 1, P.woodLight);
  p.rect(32, 86, 16, 4, C.red);
  p.rect(36, 90, 8, 1, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** The turning wheel: rim, spokes and lights, 72x72 (hub in the middle). */
export function drawFerrisWheel(): PixelCanvas {
  const p = new PixelCanvas(72, 72);
  const cx = 35.5;
  const cy = 35.5;
  for (let y = 0; y < 72; y++) {
    for (let x = 0; x < 72; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 31 && d < 34) p.set(x, y, '#c8ccd2');
      else if (d > 30 && d <= 31) p.set(x, y, '#8a9098');
      else if (d > 19 && d < 20.5) p.set(x, y, '#a8b0b8');
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (let r = 3; r < 31; r++) p.set(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), '#9aa2aa');
  }
  // Lights on the rim.
  const bulbs = [C.gold, C.red, C.blueLight, C.greenLight];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    p.rect(Math.round(cx + Math.cos(a) * 32.5) - 1, Math.round(cy + Math.sin(a) * 32.5) - 1, 2, 2, bulbs[i % 4]);
  }
  p.rect(31, 31, 10, 10, C.red);
  p.rect(33, 33, 6, 6, C.gold);
  return p;
}

/** A Ferris wheel gondola, 10x11, hangs from row 0. */
export function drawGondola(color: string, light: string): PixelCanvas {
  const p = new PixelCanvas(10, 11);
  p.rect(4, 0, 2, 3, '#8a9098');
  p.rect(1, 3, 8, 2, light);
  p.rect(1, 5, 8, 5, color);
  p.rect(2, 6, 6, 2, '#a8d4e8');
  p.outline(P.outline);
  return p;
}

/** The carousel's canopy, pole and platform, 64x60, base row 59. */
export function drawCarousel(): PixelCanvas {
  const p = new PixelCanvas(64, 60);
  // Flag.
  p.rect(31, 0, 2, 7, P.woodDark);
  p.rect(33, 1, 5, 3, C.red);
  // Cone roof.
  for (let y = 6; y < 22; y++) {
    const half = Math.round(3 + (y - 6) * 1.8);
    for (let x = 32 - half; x < 32 + half; x++) p.set(x, y, Math.floor((x - 32 + 64) / 4) % 2 ? C.red : C.cream);
  }
  p.rect(2, 22, 60, 4, C.gold);
  for (let x = 4; x < 60; x += 5) p.set(x, 23, C.red);
  // Scallops.
  for (let x = 2; x < 62; x++) if (((x - 2) % 6) - 2.5 < 2 && ((x - 2) % 6) - 2.5 > -2) p.set(x, 26, C.gold);
  // Centre column and poles.
  p.rect(28, 26, 8, 26, C.purple);
  p.rect(29, 26, 2, 26, C.purpleLight);
  for (const x of [8, 20, 43, 55]) p.rect(x, 26, 1, 26, C.goldDark);
  // Platform.
  p.rect(1, 50, 62, 5, P.woodLight);
  p.rect(1, 55, 62, 4, C.purple);
  for (let x = 4; x < 62; x += 6) p.rect(x, 56, 2, 2, C.gold);
  p.outline(P.outline);
  return p;
}

/** A painted carousel horse, 14x12. */
export function drawCarouselHorse(body: string, mane: string): PixelCanvas {
  const p = new PixelCanvas(14, 12);
  p.rect(3, 4, 8, 4, body); // body
  p.rect(10, 1, 3, 5, body); // neck + head
  p.rect(12, 2, 2, 2, body);
  p.rect(9, 1, 2, 4, mane);
  p.rect(1, 4, 2, 3, mane); // tail
  p.rect(3, 8, 1, 3, body); // legs
  p.rect(6, 8, 1, 2, body);
  p.rect(9, 8, 1, 3, body);
  p.rect(5, 5, 4, 1, C.gold); // saddle
  p.set(12, 2, '#2b1d1a');
  p.outline(P.outline);
  return p;
}

/** The High Striker: tall scale with a bell, a target pad and a mallet, 22x78, base row 77. */
export function drawStriker(): PixelCanvas {
  const p = new PixelCanvas(22, 78);
  // Bell.
  p.rect(7, 2, 8, 6, C.gold);
  p.rect(6, 6, 10, 3, C.gold);
  p.rect(8, 3, 2, 3, '#fff0a8');
  p.rect(10, 0, 2, 2, C.goldDark);
  // Tower with a scale.
  p.rect(8, 9, 6, 62, C.cream);
  p.rect(10, 9, 2, 62, '#8a9098');
  const bands = [C.red, '#e8812f', C.gold, C.greenLight, C.blueLight];
  for (let i = 0; i < 5; i++) p.rect(8, 10 + i * 12, 2, 12, bands[i]);
  for (let y = 12; y < 70; y += 6) p.rect(12, y, 2, 1, P.woodDark);
  // Puck at rest near the bottom.
  p.rect(9, 64, 4, 3, C.red);
  // Base and pad.
  p.rect(2, 70, 18, 7, P.wood);
  p.rect(2, 70, 18, 1, P.woodLight);
  p.rect(6, 68, 10, 3, C.red);
  // Mallet leaning on the side.
  p.rect(18, 50, 2, 20, P.woodLight);
  p.rect(16, 46, 6, 5, P.woodDark);
  p.outline(P.outline);
  return p;
}

/** The Wheel of Fortune's stand, 44x58, base row 57 (wheel centre at 22,22). */
export function drawFortuneStand(): PixelCanvas {
  const p = new PixelCanvas(44, 58);
  p.rect(20, 22, 4, 30, P.woodDark);
  p.rect(10, 50, 24, 6, P.wood);
  p.rect(10, 50, 24, 1, P.woodLight);
  // Pointer at the top.
  p.rect(20, 0, 4, 3, C.red);
  p.rect(21, 3, 2, 2, C.red);
  p.outline(P.outline);
  return p;
}

/** The Wheel of Fortune's coloured disk, 42x42 (spins around its centre). */
export function drawFortuneDisk(): PixelCanvas {
  const p = new PixelCanvas(42, 42);
  const colors = [C.red, C.gold, C.blue, C.cream, C.green, C.pink, C.purple, '#e8812f'];
  const cx = 20.5;
  const cy = 20.5;
  for (let y = 0; y < 42; y++) {
    for (let x = 0; x < 42; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 20.5) continue;
      if (d > 18.5) {
        p.set(x, y, P.woodDark);
        continue;
      }
      const a = (Math.atan2(y - cy, x - cx) + Math.PI * 2) % (Math.PI * 2);
      p.set(x, y, colors[Math.floor((a / (Math.PI * 2)) * 8) % 8]);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.rect(Math.round(cx + Math.cos(a) * 19.5), Math.round(cy + Math.sin(a) * 19.5), 1, 1, C.gold);
  }
  p.rect(18, 18, 5, 5, C.gold);
  p.rect(19, 19, 3, 3, '#fff0a8');
  return p;
}

/** The entrance arch over the path, 72x52, base row 51 (pillars at x 0-9 and 62-71). */
export function drawArch(): PixelCanvas {
  const p = new PixelCanvas(72, 52);
  for (const x of [1, 62]) {
    p.rect(x, 14, 9, 37, C.red);
    for (let y = 16; y < 50; y += 6) p.rect(x, y, 9, 3, C.cream);
    p.rect(x - 1, 46, 11, 5, P.woodDark);
    p.rect(x + 2, 8, 5, 6, C.gold);
    p.set(x + 4, 6, C.gold);
    p.set(x + 4, 7, C.gold);
  }
  // Curved sign.
  for (let x = 6; x < 66; x++) {
    const arc = Math.round(Math.sin(((x - 6) / 60) * Math.PI) * 6);
    for (let y = 12 - arc; y < 24 - arc; y++) p.set(x, y, y === 12 - arc || y === 23 - arc ? C.goldDark : C.purple);
  }
  // Bulbs along the sign.
  for (let x = 8; x < 64; x += 4) {
    const arc = Math.round(Math.sin(((x - 6) / 60) * Math.PI) * 6);
    p.set(x, 11 - arc, C.gold);
  }
  p.outline(P.outline);
  return p;
}

/** A treat cart with a striped umbrella, 30x38, base row 37. */
export function drawTreatCart(): PixelCanvas {
  const p = new PixelCanvas(30, 38);
  // Umbrella.
  for (let y = 1; y < 10; y++) {
    const half = Math.round(3 + y * 1.4);
    for (let x = 15 - half; x < 15 + half; x++) p.set(x, y, Math.floor((x - 15 + 30) / 3) % 2 ? C.pink : C.cream);
  }
  p.rect(14, 10, 2, 10, '#8a9098');
  // Cart body with cotton candy and apples on top.
  p.rect(3, 20, 24, 12, C.blueLight);
  p.rect(3, 20, 24, 2, C.cream);
  p.rect(5, 15, 4, 5, '#f6a8d0');
  p.rect(6, 14, 2, 1, '#f6a8d0');
  p.rect(20, 17, 3, 3, '#c8202e');
  p.rect(24, 17, 2, 3, '#c8202e');
  p.rect(6, 24, 18, 5, C.cream);
  p.rect(8, 26, 14, 1, C.red);
  // Wheels.
  for (const x of [6, 20]) {
    p.rect(x, 31, 5, 5, '#3a2a22');
    p.rect(x + 2, 33, 1, 1, '#8a9098');
  }
  p.outline(P.outline);
  return p;
}

/** A lamp post with a round bulb, 8x34, base row 33. */
export function drawLightPole(): PixelCanvas {
  const p = new PixelCanvas(8, 34);
  p.rect(3, 6, 2, 26, '#4a4048');
  p.rect(1, 31, 6, 2, '#4a4048');
  p.rect(1, 0, 6, 6, C.gold);
  p.rect(2, 1, 2, 2, '#fff8d0');
  p.outline(P.outline);
  return p;
}

/** The carnival grounds: grass around a sandy plaza with paths, w×h tiles. */
export function drawCarnivalGround(w: number, h: number, size: number, plaza: (tx: number, ty: number) => boolean, seed: () => number): HTMLCanvasElement {
  const p = new PixelCanvas(w * size, h * size);
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const x0 = tx * size;
      const y0 = ty * size;
      if (plaza(tx, ty)) {
        p.rect(x0, y0, size, size, P.dirtLight);
        for (let i = 0; i < 5; i++) p.set(x0 + Math.floor(seed() * size), y0 + Math.floor(seed() * size), P.dirt);
        if (seed() < 0.08) p.set(x0 + Math.floor(seed() * size), y0 + Math.floor(seed() * size), [C.red, C.gold, C.blueLight, C.pink][Math.floor(seed() * 4)]); // confetti
      } else {
        p.rect(x0, y0, size, size, P.grass);
        for (let i = 0; i < 6; i++) p.set(x0 + Math.floor(seed() * size), y0 + Math.floor(seed() * size), seed() < 0.5 ? P.grassShade : P.grassLight);
        if (seed() < 0.05) p.set(x0 + Math.floor(seed() * size), y0 + Math.floor(seed() * size), P.flowerYellow);
      }
    }
  }
  // Grass creeps onto the plaza along a ragged edge, so it doesn't look tiled.
  blendTileEdges(
    p,
    w,
    h,
    size,
    (tx, ty) => (tx < 0 || ty < 0 || tx >= w || ty >= h ? null : plaza(tx, ty) ? 'plaza' : 'grass'),
    { grass: { base: P.grass, light: P.grassLight, shade: P.grassShade } },
    { grass: 2, plaza: 1 },
    seed,
  );
  return p.toCanvas();
}

/** A little wooden stage with a striped skirt for the juggler, 64x22, base row 21. */
export function drawStage(): PixelCanvas {
  const p = new PixelCanvas(64, 22);
  p.rect(1, 6, 62, 5, P.woodLight);
  p.rect(1, 6, 62, 1, '#e8b880');
  for (let x = 4; x < 62; x += 8) p.rect(x, 7, 1, 4, P.wood);
  p.rect(2, 11, 60, 10, C.red);
  for (let x = 2; x < 62; x += 8) p.rect(x, 11, 4, 10, C.cream);
  p.rect(2, 11, 60, 1, C.goldDark);
  // Two little star lamps at the front corners.
  for (const x of [3, 58]) {
    p.rect(x, 1, 3, 5, '#4a4048');
    p.rect(x - 1, 0, 5, 2, C.gold);
  }
  p.outline(P.outline);
  return p;
}

/** A crystal ball on a draped table, 18x16, base row 15. */
export function drawCrystalBall(): PixelCanvas {
  const p = new PixelCanvas(18, 16);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 18; x++) if (Math.hypot(x - 8.5, y - 4.5) < 4.6) p.set(x, y, '#9ad8f0');
  p.rect(6, 2, 2, 2, '#ffffff');
  p.rect(9, 5, 2, 1, '#c8a8ff');
  p.rect(5, 9, 8, 2, C.goldDark);
  p.rect(2, 11, 14, 4, '#5a2a6a');
  p.rect(2, 11, 14, 1, '#8a4aa0');
  for (let x = 3; x < 15; x += 3) p.set(x, 13, C.gold);
  p.outline(P.outline);
  return p;
}

/** A small balloon on a string that visitors carry, 5x12 (string ends at the bottom). */
export function drawHandBalloon(color: string, light: string): PixelCanvas {
  const p = new PixelCanvas(5, 12);
  p.rect(0, 1, 5, 4, color);
  p.rect(1, 0, 3, 6, color);
  p.set(1, 1, light);
  for (let y = 6; y < 12; y++) p.set(2, y, '#e8e2d4');
  return p;
}

/** The carnival-card board by the arch, 26x30, base row 29. */
export function drawCardBoard(): PixelCanvas {
  const p = new PixelCanvas(26, 30);
  p.rect(3, 14, 2, 15, P.woodDark);
  p.rect(21, 14, 2, 15, P.woodDark);
  p.rect(0, 1, 26, 17, P.wood);
  p.rect(1, 2, 24, 15, C.purple);
  p.rect(1, 2, 24, 3, C.gold);
  // Five stamp circles and a star.
  for (let i = 0; i < 5; i++) {
    p.rect(3 + i * 4, 8, 3, 3, C.cream);
    if (i % 2 === 0) p.set(4 + i * 4, 9, C.red);
  }
  p.rect(9, 13, 8, 2, C.cream);
  p.outline(P.outline);
  return p;
}

/** A wooden arrow sign on a post pointing right (flip for left), 34x30, base row 29. */
export function drawFairSignpost(): PixelCanvas {
  const p = new PixelCanvas(34, 30);
  p.rect(6, 12, 3, 17, P.woodDark);
  // Arrow-shaped board in carnival stripes.
  for (let y = 2; y < 13; y++) {
    const tip = 26 + Math.min(y - 2, 12 - y);
    for (let x = 1; x < tip; x++) p.set(x, y, y === 2 || y === 12 ? C.goldDark : x < 4 ? C.red : C.cream);
  }
  for (let x = 4; x < 26; x += 6) p.rect(x, 3, 2, 1, C.red);
  for (let x = 4; x < 26; x += 6) p.rect(x, 11, 2, 1, C.red);
  p.outline(P.outline);
  return p;
}

/** A striped billboard on two legs ("games, rides, prizes"), 40x34, base row 33. */
export function drawFairBillboard(): PixelCanvas {
  const p = new PixelCanvas(40, 34);
  for (const x of [5, 33]) p.rect(x, 18, 2, 15, P.woodDark);
  p.rect(1, 2, 38, 18, C.purple);
  p.rect(1, 2, 38, 2, C.goldDark);
  p.rect(1, 18, 38, 2, C.goldDark);
  p.rect(3, 5, 34, 12, C.cream);
  // Bulbs on the frame.
  for (let x = 3; x < 38; x += 4) {
    p.set(x, 0, C.gold);
    p.set(x, 1, C.gold);
  }
  p.outline(P.outline);
  return p;
}

/** A string of triangle pennants between two points, as one canvas w×h (sag drawn in). */
export function drawBunting(w: number): PixelCanvas {
  const h = 12;
  const p = new PixelCanvas(w, h);
  const colors = [C.red, C.gold, C.blueLight, C.greenLight, C.pink, C.purpleLight];
  const sag = (x: number) => Math.round(Math.sin((x / (w - 1)) * Math.PI) * 4);
  for (let x = 0; x < w; x++) p.set(x, 1 + sag(x), '#5a4a42');
  let i = 0;
  for (let x = 3; x + 4 < w; x += 7, i++) {
    const top = 2 + sag(x + 2);
    const col = colors[i % colors.length];
    for (let r = 0; r < 5; r++) for (let c = r; c < 5 - r; c++) p.set(x + c, top + r, col);
  }
  return p;
}
