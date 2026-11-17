/**
 * Minimal RGBA pixel buffer used to author pixel art in code. Drawing happens
 * on a typed array (fast, exact, no anti-aliasing) and is converted to a
 * canvas once, at boot, for Phaser to upload as a texture.
 */

type Rgb = readonly [number, number, number];
const colorCache = new Map<string, Rgb>();

function parseHex(hex: string): Rgb {
  let rgb = colorCache.get(hex);
  if (!rgb) {
    const v = parseInt(hex.slice(1), 16);
    rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    colorCache.set(hex, rgb);
  }
  return rgb;
}

export class PixelCanvas {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  set(x: number, y: number, color: string, alpha = 255): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inBounds(x, y)) return;
    const [r, g, b] = parseHex(color);
    const o = (y * this.width + x) * 4;
    this.data[o] = r;
    this.data[o + 1] = g;
    this.data[o + 2] = b;
    this.data[o + 3] = alpha;
  }

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color, alpha);
  }

  alphaAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  filled(x: number, y: number): boolean {
    return this.alphaAt(x, y) > 0;
  }

  /** Raw copy of one pixel (including transparency) from another canvas. */
  copyPixel(src: PixelCanvas, sx: number, sy: number, dx: number, dy: number): void {
    if (!src.inBounds(sx, sy) || !this.inBounds(dx, dy)) return;
    const so = (sy * src.width + sx) * 4;
    const d = (dy * this.width + dx) * 4;
    for (let k = 0; k < 4; k++) this.data[d + k] = src.data[so + k];
  }

  /** Copies a region into another location, flipped horizontally. */
  mirrorRegion(sx: number, sy: number, w: number, h: number, dx: number, dy: number): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) this.copyPixel(this, sx + i, sy + j, dx + w - 1 - i, dy + j);
    }
  }

  /** Adds a 1px outline around every opaque shape. */
  outline(color: string): void {
    const points: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.filled(x, y)) continue;
        if (this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1)) {
          points.push(x, y);
        }
      }
    }
    for (let i = 0; i < points.length; i += 2) this.set(points[i], points[i + 1], color);
  }

  toCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.putImageData(new ImageData(this.data, this.width, this.height), 0, 0);
    return canvas;
  }
}
