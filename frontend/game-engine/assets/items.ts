import type { CropId, ItemId } from '@farming/shared';
import { P } from './palette';
import { drawBirdbath, drawCollector, drawFlowerBed, drawGnome, drawMetalSprinkler, drawShed, drawSilo, drawStatue, drawWell } from './farmDecor';
import { PixelCanvas } from './PixelCanvas';
import { drawFruitIcon, drawSaplingIcon } from './orchard';
import { produceIcon, PRODUCE, seedPicture } from './produce';
import { drawFurniture } from './interior';
import { FURNITURE_KINDS } from '@farming/shared';

/**
 * 16x16 item icons. Pure drawing code (no Phaser), so the same art is used
 * by the game (dropped items, the tool in the player's hand) and by the React
 * UI (hotbar, inventory, shop) via data URLs.
 */

const METAL = { base: '#b9c0c6', light: '#eef1f3', dark: '#7d858d' };
const COPPER = { base: '#d9823b', light: '#f4b07a', dark: '#9c5525' };
const CAN = { base: '#5f97bb', light: '#9cc8e0', dark: '#3f6f8f' };
const PAPER = { base: '#eadfc4', dark: '#c9b993' };
const ORANGE = { base: '#e8812f', light: '#f6a95c', dark: '#b8601c' };
const TURNIP = { white: '#f3efe6', purple: '#a35bb5', purpleLight: '#c487d2' };
const SACK = { base: '#9c7a4f', light: '#b8956a', dark: '#765a37' };
const IRON = { base: '#8f9eb0', light: '#c9d4e0', dark: '#5b6878' };
const GOLD = { base: '#e8b83a', light: '#fff0a8', dark: '#a87a1c' };
const AMETHYST = { base: '#9b5ccf', light: '#d7a8ff', dark: '#5f2f8a' };
const RUBY = { base: '#d0283c', light: '#ff8a96', dark: '#80141e' };
const JADE = { base: '#2aa070', light: '#8af0c0', dark: '#156040' };

type Metal = typeof METAL;

function handle(p: PixelCanvas, x: number, top: number, bottom: number): void {
  for (let y = top; y <= bottom; y++) {
    p.set(x, y, P.wood);
    p.set(x + 1, y, P.woodDark);
  }
}

function axe(p: PixelCanvas, m: Metal): void {
  handle(p, 8, 3, 14);
  p.rect(3, 2, 5, 5, m.base);
  p.rect(3, 2, 1, 5, m.light);
  p.rect(4, 6, 4, 1, m.dark);
  p.rect(7, 3, 1, 3, m.dark);
}

function pickaxe(p: PixelCanvas, m: Metal): void {
  handle(p, 7, 4, 14);
  p.rect(4, 2, 8, 1, m.light);
  p.rect(3, 3, 10, 2, m.base);
  p.rect(5, 4, 6, 1, m.dark);
  p.set(2, 4, m.base);
  p.set(2, 5, m.dark);
  p.set(13, 4, m.base);
  p.set(13, 5, m.dark);
}

function hoe(p: PixelCanvas): void {
  handle(p, 8, 2, 14);
  p.rect(3, 2, 5, 2, METAL.base);
  p.rect(3, 2, 5, 1, METAL.light);
  p.rect(3, 4, 2, 2, METAL.dark);
}

function wateringCan(p: PixelCanvas): void {
  p.rect(3, 6, 8, 7, CAN.base);
  p.rect(3, 6, 1, 7, CAN.light);
  p.rect(10, 6, 1, 7, CAN.dark);
  p.rect(3, 12, 8, 1, CAN.dark);
  p.rect(4, 4, 6, 1, CAN.dark);
  p.set(4, 5, CAN.dark);
  p.set(9, 5, CAN.dark);
  for (let i = 0; i < 4; i++) {
    p.set(11 + i, 9 - i, CAN.base);
    p.set(11 + i, 10 - i, CAN.dark);
  }
  p.set(14, 4, CAN.light);
}

function log(p: PixelCanvas): void {
  p.rect(2, 6, 10, 1, P.trunkLight);
  p.rect(2, 7, 10, 3, P.trunk);
  p.rect(2, 10, 10, 1, P.trunkDark);
  p.set(5, 8, P.trunkDark);
  p.set(8, 7, P.trunkDark);
  p.rect(12, 6, 2, 5, P.woodLight);
  p.set(12, 8, P.wood);
  p.set(13, 6, P.wood);
  // second log behind
  p.rect(4, 3, 9, 1, P.trunkLight);
  p.rect(4, 4, 9, 2, P.trunk);
  p.rect(13, 3, 2, 3, P.woodLight);
}

function stoneBlob(p: PixelCanvas, speck?: { base: string; light: string }): void {
  for (let y = 4; y <= 13; y++) {
    for (let x = 2; x <= 13; x++) {
      const nx = (x - 7.5) / 5.5;
      const ny = (y - 9) / 4.5;
      if (nx * nx + ny * ny > 1) continue;
      const l = -(nx * 0.55 + ny * 0.85);
      p.set(x, y, l > 0.4 ? P.stoneLight : l < -0.35 ? P.stoneDark : P.stone);
    }
  }
  p.set(6, 6, P.stoneHi);
  if (speck) {
    // Chunky copper nuggets so ore reads clearly at icon size.
    for (const [x, y] of [
      [4, 8],
      [8, 6],
      [9, 10],
    ] as const) {
      p.rect(x, y, 2, 2, speck.base);
      p.set(x, y, speck.light);
      p.set(x + 1, y + 1, COPPER.dark);
    }
  }
}

function oreBlob(p: PixelCanvas, m: Metal): void {
  stoneBlob(p);
  for (const [x, y] of [
    [4, 8],
    [8, 6],
    [9, 10],
  ] as const) {
    p.rect(x, y, 2, 2, m.base);
    p.set(x, y, m.light);
    p.set(x + 1, y + 1, m.dark);
  }
}

function gem(p: PixelCanvas, g = AMETHYST): void {
  const rows = [
    [6, 9],
    [5, 10],
    [4, 11],
    [4, 11],
    [5, 10],
    [6, 9],
    [7, 8],
  ];
  rows.forEach(([a, b], i) => p.rect(a, 4 + i, b - a + 1, 1, i < 2 ? g.light : i > 4 ? g.dark : g.base));
  p.rect(4, 6, 8, 1, g.light);
  p.set(6, 5, '#ffffff');
}

function slimeBlob(p: PixelCanvas): void {
  for (let y = 5; y <= 13; y++) {
    for (let x = 2; x <= 13; x++) {
      const nx = (x - 7.5) / 6;
      const ny = (y - 10) / (y < 10 ? 5 : 3.5);
      if (nx * nx + ny * ny <= 1) p.set(x, y, y < 8 ? '#9ee67a' : y > 11 ? '#3f8a3a' : '#6cc45a');
    }
  }
  p.rect(5, 7, 2, 1, '#e6ffd8');
}

function sword(p: PixelCanvas, m: Metal): void {
  for (let i = 0; i < 9; i++) {
    p.set(4 + i, 11 - i, m.base);
    p.set(5 + i, 11 - i, m.light);
    p.set(4 + i, 12 - i, m.dark);
  }
  p.rect(2, 10, 5, 2, P.woodDark);
  p.rect(3, 12, 2, 2, P.wood);
  p.set(2, 14, P.woodDark);
}

function juice(p: PixelCanvas): void {
  p.rect(5, 3, 6, 2, '#c9b993');
  p.rect(4, 5, 8, 9, '#e8f2f4');
  p.rect(5, 7, 6, 6, '#e8573a');
  p.rect(5, 7, 6, 1, '#ff9a7a');
  p.rect(11, 5, 1, 9, '#a8b4b8');
}

function picklesJar(p: PixelCanvas): void {
  p.rect(4, 3, 8, 2, '#9c5525');
  p.rect(4, 5, 8, 9, '#dfeee4');
  p.rect(5, 6, 6, 7, '#7aa83a');
  for (const [x, y] of [[6, 8], [9, 7], [7, 11]]) p.rect(x, y, 2, 2, '#4f7a2a');
  p.rect(11, 5, 1, 9, '#a8b4b8');
}

function kegIcon(p: PixelCanvas): void {
  p.rect(4, 3, 8, 11, P.wood);
  p.rect(4, 3, 1, 11, P.woodLight);
  p.rect(11, 3, 1, 11, P.woodDark);
  p.rect(3, 5, 10, 1, '#7d858d');
  p.rect(3, 11, 10, 1, '#7d858d');
  p.rect(7, 9, 2, 2, '#9c5525');
}

function jarIcon(p: PixelCanvas): void {
  p.rect(4, 4, 8, 10, '#dfeee4');
  p.rect(4, 3, 8, 2, P.woodDark);
  p.rect(5, 7, 6, 6, '#c4a24a');
  p.rect(11, 5, 1, 9, '#a8b4b8');
}

function greenhouseIcon(p: PixelCanvas): void {
  p.rect(2, 7, 12, 7, '#bfe6e8');
  for (let i = 0; i < 6; i++) p.rect(7 - i, 2 + i, 2 + i * 2, 1, '#bfe6e8');
  for (let x = 2; x <= 13; x += 4) p.rect(x, 7, 1, 7, '#e8f2f4');
  p.rect(2, 13, 12, 1, P.woodDark);
  p.rect(6, 10, 3, 4, P.leaf);
}

function animalIcon(p: PixelCanvas, body: string, spot: string, head: string): void {
  for (let y = 6; y <= 12; y++) for (let x = 3; x <= 13; x++) if (((x - 8) / 5.5) ** 2 + ((y - 9) / 3.5) ** 2 <= 1) p.set(x, y, body);
  p.rect(7, 7, 3, 2, spot);
  for (const x of [5, 7, 10, 12]) p.rect(x, 12, 1, 3, head);
  p.rect(1, 5, 4, 4, head);
  p.set(2, 6, P.eye);
}

function hay(p: PixelCanvas): void {
  for (let i = 0; i < 9; i++) p.rect(3 + i, 6 + (i % 3), 1, 8 - (i % 3), i % 2 ? '#e2b85a' : '#c8a04a');
  p.rect(3, 10, 10, 1, '#9c5525');
}

function bottle(p: PixelCanvas, fill: string): void {
  p.rect(6, 2, 4, 3, '#dfe8ea');
  p.rect(4, 5, 8, 9, '#eef4f4');
  p.rect(5, 7, 6, 6, fill);
  p.rect(6, 1, 4, 1, '#3f6f8f');
}

function woolBall(p: PixelCanvas): void {
  for (let y = 4; y <= 13; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.8) ** 2 + ((y - 8.5) / 4.5) ** 2 <= 1) p.set(x, y, (x + y) % 3 ? '#f6f2ea' : '#d8d0c4');
}

function cheeseWedge(p: PixelCanvas): void {
  for (let y = 6; y <= 12; y++) p.rect(2 + (12 - y), y, 12 - (12 - y), 1, '#f2d06a');
  p.rect(2, 12, 12, 1, '#c8a040');
  for (const [x, y] of [[9, 9], [11, 11], [7, 11]]) p.set(x, y, '#c8a040');
}

function clothBolt(p: PixelCanvas): void {
  p.rect(2, 4, 12, 9, '#8ab0d8');
  for (let y = 5; y <= 12; y += 2) p.rect(2, y, 12, 1, '#a8c8ea');
  p.rect(2, 4, 2, 9, '#5a80a8');
}

function fiber(p: PixelCanvas): void {
  for (let x = 5; x <= 10; x++) {
    for (let y = 2; y <= 14; y++) {
      const lean = y < 8 ? Math.round((x - 7.5) * ((8 - y) / 6)) : 0;
      p.set(x + lean, y, (x + y) % 2 === 0 ? P.grassLight : P.grass);
    }
  }
  p.rect(5, 8, 6, 2, P.wood);
  p.rect(5, 9, 6, 1, P.woodDark);
}

function berries(p: PixelCanvas): void {
  const dots: Array<[number, number]> = [
    [5, 9],
    [10, 9],
    [7, 12],
  ];
  for (const [cx, cy] of dots) {
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) p.set(cx + x, cy + y, P.berry);
    p.set(cx - 1, cy - 1, P.berryHi);
  }
  p.rect(7, 3, 2, 3, P.leafDark);
  p.rect(5, 3, 2, 2, P.leaf);
  p.rect(9, 3, 2, 2, P.leafLight);
}

function turnip(p: PixelCanvas, x0 = 0, y0 = 0, s = 1): void {
  for (let y = -4; y <= 4; y++) {
    for (let x = -4; x <= 4; x++) {
      if (x * x + y * y > 17) continue;
      const c = y < 0 ? (x < -1 ? TURNIP.purpleLight : TURNIP.purple) : TURNIP.white;
      p.set(x0 + 8 + x * s, y0 + 10 + y * s, c);
    }
  }
  p.rect(x0 + 6, y0 + 2, 2, 4, P.leaf);
  p.rect(x0 + 9, y0 + 3, 2, 3, P.leafLight);
}

function carrot(p: PixelCanvas): void {
  for (let y = 5; y <= 14; y++) {
    const half = Math.max(0, Math.round(3 - (y - 5) * 0.33));
    for (let x = 8 - half; x <= 8 + half; x++) p.set(x, y, x === 8 + half ? ORANGE.dark : ORANGE.base);
    if (half > 0) p.set(8 - half, y, ORANGE.light);
  }
  p.set(7, 8, ORANGE.dark);
  p.set(9, 11, ORANGE.dark);
  p.rect(6, 1, 1, 4, P.leaf);
  p.rect(8, 1, 1, 4, P.leafLight);
  p.rect(10, 2, 1, 3, P.leaf);
}

function pumpkin(p: PixelCanvas, cx = 7.5, cy = 9.5, rx = 6, ry = 4.5): void {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      let c = ORANGE.base;
      if (Math.abs(x - cx + 2.5) < 0.6 || Math.abs(x - cx - 2.5) < 0.6) c = ORANGE.dark;
      else if (nx < -0.4 && ny < 0.2) c = ORANGE.light;
      if (ny > 0.75) c = ORANGE.dark;
      p.set(x, y, c);
    }
  }
  p.rect(Math.round(cx) - 1, Math.round(cy - ry) - 2, 2, 3, P.trunk);
  p.set(Math.round(cx) + 1, Math.round(cy - ry) - 2, P.leaf);
}

function seedPacket(p: PixelCanvas, crop: CropId): void {
  p.rect(4, 2, 8, 12, PAPER.base);
  p.rect(4, 2, 8, 2, PAPER.dark);
  p.rect(11, 4, 1, 10, PAPER.dark);
  // picture of the crop
  const pic = new PixelCanvas(16, 16);
  if (crop === 'turnip') {
    pic.rect(6, 7, 4, 2, TURNIP.purple);
    pic.rect(6, 9, 4, 2, TURNIP.white);
    pic.rect(7, 5, 2, 2, P.leaf);
  } else if (crop === 'carrot') {
    pic.rect(7, 7, 2, 4, ORANGE.base);
    pic.set(7, 11, ORANGE.base);
    pic.rect(7, 5, 2, 2, P.leaf);
  } else if (crop === 'pumpkin') {
    pic.rect(5, 7, 6, 4, ORANGE.base);
    pic.set(7, 7, ORANGE.dark);
    pic.rect(7, 5, 2, 2, P.trunk);
  } else {
    seedPicture(pic, crop);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (pic.filled(x, y)) p.copyPixel(pic, x, y, x, y);
  p.set(6, 12, P.trunkDark);
  p.set(8, 12, P.trunkDark);
  p.set(10, 12, P.trunkDark);
}

function fertilizer(p: PixelCanvas): void {
  p.rect(4, 5, 8, 9, SACK.base);
  p.rect(4, 5, 1, 9, SACK.light);
  p.rect(11, 5, 1, 9, SACK.dark);
  p.rect(5, 3, 6, 2, SACK.base);
  p.rect(6, 4, 4, 1, SACK.dark);
  p.rect(6, 8, 4, 3, P.leaf);
  p.set(7, 8, P.leafHi);
  p.set(8, 11, P.leafDark);
}

function egg(p: PixelCanvas): void {
  for (let y = 3; y <= 13; y++) {
    for (let x = 3; x <= 12; x++) {
      const nx = (x - 7.5) / 4.5;
      const ny = (y - 8.5) / (y < 8.5 ? 5.5 : 4.5);
      if (nx * nx + ny * ny > 1) continue;
      p.set(x, y, nx < -0.3 && ny < 0 ? '#fffdf6' : ny > 0.5 || nx > 0.55 ? '#d9cbb0' : '#f3ead8');
    }
  }
  p.set(6, 5, '#ffffff');
}

function fenceIcon(p: PixelCanvas): void {
  for (const y of [6, 10]) {
    p.rect(1, y, 14, 1, P.woodLight);
    p.rect(1, y + 1, 14, 1, P.woodDark);
  }
  for (const x of [3, 11]) {
    p.rect(x, 3, 2, 11, P.wood);
    p.set(x, 3, P.woodLight);
    p.rect(x + 1, 4, 1, 10, P.woodDark);
  }
}

function pathIcon(p: PixelCanvas, stone: boolean): void {
  if (stone) {
    for (const [x, y, w, h] of [
      [2, 3, 5, 4],
      [8, 2, 6, 5],
      [2, 8, 6, 5],
      [9, 8, 5, 5],
    ] as const) {
      p.rect(x, y, w, h, P.stone);
      p.rect(x, y, w, 1, P.stoneHi);
      p.rect(x, y + h - 1, w, 1, P.stoneDark);
    }
  } else {
    for (let y = 3; y <= 12; y++) p.rect(2, y, 12, 1, y % 3 === 2 ? P.woodDark : y % 3 === 0 ? P.woodLight : P.wood);
  }
}

function lampIcon(p: PixelCanvas): void {
  p.rect(7, 7, 2, 7, '#3b3b45');
  p.rect(5, 13, 6, 1, P.stoneDark);
  p.rect(5, 2, 6, 5, '#3b3b45');
  p.rect(6, 3, 4, 3, '#ffe9a8');
  p.set(6, 3, '#fff6d6');
}

function chestIcon(p: PixelCanvas): void {
  p.rect(2, 7, 12, 7, P.wood);
  p.rect(2, 3, 12, 4, P.woodLight);
  p.rect(2, 6, 12, 1, P.woodDark);
  p.rect(2, 13, 12, 1, P.woodDark);
  for (const x of [4, 11]) p.rect(x, 3, 1, 11, '#9c5525');
  p.rect(7, 6, 2, 3, '#e8c25a');
}

function chickenIcon(p: PixelCanvas): void {
  for (let y = 6; y <= 13; y++) {
    for (let x = 3; x <= 13; x++) {
      const nx = (x - 8.5) / 5;
      const ny = (y - 10) / 3.5;
      if (nx * nx + ny * ny <= 1) p.set(x, y, ny > 0.4 ? '#d6d0c4' : '#f4f1ea');
    }
  }
  for (let y = 2; y <= 7; y++) for (let x = 3; x <= 7; x++) if ((x - 5) ** 2 + (y - 5) ** 2 <= 5) p.set(x, y, '#f4f1ea');
  p.rect(4, 1, 3, 1, '#d2404c');
  p.set(2, 5, '#e8a33a');
  p.set(4, 4, P.eye);
  p.set(13, 7, '#f4f1ea');
}

function crabPotIcon(p: PixelCanvas): void {
  p.rect(3, 6, 10, 8, '#8a6a42');
  for (let x = 3; x <= 12; x += 3) p.rect(x, 6, 1, 8, '#5a4228');
  for (let y = 6; y <= 13; y += 3) p.rect(3, y, 10, 1, '#5a4228');
  p.rect(7, 2, 2, 4, '#e6e1d8');
  p.rect(6, 1, 4, 2, '#d2553f');
}

function baitIcon(p: PixelCanvas): void {
  for (const [x, y] of [[4, 10], [5, 9], [6, 9], [7, 10], [8, 10], [9, 9], [10, 8], [11, 8]]) p.rect(x, y, 1, 2, '#d98a8a');
  p.rect(3, 12, 10, 2, '#8a6a42');
}

function crabIcon(p: PixelCanvas, shell: string, light: string): void {
  for (let y = 6; y <= 11; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 5) ** 2 + ((y - 9) / 3) ** 2 <= 1) p.set(x, y, y < 8 ? light : shell);
  p.rect(1, 5, 2, 2, shell);
  p.rect(13, 5, 2, 2, shell);
  for (const x of [3, 5, 10, 12]) p.set(x, 12, shell);
  p.set(6, 7, '#1a1412');
  p.set(9, 7, '#1a1412');
}

function shrimpIcon(p: PixelCanvas): void {
  for (let i = 0; i < 9; i++) p.rect(3 + i, 8 + Math.round(Math.sin(i / 2.5) * 2), 2, 3 - (i > 6 ? 1 : 0), i % 2 ? '#f08a5a' : '#f4a77a');
  p.set(12, 6, '#e8723a');
  p.set(13, 5, '#e8723a');
}

function driftwoodIcon(p: PixelCanvas): void {
  for (let i = 0; i < 11; i++) p.rect(2 + i, 10 - Math.round(i / 3), 2, 3, i % 3 ? '#a89a82' : '#8a7a62');
}

function bootIcon(p: PixelCanvas): void {
  p.rect(5, 2, 5, 9, '#5a4a3a');
  p.rect(5, 10, 9, 4, '#5a4a3a');
  p.rect(5, 13, 9, 1, '#2a2018');
  p.rect(6, 4, 3, 1, '#7a6a5a');
  p.set(12, 11, '#3a8ab5');
}

function seaweedIcon(p: PixelCanvas): void {
  for (let y = 2; y < 14; y++) {
    p.set(5 + Math.round(Math.sin(y / 2) * 1.5), y, '#2f7a4a');
    p.set(10 + Math.round(Math.cos(y / 2) * 1.5), y, '#3f9a5a');
  }
}

function ringIcon(p: PixelCanvas, gem: string): void {
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    p.set(Math.round(8 + Math.cos(t) * 4), Math.round(9 + Math.sin(t) * 4), '#e8c25a');
  }
  p.rect(6, 3, 4, 3, gem);
  p.set(7, 3, '#ffffff');
}

function armorIcon(p: PixelCanvas, main: string, light: string): void {
  p.rect(3, 3, 10, 10, main);
  p.rect(1, 3, 3, 4, main);
  p.rect(12, 3, 3, 4, main);
  p.rect(6, 2, 4, 2, '#1a1412');
  p.rect(4, 5, 8, 1, light);
  p.rect(7, 6, 2, 6, light);
}

function mushroomIcon(p: PixelCanvas, cap: string, spots: string): void {
  for (let y = 3; y <= 8; y++) for (let x = 2; x <= 13; x++) if (((x - 7.5) / 6) ** 2 + ((y - 8) / 5) ** 2 <= 1) p.set(x, y, cap);
  p.rect(6, 8, 4, 6, '#efe4cc');
  p.set(5, 5, spots);
  p.set(9, 4, spots);
  p.set(11, 6, spots);
}

function morelIcon(p: PixelCanvas): void {
  for (let y = 2; y <= 10; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.6) ** 2 + ((y - 6) / 4.5) ** 2 <= 1) p.set(x, y, (x + y) % 2 ? '#a8823a' : '#7a5a2a');
  p.rect(6, 10, 4, 4, '#efe4cc');
}

function herbIcon(p: PixelCanvas): void {
  p.rect(7, 6, 1, 8, '#3f7a3a');
  for (const [x, y] of [[4, 5], [9, 3], [5, 9], [10, 8], [6, 2]]) p.rect(x, y, 3, 2, '#6cc45a');
}

function nutIcon(p: PixelCanvas): void {
  for (let y = 5; y <= 13; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.5) ** 2 + ((y - 9.5) / 4.5) ** 2 <= 1) p.set(x, y, y < 8 ? '#c8a06a' : '#8a5a2a');
  p.rect(6, 3, 4, 2, '#5a8a3a');
}

function rootIcon(p: PixelCanvas): void {
  for (let i = 0; i < 9; i++) p.rect(5 + Math.round(i / 3), 3 + i, 5 - Math.floor(i / 2), 1, i < 3 ? '#e8e0f0' : '#b8a0c8');
  p.rect(6, 1, 1, 3, '#5a8a3a');
  p.rect(8, 1, 1, 2, '#5a8a3a');
}

function berryClusterIcon(p: PixelCanvas, c: string, hi: string): void {
  for (const [x, y] of [[5, 6], [9, 6], [7, 9], [4, 10], [10, 10]]) {
    p.rect(x, y, 3, 3, c);
    p.set(x, y, hi);
  }
  p.rect(7, 2, 1, 4, '#3f7a3a');
}

function hardwoodIcon(p: PixelCanvas): void {
  p.rect(2, 5, 12, 7, '#6a3e1e');
  for (let y = 6; y <= 10; y += 2) p.rect(3, y, 9, 1, '#8a5a2a');
  for (let y = 5; y < 12; y++) for (let x = 11; x < 15; x++) if (((x - 12.5) / 2) ** 2 + ((y - 8.5) / 3.5) ** 2 <= 1) p.set(x, y, '#c8945a');
  p.set(12, 8, '#8a5a2a');
}

function fishingRod(p: PixelCanvas): void {
  for (let i = 0; i < 11; i++) {
    p.set(3 + i, 13 - i, i < 4 ? P.woodDark : P.wood);
  }
  p.rect(3, 11, 2, 2, P.trunkDark); // handle
  p.set(5, 10, '#b9c0c6'); // reel
  for (let y = 3; y <= 9; y++) p.set(14, y, '#e6e1d8'); // line
  p.set(14, 10, P.berry); // bobber
  p.set(14, 11, '#ffffff');
}

function fish(p: PixelCanvas, body: string, belly: string, fin: string): void {
  for (let y = 5; y <= 11; y++) {
    for (let x = 2; x <= 11; x++) {
      const nx = (x - 6.5) / 4.5;
      const ny = (y - 8) / 3;
      if (nx * nx + ny * ny > 1) continue;
      p.set(x, y, y > 8 ? belly : body);
    }
  }
  // tail
  p.rect(12, 6, 1, 5, fin);
  p.rect(13, 5, 1, 2, fin);
  p.rect(13, 10, 1, 2, fin);
  p.set(6, 4, fin); // dorsal fin
  p.set(7, 4, fin);
  p.set(4, 7, P.eye);
}

function bread(p: PixelCanvas): void {
  for (let y = 5; y <= 12; y++) {
    for (let x = 2; x <= 13; x++) {
      const nx = (x - 7.5) / 6;
      const ny = (y - 9) / 4;
      if (nx * nx + ny * ny > 1) continue;
      p.set(x, y, y < 8 ? '#d9a05a' : '#c08442');
    }
  }
  for (const x of [5, 8, 11]) p.set(x, 7, '#f0d199');
}

function bowl(p: PixelCanvas, soup: string, bits: string): void {
  p.rect(2, 8, 12, 1, soup);
  p.rect(3, 9, 10, 3, '#e6e1d8');
  p.rect(4, 12, 8, 1, '#bdb5a3');
  p.rect(5, 13, 6, 1, '#bdb5a3');
  p.set(5, 8, bits);
  p.set(9, 8, bits);
  p.set(7, 5, '#e6e1d8');
  p.set(8, 4, '#e6e1d8');
}

function tart(p: PixelCanvas): void {
  p.rect(2, 10, 12, 3, '#c08442');
  p.rect(3, 8, 10, 2, '#d9a05a');
  for (const [x, y] of [[4, 8], [6, 7], [8, 8], [10, 7], [5, 9], [9, 9], [11, 9], [7, 9]]) p.set(x, y, '#4a5fc4');
  p.set(6, 6, '#7a8fe4');
}

function jar(p: PixelCanvas): void {
  p.rect(4, 4, 8, 2, P.woodLight);
  p.rect(4, 6, 8, 8, '#a8304a');
  p.rect(5, 7, 2, 5, '#d2506a');
  p.rect(6, 9, 4, 2, '#f1e3c4');
}

function grilledFish(p: PixelCanvas): void {
  fish(p, '#b8763a', '#d9a05a', '#8a5426');
  for (const x of [5, 7, 9]) p.set(x, 7, '#6b4222');
  p.rect(1, 12, 14, 1, '#e6e1d8');
}

function omelette(p: PixelCanvas): void {
  p.rect(2, 9, 12, 3, '#e6e1d8');
  for (let y = 6; y <= 10; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 5) ** 2 + ((y - 9) / 3) ** 2 <= 1) p.set(x, y, y < 8 ? '#f6d65a' : '#e8b83a');
  p.set(6, 7, P.leafLight);
  p.set(9, 8, P.leafLight);
}

function pie(p: PixelCanvas): void {
  p.rect(2, 10, 12, 3, '#c08442');
  for (let y = 6; y <= 10; y++) for (let x = 2; x <= 13; x++) if (((x - 7.5) / 6) ** 2 + ((y - 10) / 4) ** 2 <= 1) p.set(x, y, y < 9 ? '#e58a2c' : '#c96d1c');
  p.rect(2, 9, 12, 1, '#d9a05a');
  p.set(7, 7, '#f6a95c');
}

function sprinklerIcon(p: PixelCanvas): void {
  p.rect(6, 7, 4, 7, '#9c5525');
  p.rect(6, 7, 1, 7, '#d9823b');
  p.rect(4, 5, 8, 2, '#b9c0c6');
  p.rect(7, 3, 2, 2, '#b9c0c6');
  for (const [x, y] of [
    [2, 3],
    [13, 3],
    [1, 6],
    [14, 6],
  ] as const) p.set(x, y, '#58a4d2');
}

function benchIcon(p: PixelCanvas): void {
  p.rect(2, 6, 12, 2, P.woodLight);
  p.rect(2, 8, 12, 1, P.woodDark);
  p.rect(2, 3, 12, 2, P.wood);
  p.rect(3, 9, 2, 5, P.woodDark);
  p.rect(11, 9, 2, 5, P.woodDark);
}

function flowerPotIcon(p: PixelCanvas): void {
  p.rect(4, 9, 8, 5, '#b8603a');
  p.rect(3, 9, 10, 1, '#d07a4a');
  p.rect(7, 5, 2, 4, P.leaf);
  for (const [x, y, c] of [
    [5, 4, P.flowerPink],
    [10, 4, P.flowerYellow],
    [7, 2, P.flowerBlue],
  ] as const) {
    p.rect(x, y, 2, 2, c);
  }
}

function scarecrowIcon(p: PixelCanvas): void {
  p.rect(7, 6, 2, 9, P.woodDark);
  p.rect(2, 7, 12, 2, P.wood);
  p.rect(5, 6, 6, 5, '#8a5aa8');
  p.rect(6, 2, 4, 4, '#e8c47a');
  p.rect(4, 1, 8, 2, '#8a6a2c');
  p.set(7, 3, P.eye);
  p.set(9, 3, P.eye);
}

function tokenIcon(p: PixelCanvas): void {
  p.rect(4, 2, 8, 12, '#c8982a');
  p.rect(2, 4, 12, 8, '#c8982a');
  p.rect(3, 3, 10, 10, '#e8b83a');
  p.rect(5, 5, 6, 6, '#f4d24a');
  p.rect(7, 4, 2, 8, '#a87a1c'); // a big "C" mark
  p.rect(7, 4, 3, 1, '#a87a1c');
  p.rect(7, 11, 3, 1, '#a87a1c');
  p.rect(4, 3, 3, 1, '#fff0a8');
  p.outline(P.outline);
}

function ticketIcon(p: PixelCanvas): void {
  p.rect(1, 4, 14, 8, '#e0454f');
  p.rect(2, 5, 12, 6, '#f26a72');
  p.set(1, 7, '#000000', 0); // notches
  p.set(1, 8, '#000000', 0);
  p.set(14, 7, '#000000', 0);
  p.set(14, 8, '#000000', 0);
  for (let y = 5; y < 11; y += 2) p.set(5, y, '#ffe0e0');
  p.rect(7, 6, 5, 1, '#fff6d8');
  p.rect(7, 8, 4, 1, '#fff6d8');
  p.outline(P.outline);
}

function cottonCandyIcon(p: PixelCanvas): void {
  p.rect(7, 9, 2, 6, '#e8e2d4');
  p.rect(4, 2, 8, 7, '#f6a8d0');
  p.rect(3, 3, 10, 5, '#f6a8d0');
  p.rect(5, 1, 6, 2, '#f6a8d0');
  p.rect(5, 3, 3, 2, '#ffd8ec');
  p.rect(9, 6, 3, 2, '#e07ab0');
  p.outline(P.outline);
}

function candyAppleIcon(p: PixelCanvas): void {
  p.rect(7, 0, 2, 6, '#c9905a'); // stick
  p.rect(3, 5, 10, 8, '#c8202e');
  p.rect(4, 4, 8, 10, '#c8202e');
  p.rect(5, 5, 2, 3, '#ff8088');
  p.rect(3, 12, 10, 2, '#e8a040'); // toffee drip
  p.outline(P.outline);
}

const DRAW = {
  carnival_token: tokenIcon,
  prize_ticket: ticketIcon,
  cotton_candy: cottonCandyIcon,
  candy_apple: candyAppleIcon,
  axe: (p) => axe(p, METAL),
  pickaxe: (p) => pickaxe(p, METAL),
  hoe,
  watering_can: wateringCan,
  copper_axe: (p) => axe(p, COPPER),
  copper_pickaxe: (p) => pickaxe(p, COPPER),
  wood: log,
  stone: (p) => stoneBlob(p),
  copper_ore: (p) => stoneBlob(p, { base: COPPER.base, light: COPPER.light }),
  fiber,
  berries,
  turnip_seeds: (p) => seedPacket(p, 'turnip'),
  carrot_seeds: (p) => seedPacket(p, 'carrot'),
  pumpkin_seeds: (p) => seedPacket(p, 'pumpkin'),
  turnip: (p) => turnip(p),
  carrot,
  pumpkin: (p) => pumpkin(p),
  fertilizer,
  egg,
  fence: fenceIcon,
  wood_path: (p) => pathIcon(p, false),
  stone_path: (p) => pathIcon(p, true),
  lamp_post: lampIcon,
  chest: chestIcon,
  chicken: chickenIcon,
  fishing_rod: fishingRod,
  sunfish: (p) => fish(p, '#e8b83a', '#f6d65a', '#d2553f'),
  trout: (p) => fish(p, '#7a9a6a', '#d9c7b0', '#5a7a4a'),
  catfish: (p) => fish(p, '#6b5a4a', '#a8957f', '#4a3d31'),
  golden_carp: (p) => fish(p, '#f4c24a', '#fff0a8', '#e8812f'),
  bread,
  veggie_soup: (p) => bowl(p, '#d9823b', P.leaf),
  berry_jam: jar,
  grilled_fish: grilledFish,
  omelette,
  pumpkin_pie: pie,
  miners_stew: (p) => bowl(p, '#8a4a2a', '#d9a05a'),
  corn_chowder: (p) => bowl(p, '#f2d47a', '#e8b83a'),
  blueberry_tart: tart,
  crab_pot: crabPotIcon,
  mushroom: (p) => mushroomIcon(p, '#b8743a', '#efe4cc'),
  morel: morelIcon,
  wild_herb: herbIcon,
  hazelnut: nutIcon,
  winter_root: rootIcon,
  salmonberry: (p) => berryClusterIcon(p, '#f08a3a', '#ffc08a'),
  hardwood: hardwoodIcon,
  iron_sprinkler: (p) => fromSprite(drawMetalSprinkler('#8a9098', '#c8ccd2'))(p),
  gold_sprinkler: (p) => fromSprite(drawMetalSprinkler('#c8982a', '#f4d24a'))(p),
  silo: (p) => fromSprite(drawSilo())(p),
  well: (p) => fromSprite(drawWell())(p),
  shed: (p) => fromSprite(drawShed())(p),
  statue: (p) => fromSprite(drawStatue())(p),
  flower_bed: (p) => fromSprite(drawFlowerBed())(p),
  birdbath: (p) => fromSprite(drawBirdbath())(p),
  gnome: (p) => fromSprite(drawGnome())(p),
  collector: (p) => fromSprite(drawCollector())(p),
  duck: (p) => {
    for (let y = 6; y <= 12; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 5) ** 2 + ((y - 9.5) / 3.5) ** 2 <= 1) p.set(x, y, '#f4f0e8');
    p.rect(10, 3, 4, 4, '#f4f0e8');
    p.rect(14, 5, 2, 1, '#f2a03a');
    p.set(12, 4, '#1a1412');
    p.rect(6, 13, 1, 2, '#f2a03a');
    p.rect(9, 13, 1, 2, '#f2a03a');
  },
  rabbit: (p) => {
    for (let y = 7; y <= 13; y++) for (let x = 3; x <= 11; x++) if (((x - 7) / 4.5) ** 2 + ((y - 10.5) / 3.5) ** 2 <= 1) p.set(x, y, '#f4f0e8');
    p.rect(9, 5, 4, 4, '#f4f0e8');
    p.rect(9, 1, 1, 4, '#f4f0e8');
    p.rect(11, 1, 1, 4, '#f4f0e8');
    p.set(9, 2, '#f4a6c6');
    p.set(11, 6, '#1a1412');
    p.set(2, 10, '#ffffff');
  },
  duck_egg: (p) => {
    for (let y = 3; y <= 13; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.8) ** 2 + ((y - 8.5) / 5) ** 2 <= 1) p.set(x, y, y < 6 ? '#e8f4ec' : '#c8e0d0');
    p.set(6, 6, '#ffffff');
  },
  rabbit_foot: (p) => {
    for (let y = 4; y <= 13; y++) for (let x = 5; x <= 10; x++) if (((x - 7.5) / 2.8) ** 2 + ((y - 9) / 5) ** 2 <= 1) p.set(x, y, '#d8c8b0');
    p.rect(6, 2, 3, 3, '#e8c25a');
    p.set(7, 1, '#e8c25a');
  },
  bouquet: (p) => {
    for (const [x, y, c] of [[5, 3, '#f4a6c6'], [9, 2, '#e0443e'], [7, 5, '#f2cc45'], [4, 6, '#c46ad8'], [10, 5, '#f4a6c6']] as const) {
      p.rect(x, y, 3, 3, c);
      p.set(x + 1, y + 1, '#ffffff');
    }
    p.rect(7, 8, 2, 6, '#3f7a3a');
    p.rect(5, 10, 6, 2, '#e8d8b8');
  },
  pendant: (p) => {
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI;
      p.set(Math.round(8 + Math.cos(t) * 6), Math.round(4 - Math.sin(t) * 3) + 2, '#e8c25a');
    }
    for (let y = 7; y <= 13; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.5) ** 2 + ((y - 10) / 3.2) ** 2 <= 1) p.set(x, y, y < 9 ? '#8ae0f0' : '#3a9ab5');
    p.set(6, 8, '#ffffff');
  },
  bat_wing: (p) => {
    p.rect(2, 6, 12, 3, '#4a3a5a');
    for (const x of [3, 7, 11]) p.rect(x, 9, 2, 2, '#4a3a5a');
    p.rect(2, 5, 12, 1, '#6a5a7a');
  },
  ectoplasm: (p) => {
    for (let y = 4; y < 14; y++) for (let x = 3; x < 13; x++) if (((x - 7.5) / 5) ** 2 + ((y - 10) / 4.5) ** 2 <= 1) p.set(x, y, y < 8 ? '#c8f0d8' : '#8ae0b0');
    p.set(6, 7, '#ffffff');
  },
  power_ring: (p) => ringIcon(p, '#e0443e'),
  guard_ring: (p) => ringIcon(p, '#4a8fd8'),
  lucky_ring: (p) => ringIcon(p, '#6cc45a'),
  leather_armor: (p) => armorIcon(p, '#8a5a2a', '#b07a42'),
  iron_armor: (p) => armorIcon(p, '#8a9098', '#c8ccd2'),
  bait: baitIcon,
  crab: (p) => crabIcon(p, '#c8452e', '#e8723a'),
  shrimp: shrimpIcon,
  driftwood: driftwoodIcon,
  old_boot: bootIcon,
  seaweed: seaweedIcon,
  sprinkler: sprinklerIcon,
  bench: benchIcon,
  flower_pot: flowerPotIcon,
  scarecrow: scarecrowIcon,
  iron_ore: (p) => oreBlob(p, IRON),
  gold_ore: (p) => oreBlob(p, GOLD),
  amethyst: (p) => gem(p),
  slime: slimeBlob,
  sword: (p) => sword(p, { base: '#a89a8a', light: '#d2c6b8', dark: '#7a6a5a' }),
  iron_sword: (p) => sword(p, IRON),
  iron_axe: (p) => axe(p, IRON),
  iron_pickaxe: (p) => pickaxe(p, IRON),
  gold_axe: (p) => axe(p, GOLD),
  gold_pickaxe: (p) => pickaxe(p, GOLD),
  ...(Object.fromEntries(
    (Object.keys(PRODUCE) as CropId[]).flatMap((crop) => [
      [crop, (p: PixelCanvas) => produceIcon(p, crop)],
      [`${crop}_seeds`, (p: PixelCanvas) => seedPacket(p, crop)],
    ]),
  ) as Record<string, (p: PixelCanvas) => void>),
  juice,
  pickles: picklesJar,
  keg: kegIcon,
  preserves_jar: jarIcon,
  greenhouse: greenhouseIcon,
  cow: (p: PixelCanvas) => animalIcon(p, '#f3efe6', '#3a2e2a', '#f3efe6'),
  sheep: (p: PixelCanvas) => animalIcon(p, '#f6f2ea', '#d8d0c4', '#4a3a34'),
  hay,
  milk: (p: PixelCanvas) => bottle(p, '#ffffff'),
  wool: woolBall,
  cheese: cheeseWedge,
  cloth: clothBolt,
  cheese_press: (p: PixelCanvas) => {
    p.rect(3, 6, 10, 8, P.wood);
    p.rect(5, 3, 6, 3, '#b9c0c6');
    p.rect(5, 9, 6, 3, '#f2d06a');
  },
  loom: (p: PixelCanvas) => {
    p.rect(2, 3, 2, 11, P.woodDark);
    p.rect(12, 3, 2, 11, P.woodDark);
    p.rect(4, 5, 8, 6, '#efe8dc');
  },
  painted_egg: (p: PixelCanvas) => {
    for (let y = 3; y <= 13; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.5) ** 2 + ((y - 8.5) / 5.5) ** 2 <= 1) p.set(x, y, y < 7 ? '#f6a8c8' : y < 10 ? '#8ec8f0' : '#f2e06a');
    p.rect(4, 7, 8, 1, '#ffffff');
  },
  golden_egg: (p: PixelCanvas) => {
    for (let y = 3; y <= 13; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.5) ** 2 + ((y - 8.5) / 5.5) ** 2 <= 1) p.set(x, y, x < 6 ? '#fff0a8' : x > 10 ? '#a87a1c' : '#e8b83a');
    p.set(5, 5, '#ffffff');
  },
  ribbon: (p: PixelCanvas) => {
    for (let y = 2; y <= 8; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.5) ** 2 + ((y - 5) / 3) ** 2 <= 1) p.set(x, y, '#4a62c8');
    p.rect(6, 4, 3, 2, '#f2cc45');
    p.rect(5, 8, 2, 6, '#4a62c8');
    p.rect(9, 8, 2, 6, '#4a62c8');
  },
  seashell: (p: PixelCanvas) => {
    for (let i = 0; i < 6; i++) p.rect(3 + i, 12 - i, 10 - i * 2 + 2, 1, i % 2 ? '#f6d2c0' : '#f0b8a0');
    for (let x = 4; x <= 12; x += 2) p.rect(x, 7, 1, 6, '#d8907a');
    p.rect(6, 12, 4, 2, '#d8907a');
  },
  coral: (p: PixelCanvas) => {
    for (const [x, y, h] of [[7, 3, 11], [4, 6, 6], [10, 5, 7], [3, 4, 2], [12, 3, 2]]) p.rect(x, y, 2, h, '#f07a8a');
    p.rect(5, 9, 6, 2, '#f07a8a');
    p.rect(7, 13, 2, 1, '#c8505e');
  },
  sea_urchin: (p: PixelCanvas) => {
    for (let y = 5; y <= 12; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.8) ** 2 + ((y - 8.5) / 3.6) ** 2 <= 1) p.set(x, y, '#5a2a6a');
    for (const [x, y] of [[7, 2], [3, 4], [12, 4], [1, 8], [14, 8], [3, 13], [12, 13], [8, 14], [5, 3], [10, 3]]) p.set(x, y, '#3a1a4a');
    for (const [x, y] of [[7, 3], [4, 5], [11, 5], [2, 8], [13, 8], [4, 12], [11, 12]]) p.set(x, y, '#7a4a8a');
    p.set(6, 7, '#b07ad0');
  },
  sea_star: (p: PixelCanvas) => {
    const c = '#f05a4a';
    p.rect(6, 6, 4, 4, c);
    p.rect(7, 1, 2, 5, c);
    p.rect(1, 6, 5, 2, c);
    p.rect(10, 6, 5, 2, c);
    p.rect(4, 10, 2, 4, c);
    p.rect(10, 10, 2, 4, c);
    for (const [x, y] of [[7, 3], [3, 6], [12, 6], [7, 7], [5, 11], [10, 11]]) p.set(x, y, '#f8b08a');
  },
  rainbow_shell: (p: PixelCanvas) => {
    const bands = ['#f07a8a', '#f2b45a', '#f4e27a', '#7ad28a', '#7ab8f0', '#b07ad0'];
    for (let i = 0; i < 6; i++) p.rect(3 + i, 12 - i, 10 - i * 2 + 2, 1, bands[i]);
    for (let x = 4; x <= 12; x += 2) p.rect(x, 7, 1, 6, '#ffffff');
    p.rect(6, 12, 4, 2, '#d8a0c8');
    p.set(9, 8, '#ffffff');
  },
  coconut: (p: PixelCanvas) => {
    for (let y = 3; y <= 13; y++) for (let x = 3; x <= 13; x++) if (((x - 8) / 5) ** 2 + ((y - 8.5) / 5) ** 2 <= 1) p.set(x, y, (x + y) % 3 ? '#7a5232' : '#5e3a1e');
    p.set(6, 6, '#3a2418');
    p.set(9, 6, '#3a2418');
    p.set(8, 8, '#3a2418');
    p.rect(5, 4, 3, 1, '#9a7252');
  },
  pineapple_seeds: (p: PixelCanvas) => {
    p.rect(4, 2, 8, 12, '#f4e2a8');
    p.rect(4, 2, 8, 2, '#d8c07a');
    p.rect(11, 4, 1, 10, '#d8c07a');
    p.rect(6, 7, 4, 4, '#e8b83a');
    p.set(7, 8, '#a8823a');
    p.rect(7, 5, 2, 2, '#3f8a4a');
    p.set(6, 12, '#8a6a32');
    p.set(9, 12, '#8a6a32');
  },
  pineapple: (p: PixelCanvas) => {
    for (const [x, h] of [[5, 4], [7, 6], [8, 6], [10, 4]]) p.rect(x, 7 - h + 1, 1, h, x % 2 ? '#3f8a4a' : '#5aaa5a');
    for (let y = 7; y <= 14; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 4) ** 2 + ((y - 10.5) / 4) ** 2 <= 1) p.set(x, y, (x + y) % 3 === 0 ? '#a8823a' : y < 10 ? '#f4d24a' : '#e8b83a');
  },
  taro_tuber: (p: PixelCanvas) => {
    for (let y = 6; y <= 13; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.8) ** 2 + ((y - 9.5) / 3.6) ** 2 <= 1) p.set(x, y, y % 2 ? '#8a6a5a' : '#a0806a');
    p.rect(7, 3, 2, 3, '#4a8a3a');
    p.set(6, 3, '#6ab04c');
  },
  taro: (p: PixelCanvas) => {
    for (let y = 6; y <= 14; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.6) ** 2 + ((y - 10) / 4) ** 2 <= 1) p.set(x, y, (x * 3 + y) % 4 ? '#7a5a6a' : '#5e4252');
    p.rect(6, 8, 3, 2, '#c8a8d8');
    p.rect(7, 2, 1, 4, '#4a8a3a');
    p.rect(5, 1, 5, 2, '#5aaa4a');
  },
  pearl: (p: PixelCanvas) => {
    for (let y = 4; y <= 12; y++) for (let x = 4; x <= 12; x++) if (((x - 8) / 4.2) ** 2 + ((y - 8) / 4.2) ** 2 <= 1) p.set(x, y, y > 9 ? '#d8d0e8' : '#f6f2ff');
    p.rect(6, 6, 2, 2, '#ffffff');
    p.set(10, 11, '#b8b0d0');
  },
  ruby: (p: PixelCanvas) => gem(p, RUBY),
  jade: (p: PixelCanvas) => {
    for (let y = 4; y <= 12; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.8) ** 2 + ((y - 8) / 4) ** 2 <= 1) p.set(x, y, y < 7 ? JADE.light : y > 10 ? JADE.dark : JADE.base);
    p.set(6, 6, '#ffffff');
  },
  parrotfish: (p: PixelCanvas) => {
    fish(p, '#3ab8a8', '#f07a8a', '#4a62c8');
    p.rect(7, 6, 1, 4, '#f4d24a');
  },
  lionfish: (p: PixelCanvas) => {
    fish(p, '#e8e0d8', '#f0e8e0', '#c8283a');
    for (const x of [5, 7, 9]) p.rect(x, 5, 1, 7, '#c8283a');
    for (const [x, y] of [[5, 2], [7, 1], [9, 2], [6, 13], [9, 13]]) p.rect(x, y, 1, 3, '#a8283a');
  },
  swordfish: (p: PixelCanvas) => {
    fish(p, '#3a4a78', '#a8b8d0', '#22305a');
    p.rect(0, 7, 3, 1, '#8a9ab8');
    p.set(6, 3, '#22305a');
    p.set(7, 2, '#22305a');
  },
  old_coin: (p: PixelCanvas) => {
    for (let y = 3; y <= 13; y++) for (let x = 3; x <= 13; x++) if (((x - 8) / 5) ** 2 + ((y - 8) / 5) ** 2 <= 1) p.set(x, y, '#b8903a');
    for (let y = 5; y <= 11; y++) for (let x = 5; x <= 11; x++) if (((x - 8) / 3) ** 2 + ((y - 8) / 3) ** 2 <= 1) p.set(x, y, '#d8b05a');
    p.rect(7, 6, 2, 4, '#8a6a2a');
    p.set(5, 4, '#f0d890');
  },
  arrowhead: (p: PixelCanvas) => {
    for (let y = 2; y <= 12; y++) {
      const w = Math.round((y - 2) * 0.45);
      p.rect(8 - w, y, w * 2 + 1, 1, y % 3 ? '#8a8292' : '#a8a0b0');
    }
    p.rect(7, 13, 3, 2, '#6a6272');
  },
  clay_pot: (p: PixelCanvas) => {
    for (let y = 5; y <= 14; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.8) ** 2 + ((y - 10) / 4.6) ** 2 <= 1) p.set(x, y, '#c46a3a');
    p.rect(5, 3, 6, 3, '#b45a2a');
    p.rect(6, 2, 4, 1, '#d8844a');
    p.rect(4, 9, 8, 1, '#3a2418');
    for (let x = 5; x < 12; x += 2) p.set(x, 11, '#3a2418');
  },
  fossil: (p: PixelCanvas) => {
    p.rect(2, 3, 12, 11, '#b8ae9a');
    p.rect(2, 3, 12, 1, '#d0c8b4');
    for (let a = 0; a < 18; a++) {
      const r = 0.4 + a * 0.22;
      const x = Math.round(8 + Math.cos(a * 0.7) * r);
      const y = Math.round(8.5 + Math.sin(a * 0.7) * r);
      p.set(x, y, '#6a5a42');
    }
  },
  stone_tablet: (p: PixelCanvas) => {
    p.rect(3, 2, 10, 13, '#8a8478');
    p.rect(3, 2, 10, 1, '#a8a294');
    p.rect(12, 3, 1, 12, '#6a645a');
    for (const [x, y] of [[5, 4], [8, 4], [5, 7], [9, 7], [6, 10], [9, 11], [5, 12]]) p.rect(x, y, 2, 1, '#3a342c');
    p.set(7, 5, '#3a342c');
    p.set(10, 9, '#3a342c');
  },
  charcoal: (p: PixelCanvas) => {
    for (const [x, y, w, h] of [[3, 7, 5, 4], [7, 5, 6, 5], [5, 10, 7, 3]]) p.rect(x, y, w, h, '#2e2a2a');
    p.rect(8, 6, 3, 1, '#5a5454');
    p.rect(4, 8, 2, 1, '#5a5454');
    p.set(10, 11, '#e8642a');
    p.set(6, 12, '#a83a1a');
  },
  coal: (p: PixelCanvas) => {
    for (const [x, y, w, h] of [[4, 6, 5, 5], [8, 5, 5, 6], [5, 10, 7, 3]]) p.rect(x, y, w, h, '#1e1c22');
    for (const [x, y] of [[9, 6], [5, 7], [10, 9], [7, 11]]) p.set(x, y, '#5c6070');
    p.set(11, 7, '#8a90a0');
  },
  golden_spike: (p: PixelCanvas) => {
    p.rect(4, 3, 8, 2, '#f0c84a');
    p.rect(4, 3, 8, 1, '#fff0a0');
    p.rect(7, 5, 3, 7, '#d8a830');
    p.rect(7, 5, 1, 7, '#fff0a0');
    p.rect(8, 12, 1, 2, '#b88a20');
    p.set(3, 4, '#b88a20');
  },
  silver_locket: (p: PixelCanvas) => {
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2;
      p.set(Math.round(8 + Math.cos(t) * 3.5), Math.round(3 + Math.sin(t) * 2.5), '#c8ccd8');
    }
    for (let y = 6; y <= 13; y++) for (let x = 4; x <= 12; x++) if (((x - 8) / 4) ** 2 + ((y - 9.5) / 3.6) ** 2 <= 1) p.set(x, y, '#b8bcc8');
    p.rect(6, 7, 2, 2, '#eef0f8');
    p.set(8, 10, '#8a8ea0');
    p.set(9, 9, '#8a8ea0');
  },
  reading_glasses: (p: PixelCanvas) => {
    for (const cx of [5, 11]) {
      for (let a = 0; a < 18; a++) {
        const t = (a / 18) * Math.PI * 2;
        p.set(Math.round(cx + Math.cos(t) * 2.6), Math.round(9 + Math.sin(t) * 2.6), '#6a4a2a');
      }
      p.rect(cx - 1, 8, 2, 2, '#cfe8f4');
    }
    p.rect(7, 8, 2, 1, '#6a4a2a');
    p.rect(1, 7, 2, 1, '#6a4a2a');
    p.rect(13, 7, 2, 1, '#6a4a2a');
  },
  music_box: (p: PixelCanvas) => {
    p.rect(3, 6, 10, 7, '#8a4a2e');
    p.rect(3, 4, 10, 3, '#a85e3a');
    p.rect(3, 4, 10, 1, '#c87a50');
    p.rect(7, 8, 2, 2, '#f0c84a');
    p.rect(13, 8, 2, 1, '#c8ccd8');
    p.rect(14, 7, 1, 3, '#c8ccd8');
    p.set(5, 2, '#fff1a8');
    p.set(10, 1, '#fff1a8');
  },
  spirit_ring: (p: PixelCanvas) => {
    ringIcon(p, '#9fe4f4');
    p.set(3, 3, '#cfefff');
    p.set(13, 5, '#cfefff');
  },
  meteorite: (p: PixelCanvas) => {
    for (let y = 4; y <= 13; y++) for (let x = 3; x <= 13; x++) if (((x - 8) / 5.2) ** 2 + ((y - 8.5) / 4.6) ** 2 <= 1) p.set(x, y, (x * 7 + y * 3) % 5 === 0 ? '#2a2630' : '#4a4452');
    for (const [x, y] of [[6, 7], [10, 9], [8, 11]]) p.set(x, y, '#7a8aa8');
    p.rect(9, 5, 2, 2, '#c8d8ff');
    p.set(5, 6, '#e8642a');
  },
  icefish: (p: PixelCanvas) => {
    fish(p, '#c8e8f4', '#f4fcff', '#7ab0c8');
    p.rect(6, 7, 4, 1, '#ffffff');
  },
  apple_sapling: (p: PixelCanvas) => drawSaplingIcon(p, 'apple'),
  cherry_sapling: (p: PixelCanvas) => drawSaplingIcon(p, 'cherry'),
  peach_sapling: (p: PixelCanvas) => drawSaplingIcon(p, 'peach'),
  apple: (p: PixelCanvas) => drawFruitIcon(p, 'apple'),
  cherry: (p: PixelCanvas) => drawFruitIcon(p, 'cherry'),
  peach: (p: PixelCanvas) => drawFruitIcon(p, 'peach'),
  glacierfish: (p: PixelCanvas) => {
    fish(p, '#5ab0e0', '#d8f4ff', '#2a6a9a');
    for (const [x, y] of [[5, 6], [8, 8], [10, 6]]) p.set(x, y, '#ffffff');
  },
  horse: (p: PixelCanvas) => {
    // A horse's head in profile.
    p.rect(5, 4, 5, 9, '#9a5a32');
    p.rect(8, 3, 5, 5, '#9a5a32');
    p.rect(11, 5, 3, 3, '#7a4422');
    p.rect(9, 1, 2, 3, '#9a5a32');
    p.rect(4, 2, 3, 10, '#3a2418');
    p.set(10, 5, '#1a1412');
    p.rect(5, 13, 6, 2, '#8a2a2a');
    p.set(13, 7, '#2b1d1a');
  },
  golden_idol: (p: PixelCanvas) => {
    for (let y = 2; y <= 7; y++) for (let x = 4; x <= 11; x++) if (((x - 7.5) / 3.6) ** 2 + ((y - 4.8) / 3) ** 2 <= 1) p.set(x, y, '#e8b83a');
    p.rect(5, 8, 6, 5, '#d8a02a');
    p.rect(4, 13, 8, 2, '#a87a1c');
    p.rect(6, 4, 1, 1, '#2aa070');
    p.rect(9, 4, 1, 1, '#2aa070');
    p.rect(6, 6, 4, 1, '#a87a1c');
    p.rect(5, 3, 2, 1, '#fff0a8');
  },
  tuna: (p: PixelCanvas) => fish(p, '#4a6a98', '#c8d4e0', '#2a4268'),
  pufferfish: (p: PixelCanvas) => {
    for (let y = 4; y <= 12; y++) for (let x = 3; x <= 12; x++) if (((x - 7.5) / 4.8) ** 2 + ((y - 8) / 4.2) ** 2 <= 1) p.set(x, y, y > 9 ? '#f6f0d8' : '#e8c25a');
    for (const [x, y] of [[2, 6], [13, 7], [7, 3], [5, 13], [11, 12]]) p.set(x, y, '#a8823a');
    p.set(5, 7, P.eye);
  },
  ...(Object.fromEntries(
    FURNITURE_KINDS.map((kind) => [
      kind,
      (p: PixelCanvas) => {
        // Furniture icons: the sprite, shrunk to fit 16x16 (nearest neighbour).
        const art = drawFurniture(kind);
        const scale = Math.max(art.width, art.height) / 15;
        for (let y = 0; y < 16; y++) {
          for (let x = 0; x < 16; x++) {
            const sx = Math.floor(x * scale);
            const sy = Math.floor(y * scale);
            if (sx < art.width && sy < art.height && art.filled(sx, sy)) p.copyPixel(art, sx, sy, x, y);
          }
        }
      },
    ]),
  ) as Record<string, (p: PixelCanvas) => void>),
  house_upgrade: (p: PixelCanvas) => {
    p.rect(2, 3, 12, 11, '#efe4c8');
    p.rect(2, 3, 12, 1, '#c9b993');
    for (let i = 0; i < 4; i++) p.rect(6 - i, 5 + i, 4 + i * 2, 1, '#6e4638');
    p.rect(4, 9, 8, 4, '#b8443a');
    p.rect(7, 10, 2, 3, '#f3ead8');
  },
  barn: (p: PixelCanvas) => {
    p.rect(2, 7, 12, 7, '#b8443a');
    for (let i = 0; i < 6; i++) p.rect(7 - i, 1 + i, 2 + i * 2, 1, '#6e4638');
    p.rect(6, 9, 4, 5, '#f3ead8');
  },
} as Record<ItemId, (p: PixelCanvas) => void>;

/** An icon made by shrinking a world sprite into 16x16 (nearest pixel). */
function fromSprite(src: PixelCanvas): (p: PixelCanvas) => void {
  return (p) => {
    const scale = Math.max(src.width, src.height) / 15;
    const w = Math.floor(src.width / scale);
    const h = Math.floor(src.height / scale);
    const ox = Math.floor((16 - w) / 2);
    const oy = Math.floor((16 - h) / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.copyPixel(src, Math.floor(x * scale), Math.floor(y * scale), ox + x, oy + y);
  };
}

export function drawItemIcon(id: ItemId): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  DRAW[id](p);
  p.outline(P.outline);
  return p;
}

// Reused by crop sprites.
export const cropArt = { turnip, carrot, pumpkin, ORANGE, TURNIP };
