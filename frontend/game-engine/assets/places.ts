import type { NpcId } from '@farming/shared';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Art for the villagers' homes, the museum, and the island: houses and their
 * rooms' props, the museum front and its displays, and the island's huts,
 * palms' neighbours, crops, critters and cave. Base row = bottom row.
 */

const OUTLINE = P.outline;

function ellipse(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, color: string): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) p.set(x, y, color);
    }
  }
}

/** Tiny deterministic noise for texture. */
const noise = (x: number, y: number, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------- Villagers' houses ----------

interface HouseStyle {
  roof: [string, string, string];
  wall: 'plaster' | 'brick' | 'stone' | 'boards' | 'logs' | 'painted';
  wallColors: [string, string, string];
  door: [string, string];
  shutter: string;
  chimney: boolean;
  emblem: (p: PixelCanvas, x: number, y: number) => void;
  extra?: (p: PixelCanvas) => void;
}

const HOUSES: Record<NpcId, HouseStyle> = {
  mira: {
    roof: ['#3f7a4a', '#5a9a5e', '#2a5a34'],
    wall: 'plaster',
    wallColors: ['#efe2c4', '#d8c8a2', '#7a5236'],
    door: ['#c0703a', '#8a4a22'],
    shutter: '#3f7a4a',
    chimney: false,
    emblem: (p, x, y) => {
      p.rect(x + 3, y + 2, 1, 3, '#3f7a3a');
      p.rect(x + 1, y + 1, 2, 2, '#6ab04c');
      p.rect(x + 4, y + 1, 2, 2, '#6ab04c');
    },
    extra: (p) => {
      // Seedling pots by the door.
      for (const x of [13, 31]) {
        p.rect(x, 52, 5, 4, '#b8643a');
        p.rect(x, 52, 5, 1, '#d8845a');
        p.rect(x + 1, 49, 1, 3, '#4a8a3a');
        p.rect(x + 3, 48, 1, 4, '#4a8a3a');
        p.set(x, 49, '#6ab04c');
        p.set(x + 4, 48, '#6ab04c');
      }
    },
  },
  rosa: {
    roof: ['#b8505e', '#d4707a', '#82303e'],
    wall: 'painted',
    wallColors: ['#f6e6d8', '#e6d0be', '#b8505e'],
    door: ['#f0c86a', '#b8903a'],
    shutter: '#b8505e',
    chimney: true,
    emblem: (p, x, y) => {
      ellipse(p, x + 3.5, y + 3, 3, 1.6, '#d8a050');
      p.set(x + 2, y + 2, '#f0c878');
      p.set(x + 4, y + 2, '#f0c878');
    },
    extra: (p) => {
      // Flower boxes under the windows.
      for (const x of [7, 29]) {
        p.rect(x, 42, 12, 3, '#8a5a32');
        for (let i = 0; i < 12; i += 2) p.set(x + i, 41, i % 4 ? '#f07a8a' : '#f4d24a');
      }
    },
  },
  bram: {
    roof: ['#4a4a56', '#6a6a78', '#2e2e38'],
    wall: 'stone',
    wallColors: ['#a8a090', '#8a8272', '#5a5448'],
    door: ['#5a3a26', '#3a2418'],
    shutter: '#3a3a44',
    chimney: true,
    emblem: (p, x, y) => {
      p.rect(x + 1, y + 1, 6, 2, '#3a3a44');
      p.rect(x + 2, y + 3, 3, 1, '#3a3a44');
      p.rect(x + 1, y + 4, 5, 1, '#3a3a44');
    },
    extra: (p) => {
      // A water barrel and a stack of iron bars.
      p.rect(39, 47, 6, 9, '#7a5236');
      p.rect(39, 49, 6, 1, '#4a4a56');
      p.rect(39, 53, 6, 1, '#4a4a56');
      p.rect(40, 47, 4, 1, '#5a9ac8');
      p.rect(2, 53, 7, 3, '#8f9eb0');
      p.rect(3, 51, 5, 2, '#b9c4d0');
    },
  },
  finn: {
    roof: ['#3a6a9a', '#5a8aba', '#22466a'],
    wall: 'boards',
    wallColors: ['#a8c8d8', '#88a8bc', '#4a6a80'],
    door: ['#e8e0c8', '#b8ae94'],
    shutter: '#e8a03a',
    chimney: false,
    emblem: (p, x, y) => {
      ellipse(p, x + 3, y + 3, 2.6, 1.6, '#e8a03a');
      p.rect(x + 6, y + 2, 1, 3, '#e8a03a');
      p.set(x + 2, y + 2, '#2b1d1a');
    },
    extra: (p) => {
      // A net and a float hung on the wall, an oar by the door.
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if ((x + y) % 2 === 0) p.set(38 + x, 33 + y, '#c8b88a');
      ellipse(p, 41, 42, 1.6, 1.6, '#e8473a');
      p.rect(16, 40, 1, 16, '#a8703d');
      p.rect(15, 52, 3, 4, '#c08a5a');
    },
  },
  willa: {
    roof: ['#8a5a32', '#a8763f', '#5e3a1e'],
    wall: 'logs',
    wallColors: ['#b8844e', '#9a6a3a', '#6e4626'],
    door: ['#5e7a3a', '#3e5a22'],
    shutter: '#5e7a3a',
    chimney: true,
    emblem: (p, x, y) => {
      p.rect(x + 1, y + 1, 5, 2, '#9aa4ae');
      p.rect(x + 3, y + 3, 1, 3, '#7a5236');
    },
    extra: (p) => {
      // Woodpile against the side.
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
        const x = 1 + i * 3 + r;
        const y = 52 - r * 3;
        ellipse(p, x + 1, y + 1, 1.5, 1.5, '#a8763f');
        p.set(x + 1, y + 1, '#d8b47a');
      }
    },
  },
  tobin: {
    roof: ['#8a3a2e', '#a8584a', '#5e2218'],
    wall: 'brick',
    wallColors: ['#c86a4a', '#a8503a', '#e8d8c0'],
    door: ['#3f5c8c', '#2e466c'],
    shutter: '#f0e4c8',
    chimney: true,
    emblem: (p, x, y) => {
      ellipse(p, x + 3.5, y + 3, 2.4, 2.4, '#f4d24a');
      p.set(x + 3, y, '#f4d24a');
      p.set(x + 3, y + 6, '#f4d24a');
    },
    extra: (p) => {
      // A little bench and a potted fern.
      p.rect(33, 50, 10, 2, '#a8703d');
      p.rect(34, 52, 1, 4, '#6e4638');
      p.rect(41, 52, 1, 4, '#6e4638');
      p.rect(5, 52, 5, 4, '#7a5236');
      for (const [x, y] of [[5, 49], [7, 47], [9, 49], [6, 48], [8, 48]]) p.set(x, y, '#4a8a3a');
    },
  },
};

/** A villager's house: 48x60, three tiles wide, door at the bottom centre (base row 59). */
export function drawVillagerHouse(id: NpcId): PixelCanvas {
  const s = HOUSES[id];
  const p = new PixelCanvas(48, 60);
  const [wa, wb, wc] = s.wallColors;
  // Walls.
  for (let y = 26; y < 56; y++) {
    for (let x = 4; x < 44; x++) {
      let c = wa;
      switch (s.wall) {
        case 'plaster':
          c = noise(x, y) < 0.12 ? wb : wa;
          if (x === 4 || x === 43 || x === 23 || x === 24 || y === 26 || y === 40) c = wc;
          if ((x - y + 60) % 22 === 0 && y > 26 && y < 40 && (x < 20 || x > 28)) c = wc;
          break;
        case 'brick': {
          const row = Math.floor((y - 26) / 3);
          const off = row % 2 ? 3 : 0;
          c = (y - 26) % 3 === 2 || (x + off) % 6 === 0 ? wc : noise(x, y) < 0.2 ? wb : wa;
          break;
        }
        case 'stone': {
          const row = Math.floor((y - 26) / 5);
          const off = (row * 7) % 9;
          c = (y - 26) % 5 === 4 || (x + off) % 9 === 0 ? wc : noise(Math.floor((x + off) / 9), row) < 0.4 ? wb : wa;
          break;
        }
        case 'boards':
          c = x % 5 === 0 ? wc : noise(x, Math.floor(y / 8)) < 0.3 ? wb : wa;
          break;
        case 'logs': {
          const r = (y - 26) % 5;
          c = r === 4 ? wc : r === 0 ? wb : wa;
          break;
        }
        case 'painted':
          c = (y - 26) % 4 === 3 ? wb : wa;
          if (y >= 47) c = (x % 4 === 0) ? wc : '#d0687a';
          break;
      }
      p.set(x, y, c);
    }
  }
  // Corner posts.
  p.rect(3, 26, 2, 30, wc);
  p.rect(43, 26, 2, 30, wc);
  // Roof: a gable with shingles.
  const [ra, rb, rc] = s.roof;
  for (let y = 4; y <= 28; y++) {
    const half = Math.round(4 + ((y - 4) / 24) * 20);
    for (let x = 24 - half; x < 24 + half; x++) {
      const row = Math.floor((y - 4) / 3);
      let c = (y - 4) % 3 === 2 ? rc : (x + row * 2) % 6 === 0 ? rc : row % 2 ? ra : rb;
      if (y === 28 || y === 27) c = rc;
      p.set(x, y, c);
    }
  }
  p.rect(22, 3, 4, 2, rc);
  // Gable window in the roof.
  p.rect(20, 14, 8, 7, s.wallColors[0]);
  p.rect(21, 15, 6, 5, '#7ab8d8');
  p.rect(23, 15, 1, 5, wc);
  p.rect(21, 17, 6, 1, wc);
  // Chimney.
  if (s.chimney) {
    p.rect(34, 4, 6, 12, '#8a7a6a');
    for (let y = 4; y < 16; y += 3) p.rect(34, y, 6, 1, '#6a5a4a');
    p.rect(33, 3, 8, 2, '#5a4a3a');
  }
  // Windows with shutters.
  for (const wx of [8, 32]) {
    p.rect(wx - 3, 31, 3, 10, s.shutter);
    p.rect(wx + 8, 31, 3, 10, s.shutter);
    for (let y = 32; y < 40; y += 2) {
      p.set(wx - 2, y, wc);
      p.set(wx + 9, y, wc);
    }
    p.rect(wx, 31, 8, 10, wc);
    p.rect(wx + 1, 32, 6, 8, '#9ccae2');
    p.rect(wx + 1, 32, 3, 2, '#d8f0fa');
    p.rect(wx + 4, 32, 1, 8, wc);
    p.rect(wx + 1, 36, 6, 1, wc);
    p.rect(wx - 1, 41, 10, 1, wc);
  }
  // Door with a little arch.
  const [da, db] = s.door;
  p.rect(18, 40, 12, 16, wc);
  p.rect(19, 41, 10, 15, da);
  p.rect(20, 40, 8, 1, wc);
  for (const x of [22, 25]) p.rect(x, 42, 1, 14, db);
  p.rect(19, 41, 10, 1, db);
  p.rect(26, 48, 2, 2, '#f4d24a');
  // Emblem sign above the door.
  p.rect(20, 33, 8, 7, '#6e4638');
  p.rect(21, 34, 6, 5, '#e8d8b0');
  s.emblem(p, 20, 33);
  // Doorstep and foundation.
  p.rect(2, 56, 44, 2, '#7a7064');
  p.rect(17, 56, 14, 4, '#9a9284');
  p.rect(17, 56, 14, 1, '#b8b0a2');
  s.extra?.(p);
  p.outline(OUTLINE);
  return p;
}

// ---------- The museum ----------

/** The museum: 80x72 (five tiles wide), base row 71. */
export function drawMuseum(): PixelCanvas {
  const p = new PixelCanvas(80, 72);
  const stone = '#e8e0cc';
  const stoneDark = '#c8bea4';
  const stoneDeep = '#a89e86';
  // Back wall.
  p.rect(6, 28, 68, 36, '#d8ceb4');
  for (let y = 30; y < 64; y += 4) p.rect(6, y, 68, 1, '#c4b89c');
  // Roof (a low pediment) and frieze.
  for (let y = 6; y <= 22; y++) {
    const half = Math.round(8 + ((y - 6) / 16) * 32);
    p.rect(40 - half, y, half * 2, 1, y % 3 === 0 ? stoneDark : stone);
  }
  p.rect(2, 22, 76, 3, stoneDeep);
  p.rect(4, 25, 72, 4, stone);
  p.rect(4, 28, 72, 1, stoneDark);
  for (let x = 6; x < 74; x += 4) p.rect(x, 26, 2, 2, stoneDark);
  // A round emblem in the pediment: a gold sun.
  ellipse(p, 40, 15, 4.5, 4.5, '#e8b83a');
  ellipse(p, 40, 15, 2.5, 2.5, '#fff0a8');
  // Big doors.
  p.rect(32, 40, 16, 24, '#5a3a26');
  p.rect(33, 41, 6, 23, '#7a4e30');
  p.rect(41, 41, 6, 23, '#7a4e30');
  p.rect(39, 52, 2, 2, '#e8b83a');
  p.rect(30, 38, 20, 2, stoneDeep);
  // Windows between the columns.
  for (const wx of [13, 59]) {
    p.rect(wx, 36, 8, 14, stoneDeep);
    p.rect(wx + 1, 37, 6, 12, '#7aa8c8');
    p.rect(wx + 1, 37, 6, 3, '#a8d0e8');
    p.rect(wx + 3, 37, 1, 12, stoneDeep);
  }
  // Red banners.
  for (const bx of [24, 52]) {
    p.rect(bx, 32, 4, 14, '#a83a3a');
    p.set(bx, 46, '#a83a3a');
    p.set(bx + 3, 46, '#a83a3a');
    p.rect(bx + 1, 35, 2, 2, '#e8b83a');
  }
  // Columns.
  for (const cx of [6, 20, 30, 48, 58, 72]) {
    p.rect(cx - 2, 29, 6, 2, stoneDark);
    for (let y = 31; y < 62; y++) {
      p.set(cx - 1, y, stoneDark);
      p.set(cx, y, stone);
      p.set(cx + 1, y, '#f6f0e0');
      p.set(cx + 2, y, stoneDark);
    }
    p.rect(cx - 2, 62, 6, 2, stoneDeep);
  }
  // Steps.
  for (let i = 0; i < 4; i++) {
    const y = 64 + i * 2;
    p.rect(2 + (3 - i) * 0, y, 76, 2, i % 2 ? stoneDark : stone);
    p.rect(2, y + 1, 76, 1, stoneDeep);
  }
  p.outline(OUTLINE);
  return p;
}

// ---------- Home props ----------

/** A brick bread oven with a fire inside, 32x30. */
export function drawOven(): PixelCanvas {
  const p = new PixelCanvas(32, 30);
  ellipse(p, 16, 14, 14, 12, '#b8604a');
  for (let y = 2; y < 28; y += 3) for (let x = 2; x < 31; x++) if (p.filled(x, y)) p.set(x, y, '#8a4232');
  p.rect(2, 20, 28, 10, '#9a5040');
  for (let y = 21; y < 30; y += 3) p.rect(2, y, 28, 1, '#7a3a2a');
  ellipse(p, 16, 17, 6, 5, '#2b1d1a');
  p.rect(10, 17, 13, 5, '#2b1d1a');
  ellipse(p, 16, 20, 4, 2, '#e8812f');
  p.rect(14, 18, 2, 2, '#f4d24a');
  p.rect(17, 19, 2, 1, '#f4d24a');
  p.outline(OUTLINE);
  return p;
}

/** An anvil on a stump, 20x16. */
export function drawAnvil(): PixelCanvas {
  const p = new PixelCanvas(20, 16);
  p.rect(6, 9, 8, 7, '#7a5236');
  p.rect(6, 9, 8, 1, '#a8763f');
  p.rect(2, 3, 16, 3, '#5a5a66');
  p.rect(2, 3, 16, 1, '#8a8a98');
  p.rect(0, 4, 3, 1, '#5a5a66');
  p.rect(7, 6, 6, 3, '#4a4a56');
  p.outline(OUTLINE);
  return p;
}

/** A carpenter's workbench with a plank and tools, 32x20. */
export function drawWorkbench(): PixelCanvas {
  const p = new PixelCanvas(32, 20);
  p.rect(1, 6, 30, 4, '#b8844e');
  p.rect(1, 6, 30, 1, '#d8a46a');
  p.rect(3, 10, 3, 10, '#8a5a32');
  p.rect(26, 10, 3, 10, '#8a5a32');
  p.rect(3, 15, 26, 2, '#8a5a32');
  p.rect(6, 3, 14, 3, '#e0c08a');
  p.rect(22, 2, 2, 4, '#7a5236');
  p.rect(21, 1, 4, 2, '#9aa4ae');
  for (let i = 0; i < 6; i++) p.set(8 + i * 3, 11 + (i % 2), '#e8c88a');
  p.outline(OUTLINE);
  return p;
}

/** Shelves of seed jars, 32x28. */
export function drawSeedShelf(): PixelCanvas {
  const p = new PixelCanvas(32, 28);
  p.rect(0, 0, 32, 28, '#8a5a32');
  p.rect(2, 2, 28, 24, '#5e3a1e');
  const jars = ['#e8b83a', '#6ab04c', '#c46a3a', '#a35bb5', '#e0443e', '#4a62c8', '#d8a050'];
  for (const row of [0, 1, 2]) {
    const y = 3 + row * 8;
    p.rect(2, y + 6, 28, 2, '#a8763f');
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 5;
      p.rect(x, y + 1, 4, 5, '#d8eef4');
      p.rect(x, y + 3, 4, 3, jars[(i + row * 2) % jars.length]);
      p.rect(x, y, 4, 1, '#8a5a32');
    }
  }
  p.outline(OUTLINE);
  return p;
}

/** Fishing nets with floats, hung on a wall, 32x16. */
export function drawWallNets(): PixelCanvas {
  const p = new PixelCanvas(32, 16);
  for (let y = 1; y < 14; y++) for (let x = 1; x < 31; x++) if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) p.set(x, y + Math.round(Math.sin(x / 5)), '#c8b88a');
  p.rect(0, 0, 32, 1, '#7a5236');
  for (const x of [5, 15, 25]) ellipse(p, x, 9, 1.8, 1.8, '#e8473a');
  return p;
}

/** A rocking chair, 16x20. */
export function drawRockingChair(): PixelCanvas {
  const p = new PixelCanvas(16, 20);
  p.rect(3, 1, 10, 9, '#8a5a32');
  for (const x of [5, 8, 11]) p.rect(x, 2, 1, 8, '#6e4638');
  p.rect(2, 10, 12, 3, '#a8703d');
  p.rect(4, 11, 8, 1, '#c86a6a');
  p.rect(3, 13, 1, 4, '#6e4638');
  p.rect(12, 13, 1, 4, '#6e4638');
  p.rect(0, 17, 16, 2, '#6e4638');
  p.set(0, 16, '#6e4638');
  p.set(15, 16, '#6e4638');
  p.outline(OUTLINE);
  return p;
}

/** A tall clock, 12x30. */
export function drawClock(): PixelCanvas {
  const p = new PixelCanvas(12, 30);
  p.rect(1, 0, 10, 30, '#6e4638');
  p.rect(2, 1, 8, 28, '#8a5a32');
  ellipse(p, 6, 6, 3.5, 3.5, '#f3ead8');
  p.rect(6, 4, 1, 3, '#2b1d1a');
  p.rect(6, 6, 2, 1, '#2b1d1a');
  p.rect(4, 12, 4, 12, '#5e3a1e');
  p.rect(5, 19, 2, 3, '#e8b83a');
  p.outline(OUTLINE);
  return p;
}

/** Tools hung on a rack, 32x16 (wall). */
export function drawToolRack(): PixelCanvas {
  const p = new PixelCanvas(32, 16);
  p.rect(0, 1, 32, 2, '#6e4638');
  // Hammer, tongs, saw, file.
  p.rect(4, 3, 1, 10, '#a8703d');
  p.rect(2, 3, 5, 3, '#6a6a78');
  p.rect(11, 3, 1, 11, '#5a5a66');
  p.rect(13, 3, 1, 11, '#5a5a66');
  p.rect(11, 3, 3, 1, '#5a5a66');
  p.rect(18, 3, 2, 4, '#a8703d');
  p.rect(18, 7, 6, 3, '#9aa4ae');
  for (let x = 18; x < 24; x += 2) p.set(x, 10, '#6a7480');
  p.rect(27, 3, 1, 10, '#8a9098');
  p.rect(26, 3, 3, 3, '#7a5236');
  return p;
}

/** A framed old photo, 14x12 (wall). */
export function drawPhoto(): PixelCanvas {
  const p = new PixelCanvas(14, 12);
  p.rect(0, 0, 14, 12, '#8a5a32');
  p.rect(1, 1, 12, 10, '#e8dcc0');
  p.rect(2, 2, 10, 8, '#c8b48a');
  p.rect(4, 4, 2, 5, '#6e5a42');
  p.rect(8, 4, 2, 5, '#6e5a42');
  p.rect(4, 3, 2, 1, '#8a7656');
  p.rect(8, 3, 2, 1, '#8a7656');
  p.rect(2, 8, 10, 2, '#9a8462');
  return p;
}

// ---------- Museum props ----------

/** A stone pedestal for one exhibit, 16x14. */
export function drawPedestal(): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  p.rect(1, 0, 14, 3, '#e8e0cc');
  p.rect(1, 2, 14, 1, '#c8bea4');
  p.rect(3, 3, 10, 8, '#d8ceb4');
  p.rect(3, 3, 2, 8, '#f0e8d4');
  p.rect(11, 3, 2, 8, '#b8ae94');
  p.rect(1, 11, 14, 3, '#c8bea4');
  p.rect(1, 13, 14, 1, '#a89e86');
  p.outline(OUTLINE);
  return p;
}

/** A curator's perch and desk for the museum owl, 28x24. */
export function drawCuratorDesk(): PixelCanvas {
  const p = new PixelCanvas(28, 24);
  p.rect(0, 10, 28, 12, '#7a4e30');
  p.rect(0, 10, 28, 2, '#a8703d');
  p.rect(2, 13, 24, 7, '#5e3a1e');
  p.rect(3, 6, 6, 4, '#f3ead8');
  p.rect(3, 6, 6, 1, '#c8b88a');
  p.rect(18, 4, 2, 6, '#6e4638');
  p.rect(14, 3, 10, 2, '#8a5a32');
  p.rect(22, 7, 3, 3, '#e8b83a');
  p.rect(0, 22, 28, 2, '#3a2418');
  p.outline(OUTLINE);
  return p;
}

/** A hanging banner, 14x26 (wall). */
export function drawBanner(color: string, trim: string): PixelCanvas {
  const p = new PixelCanvas(14, 26);
  p.rect(0, 0, 14, 2, '#6e4638');
  p.rect(1, 2, 12, 20, color);
  for (let i = 0; i < 6; i++) {
    p.set(1 + i, 22 + i, color);
    p.set(12 - i, 22 + i, color);
  }
  p.rect(1, 2, 12, 1, trim);
  p.rect(3, 8, 8, 1, trim);
  ellipse(p, 7, 14, 2.5, 2.5, trim);
  return p;
}

// ---------- The island ----------

/** The parrot on its perch, 14x24 (frame 1 = head bobbed down). */
export function drawParrot(frame: number): PixelCanvas {
  const p = new PixelCanvas(14, 24);
  p.rect(6, 12, 2, 12, '#8a5a32');
  p.rect(2, 22, 10, 2, '#6e4638');
  p.rect(1, 11, 12, 2, '#a8703d');
  const dy = frame ? 1 : 0;
  ellipse(p, 7, 7 + dy, 3, 4, '#e0443e');
  p.rect(5, 8 + dy, 5, 3, '#4a62c8');
  p.rect(6, 9 + dy, 3, 2, '#f4d24a');
  ellipse(p, 7, 3 + dy, 2.5, 2.5, '#e0443e');
  p.set(8, 3 + dy, '#ffffff');
  p.set(8, 2 + dy, '#2b1d1a');
  p.rect(9, 3 + dy, 2, 2, '#f0e4c8');
  p.set(10, 5 + dy, '#2b1d1a');
  p.rect(6, 11, 1, 1, '#4a62c8');
  p.rect(7, 10 + dy, 1, 2, '#2a3a8a');
  p.outline(OUTLINE);
  return p;
}

/** A wooden trade crate (an item icon is drawn on it by the scene), 16x14. */
export function drawCrate(): PixelCanvas {
  const p = new PixelCanvas(16, 14);
  p.rect(0, 0, 16, 14, '#b8844e');
  p.rect(0, 0, 16, 2, '#d8a46a');
  p.rect(0, 6, 16, 1, '#8a5a32');
  p.rect(0, 12, 16, 2, '#8a5a32');
  p.rect(1, 2, 1, 10, '#8a5a32');
  p.rect(14, 2, 1, 10, '#8a5a32');
  p.outline(OUTLINE);
  return p;
}

/** A bamboo hut with a thatched roof, 48x44. */
export function drawHut(): PixelCanvas {
  const p = new PixelCanvas(48, 44);
  for (let x = 6; x < 42; x++) {
    for (let y = 20; y < 42; y++) p.set(x, y, x % 4 === 0 ? '#a88a4a' : x % 4 === 1 ? '#d8c07a' : '#c8aa62');
  }
  for (let y = 26; y < 42; y += 7) p.rect(6, y, 36, 1, '#8a6a32');
  for (let y = 2; y <= 22; y++) {
    const half = Math.round(6 + ((y - 2) / 20) * 20);
    for (let x = 24 - half; x < 24 + half; x++) p.set(x, y, (x + y * 3) % 5 === 0 ? '#a8823a' : y % 4 === 0 ? '#c8a050' : '#d8b460');
  }
  for (let x = 2; x < 46; x += 2) p.set(x, 22 + (x % 4 ? 1 : 0), '#a8823a');
  p.rect(20, 28, 9, 14, '#3a2418');
  p.rect(9, 27, 8, 7, '#3a2418');
  p.rect(10, 28, 6, 5, '#5a8aa8');
  p.rect(31, 30, 7, 3, '#e0443e');
  p.outline(OUTLINE);
  return p;
}

/** The rock face with the cave mouth (open) or the mouth behind a cracked boulder, 64x48. */
export function drawCliff(): PixelCanvas {
  const p = new PixelCanvas(64, 48);
  for (let y = 0; y < 48; y++) {
    const inset = Math.round(Math.abs(Math.sin(y * 0.3)) * 3 + (y < 10 ? (10 - y) * 1.6 : 0));
    for (let x = inset; x < 64 - inset; x++) {
      const n = noise(x >> 2, y >> 2, 3);
      p.set(x, y, n < 0.3 ? '#7a6e62' : n < 0.7 ? '#8e8272' : '#a29684');
    }
  }
  for (let i = 0; i < 40; i++) p.set(Math.floor(noise(i, 1) * 60) + 2, Math.floor(noise(i, 2) * 44) + 2, '#5e544a');
  // Vines.
  for (const vx of [8, 14, 50, 56]) for (let y = 0; y < 26 + (vx % 3) * 4; y++) if (p.filled(vx + Math.round(Math.sin(y / 3)), y)) p.set(vx + Math.round(Math.sin(y / 3)), y, y % 3 ? '#3f8a3a' : '#5aaa4a');
  // The mouth.
  ellipse(p, 32, 40, 12, 14, '#15100c');
  p.rect(20, 40, 25, 8, '#15100c');
  ellipse(p, 32, 42, 8, 10, '#0a0806');
  p.outline(OUTLINE);
  return p;
}

/** A cracked boulder blocking the cave, 28x24. */
export function drawBoulder(): PixelCanvas {
  const p = new PixelCanvas(28, 24);
  ellipse(p, 14, 13, 13, 10.5, '#8a8072');
  ellipse(p, 11, 10, 8, 6, '#a29888');
  ellipse(p, 9, 8, 3, 2, '#b8ae9e');
  for (const [x, y] of [[14, 4], [15, 5], [15, 6], [14, 7], [15, 8], [16, 9], [17, 10], [16, 11], [17, 12], [18, 13], [13, 9], [12, 10], [11, 11]]) p.set(x, y, '#3a3028');
  p.outline(OUTLINE);
  return p;
}

/** A tiki torch, 8x26 (the flame flickers via tint). */
export function drawTikiTorch(): PixelCanvas {
  const p = new PixelCanvas(8, 26);
  p.rect(3, 8, 2, 18, '#8a5a32');
  p.rect(2, 6, 4, 4, '#a8823a');
  p.rect(2, 7, 4, 1, '#6e4638');
  ellipse(p, 4, 3, 2.2, 3, '#e8812f');
  p.rect(3, 2, 2, 3, '#f4d24a');
  return p;
}

/** A hibiscus bush, 14x12. */
export function drawHibiscus(color: string): PixelCanvas {
  const p = new PixelCanvas(14, 12);
  ellipse(p, 7, 7, 6.5, 4.5, '#2f7a3a');
  ellipse(p, 6, 6, 4, 3, '#3f9a4a');
  for (const [x, y] of [[3, 5], [9, 4], [7, 8], [11, 7]]) {
    p.rect(x - 1, y, 3, 1, color);
    p.rect(x, y - 1, 1, 3, color);
    p.set(x, y, '#f4d24a');
  }
  p.outline(OUTLINE);
  return p;
}

/** Island crops by stage (0 sprout … 3 ripe), 16x16 standing on row 15. */
export function drawIslandCrop(id: 'pineapple' | 'taro', stage: number): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  if (id === 'pineapple') {
    const leaves = [2, 4, 6, 7][stage];
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 1.6;
      for (let t = 0; t < leaves; t++) p.set(Math.round(8 + dx * (t / leaves) * 2), 15 - t, i % 2 ? '#3f8a4a' : '#5aaa5a');
    }
    if (stage >= 2) {
      const r = stage === 3 ? 3.2 : 2;
      ellipse(p, 8, 11 - leaves / 3, r - 0.6, r, stage === 3 ? '#e8b83a' : '#8aa83a');
      if (stage === 3) for (const [x, y] of [[7, 9], [9, 10], [8, 12]]) p.set(x, y, '#a8823a');
      p.rect(7, Math.round(7 - leaves / 3), 3, 2, '#3f8a4a');
    }
  } else {
    const h = [3, 6, 9, 11][stage];
    for (const [dx, lean] of [[-3, -1], [0, 0], [3, 1]] as const) {
      for (let t = 0; t < h; t++) p.set(8 + dx + Math.round((lean * t) / 4), 15 - t, '#4a7a3a');
      if (stage >= 1) ellipse(p, 8 + dx + lean * 2, 15 - h, 2.5, 1.6, '#3f9a4a');
    }
    if (stage === 3) {
      ellipse(p, 8, 14, 3, 1.6, '#8a6a9a');
      p.set(7, 14, '#b08ac0');
    }
  }
  p.outline(OUTLINE);
  return p;
}

/** A sea turtle, 22x14 (frame 0/1 flippers). */
export function drawTurtle(frame: number): PixelCanvas {
  const p = new PixelCanvas(22, 14);
  const f = frame ? 1 : 0;
  // Flippers.
  p.rect(3 - f, 2 + f, 4, 2, '#5a9a6a');
  p.rect(3 + f, 10 - f, 4, 2, '#5a9a6a');
  p.rect(13 + f, 2 + f, 3, 2, '#5a9a6a');
  p.rect(13 - f, 10 - f, 3, 2, '#5a9a6a');
  ellipse(p, 10, 7, 7, 4.5, '#6a5a32');
  for (const [x, y] of [[7, 5], [10, 4], [13, 6], [9, 8], [12, 9], [6, 8]]) {
    p.rect(x, y, 2, 2, '#8a7a42');
  }
  ellipse(p, 18.5, 7, 2.5, 2, '#6aaa7a');
  p.set(19, 6, '#2b1d1a');
  p.rect(1, 7, 2, 1, '#5a9a6a');
  p.outline(OUTLINE);
  return p;
}

/** The giant clam in the cave pool, 24x14 (open shows the pearl). */
export function drawClam(open: boolean): PixelCanvas {
  const p = new PixelCanvas(24, 14);
  for (let i = 0; i < 6; i++) p.rect(2 + i, 13 - i, 20 - i * 2, 1, i % 2 ? '#7a9ab0' : '#9ab8c8');
  for (let x = 3; x < 22; x += 3) p.rect(x, 8, 1, 5, '#5a7a90');
  if (open) {
    for (let i = 0; i < 5; i++) p.rect(3 + i, 2 + i, 18 - i * 2, 1, '#9ab8c8');
    p.rect(5, 6, 14, 2, '#e8c8d0');
    ellipse(p, 12, 6, 2, 2, '#f6f0ff');
    p.set(11, 5, '#ffffff');
  } else {
    p.rect(3, 7, 18, 1, '#5a7a90');
  }
  p.outline(OUTLINE);
  return p;
}

/** A crystal rock in the cave: ruby, jade or plain stone, 16x16. */
export function drawCrystalRock(kind: 'ruby' | 'jade' | 'plain'): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  ellipse(p, 8, 10, 7, 5.5, '#5e5a66');
  ellipse(p, 7, 9, 5, 3.6, '#76727e');
  const [c, l] = kind === 'ruby' ? ['#c8283a', '#ff7a8a'] : kind === 'jade' ? ['#2a9a6a', '#7ae8b0'] : ['#8a86a0', '#c8c4d8'];
  for (const [x, y, h] of [[5, 6, 4], [8, 3, 6], [11, 6, 3]]) {
    p.rect(x, y, 2, h, c);
    p.set(x, y, l);
    p.set(x, y + 1, l);
  }
  p.outline(OUTLINE);
  return p;
}

/** The ancient chest, 20x16. */
export function drawIdolChest(open: boolean): PixelCanvas {
  const p = new PixelCanvas(20, 16);
  p.rect(1, 7, 18, 9, '#5e4a2a');
  p.rect(1, 7, 18, 1, '#8a6a3a');
  for (const x of [1, 9, 17]) p.rect(x, 7, 2, 9, '#c8982a');
  if (open) {
    p.rect(1, 1, 18, 4, '#5e4a2a');
    p.rect(1, 1, 18, 1, '#8a6a3a');
    p.rect(3, 5, 14, 3, '#f4d24a');
    p.set(6, 5, '#ffffff');
  } else {
    p.rect(1, 3, 18, 5, '#6e5632');
    p.rect(1, 3, 18, 1, '#9a7a42');
    p.rect(8, 6, 4, 4, '#e8b83a');
  }
  p.outline(OUTLINE);
  return p;
}

/** A glowing crystal cluster (cave decor and a light), 12x14. */
export function drawGlowCrystal(color: string, light: string): PixelCanvas {
  const p = new PixelCanvas(12, 14);
  for (const [x, y, h] of [[2, 6, 7], [5, 1, 12], [8, 4, 9]]) {
    p.rect(x, y, 2, h, color);
    p.set(x, y, light);
    p.set(x + 1, y + 1, light);
  }
  p.rect(1, 12, 10, 2, '#4a4652');
  p.outline(OUTLINE);
  return p;
}

// ---------- Museum showpieces ----------

const BONE = '#efe6cf';
const BONE_DARK = '#c8bc9c';

/** A dinosaur skeleton on a low plinth: the museum's centrepiece, 72x52. */
export function drawDinoSkeleton(): PixelCanvas {
  const p = new PixelCanvas(72, 52);
  // Plinth.
  p.rect(2, 44, 68, 8, '#8a6a4a');
  p.rect(2, 44, 68, 2, '#a8885e');
  p.rect(4, 48, 64, 1, '#6e5236');
  // Support poles.
  for (const x of [22, 46]) p.rect(x, 28, 2, 16, '#6a6272');
  // Spine: a long arch from tail to neck.
  for (let x = 6; x <= 56; x++) {
    const t = (x - 6) / 50;
    const y = Math.round(30 - Math.sin(t * Math.PI) * 10 - (x > 46 ? (x - 46) * 0.9 : 0));
    p.rect(x, y, 1, 2, BONE);
    if (x % 3 === 0) p.set(x, y - 1, BONE_DARK);
  }
  // Ribs hanging from the middle of the spine.
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 4;
    const t = (x - 6) / 50;
    const top = Math.round(30 - Math.sin(t * Math.PI) * 10) + 2;
    const len = 9 - Math.abs(i - 3);
    for (let k = 0; k < len; k++) p.set(x + Math.round(k / 4), top + k, k === len - 1 ? BONE_DARK : BONE);
  }
  // Skull with an open jaw and an eye socket.
  p.rect(56, 11, 10, 6, BONE);
  p.rect(64, 13, 4, 3, BONE);
  p.rect(57, 17, 9, 2, BONE_DARK);
  p.set(59, 13, '#2b1d1a');
  p.set(60, 13, '#2b1d1a');
  for (const x of [61, 63, 65]) p.set(x, 16, '#ffffff');
  // Legs (big back legs, little front arms).
  const leg = (x: number, top: number, len: number) => {
    for (let k = 0; k < len; k++) p.rect(x + (k > len / 2 ? 1 : 0), top + k, 2, 1, BONE);
    p.rect(x - 1, top + len, 5, 1, BONE_DARK);
  };
  leg(24, 26, 17);
  leg(32, 25, 18);
  for (let k = 0; k < 5; k++) p.set(48 + k, 24 + k, BONE);
  // Tail tip.
  p.rect(3, 31, 4, 1, BONE);
  p.outline(OUTLINE);
  return p;
}

/** A model sailing ship in a glass case on a stand, 36x34. */
export function drawShipCase(): PixelCanvas {
  const p = new PixelCanvas(36, 34);
  p.rect(4, 24, 28, 10, '#6e4638');
  p.rect(4, 24, 28, 2, '#8a5a32');
  p.rect(6, 28, 24, 4, '#5a3a26');
  // Glass box.
  p.rect(2, 2, 32, 22, '#cfe8f0');
  for (let y = 3; y < 23; y++) for (let x = 3; x < 33; x++) p.set(x, y, (x + y) % 9 === 0 ? '#ffffff' : '#bcdde8');
  // Ship: hull, masts and sails.
  p.rect(7, 17, 22, 3, '#7a4e30');
  p.rect(9, 20, 18, 1, '#5a3a26');
  for (const x of [13, 22]) p.rect(x, 5, 1, 12, '#5a3a26');
  for (const [x, w] of [
    [10, 7],
    [19, 7],
  ] as const) {
    p.rect(x, 6, w, 4, '#f6f0e0');
    p.rect(x + 1, 11, w - 2, 4, '#f6f0e0');
  }
  p.rect(22, 3, 4, 2, '#d8342a');
  p.rect(2, 2, 32, 1, '#e8f6fa');
  p.outline(OUTLINE);
  return p;
}

/** A big globe on a wooden stand, 18x26. */
export function drawGlobe(): PixelCanvas {
  const p = new PixelCanvas(18, 26);
  p.rect(6, 22, 6, 4, '#6e4638');
  p.rect(8, 16, 2, 6, '#8a5a32');
  for (let y = 1; y <= 15; y++) for (let x = 1; x <= 16; x++) if (((x - 8.5) / 7) ** 2 + ((y - 8) / 7) ** 2 <= 1) p.set(x, y, '#4a8ac8');
  for (const [x, y, w, h] of [
    [4, 4, 4, 3],
    [5, 7, 3, 4],
    [10, 5, 4, 2],
    [11, 8, 3, 4],
    [7, 12, 2, 1],
  ]) p.rect(x, y, w, h, '#6ab04c');
  p.rect(5, 3, 2, 1, '#bfe0ff');
  for (let a = 0; a < 20; a++) p.set(Math.round(8.5 + Math.cos(a / 3.2) * 8.4), Math.round(8 + Math.sin(a / 3.2) * 8.4), '#c8982a');
  p.outline(OUTLINE);
  return p;
}

/** A framed map of the valley for the wall, 40x24. */
export function drawValleyMap(): PixelCanvas {
  const p = new PixelCanvas(40, 24);
  p.rect(0, 0, 40, 24, '#7a4e30');
  p.rect(2, 2, 36, 20, '#ecdcb0');
  // River, forest, path, sea and a little cottage.
  for (let x = 2; x < 38; x++) p.set(x, 11 + Math.round(Math.sin(x / 4) * 2), '#5a9ac8');
  for (const [x, y] of [[5, 5], [7, 4], [9, 6], [6, 7], [11, 5]]) p.rect(x, y, 2, 2, '#4a8a3a');
  for (let x = 4; x < 32; x++) p.set(x, 17, '#b0905a');
  p.rect(33, 3, 5, 18, '#7ab8d8');
  p.rect(20, 14, 3, 2, '#c86a4a');
  p.rect(24, 5, 2, 2, '#8a8478');
  p.set(14, 17, '#d8342a');
  p.rect(13, 16, 3, 1, '#d8342a');
  return p;
}

/** A brass rope post, 6x14 (ropes are drawn between posts by the scene). */
export function drawRopePost(): PixelCanvas {
  const p = new PixelCanvas(6, 14);
  p.rect(2, 2, 2, 10, '#c8982a');
  p.rect(1, 0, 4, 2, '#e8b83a');
  p.rect(0, 12, 6, 2, '#a87a1c');
  p.outline(OUTLINE);
  return p;
}

/** A glass display case on legs (the scene puts items inside), 32x22. */
export function drawGlassCase(): PixelCanvas {
  const p = new PixelCanvas(32, 22);
  p.rect(2, 14, 28, 4, '#6e4638');
  p.rect(3, 18, 2, 4, '#5a3a26');
  p.rect(27, 18, 2, 4, '#5a3a26');
  p.rect(1, 2, 30, 12, '#cfe8f0');
  for (let y = 3; y < 13; y++) for (let x = 2; x < 30; x++) p.set(x, y, (x - y + 40) % 11 === 0 ? '#ffffff' : '#bcdde8');
  p.rect(2, 11, 28, 3, '#8a2a2a');
  p.rect(1, 2, 30, 1, '#e8f6fa');
  p.outline(OUTLINE);
  return p;
}
