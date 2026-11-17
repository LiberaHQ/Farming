import * as Phaser from 'phaser';
import { GAME_CONFIG, type ItemId } from '@farming/shared';
import { drawLocomotive, drawRailTile, drawSteamPuff, drawTrainCar, type CarKind } from '../assets/valley';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';
import type { DropSystem } from './DropSystem';

const T = GAME_CONFIG.tileSize;
/** Pixels per second. */
const SPEED = 150;
const CAR_GAP = 1;
/** When trains may come by (game minutes), each nudged a little day to day. */
const SLOTS = [7 * 60 + 30, 10 * 60, 12 * 60 + 30, 15 * 60, 17 * 60 + 30, 20 * 60 + 30];
/** A train that is this late (you slept through it) just doesn't come. */
const MISSED = 40;

/** What can fall off a passing train, by weight. */
const CARGO: Array<{ itemId: ItemId; min: number; max: number; weight: number }> = [
  { itemId: 'coal', min: 2, max: 4, weight: 44 },
  { itemId: 'copper_ore', min: 2, max: 3, weight: 18 },
  { itemId: 'iron_ore', min: 1, max: 3, weight: 14 },
  { itemId: 'wood', min: 3, max: 5, weight: 10 },
  { itemId: 'gold_ore', min: 1, max: 2, weight: 6 },
  { itemId: 'golden_spike', min: 1, max: 1, weight: 2 },
];

interface Car {
  sprite: Phaser.GameObjects.Image;
  kind: CarKind | 'loco';
  width: number;
}

interface Run {
  dir: 1 | -1;
  /** x of the train's front. */
  head: number;
  cars: Car[];
  length: number;
  /** Things that will fall off as the train's tail passes these x positions. */
  spills: Array<{ x: number; itemId: ItemId; quantity: number }>;
  spilled: boolean;
  bumped: boolean;
  seen: boolean;
  wheelAt: number;
  frame: number;
  puffAt: number;
  chugAt: number;
}

export interface TrainContext {
  minute: number;
  day: number;
  player: { x: number; y: number; placeAt(x: number, y: number, facing?: 'up' | 'down' | 'left' | 'right'): void };
  /** The player is in a side area (the train still runs, out of sight and earshot). */
  away: boolean;
}

/**
 * A little steam train that crosses the valley along its own track a few
 * times a day. It whistles as it comes, chugs past, nudges you off the rails
 * if you're standing on them, and now and then something falls off a wagon.
 */
export class TrainSystem {
  private run: Run | null = null;
  /** Departures already handled ("day:index"). */
  private readonly done = new Set<string>();
  private doneDay = -1;
  private readonly widthPx: number;
  private readonly y: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly seed: string,
    readonly row: number,
    widthTiles: number,
    isWater: (tx: number, ty: number) => boolean,
    private readonly drops: DropSystem,
    /** The player watched a train go by (first time: a hint). */
    private readonly onSeen: () => void,
  ) {
    this.widthPx = widthTiles * T;
    // The wheels sit on the rails.
    this.y = row * T + 13;
    this.ensureTextures();
    for (let tx = 0; tx < widthTiles; tx++) {
      this.scene.add
        .image(tx * T, row * T, isWater(tx, row) ? 'rail-trestle' : 'rail-track')
        .setOrigin(0, 0)
        .setDepth(DEPTH.soil + 0.5);
    }
  }

  private ensureTextures(): void {
    const tex = (key: string, draw: () => { toCanvas(): HTMLCanvasElement }) => {
      if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, draw().toCanvas());
    };
    tex('rail-track', () => drawRailTile(false));
    tex('rail-trestle', () => drawRailTile(true));
    tex('train-puff', drawSteamPuff);
    for (const f of [0, 1]) {
      tex(`train-loco-${f}`, () => drawLocomotive(f));
      for (const k of ['coal', 'box', 'tank', 'caboose'] as const) tex(`train-${k}-${f}`, () => drawTrainCar(k, f));
    }
  }

  /** Today's departures (game minutes), in order. */
  private schedule(day: number): number[] {
    const rng = createRng(`${this.seed}:train:${day}`);
    const slots = [...SLOTS];
    const picked: number[] = [];
    const count = rng.next() < 0.3 ? 4 : 3;
    while (picked.length < count && slots.length) picked.push(slots.splice(rng.int(0, slots.length - 1), 1)[0] + rng.int(-20, 20));
    return picked.sort((a, b) => a - b);
  }

  /** Minutes until the next train today (null if none left). Shown nowhere yet; handy for tests. */
  next(day: number, minute: number): number | null {
    const t = this.schedule(day).find((m) => m >= minute);
    return t === undefined ? null : t - minute;
  }

  /** The engine's position while a train is out. */
  position(): { x: number; y: number } | null {
    return this.run ? { x: this.run.cars[0].sprite.x, y: this.y } : null;
  }

  get running(): boolean {
    return this.run !== null;
  }

  /** Sends a train now (debug / tests), heading east (1) or west (-1). */
  depart(dir: 1 | -1 = 1, day = 0, index = 0): void {
    if (this.run) return;
    const rng = createRng(`${this.seed}:train:${day}:${index}:cars`);
    const kinds: CarKind[] = ['coal', 'box', 'tank', 'coal', 'box'];
    const n = rng.int(3, 5);
    const cars: Car[] = [{ sprite: this.scene.add.image(0, this.y, 'train-loco-0'), kind: 'loco', width: 44 }];
    for (let i = 0; i < n; i++) {
      const kind = i === n - 1 ? 'caboose' : kinds[rng.int(0, kinds.length - 1)];
      cars.push({ sprite: this.scene.add.image(0, this.y, `train-${kind}-0`), kind, width: 36 });
    }
    for (const c of cars) c.sprite.setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(DEPTH.ySortBase + this.y);
    const length = cars.reduce((s, c) => s + c.width + CAR_GAP, 0);
    const spills: Run['spills'] = [];
    if (rng.next() < 0.55) {
      const total = CARGO.reduce((s, c) => s + c.weight, 0);
      const n = rng.next() < 0.3 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        let r = rng.next() * total;
        const c = CARGO.find((c) => (r -= c.weight) < 0) ?? CARGO[0];
        spills.push({ x: rng.int(3 * T, this.widthPx - 3 * T), itemId: c.itemId, quantity: rng.int(c.min, c.max) });
      }
    }
    this.run = {
      dir,
      head: dir > 0 ? -40 : this.widthPx + 40,
      cars,
      length,
      spills,
      spilled: false,
      bumped: false,
      seen: false,
      wheelAt: 0,
      frame: 0,
      puffAt: 0,
      chugAt: 0,
    };
    this.layout();
  }

  update(delta: number, ctx: TrainContext): void {
    if (!this.run) {
      if (this.doneDay !== ctx.day) {
        this.done.clear();
        this.doneDay = ctx.day;
      }
      const times = this.schedule(ctx.day);
      for (let i = 0; i < times.length && !this.run; i++) {
        const key = `${ctx.day}:${i}`;
        if (this.done.has(key) || ctx.minute < times[i]) continue;
        this.done.add(key);
        if (ctx.minute >= times[i] + MISSED) continue;
        this.depart(i % 2 === 0 ? 1 : -1, ctx.day, i);
        if (!ctx.away) this.whistle(ctx.player, 1);
      }
      return;
    }
    const run = this.run;
    const now = this.scene.time.now;
    run.head += run.dir * SPEED * (delta / 1000);
    this.layout();
    if (now > run.wheelAt) {
      run.wheelAt = now + 110;
      run.frame = 1 - run.frame;
      for (const c of run.cars) c.sprite.setTexture(c.kind === 'loco' ? `train-loco-${run.frame}` : `train-${c.kind}-${run.frame}`);
    }
    const loco = run.cars[0].sprite;
    const visible = this.onScreen(loco.x, 200);
    if (visible && now > run.puffAt) {
      run.puffAt = now + 200;
      this.puff(loco.x + run.dir * 12, this.y - 24);
    }
    const tailX = run.head - run.dir * run.length;
    if (!ctx.away) {
      const dy = Math.abs(ctx.player.y - this.y);
      // Sound: a rumble while it's near you.
      const nearest = Math.max(Math.min(run.head, tailX), Math.min(ctx.player.x, Math.max(run.head, tailX)));
      const dist = Math.hypot(ctx.player.x - nearest, dy);
      if (dist < 360 && now > run.chugAt) {
        run.chugAt = now + 3600;
        sfx('chug', { volume: Math.max(0.15, 1 - dist / 360) });
      }
      if (!run.seen && dist < 180) {
        run.seen = true;
        this.onSeen();
      }
      this.bump(run, ctx, tailX);
    }
    // Cargo spills as the end of the train passes.
    for (let i = run.spills.length - 1; i >= 0; i--) {
      const s = run.spills[i];
      if ((run.dir > 0 && tailX >= s.x) || (run.dir < 0 && tailX <= s.x)) {
        run.spills.splice(i, 1);
        this.drops.spawn(s.itemId, s.quantity, s.x, this.y - 6);
        if (!ctx.away && Math.hypot(ctx.player.x - s.x, ctx.player.y - this.y) < 16 * T && !run.spilled) {
          run.spilled = true;
          gameEvents.emit('toast', { text: '🚂 Something fell off the train by the tracks!' });
        }
      }
    }
    const gone = run.dir > 0 ? tailX > this.widthPx + 60 : tailX < -60;
    if (gone) {
      for (const c of run.cars) c.sprite.destroy();
      this.run = null;
    }
  }

  /** A blast on the whistle as it sets off (louder the closer you are to the line). */
  private whistle(player: { x: number; y: number }, scale: number): void {
    const dy = Math.abs(player.y - this.y) / T;
    if (dy > 30) return;
    sfx('whistle', { volume: Math.max(0.12, (1 - dy / 30) * scale) });
  }

  /** Standing on the line as the train comes: you hop off to the nearer side. */
  private bump(run: Run, ctx: TrainContext, tailX: number): void {
    const p = ctx.player;
    if (p.y < this.y - 14 || p.y > this.y + 8) return;
    const front = run.head + run.dir * 10;
    const lo = Math.min(front, tailX);
    const hi = Math.max(front, tailX);
    if (p.x < lo - 8 || p.x > hi + 8) return;
    const above = p.y < this.y - 3;
    p.placeAt(p.x, above ? this.y - 18 : this.y + 12, above ? 'up' : 'down');
    if (!run.bumped) {
      run.bumped = true;
      sfx('whoosh');
      gameEvents.emit('toast', { text: 'Whoa! Stand clear of the tracks when the train comes.' });
    }
  }

  private layout(): void {
    const run = this.run!;
    let x = run.head;
    for (const c of run.cars) {
      c.sprite.setPosition(Math.round(x - (run.dir * c.width) / 2), this.y);
      x -= run.dir * (c.width + CAR_GAP);
    }
  }

  private onScreen(x: number, margin: number): boolean {
    const v = this.scene.cameras.main.worldView;
    return x > v.x - margin && x < v.right + margin && this.y > v.y - 60 && this.y < v.bottom + 60;
  }

  private puff(x: number, y: number): void {
    const p = this.scene.add.image(x, y, 'train-puff').setDepth(DEPTH.ySortBase + this.y + 2).setAlpha(0.9).setScale(0.6);
    this.scene.tweens.add({ targets: p, y: y - 18, x: x + Phaser.Math.Between(-6, 6), scale: 1.6, alpha: 0, duration: 1100, onComplete: () => p.destroy() });
  }
}
