import type { CharacterAppearance, Direction } from '@farming/shared';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The player sprite sheet is composed from body parts at boot, coloured by a
 * CharacterAppearance. Changing the appearance regenerates the whole sheet,
 * which is how character customisation will plug in later.
 *
 * Layout: 3 frames (stand, step A, step B) x 4 rows (down, left, right, up).
 * Each frame is 16x24; feet rest on row 21.
 */
export const CHARACTER_FRAME = { width: 16, height: 24, framesPerDirection: 3 } as const;

export const DIRECTION_ROWS: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

type Rect = (x: number, y: number, w: number, h: number, c: string) => void;
type Dot = (x: number, y: number, c: string) => void;

function frontLegs(R: Rect, frame: number, a: CharacterAppearance): void {
  // The forward leg reads as lower (closer to camera); the raised leg is shorter.
  const lBottom = frame === 1 ? 22 : frame === 2 ? 20 : 21;
  const rBottom = frame === 1 ? 20 : frame === 2 ? 22 : 21;
  R(5, 18, 3, lBottom - 18, a.pants);
  R(5, lBottom, 3, 1, a.shoes);
  R(8, 18, 3, rBottom - 18, a.pants);
  R(10, 18, 1, rBottom - 18, a.pantsDark);
  R(8, rBottom, 3, 1, a.shoes);
}

function sideLegs(R: Rect, frame: number, a: CharacterAppearance): void {
  if (frame === 0) {
    R(6, 18, 4, 3, a.pants);
    R(9, 18, 1, 3, a.pantsDark);
    R(5, 21, 5, 1, a.shoes);
    return;
  }
  const front = frame === 1 ? a.pants : a.pantsDark;
  const back = frame === 1 ? a.pantsDark : a.pants;
  R(9, 18, 3, 3, back);
  R(9, 21, 3, 1, a.shoes);
  R(4, 18, 3, 3, front);
  R(3, 21, 4, 1, a.shoes);
}

function drawFrame(p: PixelCanvas, ox: number, oy: number, facing: 'down' | 'up' | 'left', frame: number, a: CharacterAppearance) {
  const R: Rect = (x, y, w, h, c) => p.rect(ox + x, oy + y, w, h, c);
  const S: Dot = (x, y, c) => p.set(ox + x, oy + y, c);
  const b = frame === 0 ? 0 : 1; // body dips on contact frames

  if (facing === 'left') sideLegs(R, frame, a);
  else frontLegs(R, frame, a);

  if (facing === 'left') {
    R(5, 12 + b, 6, 6, a.shirt);
    R(10, 12 + b, 1, 6, a.shirtDark);
    R(5, 17 + b, 6, 1, a.pantsDark);
    const sleeveX = frame === 1 ? 6 : frame === 2 ? 8 : 7;
    const handX = frame === 1 ? 5 : frame === 2 ? 9 : 7;
    R(sleeveX, 13 + b, 2, 3, a.shirtDark);
    R(handX, 16 + b, 2, 1, a.skin);
  } else {
    R(4, 12 + b, 8, 6, a.shirt);
    R(11, 12 + b, 1, 6, a.shirtDark);
    R(4, 17 + b, 8, 1, a.pantsDark);
    const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    const lHand = 16 + b + swing;
    const rHand = 16 + b - swing;
    R(3, 13 + b, 1, lHand - (13 + b), a.shirtDark);
    S(3, lHand, a.skin);
    R(12, 13 + b, 1, rHand - (13 + b), a.shirtDark);
    S(12, rHand, a.skin);
  }

  if (facing === 'down') {
    R(4, 4 + b, 8, 7, a.skin);
    R(5, 11 + b, 6, 1, a.skinShade);
    R(5, 1 + b, 6, 1, a.hair);
    R(4, 2 + b, 8, 4, a.hair);
    R(4, 6 + b, 1, 3, a.hair);
    R(11, 6 + b, 1, 3, a.hair);
    S(6, 6 + b, a.hair);
    S(9, 6 + b, a.hair);
    S(6, 2 + b, a.hairLight);
    S(7, 2 + b, a.hairLight);
    S(5, 3 + b, a.hairLight);
    R(6, 8 + b, 1, 2, P.eye);
    R(9, 8 + b, 1, 2, P.eye);
    S(5, 10 + b, P.cheek);
    S(10, 10 + b, P.cheek);
  } else if (facing === 'up') {
    R(5, 1 + b, 6, 1, a.hair);
    R(4, 2 + b, 8, 8, a.hair);
    R(5, 10 + b, 6, 1, a.hair);
    R(6, 11 + b, 4, 1, a.skinShade);
    S(6, 3 + b, a.hairLight);
    S(7, 3 + b, a.hairLight);
    S(8, 4 + b, a.hairLight);
    S(5, 5 + b, a.hairLight);
  } else {
    R(4, 4 + b, 7, 7, a.skin);
    R(5, 11 + b, 5, 1, a.skinShade);
    R(5, 1 + b, 6, 1, a.hair);
    R(4, 2 + b, 8, 3, a.hair);
    R(4, 5 + b, 3, 1, a.hair);
    R(8, 5 + b, 4, 5, a.hair);
    R(9, 10 + b, 2, 1, a.hair);
    R(8, 7 + b, 1, 2, a.skinShade);
    R(5, 8 + b, 1, 2, P.eye);
    S(3, 8 + b, a.skin);
    S(6, 10 + b, P.cheek);
    S(6, 2 + b, a.hairLight);
    S(7, 2 + b, a.hairLight);
    S(9, 3 + b, a.hairLight);
  }
}

export function drawCharacterSheet(appearance: CharacterAppearance): PixelCanvas {
  const { width: FW, height: FH, framesPerDirection: N } = CHARACTER_FRAME;
  const sheet = new PixelCanvas(FW * N, FH * 4);
  for (let f = 0; f < N; f++) {
    drawFrame(sheet, f * FW, DIRECTION_ROWS.down * FH, 'down', f, appearance);
    drawFrame(sheet, f * FW, DIRECTION_ROWS.left * FH, 'left', f, appearance);
    drawFrame(sheet, f * FW, DIRECTION_ROWS.up * FH, 'up', f, appearance);
  }
  // Right-facing frames are mirrored from left-facing ones.
  for (let f = 0; f < N; f++) {
    sheet.mirrorRegion(f * FW, DIRECTION_ROWS.left * FH, FW, FH, f * FW, DIRECTION_ROWS.right * FH);
  }
  sheet.outline(P.outline);
  return sheet;
}
