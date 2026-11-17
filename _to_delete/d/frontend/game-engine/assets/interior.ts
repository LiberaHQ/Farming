import { drawBirdbath, drawFlowerBed, drawGnome, drawStatue } from './farmDecor';
import { drawBench, drawFlowerPot } from './sprites';
import { drawLampPost } from './structures';
import type { FurnitureKind } from '@farming/shared';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/** Cottage interior art: room, bed and furniture. Base row = bottom row unless noted. */

export const FURNITURE_ORIGIN: Record<FurnitureKind, number> = {
  rug: 0.5,
  table: 1,
  chair: 1,
  bookshelf: 1,
  house_plant: 1,
  floor_lamp: 1,
  painting: 0.5,
  stove: 1,
  fireplace: 1,
  display_table: 1,
  wall_shelf: 0.5,
  aquarium: 1,
  flower_pot: 1,
  flower_bed: 1,
  statue: 1,
  gnome: 1,
  birdbath: 1,
  bench: 1,
  lamp_post: 1,
};

/** The room: wooden floor, plaster walls with a wainscot, a window or two. */
export function drawRoom(width: number, height: number, size = 16): HTMLCanvasElement {
  const p = new PixelCanvas(width * size, height * size);
  const wallRows = 2;
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const x0 = tx * size;
      const y0 = ty * size;
      const edge = tx === 0 || tx === width - 1 || ty === height - 1;
      if (edge) {
        p.rect(x0, y0, size, size, '#3a2a22');
        continue;
      }
      if (ty < wallRows) {
        p.rect(x0, y0, size, size, '#e8d8b8');
        if (ty === wallRows - 1) {
          p.rect(x0, y0 + 9, size, 7, '#9c6a40');
          p.rect(x0, y0 + 9, size, 1, '#c08a5a');
        }
        continue;
      }
      // Floor planks.
      p.rect(x0, y0, size, size, (ty % 2) ? '#b07a48' : '#a8723f');
      p.rect(x0, y0 + 7, size, 1, '#8a5a32');
      p.rect(x0 + ((ty * 7) % 16), y0, 1, 7, '#8a5a32');
      p.rect(x0 + ((ty * 7 + 9) % 16), y0 + 8, 1, 8, '#8a5a32');
    }
  }
  // Windows.
  for (const wx of [3, width - 4]) {
    const x0 = wx * size + 2;
    p.rect(x0, 4, 12, 11, '#6e4638');
    p.rect(x0 + 1, 5, 10, 9, '#a8d4e8');
    p.rect(x0 + 6, 5, 1, 9, '#6e4638');
    p.rect(x0 + 1, 9, 10, 1, '#6e4638');
  }
  // The front door, in the bottom wall, with a mat in front of it.
  const mx = Math.floor(width / 2) * size;
  const dy = (height - 1) * size;
  p.rect(mx - 2, dy, size + 4, size, '#2b1d1a'); // frame shadow
  p.rect(mx - 1, dy, size + 2, size, '#6e4638'); // frame
  p.rect(mx + 1, dy + 1, size - 2, size - 1, '#a8703d'); // door
  for (const px of [mx + 5, mx + 10]) p.rect(px, dy + 1, 1, size - 1, '#8a5a32'); // planks
  p.rect(mx + 1, dy + 1, size - 2, 1, '#c9905a'); // top light edge
  p.rect(mx + 1, dy + 5, size - 2, 1, '#8a5a32'); // cross brace
  p.rect(mx + 1, dy + 11, size - 2, 1, '#8a5a32');
  p.rect(mx + 12, dy + 8, 2, 2, '#f4d24a'); // knob
  p.rect(mx + 12, dy + 9, 2, 1, '#c8982a');
  p.rect(mx - 4, dy - 6, 24, 5, '#7a5a3a'); // mat
  p.rect(mx - 3, dy - 5, 22, 1, '#9a7a52');
  return p.toCanvas();
}

/** The bed, 32x30, base row 29. */
export function drawBed(): PixelCanvas {
  const p = new PixelCanvas(32, 30);
  p.rect(1, 2, 30, 6, P.woodDark);
  p.rect(2, 3, 28, 4, P.wood);
  p.rect(2, 8, 28, 20, '#f3ead8');
  p.rect(4, 9, 10, 5, '#ffffff');
  p.rect(18, 9, 10, 5, '#ffffff');
  p.rect(2, 15, 28, 13, '#5a7ac8');
  for (let y = 17; y < 28; y += 3) p.rect(2, y, 28, 1, '#7a9ae0');
  p.rect(1, 27, 30, 3, P.woodDark);
  p.outline(P.outline);
  return p;
}

export function drawFurniture(kind: FurnitureKind): PixelCanvas {
  switch (kind) {
    // Farm decor brought indoors uses its outdoor art.
    case 'flower_pot':
      return drawFlowerPot();
    case 'flower_bed':
      return drawFlowerBed();
    case 'statue':
      return drawStatue();
    case 'gnome':
      return drawGnome();
    case 'birdbath':
      return drawBirdbath();
    case 'bench':
      return drawBench();
    case 'lamp_post':
      return drawLampPost();
    case 'rug': {
      const p = new PixelCanvas(48, 32);
      p.rect(1, 1, 46, 30, '#a8443a');
      p.rect(4, 4, 40, 24, '#d8a050');
      p.rect(7, 7, 34, 18, '#a8443a');
      for (let x = 10; x < 40; x += 6) p.rect(x, 14, 3, 4, '#f3ead8');
      return p;
    }
    case 'table': {
      const p = new PixelCanvas(32, 22);
      p.rect(1, 4, 30, 8, P.wood);
      p.rect(1, 4, 30, 2, P.woodLight);
      p.rect(3, 12, 3, 9, P.woodDark);
      p.rect(26, 12, 3, 9, P.woodDark);
      p.rect(12, 1, 6, 4, '#f3ead8');
      p.rect(13, 0, 4, 2, '#e0443e');
      p.outline(P.outline);
      return p;
    }
    case 'chair': {
      const p = new PixelCanvas(14, 22);
      p.rect(2, 1, 10, 10, P.woodDark);
      p.rect(3, 2, 8, 8, P.wood);
      p.rect(1, 11, 12, 3, P.woodLight);
      p.rect(2, 14, 2, 7, P.woodDark);
      p.rect(10, 14, 2, 7, P.woodDark);
      p.outline(P.outline);
      return p;
    }
    case 'bookshelf': {
      const p = new PixelCanvas(32, 34);
      p.rect(1, 1, 30, 32, P.woodDark);
      p.rect(3, 3, 26, 28, '#5a3a24');
      const books = ['#c8443a', '#4a62c8', '#6cc45a', '#e8b83a', '#a06ac4', '#f3ead8'];
      for (let shelf = 0; shelf < 3; shelf++) {
        const y = 3 + shelf * 10;
        p.rect(3, y + 8, 26, 2, P.wood);
        for (let x = 4, i = shelf; x < 28; x += 3, i++) p.rect(x, y + 1 + (i % 2), 2, 7 - (i % 2), books[i % books.length]);
      }
      p.outline(P.outline);
      return p;
    }
    case 'house_plant': {
      const p = new PixelCanvas(16, 24);
      p.rect(4, 16, 8, 7, '#b8603a');
      p.rect(4, 16, 8, 1, '#d8805a');
      for (const [x, y, w, h] of [[7, 4, 2, 12], [3, 6, 4, 3], [9, 3, 4, 3], [2, 10, 5, 3], [9, 9, 5, 3], [6, 1, 4, 3]]) p.rect(x, y, w, h, P.leaf);
      p.rect(3, 6, 2, 1, P.leafLight);
      p.rect(10, 3, 2, 1, P.leafLight);
      p.outline(P.outline);
      return p;
    }
    case 'floor_lamp': {
      const p = new PixelCanvas(14, 30);
      p.rect(1, 1, 12, 8, '#f6d68a');
      p.rect(2, 2, 10, 6, '#ffe9a8');
      p.rect(6, 9, 2, 18, '#5a4a40');
      p.rect(3, 27, 8, 2, '#5a4a40');
      p.outline(P.outline);
      return p;
    }
    case 'painting': {
      const p = new PixelCanvas(32, 22);
      p.rect(0, 0, 32, 22, '#c8962a');
      p.rect(2, 2, 28, 18, '#a8d4e8');
      p.rect(2, 12, 28, 8, '#6cc45a');
      for (let i = 0; i < 8; i++) p.rect(8 + i, 12 - Math.min(i, 7 - i), 1, 1 + Math.min(i, 7 - i), '#8a9aa8');
      p.rect(22, 4, 4, 4, '#ffe27a');
      p.outline(P.outline);
      return p;
    }
    case 'stove': {
      // Stone stove with a hot plate, oven door and a pot.
      const p = new PixelCanvas(32, 30);
      p.rect(1, 10, 30, 19, '#8a847c');
      for (let y = 12; y < 28; y += 4) for (let x = 1 + ((y / 4) % 2) * 3; x < 31; x += 6) p.rect(x, y, 5, 3, '#9a948c');
      p.rect(1, 8, 30, 3, '#5a544e');
      p.rect(3, 6, 8, 3, '#3a3a3a');
      p.rect(4, 5, 6, 2, '#c8452e');
      p.rect(18, 2, 10, 7, '#4a4a52');
      p.rect(17, 2, 12, 1, '#6a6a72');
      p.rect(20, 0, 2, 2, '#e8e0f0');
      p.rect(23, 0, 1, 1, '#e8e0f0');
      p.rect(8, 15, 16, 10, '#3a2a22');
      p.rect(9, 16, 14, 8, '#e8823a');
      p.rect(11, 18, 10, 4, '#ffc85a');
      p.outline(P.outline);
      return p;
    }
    case 'fireplace': {
      // A stone hearth with a crackling fire and a log pile.
      const p = new PixelCanvas(32, 34);
      p.rect(1, 2, 30, 31, '#9a948c');
      for (let y = 3; y < 32; y += 5) for (let x = 1 + ((y / 5) % 2) * 3; x < 31; x += 7) p.rect(x, y, 6, 4, (x + y) % 3 ? '#8a847c' : '#aaa49c');
      p.rect(0, 0, 32, 4, P.woodDark);
      p.rect(0, 0, 32, 1, P.woodLight);
      p.rect(7, 14, 18, 18, '#1a1210');
      p.rect(9, 26, 14, 3, '#6a3e1e');
      for (const [x, y, w, h, c] of [[10, 18, 4, 8, '#e8823a'], [14, 15, 5, 11, '#f2a03a'], [19, 19, 3, 7, '#e8823a'], [13, 20, 3, 6, '#ffd76a'], [17, 21, 2, 5, '#ffd76a']] as const) p.rect(x, y, w, h, c);
      p.outline(P.outline);
      return p;
    }
    case 'display_table': {
      const p = new PixelCanvas(16, 18);
      p.rect(1, 3, 14, 5, '#8a5a32');
      p.rect(1, 3, 14, 1, '#b07a48');
      p.rect(2, 8, 12, 2, '#6a4422');
      p.rect(3, 10, 2, 7, P.woodDark);
      p.rect(11, 10, 2, 7, P.woodDark);
      p.rect(2, 7, 12, 1, '#c8452e');
      p.outline(P.outline);
      return p;
    }
    case 'wall_shelf': {
      const p = new PixelCanvas(32, 12);
      p.rect(1, 8, 30, 3, P.wood);
      p.rect(1, 8, 30, 1, P.woodLight);
      p.rect(4, 11, 2, 1, P.woodDark);
      p.rect(26, 11, 2, 1, P.woodDark);
      p.outline(P.outline);
      return p;
    }
    case 'aquarium': {
      const p = new PixelCanvas(32, 26);
      p.rect(1, 1, 30, 18, '#5aa0c8');
      p.rect(2, 2, 28, 3, '#8ec8e4');
      p.rect(1, 15, 30, 4, '#d8c8a0');
      for (const x of [5, 12, 24]) p.rect(x, 9, 1, 6, '#3f9a5a');
      p.rect(19, 13, 4, 2, '#e88a7a');
      p.rect(1, 19, 30, 6, P.woodDark);
      p.rect(1, 19, 30, 1, P.wood);
      p.outline(P.outline);
      return p;
    }
  }
}

/** A wooden signpost pointing to the beach, 16x22, base row 21. */
export function drawSignpost(): PixelCanvas {
  const p = new PixelCanvas(16, 22);
  p.rect(7, 6, 2, 16, P.woodDark);
  p.rect(1, 3, 13, 6, P.wood);
  p.rect(1, 3, 13, 1, P.woodLight);
  p.set(14, 5, P.wood);
  p.set(14, 6, P.wood);
  p.set(15, 5, P.wood);
  p.rect(3, 5, 8, 1, '#5a3a24');
  p.rect(3, 7, 6, 1, '#5a3a24');
  p.outline(P.outline);
  return p;
}
