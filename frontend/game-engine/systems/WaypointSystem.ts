import * as Phaser from 'phaser';
import { GAME_CONFIG, Terrain } from '@farming/shared';
import { DEPTH } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { terrainAt, type WorldData } from '../maps/WorldData';

export interface WaypointInfo {
  tx: number;
  ty: number;
  /** Steps along the trail (or straight-line tiles when there's no path). */
  steps: number;
  direction: string;
  /** False when nothing walkable reaches the spot. */
  reachable: boolean;
}

const DIRS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const ARRIVE_TILES = 1.5;
const REPATH_MS = 400;
const TRAIL_DOTS = 80;

/**
 * A marker the player sets on the world map. Draws a walkable trail of dots
 * from the player to the spot (A* around water, trees, rocks and buildings),
 * re-planned as the player moves, and reports distance and direction to the HUD.
 */
export class WaypointSystem {
  private target: { tx: number; ty: number } | null = null;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly beacon: Phaser.GameObjects.Graphics;
  private path: Array<[number, number]> = [];
  private reachable = true;
  private lastTile = '';
  private sinceRepath = 0;
  private clock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
    private readonly blocked: (tx: number, ty: number) => boolean,
  ) {
    this.trail = scene.add.graphics().setDepth(DEPTH.soil + 0.5);
    this.beacon = scene.add.graphics().setDepth(DEPTH.fx - 1);
  }

  /** The planned route (tiles), nearest first. */
  get route(): ReadonlyArray<[number, number]> {
    return this.reachable ? this.path : [];
  }

  get active(): { tx: number; ty: number } | null {
    return this.target;
  }

  set(tx: number, ty: number): void {
    const { width, height } = this.world;
    this.target = { tx: Phaser.Math.Clamp(tx, 0, width - 1), ty: Phaser.Math.Clamp(ty, 0, height - 1) };
    this.lastTile = '';
    this.sinceRepath = REPATH_MS;
  }

  clear(): void {
    this.target = null;
    this.path = [];
    this.trail.clear();
    this.beacon.clear();
    gameEvents.emit('waypoint:info', null);
  }

  setVisible(visible: boolean): void {
    this.trail.setVisible(visible);
    this.beacon.setVisible(visible);
  }

  update(delta: number, px: number, py: number): void {
    if (!this.target) return;
    const size = GAME_CONFIG.tileSize;
    const ptx = Math.floor(px / size);
    const pty = Math.floor((py - 4) / size);
    const { tx, ty } = this.target;
    if (Math.hypot(tx - ptx, ty - pty) <= ARRIVE_TILES) {
      gameEvents.emit('toast', { text: "📍 You've arrived." });
      this.clear();
      return;
    }
    this.clock += delta;
    this.sinceRepath += delta;
    const key = `${ptx},${pty}`;
    if (key !== this.lastTile && this.sinceRepath >= REPATH_MS) {
      this.lastTile = key;
      this.sinceRepath = 0;
      const found = this.findPath(ptx, pty, tx, ty);
      this.reachable = !!found;
      this.path = found ?? [];
      const steps = found ? found.length : Math.round(Math.hypot(tx - ptx, ty - pty));
      const angle = Math.atan2(ty - pty, tx - ptx);
      const direction = DIRS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
      gameEvents.emit('waypoint:info', { tx, ty, steps, direction, reachable: this.reachable } satisfies WaypointInfo);
    }
    this.draw(px, py);
  }

  private draw(px: number, py: number): void {
    const size = GAME_CONFIG.tileSize;
    const g = this.trail;
    g.clear();
    if (!this.target) return;
    // Dots travel along the trail toward the target.
    const phase = (this.clock / 600) % 1;
    if (this.reachable) {
      const n = Math.min(this.path.length, TRAIL_DOTS);
      for (let i = 0; i < n; i++) {
        const [x, y] = this.path[i];
        const fade = 1 - (i / TRAIL_DOTS) * 0.6;
        const pulse = 0.55 + 0.45 * Math.sin((i - phase * 2) * 1.2 - this.clock / 180);
        g.fillStyle(0x1a1208, 0.35 * fade);
        g.fillCircle(x * size + 8, y * size + 9, 2.6);
        g.fillStyle(0xffe27a, (0.5 + 0.4 * pulse) * fade);
        g.fillCircle(x * size + 8, y * size + 8, 2);
      }
    } else {
      // No walkable route: a short arrow from the player toward the spot.
      const angle = Phaser.Math.Angle.Between(px, py, this.target.tx * size + 8, this.target.ty * size + 8);
      for (let i = 1; i <= 4; i++) {
        g.fillStyle(0xffe27a, 0.8 - i * 0.12);
        g.fillCircle(px + Math.cos(angle) * (10 + i * 9), py - 6 + Math.sin(angle) * (10 + i * 9), 2);
      }
    }
    // The beacon over the target.
    const b = this.beacon;
    b.clear();
    const bx = this.target.tx * size + 8;
    const by = this.target.ty * size + 8;
    const bob = Math.sin(this.clock / 250) * 2;
    b.fillStyle(0xffe27a, 0.25 + 0.15 * Math.sin(this.clock / 300));
    b.fillEllipse(bx, by + 4, 16, 7);
    b.fillStyle(0xe0644f, 1);
    b.fillTriangle(bx - 5, by - 14 + bob, bx + 5, by - 14 + bob, bx, by - 4 + bob);
    b.fillCircle(bx, by - 16 + bob, 5);
    b.fillStyle(0xffffff, 1);
    b.fillCircle(bx, by - 16 + bob, 2);
  }

  private walkable(x: number, y: number): boolean {
    const t = terrainAt(this.world, x, y);
    return t >= 0 && t !== Terrain.Water && !this.blocked(x, y);
  }

  /** A* on the tile grid; the goal may itself be blocked (a tree, the mine), so stopping next to it counts. */
  private findPath(sx: number, sy: number, gx: number, gy: number): Array<[number, number]> | null {
    const { width, height } = this.world;
    const idx = (x: number, y: number) => y * width + x;
    const goalOk = (x: number, y: number) => Math.abs(x - gx) <= 1 && Math.abs(y - gy) <= 1;
    const g = new Float32Array(width * height).fill(Infinity);
    const came = new Int32Array(width * height).fill(-1);
    const closed = new Uint8Array(width * height);
    // Binary heap of [f, index].
    const heap: Array<[number, number]> = [];
    const push = (f: number, i: number) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    const h = (x: number, y: number) => {
      const dx = Math.abs(x - gx);
      const dy = Math.abs(y - gy);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
    const start = idx(sx, sy);
    g[start] = 0;
    push(h(sx, sy), start);
    let budget = width * height;
    while (heap.length && budget-- > 0) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % width;
      const cy = (cur / width) | 0;
      if (goalOk(cx, cy) && !(cx === sx && cy === sy && !goalOk(sx, sy))) {
        const out: Array<[number, number]> = [];
        for (let i = cur; i !== -1 && i !== start; i = came[i]) out.push([i % width, (i / width) | 0]);
        return out.reverse();
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !this.walkable(nx, ny)) continue;
          // No cutting corners past obstacles.
          if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
          const ni = idx(nx, ny);
          const cost = g[cur] + (dx && dy ? 1.414 : 1);
          if (cost < g[ni]) {
            g[ni] = cost;
            came[ni] = cur;
            push(cost + h(nx, ny), ni);
          }
        }
      }
    }
    return null;
  }
}
