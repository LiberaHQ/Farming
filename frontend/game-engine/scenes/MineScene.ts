import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import {
  bossOf,
  CAVE_IN_SECONDS,
  floorMonsters,
  GAME_CONFIG,
  ITEMS,
  MINE,
  MINE_ELITE,
  MINE_FLOOR_KINDS,
  MINE_MAIN_FLOORS,
  MINE_MAX_FLOOR,
  MINE_SHORTCUT,
  MONSTERS,
  mineFloorKind,
  mineRockWeights,
  mineZone,
  shortcutAllowed,
  treasureTable,
  type ItemId,
  type MineFloorKind,
  type MineRockDef,
  type MineRockKind,
  type MineZoneDef,
  type MonsterKind,
} from '@farming/shared';
import { itemTextureKey, MINE_ROCK_VARIANTS, MINE_TEX, mineRockTextureKey, TEXTURES } from '../assets/registerTextures';
import { drawCaveFloor } from '../assets/mine';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { Player } from '../entities/Player';
import { gameEvents } from '../events/GameEventBus';
import type { PlayerState } from '../state/PlayerState';
import { CameraSystem } from '../systems/CameraSystem';
import { DropSystem } from '../systems/DropSystem';
import { FxSystem } from '../systems/FxSystem';
import { InputSystem } from '../systems/InputSystem';
import { createRng, type Rng } from '../utils/random';
import { MineMonsters, type MineWorld, type Monster } from './mine/MineMonsters';
import type { MineRun } from './mine/types';

/** What the mine needs from the world scene (which keeps running: clock, menus, hotkeys). */
export interface MineHost {
  state: PlayerState;
  /** A menu is open, or the player is asleep. */
  isFrozen(): boolean;
  /** Back to the surface (fainted = health ran out). */
  exit(result: { fainted: boolean }): void;
}

export interface MineSceneData {
  floor: number;
  host: MineHost;
  /** Mine Dash: the same mine for every entrant, and a run that keeps score. */
  run?: MineRun;
}

interface Rock {
  kind: MineRockKind;
  tx: number;
  ty: number;
  hp: number;
  sprite: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  ladder: boolean;
}

interface Treasure {
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Sprite;
  opened: boolean;
  zone: Phaser.GameObjects.Zone;
  /** A vault chest: needs the key one of the monsters carries. */
  locked: boolean;
}

type Action = { verb: string; key: 'Space' | 'E'; blocked?: boolean; run: () => void };

const SLIME_TINTS = [0x7ed36a, 0x6ab8f0, 0xb07ae0, 0xf07a6a, 0xf0d06a];
const SPITTER_TINTS = [0xc8e07a, 0x9ae0c0, 0xe0a07a];
const DIRECTION_OFFSET = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] } as const;
const INVULNERABLE_MS = 900;
const GLOW_DEPTH = DEPTH.lighting + 1;

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * One floor of the mine. Each visit generates a fresh cave (or, in Mine Dash,
 * the same cave for everyone from the run's seed): rock to break for stone,
 * ore and gems, monsters, a ladder down hidden under one of the rocks, and the
 * ladder back up where you came in. Floors belong to zones (tunnels, caverns,
 * grotto, flooded depths, haunted halls, molten core, and the Abyss below 30),
 * each with its own look, hazard and monsters, and some floors are special.
 */
export class MineScene extends Phaser.Scene {
  private floor = 1;
  private host!: MineHost;
  private run: MineRun | undefined;
  /** The seed for this floor: layout, rocks, monsters and loot all come from it. */
  private floorSeed = '';
  /** Layout randomness (used only while building the floor, so it's the same every time). */
  private rng!: Rng;
  /** Behaviour randomness (monster movement), separate so it can't change the layout. */
  private aiRng!: Rng;
  private zoneDef!: MineZoneDef;
  private kind: MineFloorKind = 'normal';
  private wall!: Uint8Array;
  /** 1 = water (blocks walking), 2 = lava crack (hurts to stand on). */
  private hazard!: Uint8Array;
  private width: number = MINE.width;
  private height: number = MINE.height;
  private player!: Player;
  private controls!: InputSystem;
  private fx!: FxSystem;
  private drops!: DropSystem;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private monsters!: MineMonsters;
  private readonly rocks = new Map<number, Rock>();
  private treasure: Treasure | null = null;
  private entry = { tx: 1, ty: 1 };
  private ladderDown: { tx: number; ty: number } | null = null;
  private ladderSprite: Phaser.GameObjects.Image | null = null;
  private shortcut: { tx: number; ty: number; hp: number; sprite: Phaser.GameObjects.Image; open: boolean } | null = null;
  private vaultKey: { sprite: Phaser.GameObjects.Image } | null = null;
  private hasKey = false;
  private cursor!: Phaser.GameObjects.Graphics;
  private darkness!: Phaser.GameObjects.Image;
  private lantern = 120;
  private lightStolen = false;
  private snuffedUntil = 0;
  private slowUntil = 0;
  private invulnerable = 0;
  private lavaTick = 0;
  private caveIn = 0;
  private caveInTick = 0;
  private hurtThisFloor = false;
  private lastHint = '';
  private lastAnchor = '';
  private lastStatus = '';
  private floorTexture = '';
  private leaving = false;

  constructor() {
    super(SCENES.Mine);
  }

  init(data: MineSceneData): void {
    this.floor = Math.max(1, Math.min(MINE_MAX_FLOOR, Math.floor(data.floor)));
    this.host = data.host;
    this.run = data.run;
    this.rocks.clear();
    this.treasure = null;
    this.ladderDown = null;
    this.ladderSprite = null;
    this.shortcut = null;
    this.vaultKey = null;
    this.hasKey = false;
    this.lightStolen = false;
    this.snuffedUntil = 0;
    this.slowUntil = 0;
    this.invulnerable = 0;
    this.caveIn = 0;
    this.hurtThisFloor = false;
    this.lastHint = '';
    this.lastAnchor = '';
    this.lastStatus = '';
    this.leaving = false;
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    this.floorSeed = this.run ? `${this.run.seed}:floor:${this.floor}` : `mine:${this.floor}:${Date.now()}:${Math.random()}`;
    this.rng = createRng(`${this.floorSeed}:layout`);
    this.aiRng = createRng(`${this.floorSeed}:ai:${Math.random()}`);
    this.zoneDef = mineZone(this.floor);
    this.kind = mineFloorKind(this.floor, this.rng.next());
    this.generateCave();
    this.placeHazards();

    // The cave as one image, coloured for its zone.
    this.floorTexture = `mine-floor-${this.floor}-${Date.now()}`;
    this.textures.addCanvas(
      this.floorTexture,
      drawCaveFloor(this.rng, this.width, this.height, (x, y) => this.isWall(x, y), size, {
        palette: this.zoneDef.palette,
        tile: (x, y) => (this.isWater(x, y) ? 'water' : this.isLava(x, y) ? 'lava' : null),
      }),
    );
    this.add.image(0, 0, this.floorTexture).setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#0b0807');
    this.physics.world.setBounds(0, 0, this.width * size, this.height * size);

    // Walls and pools: one collider per horizontal run of solid tiles that touch the open cave.
    this.walls = this.physics.add.staticGroup();
    for (let ty = 0; ty < this.height; ty++) {
      let start = -1;
      for (let tx = 0; tx <= this.width; tx++) {
        const solid = tx < this.width && ((this.isWall(tx, ty) && this.touchesFloor(tx, ty)) || this.isWater(tx, ty));
        if (solid && start < 0) start = tx;
        if (!solid && start >= 0) {
          const w = (tx - start) * size;
          this.walls.add(this.add.zone(start * size + w / 2, ty * size + size / 2, w, size));
          start = -1;
        }
      }
    }
    this.decorateHazards();

    this.fx = new FxSystem(this);
    this.drops = new DropSystem(this, { persist: false });

    // The ladder back up, where you arrive.
    this.add
      .image(this.entry.tx * size + size / 2, this.entry.ty * size + size - 2, TEXTURES.ladderUp)
      .setOrigin(0.5, 25 / 26)
      .setDepth(DEPTH.ySortBase + this.entry.ty * size + 2);

    this.placeRocks();
    this.placeShortcut();

    this.player = new Player(this, this.entry.tx * size + size / 2, (this.entry.ty + 1) * size + 12);
    this.physics.add.collider(this.player.sprite, this.walls);
    this.controls = new InputSystem(this);
    new CameraSystem(this, this.player.sprite, this.width * size, this.height * size);

    this.monsters = new MineMonsters(this.mineWorld());
    this.placeMonsters();

    this.cursor = this.add.graphics().setDepth(DEPTH.cursor);
    this.lantern = (this.kind === 'dark' ? 72 : this.zoneDef.lantern) + (this.run?.lanternBonus ?? 0);
    this.darkness = this.add
      .image(0, 0, this.lightTexture(this.lantern))
      .setDepth(DEPTH.lighting)
      .setAlpha(this.kind === 'dark' ? 0.985 : this.zoneDef.darkness);

    if (this.host.state.reachFloor(this.floor) && this.floor % MINE.elevatorEvery === 0) {
      toast(`The elevator now stops at floor ${this.floor}.`);
    }
    this.announce();
    this.run?.event({ t: 'floor', floor: this.floor });
    if (this.kind === 'cavein') this.caveIn = CAVE_IN_SECONDS * 1000;
    this.emitStatus(true);
    sfx('whoosh', { rate: 0.6, volume: 0.6 });
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
      this.monsters?.destroy();
      if (this.textures.exists(this.floorTexture)) this.textures.remove(this.floorTexture);
    });
  }

  /** The zone's name on its first floor, and what's special about this one. */
  private announce(): void {
    const z = this.zoneDef;
    const first = this.floor === z.first || (z.id === 'abyss' && this.floor === MINE_MAIN_FLOORS + 1);
    toast(`${z.name} — floor ${this.floor}`);
    if (first) this.time.delayedCall(900, () => toast(z.intro));
    const special = MINE_FLOOR_KINDS[this.kind].intro;
    if (special) this.time.delayedCall(first ? 2200 : 900, () => toast(special));
  }

  private static warnedDrop = false;

  /** The player put something down. The mine is rebuilt each visit, so it's gone once you leave the floor. */
  dropItem(itemId: ItemId, quantity: number, screen?: { x: number; y: number }, q: 0 | 1 | 2 = 0): boolean {
    if (!this.drops || !this.player) return false;
    this.drops.tossFromPlayer(this.player, itemId, quantity, screen, q);
    if (!MineScene.warnedDrop) {
      MineScene.warnedDrop = true;
      gameEvents.emit('toast', { text: 'Careful: anything left on a mine floor is lost when you leave it.' });
    }
    return true;
  }

  update(_time: number, delta: number): void {
    if (this.leaving) return;
    const slowed = this.time.now < this.slowUntil;
    this.player.speedBoost = (this.host.state.hasBuff('speed') ? 1.25 : 1) * (slowed ? 0.55 : 1);
    const frozen = this.host.isFrozen();
    const actions = this.controls.getActions();
    if (frozen) {
      this.player.stop();
    } else {
      const action = this.resolve();
      if (actions.use) {
        if (action && action.key === 'Space') this.perform(action);
        else if (action?.key === 'E') this.perform(action);
        else this.swing();
      } else if (actions.interact && action) this.perform(action);
      this.player.update(this.controls.getMoveIntent());
      this.updateHazards(delta);
    }
    this.monsters.update(delta, frozen);
    this.drops.update(delta, this.player.x, this.player.y, this.host.state.inventory);
    this.pickUpKey();
    this.invulnerable -= delta;
  }

  /** Runs after physics, like the world scene's late update. */
  postUpdate(): void {
    if (!this.player) return;
    this.player.lateUpdate();
    this.darkness.setPosition(this.player.x, this.player.y - 8);
    const action = this.host.isFrozen() || this.leaving ? null : this.resolve();
    this.drawCursor(action);
    this.emitHint(action);
    this.emitStatus(false);
  }

  // ---------- Generation ----------

  private generateCave(): void {
    const { width: w, height: h } = this;
    let grid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
        grid[y * w + x] = edge || this.rng.chance(0.43) ? 1 : 0;
      }
    }
    // Cellular-automaton smoothing turns noise into caverns.
    for (let pass = 0; pass < 5; pass++) {
      const next = grid.slice();
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && grid[(y + dy) * w + x + dx]) n++;
          next[y * w + x] = n >= 5 ? 1 : n <= 3 ? 0 : grid[y * w + x];
        }
      }
      grid = next;
    }
    // Keep only the largest open region, so everything is reachable.
    const region = new Int32Array(w * h).fill(-1);
    let best = -1;
    let bestSize = 0;
    let id = 0;
    for (let i = 0; i < w * h; i++) {
      if (grid[i] || region[i] >= 0) continue;
      const stack = [i];
      region[i] = id;
      let count = 0;
      while (stack.length) {
        const c = stack.pop()!;
        count++;
        const cx = c % w;
        const cy = Math.floor(c / w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          const ni = ny * w + nx;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || grid[ni] || region[ni] >= 0) continue;
          region[ni] = id;
          stack.push(ni);
        }
      }
      if (count > bestSize) {
        bestSize = count;
        best = id;
      }
      id++;
    }
    for (let i = 0; i < w * h; i++) if (!grid[i] && region[i] !== best) grid[i] = 1;
    this.wall = grid;
    this.hazard = new Uint8Array(w * h);

    // Arrive at the open tile nearest the top-left that has room below for the ladder.
    let entry = { tx: 2, ty: 2 };
    let bestD = Infinity;
    for (let y = 1; y < h - 2; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (this.isWall(x, y) || this.isWall(x, y + 1) || this.isWall(x, y + 2) || !this.isWall(x, y - 1)) continue;
        const d = x + y * 1.2;
        if (d < bestD) {
          bestD = d;
          entry = { tx: x, ty: y };
        }
      }
    }
    this.entry = entry;
  }

  /** Pools in the Flooded Depths (never cutting the cave in two), lava cracks in the Molten Core. */
  private placeHazards(): void {
    const { width: w, height: h } = this;
    const nearEntry = (x: number, y: number) => Math.hypot(x - this.entry.tx, y - this.entry.ty) < 4;
    if (this.zoneDef.hazard === 'water') {
      for (let pool = 0, tries = 0; pool < 6 && tries < 60; tries++) {
        const cx = this.rng.int(2, w - 3);
        const cy = this.rng.int(2, h - 3);
        if (this.isWall(cx, cy) || nearEntry(cx, cy)) continue;
        const blob: number[] = [];
        const size = this.rng.int(3, 7);
        let x = cx;
        let y = cy;
        for (let i = 0; i < size * 2 && blob.length < size; i++) {
          const k = y * w + x;
          if (!this.isWall(x, y) && !nearEntry(x, y) && !this.hazard[k]) {
            this.hazard[k] = 1;
            blob.push(k);
          }
          const [dx, dy] = this.rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
          x = Math.max(1, Math.min(w - 2, x + dx));
          y = Math.max(1, Math.min(h - 2, y + dy));
        }
        if (blob.length && !this.allConnected()) for (const k of blob) this.hazard[k] = 0;
        else if (blob.length) pool++;
      }
    } else if (this.zoneDef.hazard === 'lava') {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (!this.isWall(x, y) && !nearEntry(x, y) && this.rng.chance(0.04)) this.hazard[y * w + x] = 2;
    }
  }

  /** Every walkable tile can still be reached from the entrance (pools mustn't cut the cave in two). */
  private allConnected(): boolean {
    const { width: w, height: h } = this;
    const seen = new Uint8Array(w * h);
    const start = this.entry.ty * w + this.entry.tx;
    const stack = [start];
    seen[start] = 1;
    let reached = 0;
    while (stack.length) {
      const c = stack.pop()!;
      reached++;
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        const ni = ny * w + nx;
        if (seen[ni] || this.isWall(nx, ny) || this.isWater(nx, ny)) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    let walkable = 0;
    for (let i = 0; i < w * h; i++) if (!this.wall[i] && this.hazard[i] !== 1) walkable++;
    return reached === walkable;
  }

  /** Glowing lava cracks and crystals (drawn above the dark, so they light up the cave). */
  private decorateHazards(): void {
    const size = GAME_CONFIG.tileSize;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isLava(x, y)) {
          const v = (x * 7 + y * 3) % 3;
          this.add.image(x * size, y * size, `${MINE_TEX.lava}-${v}`).setOrigin(0).setDepth(GLOW_DEPTH).setAlpha(0.85);
          this.add.image(x * size + 8, y * size + 8, TEXTURES.light).setTint(0xff6a2a).setAlpha(0.25).setScale(0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH - 0.5);
        }
      }
    }
    if (this.zoneDef.hazard === 'crystal' && this.kind !== 'dark') {
      for (let n = 0, tries = 0; n < 9 && tries < 200; tries++) {
        const x = this.rng.int(1, this.width - 2);
        const y = this.rng.int(1, this.height - 2);
        // On the floor right under a wall face.
        if (this.isWall(x, y) || !this.isWall(x, y - 1) || Math.hypot(x - this.entry.tx, y - this.entry.ty) < 3) continue;
        this.add.image(x * size + 8, y * size + 6, `${MINE_TEX.crystal}-${n % 2}`).setOrigin(0.5, 1).setDepth(GLOW_DEPTH).setAlpha(0.95);
        this.add.image(x * size + 8, y * size, TEXTURES.light).setTint(0xb890ff).setAlpha(0.3).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH - 0.5);
        n++;
      }
    }
  }

  private placeRocks(): void {
    const size = GAME_CONFIG.tileSize;
    const weights = mineRockWeights(Math.min(this.floor, MINE_MAIN_FLOORS));
    if (this.kind === 'vein') {
      // A rich seam: much less plain stone, twice the ore and gems.
      weights.stone = 15;
      for (const k of ['copper', 'iron', 'gold', 'gem'] as const) weights[k] *= 2;
    }
    const kinds = Object.keys(weights) as MineRockKind[];
    const total = kinds.reduce((s, k) => s + weights[k], 0);
    const pick = (): MineRockKind => {
      let r = this.rng.next() * total;
      for (const k of kinds) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return 'stone';
    };
    const density = this.kind === 'vein' ? 0.32 : 0.24;
    const candidates: Rock[] = [];
    for (let ty = 1; ty < this.height - 1; ty++) {
      for (let tx = 1; tx < this.width - 1; tx++) {
        if (this.isWall(tx, ty) || this.hazard[this.key(tx, ty)] || Math.hypot(tx - this.entry.tx, ty - this.entry.ty) < 3) continue;
        if (!this.rng.chance(density)) continue;
        const kind = pick();
        const x = tx * size + size / 2;
        const baseY = ty * size + size - 2;
        const sprite = this.add
          .image(x, baseY, mineRockTextureKey(kind, this.rng.int(0, MINE_ROCK_VARIANTS - 1)))
          .setOrigin(0.5, 13 / 14)
          .setDepth(DEPTH.ySortBase + baseY);
        const zone = this.add.zone(x, baseY - 3, 12, 7);
        this.walls.add(zone);
        const rock: Rock = { kind, tx, ty, hp: MINE.rocks[kind].hp, sprite, zone, ladder: false };
        this.rocks.set(this.key(tx, ty), rock);
        candidates.push(rock);
      }
    }
    // One rock, well away from the entrance, always hides the way down.
    const far = candidates.filter((r) => Math.hypot(r.tx - this.entry.tx, r.ty - this.entry.ty) > 8);
    const pool = far.length ? far : candidates;
    const hider = pool[this.rng.int(0, Math.max(0, pool.length - 1))];
    // On boss floors the way down only opens when the boss falls; in a den, when the den is clear.
    if (hider && this.floor < MINE_MAX_FLOOR && !bossOf(this.floor) && this.kind !== 'den') {
      hider.ladder = true;
      // A cave-in gives you a hint: the ladder's rock glints (so does a Mine Dash scout's map).
      if (this.kind === 'cavein' || this.run?.useMap()) {
        const glint = this.add.image(hider.sprite.x, hider.sprite.y - 10, TEXTURES.sparkle).setDepth(GLOW_DEPTH).setTint(0xffe27a);
        this.tweens.add({ targets: glint, alpha: 0.2, yoyo: true, repeat: -1, duration: 500 });
        hider.sprite.once(Phaser.GameObjects.Events.DESTROY, () => glint.destroy());
      }
    }
  }

  /** Sometimes a cracked wall hides a drop two floors down. */
  private placeShortcut(): void {
    if (this.kind !== 'normal' || !shortcutAllowed(this.floor) || this.floor + 2 > MINE_MAX_FLOOR || !this.rng.chance(MINE_SHORTCUT.chance)) return;
    const size = GAME_CONFIG.tileSize;
    for (let tries = 0; tries < 300; tries++) {
      const tx = this.rng.int(2, this.width - 3);
      const ty = this.rng.int(2, this.height - 3);
      // A wall tile with a visible face (open floor below), away from the entrance.
      if (!this.isWall(tx, ty) || this.isWall(tx, ty + 1) || this.isWater(tx, ty + 1) || this.rocks.has(this.key(tx, ty + 1))) continue;
      if (Math.hypot(tx - this.entry.tx, ty - this.entry.ty) < 8) continue;
      const sprite = this.add.image(tx * size, ty * size, MINE_TEX.crackedWall).setOrigin(0).setDepth(DEPTH.floor + 0.3);
      this.shortcut = { tx, ty, hp: MINE_SHORTCUT.hp, sprite, open: false };
      return;
    }
  }

  private placeMonsters(): void {
    const size = GAME_CONFIG.tileSize;
    const { count, kinds } = floorMonsters(this.floor);
    const tier = Math.floor((Math.min(this.floor, MINE_MAIN_FLOORS) - 1) / 6);
    const slimeTint = SLIME_TINTS[Math.min(SLIME_TINTS.length - 1, tier)];
    const free = (tx: number, ty: number, minDist: number) =>
      !this.isWall(tx, ty) && !this.hazard[this.key(tx, ty)] && !this.rocks.has(this.key(tx, ty)) && Math.hypot(tx - this.entry.tx, ty - this.entry.ty) >= minDist;
    const boss = bossOf(this.floor);
    if (boss) {
      for (let tries = 0; tries < 800; tries++) {
        const tx = this.rng.int(3, this.width - 4);
        const ty = this.rng.int(3, this.height - 4);
        if (!free(tx, ty, 12)) continue;
        // Clear room around the boss.
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.removeRockAt(tx + dx, ty + dy);
        this.monsters.spawn(boss.base, tx * size + size / 2, ty * size + size - 3, { boss });
        toast(`⚠ ${boss.name} lurks on this floor! Defeat it to open the way down.`);
        break;
      }
    } else gameEvents.emit('mine:boss', null);

    if (this.kind === 'vein') return this.placeTreasureMaybe(false);
    const target = Math.round((boss ? count / 2 : count) * (this.kind === 'den' ? 1.5 : 1));
    const spawned: Monster[] = [];
    for (let n = 0, tries = 0; n < target && tries < 600; tries++) {
      const tx = this.rng.int(1, this.width - 2);
      const ty = this.rng.int(1, this.height - 2);
      // Newer monster kinds show up more as you go deeper.
      let kind: MonsterKind = kinds[Math.min(kinds.length - 1, Math.floor(this.rng.next() * kinds.length * 1.15))];
      const elite = this.rng.chance(MINE_ELITE.chance(this.floor));
      if (kind === 'eel') {
        const pool = this.poolTile();
        if (!pool) kind = 'crab';
        else {
          spawned.push(this.monsters.spawn('eel', pool.tx * size + size / 2, pool.ty * size + size - 2, { home: { x: pool.tx * size + size / 2, y: pool.ty * size + size - 2 }, elite }));
          n++;
          continue;
        }
      }
      if (!free(tx, ty, 9)) continue;
      if (kind === 'mimic' && this.kind === 'den') kind = 'ghost';
      const m = this.monsters.spawn(kind, tx * size + size / 2, ty * size + size - 3, { elite });
      if (kind === 'slime' && !elite) m.sprite.setTint((m.tint = slimeTint));
      if (kind === 'spitter' && !elite) m.sprite.setTint((m.tint = SPITTER_TINTS[Math.min(SPITTER_TINTS.length - 1, tier)]));
      if (kind === 'mimic') m.sprite.setDepth(DEPTH.ySortBase + m.sprite.y);
      spawned.push(m);
      n++;
    }
    // A vault: one monster (not a mimic, eel or fuse cap) carries the key.
    if (this.kind === 'vault') {
      const carriers = spawned.filter((m) => !['mimic', 'eel', 'fusecap'].includes(m.kind));
      const carrier = carriers[this.rng.int(0, Math.max(0, carriers.length - 1))];
      if (carrier) this.monsters.giveKey(carrier);
    }
    // Some floors (and every boss floor and vault) hide a treasure chest.
    this.placeTreasureMaybe(!!boss);
  }

  private placeTreasureMaybe(guarded: boolean): void {
    if (guarded || this.kind === 'vault' || this.rng.next() < 0.22) this.placeTreasure(guarded);
  }

  /** A water tile next to the floor, for an eel to lurk in. */
  private poolTile(): { tx: number; ty: number } | null {
    for (let tries = 0; tries < 200; tries++) {
      const tx = this.rng.int(1, this.width - 2);
      const ty = this.rng.int(1, this.height - 2);
      if (!this.isWater(tx, ty)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !this.isWall(tx + dx, ty + dy) && !this.isWater(tx + dx, ty + dy));
      if (edge && Math.hypot(tx - this.entry.tx, ty - this.entry.ty) > 6) return { tx, ty };
    }
    return null;
  }

  private removeRockAt(tx: number, ty: number): void {
    const rock = this.rocks.get(this.key(tx, ty));
    if (!rock) return;
    this.rocks.delete(this.key(tx, ty));
    this.walls.remove(rock.zone, true, true);
    rock.sprite.destroy();
  }

  private placeTreasure(guarded: boolean): void {
    const size = GAME_CONFIG.tileSize;
    for (let tries = 0; tries < 500; tries++) {
      const tx = this.rng.int(2, this.width - 3);
      const ty = this.rng.int(2, this.height - 3);
      if (this.isWall(tx, ty) || this.hazard[this.key(tx, ty)] || this.rocks.has(this.key(tx, ty)) || Math.hypot(tx - this.entry.tx, ty - this.entry.ty) < (guarded ? 4 : 10)) continue;
      const sprite = this.add.sprite(tx * size + size / 2, ty * size + size - 1, TEXTURES.treasure, 0).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + ty * size + size);
      const zone = this.add.zone(tx * size + size / 2, ty * size + size - 5, 14, 8);
      this.walls.add(zone);
      const locked = this.kind === 'vault';
      if (locked) sprite.setTint(0xffe6a0);
      this.treasure = { tx, ty, sprite, opened: false, zone, locked };
      if (guarded) sprite.setVisible(false);
      return;
    }
  }

  /** A seeded roll for one thing on this floor (a rock, a monster, the chest): the same in every run of the same mine. */
  private lootRng(label: string): Rng {
    return createRng(`${this.floorSeed}:loot:${label}`);
  }

  private rollTreasure(rng: Rng): { itemId: ItemId; quantity: number } {
    const table = treasureTable(Math.min(this.floor, MINE_MAIN_FLOORS));
    let roll = rng.next() * table.reduce((n, e) => n + e.weight, 0);
    for (const e of table) {
      roll -= e.weight;
      if (roll <= 0) return e;
    }
    return table[0];
  }

  private openTreasure(): void {
    const t = this.treasure;
    if (!t || t.opened) return;
    if (t.locked && !this.hasKey) return;
    t.opened = true;
    t.sprite.setFrame(1).clearTint();
    const rng = this.lootRng('chest');
    const x = t.sprite.x;
    const y = t.sprite.y - 8;
    const rolls = t.locked ? 2 : 1;
    const got: string[] = [];
    for (let i = 0; i < rolls; i++) {
      const pick = this.rollTreasure(rng);
      this.drops.spawn(pick.itemId, pick.quantity, x + (i ? 6 : 0), y);
      got.push(`${pick.quantity > 1 ? `${pick.quantity}× ` : ''}${ITEMS[pick.itemId].name}`);
    }
    if (bossOf(this.floor) && !this.monsters.bossAlive) this.drops.spawn('gold_ore', 3 + Math.floor(this.floor / 10), x, y);
    if (t.locked) {
      this.drops.spawn('gold_ore', 2 + Math.floor(this.floor / 8), x - 6, y);
      this.run?.event({ t: 'vault' });
    }
    this.fx.burst('sparkle', x, y, 14);
    sfx('sparkle');
    toast(`${t.locked ? 'Vault' : 'Treasure'}! ${got.join(', ')}`);
  }

  // ---------- Actions ----------

  private target(): { tx: number; ty: number } {
    const { tx, ty } = this.player.tile;
    const [dx, dy] = DIRECTION_OFFSET[this.player.facingDirection];
    return { tx: tx + dx, ty: ty + dy };
  }

  private resolve(): Action | null {
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    const stack = this.host.state.inventory.selectedStack;
    const tool = stack ? ITEMS[stack.itemId].tool : undefined;
    const at = (p: { tx: number; ty: number } | null) => !!p && ((tx === p.tx && ty === p.ty) || (feet.tx === p.tx && feet.ty === p.ty));

    if (at(this.entry)) return { verb: 'Climb out', key: 'E', run: () => this.leave(false) };
    if (at(this.ladderDown)) return { verb: `Climb down to floor ${this.floor + 1}`, key: 'E', run: () => this.descend(1) };
    const sc = this.shortcut;
    if (sc && tx === sc.tx && ty === sc.ty) {
      if (sc.open) return { verb: `Drop down to floor ${this.floor + 2}`, key: 'E', run: () => this.descend(2) };
      if (tool?.kind !== 'pickaxe') return { verb: 'A cracked wall (needs a pickaxe)', key: 'Space', blocked: true, run: () => undefined };
      return { verb: 'Break the cracked wall', key: 'Space', run: () => this.player.useTool(itemTextureKey(stack!.itemId), 'swing', () => this.hitShortcut(tool.power)) };
    }
    const mimic = this.monsters.mimicAt(tx, ty);
    if (mimic) return { verb: 'Open treasure chest', key: 'E', run: () => this.monsters.wakeMimic(mimic) };
    const chest = this.treasure;
    if (chest && chest.sprite.visible && !chest.opened && ((tx === chest.tx && ty === chest.ty) || Math.hypot(this.player.x - chest.sprite.x, this.player.y - chest.sprite.y) < 14)) {
      if (chest.locked && !this.hasKey) return { verb: 'Locked: a monster here carries the key', key: 'E', blocked: true, run: () => toast('The vault is locked. Find the monster with the key over its head.') };
      return { verb: chest.locked ? 'Unlock the vault' : 'Open treasure chest', key: 'E', run: () => this.openTreasure() };
    }
    if (this.monsters.inFront().length) {
      return { verb: tool?.kind === 'sword' ? 'Attack' : 'Attack (a sword hits harder)', key: 'Space', run: () => this.swing() };
    }
    const rock = this.rocks.get(this.key(tx, ty));
    if (rock) {
      if (tool?.kind !== 'pickaxe') return { verb: 'Needs a pickaxe', key: 'Space', blocked: true, run: () => this.player.useTool(stack ? itemTextureKey(stack.itemId) : null, 'swing', () => this.fx.shake(rock.sprite)) };
      const cost = skills.toolCost('pickaxe', GAME_CONFIG.energy.toolCost);
      if (this.host.state.energy < cost) return { verb: 'Too tired', key: 'Space', blocked: true, run: () => toast("You're exhausted. Eat something.") };
      return {
        verb: 'Mine',
        key: 'Space',
        run: () => {
          if (!this.host.state.spendEnergy(cost)) return;
          this.player.useTool(itemTextureKey(stack!.itemId), 'swing', () => this.hitRock(rock, tool.power * (this.host.state.hasBuff('mining') ? 2 : 1)));
        },
      };
    }
    return null;
  }

  private perform(action: Action): void {
    if (this.player.isBusy()) return;
    if (action.blocked) sfx('error');
    action.run();
  }

  /** Swing whatever you hold; anything in front gets hit (a sword hurts most). */
  private swing(): void {
    const stack = this.host.state.inventory.selectedStack;
    const tool = stack ? ITEMS[stack.itemId].tool : undefined;
    const texture = stack && tool ? itemTextureKey(stack.itemId) : null;
    const damage = (tool?.kind === 'sword' ? tool.power : tool ? 1 : 0) + (tool ? this.host.state.attackBonus + (this.run?.attackBonus ?? 0) : 0);
    if (!tool) return;
    this.player.useTool(texture, 'swing', () => {
      for (const s of this.monsters.inFront()) this.monsters.hit(s, damage);
    });
  }

  private hitRock(rock: Rock, power: number): void {
    rock.hp -= power;
    this.fx.burst('stone', rock.sprite.x, rock.sprite.y - 6, 5);
    sfx('mine');
    if (rock.hp > 0) {
      this.fx.shake(rock.sprite);
      return;
    }
    this.breakRock(rock);
  }

  private breakRock(rock: Rock): void {
    if (!this.rocks.has(this.key(rock.tx, rock.ty))) return;
    this.rocks.delete(this.key(rock.tx, rock.ty));
    this.walls.remove(rock.zone, true, true);
    const { x, y } = rock.sprite;
    rock.sprite.destroy();
    this.fx.burst('stone', x, y - 6, 10);
    sfx('rockBreak');
    const rng = this.lootRng(`rock:${rock.tx},${rock.ty}`);
    const def: MineRockDef = MINE.rocks[rock.kind];
    for (const d of def.drops) {
      if (d.chance !== undefined && rng.next() > d.chance) continue;
      this.drops.spawn(d.itemId, rng.int(d.min, d.max) + (skills.bonus('mining') ? 1 : 0), x, y - 6);
    }
    skills.gain('mining', rock.kind === 'stone' ? 4 : rock.kind === 'gem' ? 12 : 8);
    // Old things buried in the rock: pots up high, fossils deep down.
    if (rng.next() < 0.012) this.drops.spawn(this.floor < 15 ? 'clay_pot' : 'fossil', 1, x, y - 6);
    const ladderRoll = rng.next() < MINE.ladderChance && !bossOf(this.floor) && this.kind !== 'den';
    if (!this.ladderDown && this.floor < MINE_MAX_FLOOR && (rock.ladder || ladderRoll)) this.revealLadder(rock.tx, rock.ty);
  }

  private hitShortcut(power: number): void {
    const sc = this.shortcut;
    if (!sc || sc.open) return;
    sc.hp -= power;
    this.fx.burst('stone', sc.tx * 16 + 8, sc.ty * 16 + 12, 6);
    sfx('mine', { rate: 0.8 });
    if (sc.hp > 0) return;
    sc.open = true;
    sc.sprite.setTexture(TEXTURES.ladderDown).setOrigin(0).setTint(0x8a7a6a);
    sfx('rockBreak', { rate: 0.7 });
    this.fx.burst('stone', sc.tx * 16 + 8, sc.ty * 16 + 8, 14);
    toast(`A shortcut! It drops two floors, to floor ${this.floor + 2}.`);
  }

  private revealLadder(tx: number, ty: number): void {
    const size = GAME_CONFIG.tileSize;
    this.ladderDown = { tx, ty };
    this.ladderSprite = this.add.image(tx * size + size / 2, ty * size + size / 2, TEXTURES.ladderDown).setDepth(DEPTH.floor + 0.2);
    this.fx.pop(this.ladderSprite);
    this.fx.burst('sparkle', tx * size + 8, ty * size + 6, 8);
    sfx('sparkle');
    toast(this.floor === MINE_MAIN_FLOORS ? 'A ladder down… into the Abyss.' : 'You found a ladder down!');
  }

  /** A free floor tile for the ladder (where a monster fell, or near it). */
  private ladderSpotNear(x: number, y: number): { tx: number; ty: number } {
    const size = GAME_CONFIG.tileSize;
    const cx = Math.floor(x / size);
    const cy = Math.floor((y - 3) / size);
    for (let r = 0; r < 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (!this.isWall(tx, ty) && !this.hazard[this.key(tx, ty)] && !this.rocks.has(this.key(tx, ty))) return { tx, ty };
        }
      }
    }
    return { tx: cx, ty: cy };
  }

  private descend(by: number): void {
    if (this.leaving) return;
    this.leaving = true;
    if (!this.hurtThisFloor) this.run?.event({ t: 'clean', floor: this.floor });
    // Mine Dash: every 5th floor (and the end of the course) is followed by a camp.
    if (this.run && (this.floor % 5 === 0 || this.floor >= this.run.lastFloor)) {
      this.run.camp(this.floor).then((choice) => {
        if (choice === 'bank') {
          this.leaving = false;
          this.leave(false);
        } else this.goDown(by);
      });
      return;
    }
    this.goDown(by);
  }

  private goDown(by: number): void {
    sfx('step', { rate: 0.6 });
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.restart({ floor: Math.min(MINE_MAX_FLOOR, this.floor + by), host: this.host, run: this.run } satisfies MineSceneData),
    );
  }

  private leave(fainted: boolean): void {
    if (this.leaving) return;
    this.leaving = true;
    gameEvents.emit('interaction:hint', { action: null, key: null, blocked: false, info: false });
    gameEvents.emit('interaction:anchor', null);
    this.cameras.main.fadeOut(fainted ? 900 : 350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.host.exit({ fainted }));
  }

  // ---------- Monsters (see MineMonsters) ----------

  /** What the monsters need to know about the cave. */
  private mineWorld(): MineWorld {
    const size = GAME_CONFIG.tileSize;
    return {
      scene: this,
      floor: this.floor,
      rng: this.aiRng,
      player: this.player,
      fx: this.fx,
      isWall: (tx, ty) => this.isWall(tx, ty),
      isWater: (tx, ty) => this.isWater(tx, ty),
      hasRock: (tx, ty) => this.rocks.has(this.key(tx, ty)),
      freeTile: (minDist) => {
        const p = this.player.tile;
        for (let tries = 0; tries < 200; tries++) {
          const tx = this.aiRng.int(2, this.width - 3);
          const ty = this.aiRng.int(2, this.height - 3);
          if (this.isWall(tx, ty) || this.hazard[this.key(tx, ty)] || this.rocks.has(this.key(tx, ty))) continue;
          if (Math.hypot(tx - p.tx, ty - p.ty) >= minDist) return { tx, ty };
        }
        return null;
      },
      hurtPlayer: (damage, x, y) => this.hurtPlayer(damage, x, y),
      slowPlayer: (ms) => {
        this.slowUntil = this.time.now + ms;
        this.player.sprite.setTint(0xb8e08a);
        this.time.delayedCall(ms, () => this.player.sprite.clearTint());
      },
      stealLight: () => {
        this.lightStolen = true;
        this.updateLight();
      },
      restoreLight: () => {
        this.lightStolen = false;
        this.updateLight();
      },
      snuffLight: (ms) => {
        this.snuffedUntil = this.time.now + ms;
        this.updateLight();
        toast('Your lantern flickers out!');
        this.time.delayedCall(ms + 20, () => this.updateLight());
      },
      blastRocks: (x, y, radius) => {
        for (const rock of [...this.rocks.values()]) if (Math.hypot(rock.sprite.x - x, rock.sprite.y - 6 - y) < radius) this.breakRock(rock);
        const sc = this.shortcut;
        if (sc && !sc.open && Math.hypot(sc.tx * size + 8 - x, sc.ty * size + 8 - y) < radius + 8) this.hitShortcut(99);
      },
      onKilled: (m) => this.onMonsterKilled(m),
      onBoss: (info) => gameEvents.emit('mine:boss', info),
    };
  }

  private onMonsterKilled(m: Monster): void {
    const { x, y } = m.sprite;
    const rng = this.lootRng(`monster:${m.id}`);
    for (const d of MONSTERS[m.kind].drops) if (rng.next() < d.chance) this.drops.spawn(d.itemId, 1, x, y - 4);
    if (m.kind === 'slime' && this.floor >= 5 && rng.next() < 0.15) this.drops.spawn('iron_ore', 1, x, y - 4);
    if (m.kind === 'mimic') {
      // A mimic's belly is full of treasure.
      for (let i = 0; i < 2; i++) {
        const pick = this.rollTreasure(rng);
        this.drops.spawn(pick.itemId, pick.quantity, x + (i ? 6 : -6), y - 4);
      }
    }
    if (m.elite) {
      this.drops.spawn('gold_ore', 1 + rng.int(0, 1), x, y - 4);
      if (rng.next() < 0.25) this.drops.spawn('amethyst', 1, x, y - 4);
      this.run?.event({ t: 'elite' });
    }
    if (m.hasKey) {
      const size = GAME_CONFIG.tileSize;
      const spot = this.ladderSpotNear(x, y);
      const sprite = this.add.image(spot.tx * size + size / 2, spot.ty * size + size / 2, MINE_TEX.key).setDepth(GLOW_DEPTH);
      this.tweens.add({ targets: sprite, y: sprite.y - 3, yoyo: true, repeat: -1, duration: 400 });
      this.vaultKey = { sprite };
      toast('It dropped the vault key!');
    }
    if (m.boss) {
      toast(`You defeated ${m.boss.name}!`);
      this.cameras.main.shake(300, 0.01);
      for (let i = 0; i < (m.boss.mini ? 2 : 4); i++) this.drops.spawn(i % 2 ? 'gold_ore' : 'amethyst', 1, x + (i - 1.5) * 6, y - 4);
      if (this.treasure) {
        this.treasure.sprite.setVisible(true);
        this.fx.pop(this.treasure.sprite);
      }
      this.run?.event({ t: 'boss', floor: this.floor, id: m.boss.id, mini: !!m.boss.mini });
      if (this.floor === MINE_MAIN_FLOORS) toast('You have conquered the mine! Below lies the Abyss.');
      if (this.floor < MINE_MAX_FLOOR && !this.ladderDown) {
        const spot = this.ladderSpotNear(x, y);
        this.revealLadder(spot.tx, spot.ty);
      }
    }
    // A monster den opens once it's empty.
    if (this.kind === 'den' && !this.ladderDown && this.monsters.remaining === 0) {
      const spot = this.ladderSpotNear(x, y);
      toast('The den is clear!');
      this.revealLadder(spot.tx, spot.ty);
    }
  }

  private pickUpKey(): void {
    const k = this.vaultKey;
    if (!k || Math.hypot(this.player.x - k.sprite.x, this.player.y - 6 - k.sprite.y) > 12) return;
    k.sprite.destroy();
    this.vaultKey = null;
    this.hasKey = true;
    sfx('sparkle');
    toast('You have the vault key! Find the locked chest.');
  }

  private hurtPlayer(damage: number, fromX: number, fromY: number): void {
    if (this.invulnerable > 0 || this.leaving) return;
    this.invulnerable = INVULNERABLE_MS;
    this.hurtThisFloor = true;
    const dealt = Math.max(1, Math.round(damage * (1 - Math.min(0.8, this.host.state.defense + (this.run?.defenseBonus ?? 0)))));
    const left = this.host.state.hurt(dealt);
    this.run?.event({ t: 'hurt', damage: dealt });
    sfx('clunk', { rate: 0.7 });
    this.cameras.main.shake(140, 0.006);
    this.player.sprite.setTintFill(0xff6a5a);
    this.time.delayedCall(140, () => this.player.sprite.clearTint());
    // Bounce away from what hit you (unless that would put you in a wall or a pool).
    const a = Math.atan2(this.player.y - fromY, this.player.x - fromX);
    const nx = this.player.x + Math.cos(a) * 8;
    const ny = this.player.y + Math.sin(a) * 8;
    const size = GAME_CONFIG.tileSize;
    const tx = Math.floor(nx / size);
    const ty = Math.floor((ny - 2) / size);
    if (!this.isWall(tx, ty) && !this.isWater(tx, ty) && !this.rocks.has(this.key(tx, ty))) this.player.sprite.body.reset(nx, ny);
    if (left <= 0) {
      toast('You fainted…');
      this.leave(true);
    }
  }

  // ---------- Hazards ----------

  private updateHazards(delta: number): void {
    // Lava cracks burn.
    const { tx, ty } = this.player.tile;
    this.lavaTick -= delta;
    if (this.isLava(tx, ty) && this.lavaTick <= 0) {
      this.lavaTick = 800;
      this.hurtPlayer(Math.round(4 + Math.min(this.floor, 60) * 0.2), this.player.x, this.player.y + 4);
    }
    // The cave-in: the clock runs down, then the roof comes in until you get out.
    if (this.kind === 'cavein' && !this.ladderDownTaken()) {
      this.caveIn -= delta;
      if (this.caveIn < 10_000 && this.caveIn > 0 && Math.floor(this.caveIn / 700) !== Math.floor((this.caveIn + delta) / 700)) {
        this.cameras.main.shake(180, 0.004);
        this.fx.burst('stone', this.player.x + this.aiRng.range(-60, 60), this.player.y - 40, 4);
      }
      if (this.caveIn <= 0) {
        this.caveInTick -= delta;
        if (this.caveInTick <= 0) {
          this.caveInTick = 5000;
          this.cameras.main.shake(400, 0.015);
          sfx('rockBreak', { rate: 0.5 });
          this.invulnerable = 0;
          this.hurtPlayer(this.caveIn > -1000 ? Math.round(MINE.maxHealth * 0.4) : 10, this.player.x, this.player.y - 10);
        }
      }
    }
  }

  private ladderDownTaken(): boolean {
    return this.leaving;
  }

  /** The lantern: smaller while stolen or snuffed. */
  private updateLight(): void {
    const snuffed = this.time.now < this.snuffedUntil;
    const radius = snuffed ? 26 : this.lightStolen ? 36 : this.lantern;
    this.darkness.setTexture(this.lightTexture(radius));
    this.darkness.setAlpha(snuffed || this.lightStolen ? 0.99 : this.kind === 'dark' ? 0.985 : this.zoneDef.darkness);
  }

  // ---------- HUD ----------

  private emitStatus(force: boolean): void {
    const timer = this.kind === 'cavein' ? Math.max(0, Math.ceil(this.caveIn / 1000)) : null;
    const status = {
      floor: this.floor,
      zone: this.zoneDef.name,
      kind: this.kind === 'normal' ? null : MINE_FLOOR_KINDS[this.kind].name,
      timer,
      key: this.kind === 'vault' ? this.hasKey : null,
    };
    const sig = JSON.stringify(status);
    if (!force && sig === this.lastStatus) return;
    this.lastStatus = sig;
    gameEvents.emit('mine:floor', status);
  }

  // ---------- Helpers ----------

  private isWall(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
    return this.wall[ty * this.width + tx] === 1;
  }

  private isWater(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.hazard[ty * this.width + tx] === 1;
  }

  private isLava(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.hazard[ty * this.width + tx] === 2;
  }

  private touchesFloor(tx: number, ty: number): boolean {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!this.isWall(tx + dx, ty + dy)) return true;
    return false;
  }

  private key(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  /** A large dark sheet with a soft hole of light around the player (the miner's lantern), one per radius. */
  private lightTexture(radius: number): string {
    const key = `mine-lantern-${radius}`;
    if (this.textures.exists(key)) return key;
    const size = 1400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, radius * 0.25, size / 2, size / 2, radius);
    g.addColorStop(0, 'rgba(8,5,4,0)');
    g.addColorStop(0.55, 'rgba(8,5,4,0.35)');
    g.addColorStop(1, 'rgba(8,5,4,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    this.textures.addCanvas(key, canvas);
    return key;
  }

  private drawCursor(action: Action | null): void {
    const g = this.cursor;
    g.clear();
    if (!action) return;
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const pulse = 0.75 + Math.sin(this.time.now / 180) * 0.2;
    g.lineStyle(1, action.blocked ? 0xf08a7a : 0xffffff, pulse);
    g.strokeRect(tx * size + 0.5, ty * size + 0.5, size - 1, size - 1);
  }

  /** The floating action button and hint, shared with the surface. */
  private emitHint(action: Action | null): void {
    const hint = action
      ? { action: action.verb, key: action.blocked ? null : action.key, blocked: !!action.blocked, info: false }
      : { action: null, key: null, blocked: false, info: false };
    const sig = `${hint.action}|${hint.key}|${hint.blocked}`;
    if (sig !== this.lastHint) {
      this.lastHint = sig;
      gameEvents.emit('interaction:hint', hint);
    }
    let anchor: { x: number; y: number } | null = null;
    if (action) {
      const size = GAME_CONFIG.tileSize;
      const { tx, ty } = this.target();
      const cam = this.cameras.main;
      anchor = { x: Math.round((tx * size + size / 2 - cam.worldView.x) * cam.zoom), y: Math.round((ty * size - 10 - cam.worldView.y) * cam.zoom) };
    }
    const key = anchor ? `${anchor.x},${anchor.y}` : 'none';
    if (key !== this.lastAnchor) {
      this.lastAnchor = key;
      gameEvents.emit('interaction:anchor', anchor);
    }
  }
}

