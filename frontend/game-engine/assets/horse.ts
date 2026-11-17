import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Frames in the horse sheet (each 32x28, standing on row 27). */
export const HORSE_FRAME = { width: 32, height: 28 } as const;
export const HORSE_FRAMES = { sideStand: 0, sideWalk: [1, 2], down: [3, 4], up: [5, 6] } as const;

const BODY = '#9a5a32';
const LIGHT = '#c07a48';
const DARK = '#6a3a1e';
const MANE = '#3a2418';
const HOOF = '#2b1d1a';
const SADDLE = '#8a2a2a';
const STITCH = '#e8b83a';
const BLAZE = '#f0e4d0';

function ellipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) p.set(x, y, color);
    }
  }
}

/** Side view, facing right. `step` 0 = standing, 1/2 = walking. */
function side(p: PixelCanvas, ox: number, step: number): void {
  const lift = (leg: number) => (step === 0 ? 0 : (leg + step) % 2 === 0 ? 2 : 0);
  const swing = (leg: number) => (step === 0 ? 0 : (leg + step) % 2 === 0 ? 1 : -1);
  // Legs (far pair darker, drawn first).
  const legs: Array<[number, string]> = [
    [9, DARK],
    [20, DARK],
    [11, BODY],
    [22, BODY],
  ];
  legs.forEach(([x, c], i) => {
    const lx = ox + x + swing(i);
    const top = 17;
    const bottom = 26 - lift(i);
    p.rect(lx, top, 2, bottom - top, c);
    p.rect(lx, bottom, 2, 1, HOOF);
  });
  // Tail.
  for (let y = 10; y < 22; y++) p.rect(ox + 4 - Math.floor((y - 10) / 5), y, 2, 1, MANE);
  // Body.
  ellipse(p, ox + 15.5, 14, 9.5, 5, BODY);
  p.rect(ox + 8, 11, 15, 1, LIGHT);
  ellipse(p, ox + 15, 17, 6, 1.5, DARK);
  // Neck and head.
  for (let i = 0; i < 7; i++) p.rect(ox + 20 + Math.floor(i / 2), 12 - i, 4, 2, BODY);
  p.rect(ox + 23, 3, 6, 5, BODY);
  p.rect(ox + 27, 6, 3, 3, LIGHT);
  p.set(ox + 29, 7, HOOF);
  p.set(ox + 26, 4, HOOF);
  p.rect(ox + 24, 1, 1, 2, BODY);
  p.rect(ox + 25, 2, 1, 1, DARK);
  p.rect(ox + 26, 3, 2, 1, BLAZE);
  // Mane down the neck.
  for (let i = 0; i < 8; i++) p.rect(ox + 19 + Math.floor(i / 2), 11 - i, 2, 1, MANE);
  // Saddle and blanket.
  p.rect(ox + 11, 9, 8, 4, SADDLE);
  p.rect(ox + 11, 9, 8, 1, '#a83a3a');
  p.rect(ox + 11, 12, 8, 1, STITCH);
  p.rect(ox + 14, 13, 1, 4, '#5a3a26');
}

/** Facing the camera (down) or away (up); `step` 0/1. */
function front(p: PixelCanvas, ox: number, step: number, away: boolean): void {
  const s = step ? 1 : 0;
  // Legs.
  for (const [x, i] of [
    [12, 0],
    [18, 1],
  ] as const) {
    const lift = (i + s) % 2 === 0 ? 0 : 1;
    p.rect(ox + x, 18, 2, 8 - lift, BODY);
    p.rect(ox + x, 26 - lift, 2, 1, HOOF);
  }
  for (const x of [14, 16]) p.rect(ox + x, 19, 2, 6, DARK);
  // Body (seen end-on).
  ellipse(p, ox + 16, 15, 6, 5, BODY);
  if (away) {
    // Rump, tail and a glimpse of the neck and ears beyond.
    p.rect(ox + 13, 3, 6, 6, BODY);
    p.rect(ox + 13, 2, 1, 2, BODY);
    p.rect(ox + 18, 2, 1, 2, BODY);
    p.rect(ox + 15, 3, 2, 7, MANE);
    p.rect(ox + 15, 15, 2, 9 + s, MANE);
    p.rect(ox + 12, 9, 8, 4, SADDLE);
    p.rect(ox + 12, 12, 8, 1, STITCH);
  } else {
    p.rect(ox + 12, 10, 8, 3, SADDLE);
    p.rect(ox + 12, 12, 8, 1, STITCH);
    // Head straight on.
    p.rect(ox + 13, 2, 6, 10, BODY);
    p.rect(ox + 14, 9, 4, 4, LIGHT);
    p.rect(ox + 15, 3, 2, 6, BLAZE);
    p.set(ox + 13, 5, HOOF);
    p.set(ox + 18, 5, HOOF);
    p.set(ox + 15, 11, HOOF);
    p.set(ox + 16, 11, HOOF);
    p.rect(ox + 13, 0, 1, 2, BODY);
    p.rect(ox + 18, 0, 1, 2, BODY);
    p.rect(ox + 14, 1, 4, 2, MANE);
  }
}

/** The horse sheet: side stand, side walk ×2, down ×2, up ×2. */
export function drawHorseSheet(): PixelCanvas {
  const w = HORSE_FRAME.width;
  const p = new PixelCanvas(w * 7, HORSE_FRAME.height);
  side(p, 0, 0);
  side(p, w, 1);
  side(p, w * 2, 2);
  front(p, w * 3, 0, false);
  front(p, w * 4, 1, false);
  front(p, w * 5, 0, true);
  front(p, w * 6, 1, true);
  p.outline(P.outline);
  return p;
}
