import type { PixelCanvas } from './PixelCanvas';

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Recolours the fruit of a crop or icon: every coloured pixel takes the new
 * hue, with its saturation scaled and lightness shifted, keeping its shading.
 * Leaves (greens), near-greys (seed-packet paper, white highlights) and the
 * dark outline are left alone, so the plant still reads as itself.
 */
export function colorize(p: PixelCanvas, look: { hue: number; sat: number; light: number }): void {
  const d = p.data;
  for (let o = 0; o < d.length; o += 4) {
    if (d[o + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(d[o], d[o + 1], d[o + 2]);
    if (l < 0.16 || s < 0.14) continue;
    if (h >= 70 && h <= 170) continue;
    const [r, g, b] = hslToRgb(((look.hue % 360) + 360) % 360, clamp(s * look.sat), clamp(l + look.light));
    d[o] = r;
    d[o + 1] = g;
    d[o + 2] = b;
  }
}

/** The little gold star on heirloom seed packets. */
export function heirloomStar(p: PixelCanvas): void {
  for (const [x, y] of [[13, 0], [12, 1], [13, 1], [14, 1], [13, 2]] as const) p.set(x, y, '#f4d24a');
  p.set(13, 1, '#fff1a8');
}
