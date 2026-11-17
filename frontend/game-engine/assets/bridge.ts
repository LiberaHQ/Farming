import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * A wooden bridge railing for one side of a bridge, `w` pixels wide and 18
 * tall (base row 17): stone pillars at both ends, posts every tile, a hand
 * rail and a lower rail.
 */
export function drawBridgeRail(w: number): PixelCanvas {
  const h = 18;
  const p = new PixelCanvas(w, h);
  // Rails.
  p.rect(4, 5, w - 8, 2, P.woodLight);
  p.rect(4, 7, w - 8, 1, P.woodDark);
  p.rect(4, 11, w - 8, 2, P.wood);
  p.rect(4, 13, w - 8, 1, P.woodDark);
  // Posts each tile.
  for (let x = 16; x < w - 8; x += 16) {
    p.rect(x - 1, 4, 3, 13, P.wood);
    p.rect(x - 1, 4, 1, 13, P.woodLight);
    p.rect(x + 1, 4, 1, 13, P.woodDark);
    p.rect(x - 2, 3, 5, 2, P.woodLight);
  }
  // Stone pillars at the ends.
  for (const x of [0, w - 7]) {
    p.rect(x, 2, 7, 15, P.stone);
    p.rect(x, 2, 7, 2, P.stoneLight);
    p.rect(x + 1, 0, 5, 2, P.stoneHi);
    p.rect(x, 9, 7, 1, P.stoneDark);
    p.rect(x + 3, 4, 1, 5, P.stoneDark);
    p.rect(x + 2, 10, 1, 6, P.stoneDark);
    p.rect(x, 15, 7, 2, P.stoneDark);
  }
  p.outline(P.outline);
  return p;
}

/** A small iron lantern that sits on a bridge pillar, 7x11, base row 10. */
export function drawBridgeLantern(): PixelCanvas {
  const p = new PixelCanvas(7, 11);
  p.rect(1, 2, 5, 6, '#3a3a42');
  p.rect(2, 3, 3, 4, '#f4d24a');
  p.rect(2, 3, 1, 2, '#fff8d0');
  p.rect(2, 0, 3, 2, '#3a3a42');
  p.rect(3, 8, 1, 3, '#3a3a42');
  p.outline(P.outline);
  return p;
}
