import type { Rng } from './random';

/** 2D noise function returning values in [0, 1]. */
export type Noise2D = (x: number, y: number) => number;

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Seeded value noise: cheap, dependency-free and good enough for terrain. */
export function createValueNoise(rng: Rng): Noise2D {
  const perm = new Uint8Array(512);
  const values = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) values[i] = rng.next();

  const lattice = (ix: number, iy: number) => values[perm[perm[ix & 255] + (iy & 255)]];

  return (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);
    const top = lerp(lattice(x0, y0), lattice(x0 + 1, y0), fx);
    const bottom = lerp(lattice(x0, y0 + 1), lattice(x0 + 1, y0 + 1), fx);
    return lerp(top, bottom, fy);
  };
}

/** Fractal Brownian motion: layered octaves for natural-looking variation. */
export function fbm(noise: Noise2D, x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * frequency + i * 31.7, y * frequency + i * 17.3) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}
