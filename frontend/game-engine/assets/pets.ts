import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Pet sprites, facing right (flip for left): stand, walk, asleep.
 * Sheet of three 16x14 frames. The cat and the dog are built differently, not
 * just coloured differently: the cat is small and slim with pointed ears,
 * whiskers, tabby stripes and a tall curling tail; the dog is stockier with a
 * long snout, floppy ears, a red collar and a wagging tail.
 */
export function drawPetSheet(kind: 'cat' | 'dog'): PixelCanvas {
  const p = new PixelCanvas(48, 14);
  if (kind === 'cat') drawCat(p);
  else drawDog(p);
  p.outline(P.outline);
  return p;
}

function drawCat(p: PixelCanvas): void {
  const body = '#e8923a';
  const light = '#f6c08a';
  const stripe = '#b8642a';
  const white = '#fff4e6';
  const eye = '#4ab04a';
  const pink = '#f08aa0';
  for (let f = 0; f < 2; f++) {
    const ox = f * 16;
    const s = f;
    // Slim body with tabby stripes and a white belly.
    p.rect(ox + 4, 7, 7, 3, body);
    p.rect(ox + 4, 7, 7, 1, light);
    for (const x of [5, 7, 9]) p.set(ox + x, 7, stripe);
    p.rect(ox + 6, 9, 4, 1, white);
    // Thin legs with white paws.
    for (const [x, i] of [
      [4, 0],
      [6, 1],
      [9, 0],
      [10, 1],
    ] as const) {
      const lift = s && i ? 1 : 0;
      p.rect(ox + x + (s && !i ? 1 : 0), 10, 1, 2 - lift, body);
      p.set(ox + x + (s && !i ? 1 : 0), 12 - lift, white);
    }
    // Round head with pointed ears.
    p.rect(ox + 10, 4, 4, 4, body);
    p.rect(ox + 11, 3, 2, 1, body);
    p.set(ox + 10, 3, body);
    p.set(ox + 10, 2, body);
    p.set(ox + 13, 3, body);
    p.set(ox + 13, 2, body);
    p.set(ox + 13, 3, pink);
    p.set(ox + 11, 4, stripe);
    // Green eye, pink nose, white muzzle and whiskers.
    p.set(ox + 12, 5, eye);
    p.rect(ox + 13, 6, 1, 1, white);
    p.set(ox + 14, 6, pink);
    p.set(ox + 15, 5, '#f4ead8');
    p.set(ox + 15, 7, '#f4ead8');
    // Tall tail curling up and over at the tip (it sways when walking).
    const sway = s ? 1 : 0;
    p.set(ox + 3, 8, body);
    p.set(ox + 2, 7, body);
    p.set(ox + 2, 6, body);
    p.set(ox + 2 - sway, 5, stripe);
    p.set(ox + 2 - sway, 4, body);
    p.set(ox + 3 - sway, 3, body);
    p.set(ox + 4 - sway, 3, stripe);
  }
  // Asleep: a tight ball with the tail wrapped round and ears poking up.
  const ox = 32;
  for (let y = 7; y <= 12; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 5) ** 2 + ((y - 9.8) / 3) ** 2 <= 1) p.set(ox + x, y, y < 9 ? light : body);
  for (const x of [5, 7, 9]) p.set(ox + x, 8, stripe);
  p.rect(ox + 3, 11, 8, 1, stripe);
  p.set(ox + 10, 6, body);
  p.set(ox + 12, 6, body);
  p.rect(ox + 10, 7, 3, 2, body);
  p.set(ox + 11, 8, '#2b1d1a');
}

function drawDog(p: PixelCanvas): void {
  const body = '#9a6a3a';
  const light = '#c8945a';
  const dark = '#5e3a1e';
  const muzzle = '#e0c098';
  const collar = '#d8342a';
  for (let f = 0; f < 2; f++) {
    const ox = f * 16;
    const s = f;
    // Stocky, deep-chested body.
    p.rect(ox + 2, 6, 9, 4, body);
    p.rect(ox + 2, 6, 9, 1, light);
    p.rect(ox + 8, 9, 3, 1, muzzle);
    // Sturdy legs, alternating when walking.
    for (const [x, i] of [
      [2, 0],
      [4, 1],
      [8, 0],
      [10, 1],
    ] as const) {
      const fwd = s ? (i ? -1 : 1) : 0;
      p.rect(ox + x + fwd, 10, 2, 2, body);
      p.rect(ox + x + fwd, 12, 2, 1, dark);
    }
    // Head with a long snout, black nose and a floppy ear.
    p.rect(ox + 10, 2, 4, 5, body);
    p.rect(ox + 13, 4, 3, 3, muzzle);
    p.set(ox + 15, 4, '#1a1412');
    p.set(ox + 12, 3, '#1a1412');
    p.rect(ox + 10, 2, 2, 5, dark);
    p.set(ox + 10, 7, dark);
    // Tongue out while trotting.
    if (s) p.set(ox + 14, 7, '#f07a8a');
    // Red collar with a gold tag.
    p.rect(ox + 10, 7, 3, 1, collar);
    p.set(ox + 11, 8, '#f4d24a');
    // Tail up, wagging between frames.
    if (s) {
      p.rect(ox + 0, 3, 1, 2, body);
      p.set(ox + 1, 5, body);
    } else {
      p.rect(ox + 1, 3, 1, 3, body);
      p.set(ox + 0, 2, light);
    }
  }
  // Asleep: stretched out flat, head down on the paws, ear flopped over.
  const ox = 32;
  p.rect(ox + 1, 9, 10, 3, body);
  p.rect(ox + 1, 9, 10, 1, light);
  p.rect(ox + 10, 9, 4, 3, body);
  p.rect(ox + 13, 10, 3, 2, muzzle);
  p.set(ox + 15, 10, '#1a1412');
  p.rect(ox + 10, 8, 2, 3, dark);
  p.rect(ox + 11, 12, 4, 1, dark);
  p.rect(ox + 0, 11, 2, 1, body);
  p.rect(ox + 10, 11, 3, 1, collar);
  p.set(ox + 12, 10, '#2b1d1a');
}
