import type { CharacterAppearance } from '@farming/shared';
import { DIRECTION_ROWS } from './character';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * The player's own sprite sheet: a little larger than the villagers (20x30
 * frames against their 16x24), drawn at full size so every pixel stays crisp,
 * and built from layers — body, face, outfit, hair, hat — so every look in the
 * character panel composes cleanly.
 *
 * Layout matches the villagers' sheet: 3 frames (stand, step A, step B) x 4
 * rows (down, left, right, up). Feet rest on row 27; right is mirrored from left.
 */
export const PLAYER_FRAME = { width: 20, height: 30, framesPerDirection: 3 } as const;
/** Pixel row (within a frame) the feet stand on. */
export const PLAYER_FEET_ROW = 27;
export const PLAYER_FEET_ORIGIN_Y = (PLAYER_FEET_ROW + 1) / PLAYER_FRAME.height;

type Facing = 'down' | 'left' | 'up';
type Rect = (x: number, y: number, w: number, h: number, c: string) => void;
type Dot = (x: number, y: number, c: string) => void;

interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  hairLight: string;
  shirt: string;
  shirtDark: string;
  pants: string;
  pantsDark: string;
  shoes: string;
  shoesLight: string;
  eyes: string;
  hairStyle: NonNullable<CharacterAppearance['hairStyle']>;
  hat: NonNullable<CharacterAppearance['hat']>;
  outfit: NonNullable<CharacterAppearance['outfit']>;
}

const lookOf = (a: CharacterAppearance): Look => ({
  ...a,
  shoesLight: a.shoesLight ?? a.shoes,
  eyes: a.eyes ?? '#3a2a24',
  hairStyle: a.hairStyle ?? 'short',
  hat: a.hat ?? 'none',
  outfit: a.outfit ?? 'shirt',
});

const WHITE = '#fbf6ec';
/** Hats that sit over the crown (spikes and buns tuck underneath). */
const crownHidden = (l: { hat: string }) => l.hat === 'straw' || l.hat === 'cap' || l.hat === 'beanie';
const MOUTH = '#c87a66';
const HAT = { straw: '#e2c070', strawDark: '#b8923e', band: '#c8423a', cap: '#c8423a', capDark: '#962c26', beanie: '#4a7ab0', beanieDark: '#365a86', bandana: '#c8423a', petal: '#f4a2c4', petalCore: '#f4d24a' };

// ---------- Legs and shoes ----------

/** Front/back legs. Step A puts the left foot forward (one row lower), step B the right. */
function legsFront(R: Rect, frame: number, l: Look): void {
  const left = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const right = -left;
  const dress = l.outfit === 'dress';
  const leg = dress ? l.pants : l.pants;
  const top = dress ? 25 : 22;
  for (const [x, d] of [
    [6, left],
    [11, right],
  ] as const) {
    const shoeTop = 26 + d;
    R(x, top, 3, shoeTop - top, leg);
    if (!dress) R(x + 2, top, 1, shoeTop - top, l.pantsDark);
    // Shoes: a lighter upper, toes turned slightly out.
    const sx = x === 6 ? x - 1 : x;
    R(sx, shoeTop, 4, 2, l.shoes);
    R(sx + 1, shoeTop, 2, 1, l.shoesLight);
  }
  if (!dress) R(6, 22, 8, 1, l.pants);
}

/** Side view legs: together when standing, apart when walking. */
function legsSide(R: Rect, frame: number, l: Look): void {
  const top = l.outfit === 'dress' ? 25 : 22;
  if (frame === 0) {
    R(7, top, 5, 26 - top, l.pants);
    R(10, top, 2, 26 - top, l.pantsDark);
    R(5, 26, 6, 2, l.shoes);
    R(6, 26, 3, 1, l.shoesLight);
    return;
  }
  const front = frame === 1 ? l.pants : l.pantsDark;
  const back = frame === 1 ? l.pantsDark : l.pants;
  R(10, top, 3, 26 - top, back);
  R(10, 26, 4, 2, l.shoes);
  R(5, top, 3, 27 - top, front);
  R(3, 27, 5, 2, l.shoes);
  R(4, 27, 2, 1, l.shoesLight);
}

// ---------- Torso, arms and outfits ----------

function torsoFront(R: Rect, S: Dot, b: number, frame: number, l: Look, back: boolean): void {
  const y = 15 + b;
  // Shoulders, then a slim body (narrower than the head, for a friendly chibi shape).
  R(7, y, 6, 1, l.shirt);
  R(6, y + 1, 8, 6, l.shirt);
  R(13, y + 1, 1, 6, l.shirtDark);
  R(6, y + 6, 8, 1, l.shirtDark);
  if (l.outfit === 'dress') {
    // A skirt that flares out over the knees.
    R(6, y + 7, 8, 1, l.shirt);
    R(5, y + 8, 10, 2, l.shirt);
    R(5, y + 10 - b, 10, 1, l.shirtDark);
    R(13, y + 7, 2, 3 - b, l.shirtDark);
    if (!back) {
      S(9, y + 2, l.shirtDark);
      S(10, y + 2, l.shirtDark);
    }
  } else {
    R(6, y + 6, 8, 1, l.pantsDark); // belt
    if (!back) S(9, y + 6, '#d8b450'); // buckle
  }
  if (l.outfit === 'overalls') {
    // A bib and straps in the trouser colour, with brass buttons.
    R(7, y + 2, 6, 5, l.pants);
    R(12, y + 2, 1, 5, l.pantsDark);
    R(7, y, 1, 2, l.pants);
    R(12, y, 1, 2, l.pants);
    if (!back) {
      S(7, y + 2, '#e8c25a');
      S(12, y + 2, '#e8c25a');
      R(8, y + 4, 4, 1, l.pantsDark); // pocket
    }
  }
  if (!back && l.outfit !== 'overalls') {
    // A small collar opening at the neck.
    S(9, y, l.skinShade);
    S(10, y, l.skinShade);
  }
  // Arms swing opposite the legs.
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  for (const [x, d, outer] of [
    [4, swing, 4],
    [14, -swing, 15],
  ] as const) {
    const top = y + 1;
    const handY = y + 5 + d;
    const sleeveRows = l.outfit === 'tee' ? 2 : handY - top;
    R(x, top, 2, sleeveRows, l.shirt);
    R(outer, top, 1, sleeveRows, l.shirtDark);
    if (l.outfit === 'tee') R(x, top + 2, 2, handY - top - 2, l.skin);
    R(x, handY, 2, 2, l.skin);
    S(outer, handY + 1, l.skinShade);
  }
}

function torsoSide(R: Rect, S: Dot, b: number, frame: number, l: Look): void {
  const y = 15 + b;
  R(7, y, 5, 1, l.shirt);
  R(6, y + 1, 7, 6, l.shirt);
  R(12, y + 1, 1, 6, l.shirtDark);
  if (l.outfit === 'dress') {
    R(6, y + 7, 7, 1, l.shirt);
    R(5, y + 8, 9, 2, l.shirt);
    R(5, y + 10 - b, 9, 1, l.shirtDark);
  } else R(6, y + 6, 7, 1, l.pantsDark);
  if (l.outfit === 'overalls') {
    R(6, y + 2, 4, 5, l.pants);
    R(8, y, 1, 2, l.pants);
    S(8, y + 2, '#e8c25a');
  }
  // The near arm swings forward and back.
  const ax = frame === 1 ? 6 : frame === 2 ? 10 : 8;
  const handY = y + 5;
  const sleeve = l.outfit === 'tee' ? 2 : handY - (y + 1);
  R(ax, y + 1, 2, sleeve, l.shirtDark);
  if (l.outfit === 'tee') R(ax, y + 3, 2, handY - y - 3, l.skin);
  R(ax, handY, 2, 2, l.skin);
}

// ---------- Head and face ----------

function headFront(R: Rect, S: Dot, b: number, l: Look): void {
  const y = b;
  // A round face: wider in the middle, soft at the jaw.
  R(6, 5 + y, 8, 1, l.skin);
  R(5, 6 + y, 10, 7, l.skin);
  R(6, 13 + y, 8, 1, l.skinShade);
  R(14, 9 + y, 1, 4, l.skinShade);
  // Ears.
  R(4, 9 + y, 1, 2, l.skin);
  R(15, 9 + y, 1, 2, l.skinShade);
  // Neck.
  R(8, 14 + y, 4, 1, l.skinShade);
  // Eyes: dark lid, coloured iris, a bright glint.
  for (const x of [7, 11]) {
    R(x, 9 + y, 2, 1, P.eye);
    R(x, 10 + y, 2, 1, l.eyes);
    S(x + 1, 9 + y, WHITE);
  }
  // Rosy cheeks and a small smile.
  S(6, 11 + y, P.cheek);
  S(13, 11 + y, P.cheek);
  R(9, 12 + y, 2, 1, MOUTH);
}

function headSide(R: Rect, S: Dot, b: number, l: Look): void {
  const y = b;
  R(6, 5 + y, 7, 1, l.skin);
  R(5, 6 + y, 8, 7, l.skin);
  R(6, 13 + y, 6, 1, l.skinShade);
  S(4, 10 + y, l.skin); // nose
  R(10, 9 + y, 1, 2, l.skinShade); // ear
  R(8, 14 + y, 3, 1, l.skinShade);
  R(6, 9 + y, 2, 1, P.eye);
  S(6, 10 + y, l.eyes);
  S(7, 10 + y, P.eye);
  S(7, 9 + y, WHITE);
  S(7, 11 + y, P.cheek);
  S(5, 12 + y, MOUTH);
}

function headBack(R: Rect, b: number, l: Look): void {
  const y = b;
  R(6, 5 + y, 8, 1, l.skin);
  R(5, 6 + y, 10, 7, l.skin);
  R(4, 9 + y, 1, 2, l.skinShade);
  R(15, 9 + y, 1, 2, l.skinShade);
  R(9, 13 + y, 2, 2, l.skinShade);
}

// ---------- Hair ----------

function hairFront(R: Rect, S: Dot, b: number, l: Look): void {
  const y = b;
  const H = l.hair;
  const L = l.hairLight;
  const style = l.hairStyle;
  if (style === 'curly') {
    // A big soft cloud of curls.
    R(6, 2 + y, 8, 1, H);
    R(4, 3 + y, 12, 4, H);
    R(4, 7 + y, 2, 5, H);
    R(14, 7 + y, 2, 5, H);
    R(6, 7 + y, 8, 1, H);
    for (const [x, yy] of [[6, 3], [9, 2], [12, 3], [5, 5], [8, 5], [11, 5], [14, 5], [4, 8], [15, 9]] as const) S(x, yy + y, L);
    S(7, 8 + y, H);
    S(12, 8 + y, H);
    return;
  }
  // Every other style starts from a neat cap of hair with a swept fringe.
  R(7, 2 + y, 6, 1, H);
  R(5, 3 + y, 10, 4, H);
  R(5, 7 + y, 1, 3, H);
  R(14, 7 + y, 1, 3, H);
  R(6, 7 + y, 3, 1, H);
  R(11, 7 + y, 3, 1, H);
  S(9, 7 + y, H);
  S(7, 3 + y, L);
  S(8, 3 + y, L);
  S(6, 4 + y, L);
  S(10, 4 + y, L);
  if (style === 'spiky') {
    if (crownHidden(l)) return;
    for (const x of [5, 8, 11, 14]) R(x, 1 + y, 1, 2, H);
    S(7, 1 + y, H);
    S(10, 1 + y, H);
    S(8, 1 + y, L);
  } else if (style === 'long') {
    R(4, 6 + y, 2, 10, H);
    R(14, 6 + y, 2, 10, H);
    S(4, 8 + y, L);
  } else if (style === 'bob') {
    // Straight bangs and a chin-length cut.
    R(6, 7 + y, 8, 1, H);
    R(4, 6 + y, 2, 7, H);
    R(14, 6 + y, 2, 7, H);
    S(4, 7 + y, L);
  } else if (style === 'ponytail') {
    // The tie peeks out on one side.
    R(15, 6 + y, 1, 3, H);
    S(15, 5 + y, L);
  } else if (style === 'bun' && !crownHidden(l)) {
    R(8, 1 + y, 4, 2, H);
    S(9, 1 + y, L);
  }
}

function hairSide(R: Rect, S: Dot, b: number, l: Look): void {
  const y = b;
  const H = l.hair;
  const L = l.hairLight;
  const style = l.hairStyle;
  if (style === 'curly') {
    R(5, 2 + y, 9, 1, H);
    R(4, 3 + y, 11, 4, H);
    R(9, 7 + y, 6, 5, H);
    R(5, 7 + y, 2, 1, H);
    for (const [x, yy] of [[6, 3], [9, 2], [12, 4], [10, 6], [13, 8], [11, 10]] as const) S(x, yy + y, L);
    return;
  }
  R(6, 2 + y, 6, 1, H);
  R(5, 3 + y, 9, 4, H);
  R(5, 7 + y, 2, 1, H);
  R(9, 7 + y, 5, 3, H);
  R(11, 10 + y, 3, 2, H);
  S(7, 3 + y, L);
  S(8, 3 + y, L);
  S(6, 4 + y, L);
  if (style === 'spiky') {
    if (crownHidden(l)) return;
    for (const x of [6, 9, 12]) R(x, 1 + y, 1, 2, H);
    S(13, 2 + y, H);
  } else if (style === 'long') {
    R(10, 10 + y, 4, 7, H);
    S(11, 12 + y, L);
  } else if (style === 'bob') {
    R(9, 10 + y, 5, 3, H);
    R(5, 7 + y, 3, 1, H);
  } else if (style === 'ponytail') {
    R(13, 6 + y, 2, 2, H);
    R(14, 8 + y, 2, 7, H);
    S(14, 9 + y, L);
  } else if (style === 'bun' && !crownHidden(l)) {
    R(11, 1 + y, 4, 3, H);
    S(12, 1 + y, L);
  }
}

function hairBack(R: Rect, S: Dot, b: number, l: Look): void {
  const y = b;
  const H = l.hair;
  const L = l.hairLight;
  const style = l.hairStyle;
  if (style === 'curly') {
    R(6, 2 + y, 8, 1, H);
    R(4, 3 + y, 12, 10, H);
    for (const [x, yy] of [[6, 4], [9, 3], [12, 4], [5, 7], [8, 7], [11, 7], [14, 7], [7, 10], [12, 10]] as const) S(x, yy + y, L);
    return;
  }
  R(7, 2 + y, 6, 1, H);
  R(5, 3 + y, 10, 9, H);
  R(6, 12 + y, 8, 1, H);
  S(7, 4 + y, L);
  S(8, 4 + y, L);
  S(9, 5 + y, L);
  S(6, 6 + y, L);
  if (style === 'spiky') {
    if (!crownHidden(l)) for (const x of [5, 8, 11, 14]) R(x, 1 + y, 1, 2, H);
  } else if (style === 'long') {
    R(5, 12 + y, 10, 5, H);
    S(7, 14 + y, L);
  } else if (style === 'bob') {
    R(4, 6 + y, 12, 7, H);
  } else if (style === 'ponytail') {
    R(9, 12 + y, 2, 6, H);
    R(8, 11 + y, 4, 1, l.shirtDark); // hair tie
    S(9, 14 + y, L);
  } else if (style === 'bun' && !crownHidden(l)) {
    R(8, 1 + y, 4, 2, H);
    S(9, 1 + y, L);
  }
}

// ---------- Hats ----------

function hat(R: Rect, S: Dot, b: number, l: Look, facing: Facing): void {
  const y = b;
  const side = facing === 'left';
  switch (l.hat) {
    case 'straw':
      // A wide sun hat with a red band.
      R(6, 1 + y, 8, 1, HAT.straw);
      R(5, 2 + y, 10, 3, HAT.straw);
      R(5, 4 + y, 10, 1, HAT.band);
      R(side ? 1 : 2, 5 + y, side ? 16 : 16, 1, HAT.straw);
      R(side ? 1 : 2, 6 + y, side ? 16 : 16, 1, HAT.strawDark);
      S(7, 2 + y, '#f4dc98');
      S(8, 2 + y, '#f4dc98');
      break;
    case 'cap':
      R(6, 2 + y, 8, 1, HAT.cap);
      R(5, 3 + y, 10, 3, HAT.cap);
      R(5, 5 + y, 10, 1, HAT.capDark);
      S(9, 2 + y, '#e86a5a');
      if (facing === 'down') R(6, 6 + y, 8, 1, HAT.capDark);
      else if (side) R(2, 5 + y, 4, 1, HAT.capDark);
      else R(8, 6 + y, 4, 1, HAT.capDark); // the strap at the back
      break;
    case 'beanie':
      R(9, 1 + y, 2, 1, WHITE); // pom-pom
      R(6, 2 + y, 8, 1, HAT.beanie);
      R(5, 3 + y, 10, 4, HAT.beanie);
      R(5, 7 + y, 10, 1, HAT.beanieDark);
      for (const x of [6, 8, 10, 12]) R(x, 3 + y, 1, 4, HAT.beanieDark);
      break;
    case 'bandana':
      R(5, 4 + y, 10, 2, HAT.bandana);
      for (const x of [6, 9, 12]) S(x, 4 + y, WHITE);
      if (facing === 'up') {
        R(9, 6 + y, 2, 2, HAT.bandana);
      } else if (side) {
        R(13, 5 + y, 2, 3, HAT.bandana);
      }
      break;
    case 'flower': {
      // A flower clipped above one ear.
      const fx = facing === 'down' ? 12 : facing === 'up' ? 5 : 9;
      R(fx, 3 + y, 3, 3, HAT.petal);
      S(fx + 1, 4 + y, HAT.petalCore);
      S(fx, 3 + y, '#fff0f6');
      break;
    }
    case 'none':
      break;
  }
}

// ---------- Frames ----------

function drawFrame(p: PixelCanvas, ox: number, oy: number, facing: Facing, frame: number, l: Look): void {
  const R: Rect = (x, y, w, h, c) => p.rect(ox + x, oy + y, w, h, c);
  const S: Dot = (x, y, c) => p.set(ox + x, oy + y, c);
  // The body dips a pixel on the stepping frames.
  const b = frame === 0 ? 0 : 1;
  if (facing === 'left') {
    // Long hair and ponytails hang behind the body.
    if (l.hairStyle === 'long' || l.hairStyle === 'ponytail') hairSide(R, S, b, l);
    legsSide(R, frame, l);
    torsoSide(R, S, b, frame, l);
    headSide(R, S, b, l);
    hairSide(R, S, b, l);
  } else if (facing === 'up') {
    legsFront(R, frame, l);
    torsoFront(R, S, b, frame, l, true);
    headBack(R, b, l);
    hairBack(R, S, b, l);
  } else {
    // Long hair falls behind the shoulders.
    if (l.hairStyle === 'long') {
      R(4, 6 + b, 2, 10, l.hair);
      R(14, 6 + b, 2, 10, l.hair);
    }
    legsFront(R, frame, l);
    torsoFront(R, S, b, frame, l, false);
    headFront(R, S, b, l);
    hairFront(R, S, b, l);
  }
  hat(R, S, b, l, facing);
}

export function drawPlayerSheet(appearance: CharacterAppearance): PixelCanvas {
  const look = lookOf(appearance);
  const { width: FW, height: FH, framesPerDirection: N } = PLAYER_FRAME;
  const sheet = new PixelCanvas(FW * N, FH * 4);
  for (let f = 0; f < N; f++) {
    drawFrame(sheet, f * FW, DIRECTION_ROWS.down * FH, 'down', f, look);
    drawFrame(sheet, f * FW, DIRECTION_ROWS.left * FH, 'left', f, look);
    drawFrame(sheet, f * FW, DIRECTION_ROWS.up * FH, 'up', f, look);
  }
  for (let f = 0; f < N; f++) sheet.mirrorRegion(f * FW, DIRECTION_ROWS.left * FH, FW, FH, f * FW, DIRECTION_ROWS.right * FH);
  sheet.outline(P.outline);
  return sheet;
}
