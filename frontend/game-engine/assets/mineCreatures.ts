import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';

/**
 * Art for the deeper mine: the eight newer monsters, their projectiles, and
 * the zone hazards (crystals, lava cracks, flames, cracked walls, the vault key).
 * Sheets are laid out left to right, one frame after another.
 */

const ellipse = (p: PixelCanvas, ox: number, cx: number, cy: number, rx: number, ry: number, color: (x: number, y: number) => string | null) => {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1) continue;
      const c = color(x, y);
      if (c) p.set(ox + x, y, c);
    }
  }
};

/** Spitter slime: a slime with a little spout on top. Frame 1 is swollen, about to spit. Drawn pale to tint. 2 × 14x12. */
export function drawSpitterSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 12);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    const rx = f === 0 ? 6 : 6.5;
    const ry = f === 0 ? 5 : 6;
    ellipse(p, ox, 6.5, 11 - ry, rx, ry, (_x, y) => (y < 11 - ry * 1.4 ? '#ffffff' : y > 9 ? '#b0b0b0' : '#dcdcdc'));
    // The spout.
    p.rect(ox + 6, 11 - ry * 2 - 1, 2, 2, '#c8c8c8');
    p.set(ox + 6, 11 - ry * 2 - 2, '#ffffff');
    p.set(ox + 4, 8, '#1a1412');
    p.set(ox + 9, 8, '#1a1412');
    p.rect(ox + 6, 10, 2, 1, '#5a3a3a');
  }
  p.outline(P.outline);
  return p;
}

/** Burrower: a stubby mole with digging claws and a pink nose. 2 × 14x12 (claws up / down). */
export function drawBurrowerSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 12);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    ellipse(p, ox, 6.5, 7, 5.5, 4.5, (_x, y) => (y < 5 ? '#8a6a52' : '#6e5240'));
    p.rect(ox + 6, 9, 2, 1, '#e88a9a');
    p.set(ox + 4, 6, '#1a1412');
    p.set(ox + 9, 6, '#1a1412');
    const cy = f === 0 ? 7 : 9;
    p.rect(ox + 0, cy, 2, 2, '#e8d8b8');
    p.rect(ox + 12, cy, 2, 2, '#e8d8b8');
    p.set(ox + 0, cy + 2, '#e8d8b8');
    p.set(ox + 13, cy + 2, '#e8d8b8');
  }
  p.outline(P.outline);
  return p;
}

/** The burrower underground: a moving mound of dirt (frame 1: shaking, about to pop up). 2 × 14x7. */
export function drawMoundSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 7);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    ellipse(p, ox, 6.5, 6, f === 0 ? 5.5 : 6.5, f === 0 ? 3.5 : 4.5, (x, y) => (y < 4 ? '#7a6250' : (x + y) % 3 === 0 ? '#4e3e32' : '#5e4a3c'));
    if (f === 1) {
      p.set(ox + 2, 1, '#7a6250');
      p.set(ox + 11, 2, '#7a6250');
    }
  }
  return p;
}

/** Crystal beetle, seen from above and facing right (it's rotated to face where it walks). 2 × 14x14 (legs). */
export function drawBeetleSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 14);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    // Legs.
    const off = f === 0 ? 0 : 1;
    for (const x of [3, 6, 9]) {
      p.set(ox + x + off, 2, '#2a2236');
      p.set(ox + x - off, 11, '#2a2236');
    }
    // Shell (crystal, at the front) and body.
    ellipse(p, ox, 6, 7, 4.5, 4, (x) => (x < 5 ? '#4a3a5e' : '#5a4a70'));
    ellipse(p, ox, 9.5, 7, 3, 4.2, (x, y) => (y < 6 ? '#f0e0ff' : x > 10 ? '#b890e8' : '#d8b8ff'));
    p.set(ox + 9, 5, '#ffffff');
    p.set(ox + 12, 7, '#ffffff');
    // Head and eyes at the very front.
    p.rect(ox + 12, 6, 2, 3, '#3a2e4a');
    p.set(ox + 13, 6, '#f05a4a');
    p.set(ox + 13, 8, '#f05a4a');
  }
  p.outline(P.outline);
  return p;
}

/** Cave eel: frame 0 just its head breaking the surface, frame 1 lunging out. 2 × 12x16. */
export function drawEelSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 16);
  for (let f = 0; f < 2; f++) {
    const ox = f * 12;
    const top = f === 0 ? 10 : 1;
    for (let y = top; y < 15; y++) {
      const wobble = f === 1 ? Math.round(Math.sin(y / 2) * 1.2) : 0;
      p.rect(ox + 4 + wobble, y, 4, 1, y < top + 3 ? '#4ab0a0' : '#3a8a7e');
      p.set(ox + 7 + wobble, y, '#2a6a62');
    }
    p.set(ox + 5, top + 1, '#ffe27a');
    p.set(ox + 7, top + 1, '#ffe27a');
    if (f === 1) {
      p.rect(ox + 5, top + 3, 3, 1, '#1a1412');
      p.set(ox + 5, top + 4, '#ffffff');
      p.set(ox + 7, top + 4, '#ffffff');
    }
    // Ripples where it meets the water.
    p.rect(ox + 1, 15, 10, 1, '#a8e0f0');
  }
  p.outline(P.outline);
  return p;
}

/** Fuse cap mushroom: frame 1 swollen and glowing, about to burst. 2 × 12x14. */
export function drawFusecapSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 14);
  for (let f = 0; f < 2; f++) {
    const ox = f * 12;
    p.rect(ox + 4, 8, 4, 6, f === 0 ? '#e8dcc8' : '#fff4e0');
    p.rect(ox + 7, 8, 1, 6, '#c8b8a0');
    const swell = f === 0 ? 0 : 1;
    ellipse(p, ox, 5.5, 6, 5 + swell, 4 + swell * 0.5, (_x, y) => (f === 1 ? (y < 4 ? '#fff0a0' : '#ff7a3a') : y < 4 ? '#f05a4a' : '#c83a32'));
    for (const [x, y] of [[3, 4], [7, 3], [5, 6], [9, 6]] as const) p.set(ox + x, y, '#ffffff');
    p.rect(ox + 5, 1 - swell, 1, 2, '#3a2a20');
    p.set(ox + 5, 0, f === 1 ? '#ffe27a' : '#f0a040');
  }
  p.outline(P.outline);
  return p;
}

/** Lantern thief: a small big-eared imp; frame 1 carries a stolen light. 2 × 12x12. */
export function drawThiefSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 12);
  for (let f = 0; f < 2; f++) {
    const ox = f * 12;
    ellipse(p, ox, 5.5, 7, 3.5, 4, () => '#6a7a5a');
    p.rect(ox + 1, 3, 2, 2, '#6a7a5a');
    p.rect(ox + 9, 3, 2, 2, '#6a7a5a');
    p.set(ox + 0, 2, '#6a7a5a');
    p.set(ox + 11, 2, '#6a7a5a');
    p.set(ox + 4, 6, '#ffe27a');
    p.set(ox + 7, 6, '#ffe27a');
    p.rect(ox + 4, 8, 4, 1, '#2a2020');
    p.set(ox + 5, 9, '#ffffff');
    if (f === 1) {
      p.rect(ox + 9, 7, 3, 4, '#ffe27a');
      p.rect(ox + 10, 8, 1, 2, '#ffffff');
      p.set(ox + 10, 6, '#8a6a3a');
    }
  }
  p.outline(P.outline);
  return p;
}

/** Mimic: a chest (0), its lid twitching (1), and open with teeth (2). 3 × 16x14. */
export function drawMimicSheet(): PixelCanvas {
  const p = new PixelCanvas(48, 14);
  for (let f = 0; f < 3; f++) {
    const ox = f * 16;
    p.rect(ox + 1, 6, 14, 8, '#8a5a2a');
    p.rect(ox + 1, 9, 14, 1, '#e8c25a');
    if (f < 2) {
      const lift = f === 1 ? 1 : 0;
      p.rect(ox + 1, 2 - lift, 14, 4, '#a86a32');
      p.rect(ox + 1, 2 - lift, 14, 1, '#c8884a');
      p.rect(ox + 7, 5 - lift, 2, 3, '#e8c25a');
      if (f === 1) p.rect(ox + 2, 5, 12, 1, '#2a0e0e');
    } else {
      p.rect(ox + 1, 0, 14, 3, '#6a4220');
      p.rect(ox + 2, 4, 12, 4, '#4a0e12');
      for (let x = 2; x < 14; x += 2) {
        p.set(ox + x, 3, '#ffffff');
        p.set(ox + x + 1, 7, '#ffffff');
      }
      p.rect(ox + 6, 6, 4, 2, '#e85a7a');
      p.set(ox + 4, 1, '#ffe27a');
      p.set(ox + 11, 1, '#ffe27a');
    }
  }
  p.outline(P.outline);
  return p;
}

/** Magma imp: frame 1 has a fireball raised overhead (about to throw). 2 × 12x14. */
export function drawImpSheet(): PixelCanvas {
  const p = new PixelCanvas(24, 14);
  for (let f = 0; f < 2; f++) {
    const ox = f * 12;
    ellipse(p, ox, 5.5, 9, 3.5, 4.5, (_x, y) => (y < 8 ? '#e0583a' : '#b83a2a'));
    p.set(ox + 3, 4, '#3a1a14');
    p.set(ox + 8, 4, '#3a1a14');
    p.set(ox + 3, 3, '#3a1a14');
    p.set(ox + 8, 3, '#3a1a14');
    p.set(ox + 4, 8, '#ffe27a');
    p.set(ox + 7, 8, '#ffe27a');
    p.rect(ox + 4, 11, 4, 1, '#3a1a14');
    if (f === 1) {
      p.rect(ox + 9, 2, 3, 3, '#ffb03a');
      p.set(ox + 10, 1, '#fff0a0');
      p.rect(ox + 9, 5, 1, 3, '#b83a2a');
    } else {
      p.rect(ox + 9, 9, 1, 3, '#b83a2a');
    }
  }
  p.outline(P.outline);
  return p;
}

/** A blob of goo (6x6). */
export function drawGoo(): PixelCanvas {
  const p = new PixelCanvas(6, 6);
  ellipse(p, 0, 2.5, 2.5, 2.5, 2.5, (_x, y) => (y < 2 ? '#c8f0a0' : '#7ab84a'));
  p.outline(P.outline);
  return p;
}

/** A fireball (8x8). */
export function drawFireball(): PixelCanvas {
  const p = new PixelCanvas(8, 8);
  ellipse(p, 0, 3.5, 3.5, 3.5, 3.5, (x, y) => (Math.hypot(x - 3.5, y - 3.5) < 1.6 ? '#fff0a0' : Math.hypot(x - 3.5, y - 3.5) < 2.6 ? '#ffb03a' : '#e0583a'));
  return p;
}

/** A thrown boulder (12x11). */
export function drawBoulder(): PixelCanvas {
  const p = new PixelCanvas(12, 11);
  ellipse(p, 0, 5.5, 5.5, 5.5, 5, (x, y) => (y < 4 && x < 7 ? '#b0a8a0' : (x + y) % 5 === 0 ? '#6a625a' : '#8a8078'));
  p.outline(P.outline);
  return p;
}

/** Flames on the floor (where a fireball landed), 2 frames 14x10. */
export function drawFlameSheet(): PixelCanvas {
  const p = new PixelCanvas(28, 10);
  for (let f = 0; f < 2; f++) {
    const ox = f * 14;
    const tips = f === 0 ? [3, 7, 11] : [2, 6, 10];
    for (const tx of tips) {
      for (let y = 2; y < 10; y++) {
        const w = Math.max(0, Math.round((y - 2) / 2));
        for (let dx = -w; dx <= w; dx++) p.set(ox + tx + dx, y, y < 5 ? '#fff0a0' : y < 8 ? '#ffb03a' : '#e0583a');
      }
    }
  }
  return p;
}

/** A glowing crack in the floor of the Molten Core (16x16; drawn above the dark so it glows). */
export function drawLavaCrack(variant: number): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  let x = 2 + (variant % 3) * 3;
  for (let y = 1; y < 15; y++) {
    x = Math.max(1, Math.min(14, x + ((y * 7 + variant * 3) % 3) - 1));
    p.set(x, y, '#ffb03a');
    p.set(x + 1, y, y % 3 === 0 ? '#fff0a0' : '#e0583a');
    if (y % 4 === variant % 4) p.rect(x - 2, y, 2, 1, '#e0583a');
  }
  return p;
}

/** A glowing crystal cluster (10x14), two shapes. */
export function drawCrystal(variant: number): PixelCanvas {
  const p = new PixelCanvas(10, 14);
  const spikes = variant === 0 ? [[2, 6], [5, 0], [7, 4]] : [[1, 4], [4, 2], [7, 7]];
  for (const [sx, top] of spikes) {
    for (let y = top; y < 14; y++) {
      const w = y - top < 2 ? 0 : 1;
      for (let dx = -w; dx <= w; dx++) p.set(sx + dx + 1, y, dx < 0 ? '#e8d0ff' : dx > 0 ? '#9a6ad0' : '#c8a0f8');
    }
  }
  p.outline(P.outline);
  return p;
}

/** A crack in a wall face: a hidden shortcut down (16x16). */
export function drawCrackedWall(): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  const path = [[8, 4], [7, 5], [7, 6], [8, 7], [9, 8], [8, 9], [7, 10], [7, 11], [8, 12], [9, 13]];
  for (const [x, y] of path) {
    p.set(x, y, '#120c0a');
    p.set(x + 1, y, '#5e5048');
  }
  p.rect(5, 8, 2, 1, '#120c0a');
  p.rect(10, 10, 2, 1, '#120c0a');
  return p;
}

/** The vault key (8x8). */
export function drawVaultKey(): PixelCanvas {
  const p = new PixelCanvas(8, 8);
  ellipse(p, 0, 2, 2, 2, 2, (x, y) => (x === 2 && y === 2 ? null : '#ffd75a'));
  p.rect(3, 3, 4, 1, '#ffd75a');
  p.rect(6, 3, 1, 3, '#ffd75a');
  p.rect(4, 3, 1, 2, '#ffd75a');
  p.outline(P.outline);
  return p;
}
