import type { PixelCanvas } from './PixelCanvas';

/** Colours one kind of ground spreads with when it creeps over a neighbour's edge. */
export interface GroundColors {
  base: string;
  light?: string;
  shade?: string;
}

/**
 * Softens hard tile borders on a ground image drawn tile by tile. Wherever a
 * tile of kind A meets kind B and B has the higher priority, B creeps into A
 * along that side as a ragged, wandering fringe (1–4 px) with a few stray
 * pixels beyond it, so the two read as one surface instead of squares.
 * `kindAt` returns null for tiles that should be left alone (e.g. a pier).
 */
export function blendTileEdges(
  p: PixelCanvas,
  w: number,
  h: number,
  size: number,
  kindAt: (tx: number, ty: number) => string | null,
  colors: Record<string, GroundColors>,
  priority: Record<string, number>,
  random: () => number,
): void {
  const pick = (c: GroundColors) => {
    const r = random();
    return r < 0.15 && c.shade ? c.shade : r < 0.27 && c.light ? c.light : c.base;
  };
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const k = kindAt(tx, ty);
      if (k === null) continue;
      const sides: Array<[number, number, (a: number, d: number) => [number, number]]> = [
        [0, -1, (a, d) => [a, d]],
        [0, 1, (a, d) => [a, size - 1 - d]],
        [-1, 0, (a, d) => [d, a]],
        [1, 0, (a, d) => [size - 1 - d, a]],
      ];
      for (const [dx, dy, point] of sides) {
        const n = kindAt(tx + dx, ty + dy);
        if (n === null || n === k || (priority[n] ?? 0) <= (priority[k] ?? 0)) continue;
        const c = colors[n];
        if (!c) continue;
        let depth = 2;
        for (let a = 0; a < size; a++) {
          const r = random();
          depth = Math.max(1, Math.min(4, depth + (r < 0.22 ? -1 : r > 0.78 ? 1 : 0)));
          for (let d = 0; d < depth; d++) {
            const [x, y] = point(a, d);
            p.set(tx * size + x, ty * size + y, pick(c));
          }
          // Stray specks a little further in.
          if (random() < 0.3) {
            const [x, y] = point(a, depth + 1 + Math.floor(random() * 2));
            p.set(tx * size + x, ty * size + y, pick(c));
          }
        }
      }
    }
  }
}
