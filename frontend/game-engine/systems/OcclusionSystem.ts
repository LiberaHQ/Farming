import type Phaser from 'phaser';
import { GAME_CONFIG } from '@farming/shared';

export interface Occluder {
  sprite: Phaser.GameObjects.Image;
  x: number;
  baseY: number;
  halfWidth: number;
  height: number;
}

const FADED_ALPHA = 0.55;
const key = (tx: number, ty: number) => ty * 4096 + tx;

/**
 * Fades tree canopies while the player is standing behind them, so the
 * character is never lost under foliage. Uses a tile-bucketed lookup, so only
 * the handful of trees around the player are checked each frame.
 */
export class OcclusionSystem {
  private readonly buckets = new Map<number, Occluder[]>();
  private readonly active = new Set<Occluder>();

  add(occluder: Occluder, tx: number, ty: number): void {
    const k = key(tx, ty);
    const list = this.buckets.get(k);
    if (list) list.push(occluder);
    else this.buckets.set(k, [occluder]);
  }

  remove(occluder: Occluder, tx: number, ty: number): void {
    const list = this.buckets.get(key(tx, ty));
    if (list) {
      const i = list.indexOf(occluder);
      if (i >= 0) list.splice(i, 1);
    }
    this.active.delete(occluder);
  }

  update(px: number, py: number): void {
    const size = GAME_CONFIG.tileSize;
    const ptx = Math.floor(px / size);
    const pty = Math.floor(py / size);
    const covering = new Set<Occluder>();

    // Only objects whose base is below the player can be drawn in front of them.
    for (let ty = pty; ty <= pty + 3; ty++) {
      for (let tx = ptx - 1; tx <= ptx + 1; tx++) {
        for (const o of this.buckets.get(key(tx, ty)) ?? []) {
          if (py < o.baseY - 2 && py > o.baseY - o.height && Math.abs(px - o.x) < o.halfWidth) covering.add(o);
        }
      }
    }
    for (const o of covering) this.active.add(o);

    for (const o of this.active) {
      const target = covering.has(o) ? FADED_ALPHA : 1;
      o.sprite.alpha += (target - o.sprite.alpha) * 0.25;
      if (target === 1 && o.sprite.alpha > 0.98) {
        o.sprite.alpha = 1;
        this.active.delete(o);
      }
    }
  }
}
