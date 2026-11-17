import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { bossOf, floorMonsters, GAME_CONFIG, ITEMS, MINE, MONSTERS, mineRockWeights, treasureTable, type BossDef, type ItemId, type MineRockDef, type MineRockKind, type MonsterKind } from '@farming/shared';
import { itemTextureKey, MINE_ROCK_VARIANTS, mineRockTextureKey, TEXTURES } from '../assets/registerTextures';
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

interface Slime {
  kind: MonsterKind;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  tint: number;
  boss?: BossDef;
  /** Time until the next hop (ms); negative while mid-hop. */
  timer: number;
  vx: number;
  vy: number;
  flash: number;
}

type Action = { verb: string; key: 'Space' | 'E'; blocked?: boolean; run: () => void };

const SLIME_TINTS = [0x7ed36a, 0x6ab8f0, 0xb07ae0, 0xf07a6a, 0xf0d06a];
const DIRECTION_OFFSET = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] } as const;
const INVULNERABLE_MS = 900;

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * One floor of the mine. Each visit generates a fresh cave: rock to break
 * for stone, ore and gems, slimes that chase you, a ladder down hidden under
 * one of the rocks, and the ladder back up where you came in. Deeper floors
 * hold iron, gold and tougher slimes. It's dark down here.
 */
export class MineScene extends Phaser.Scene {
  private floor = 1;
  private host!: MineHost;
  private rng!: Rng;
  private wall!: Uint8Array;
  private width: number = MINE.width;
  private height: number = MINE.height;
  private player!: Player;
  private controls!: InputSystem;
  private fx!: FxSystem;
  private drops!: DropSystem;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private readonly rocks = new Map<number, Rock>();
  private slimes: Slime[] = [];
  private treasure: { tx: number; ty: number; sprite: Phaser.GameObjects.Sprite; opened: boolean; zone: Phaser.GameObjects.Zone } | null = null;
  private boss: Slime | null = null;
  private entry = { tx: 1, ty: 1 };
  private ladderDown: { tx: number; ty: number } | null = null;
  private ladderSprite: Phaser.GameObjects.Image | null = null;
  private cursor!: Phaser.GameObjects.Graphics;
  private darkness!: Phaser.GameObjects.Image;
  private invulnerable = 0;
  private lastHint = '';
  private lastAnchor = '';
  private floorTexture = '';
  private leaving = false;

  constructor() {
    super(SCENES.Mine);
  }

  init(data: MineSceneData): void {
    this.floor = Math.max(1, Math.min(MINE.floors, Math.floor(data.floor)));
    this.host = data.host;
    this.rocks.clear();
    this.slimes = [];
    this.treasure = null;
    this.boss = null;
    this.ladderDown = null;
    this.ladderSprite = null;
    this.invulnerable = 0;
    this.lastHint = '';
    this.lastAnchor = '';
    this.leaving = false;
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    this.rng = createRng(`mine:${this.floor}:${Date.now()}:${Math.random()}`);
    this.generateCave();

    // The cave as one image.
    this.floorTexture = `mine-floor-${this.floor}-${Date.now()}`;
    this.textures.addCanvas(this.floorTexture, drawCaveFloor(this.rng, this.width, this.height, (x, y) => this.isWall(x, y)));
    this.add.image(0, 0, this.floorTexture).setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#0b0807');
    this.physics.world.setBounds(0, 0, this.width * size, this.height * size);

    // Walls: one collider per horizontal run of wall tiles that touch the open cave.
    this.walls = this.physics.add.staticGroup();
    for (let ty = 0; ty < this.height; ty++) {
      let start = -1;
      for (let tx = 0; tx <= this.width; tx++) {
        const solid = tx < this.width && this.isWall(tx, ty) && this.touchesFloor(tx, ty);
        if (solid && start < 0) start = tx;
        if (!solid && start >= 0) {
          const w = (tx - start) * size;
          this.walls.add(this.add.zone(start * size + w / 2, ty * size + size / 2, w, size));
          start = -1;
        }
      }
    }

    this.fx = new FxSystem(this);
    this.drops = new DropSystem(this, { persist: false });

    // The ladder back up, where you arrive.
    this.add
      .image(this.entry.tx * size + size / 2, this.entry.ty * size + size - 2, TEXTURES.ladderUp)
      .setOrigin(0.5, 25 / 26)
      .setDepth(DEPTH.ySortBase + this.entry.ty * size + 2);

    this.placeRocks();
    this.placeSlimes();

    this.player = new Player(this, this.entry.tx * size + size / 2, (this.entry.ty + 1) * size + 12);
    this.physics.add.collider(this.player.sprite, this.walls);
    this.controls = new InputSystem(this);
    new CameraSystem(this, this.player.sprite, this.width * size, this.height * size);

    this.cursor = this.add.graphics().setDepth(DEPTH.cursor);
    this.darkness = this.add.image(0, 0, this.lightTexture()).setDepth(DEPTH.lighting).setAlpha(this.floor > 10 ? 0.95 : 0.88);

    if (this.host.state.reachFloor(this.floor) && this.floor % MINE.elevatorEvery === 0) {
      toast(`The elevator now stops at floor ${this.floor}.`);
    }
    gameEvents.emit('mine:floor', { floor: this.floor });
    toast(`Mine — floor ${this.floor}`);
    sfx('whoosh', { rate: 0.6, volume: 0.6 });
    this.cameras.main.fadeIn(350, 0, 0, 0);

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.postUpdate, this);
      if (this.textures.exists(this.floorTexture)) this.textures.remove(this.floorTexture);
    });
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
    this.player.speedBoost = this.host.state.hasBuff('speed') ? 1.25 : 1;
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
    }
    this.updateSlimes(delta, frozen);
    this.drops.update(delta, this.player.x, this.player.y, this.host.state.inventory);
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

  private placeRocks(): void {
    const size = GAME_CONFIG.tileSize;
    const weights = mineRockWeights(this.floor);
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
    const candidates: Rock[] = [];
    for (let ty = 1; ty < this.height - 1; ty++) {
      for (let tx = 1; tx < this.width - 1; tx++) {
        if (this.isWall(tx, ty) || Math.hypot(tx - this.entry.tx, ty - this.entry.ty) < 3) continue;
        if (!this.rng.chance(0.24)) continue;
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
    const hider = (far.length ? far : candidates)[this.rng.int(0, Math.max(0, (far.length ? far : candidates).length - 1))];
    // On boss floors the way down only opens when the boss falls.
    if (hider && this.floor < MINE.floors && !bossOf(this.floor)) hider.ladder = true;
  }

  private placeSlimes(): void {
    const size = GAME_CONFIG.tileSize;
    const { count, kinds } = floorMonsters(this.floor);
    const slimeTint = SLIME_TINTS[Math.min(SLIME_TINTS.length - 1, Math.floor((this.floor - 1) / 6))];
    const free = (tx: number, ty: number, minDist: number) =>
      !this.isWall(tx, ty) && !this.rocks.has(this.key(tx, ty)) && Math.hypot(tx - this.entry.tx, ty - this.entry.ty) >= minDist;
    const boss = bossOf(this.floor);
    if (boss) {
      for (let tries = 0; tries < 800; tries++) {
        const tx = this.rng.int(2, this.width - 3);
        const ty = this.rng.int(2, this.height - 3);
        if (!free(tx, ty, 12)) continue;
        // Clear room around the boss.
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.removeRockAt(tx + dx, ty + dy);
        this.boss = this.spawnMonster(boss.base, tx * size + size / 2, ty * size + size - 3, boss);
        gameEvents.emit('mine:boss', { name: boss.name, hp: boss.hp, maxHp: boss.hp });
        toast(`⚠ ${boss.name} lurks on this floor! Defeat it to open the way down.`);
        break;
      }
    } else gameEvents.emit('mine:boss', null);
    for (let n = 0, tries = 0; n < (boss ? Math.floor(count / 2) : count) && tries < 500; tries++) {
      const tx = this.rng.int(1, this.width - 2);
      const ty = this.rng.int(1, this.height - 2);
      if (!free(tx, ty, 9)) continue;
      // Newer monster kinds show up more as you go deeper.
      const kind = kinds[Math.min(kinds.length - 1, Math.floor(this.rng.next() * kinds.length * 1.15))];
      const m = this.spawnMonster(kind, tx * size + size / 2, ty * size + size - 3);
      if (kind === 'slime') m.tint = slimeTint;
      m.sprite.setTint(m.tint);
      n++;
    }
    // Some floors (and every boss floor) hide a treasure chest.
    if (boss || this.rng.next() < 0.22) this.placeTreasure(!!boss);
  }

  private spawnMonster(kind: MonsterKind, x: number, y: number, boss?: BossDef): Slime {
    const def = MONSTERS[kind];
    const texture = { slime: TEXTURES.slime, bat: TEXTURES.bat, crab: TEXTURES.crab, ghost: TEXTURES.ghost }[kind];
    const tint = boss?.tint ?? (kind === 'ghost' ? 0xffffff : 0xffffff);
    const sprite = this.add.sprite(x, y, texture, 0).setOrigin(0.5, 1).setTint(tint);
    if (boss) sprite.setScale(boss.scale);
    if (kind === 'ghost') sprite.setAlpha(0.75);
    const shadow = this.add.image(x, y, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(boss ? boss.scale * 0.8 : 0.8);
    if (kind === 'bat' || kind === 'ghost') shadow.setAlpha(0.4);
    const hp = boss?.hp ?? def.hp(this.floor);
    const m: Slime = {
      kind,
      sprite,
      shadow,
      hp,
      maxHp: hp,
      damage: boss?.damage ?? def.damage(this.floor),
      speed: boss?.speed ?? def.speed(this.floor),
      tint,
      boss,
      timer: this.rng.range(200, 1500),
      vx: 0,
      vy: 0,
      flash: 0,
    };
    this.slimes.push(m);
    return m;
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
      if (this.isWall(tx, ty) || this.rocks.has(this.key(tx, ty)) || Math.hypot(tx - this.entry.tx, ty - this.entry.ty) < (guarded ? 4 : 10)) continue;
      const sprite = this.add.sprite(tx * size + size / 2, ty * size + size - 1, TEXTURES.treasure, 0).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + ty * size + size);
      const zone = this.add.zone(tx * size + size / 2, ty * size + size - 5, 14, 8);
      this.walls.add(zone);
      this.treasure = { tx, ty, sprite, opened: false, zone };
      if (guarded) sprite.setVisible(false);
      return;
    }
  }

  private openTreasure(): void {
    const t = this.treasure;
    if (!t || t.opened) return;
    t.opened = true;
    t.sprite.setFrame(1);
    const table = treasureTable(this.floor);
    let roll = Math.random() * table.reduce((n, e) => n + e.weight, 0);
    let pick: { itemId: ItemId; quantity: number } = table[0];
    for (const e of table) {
      roll -= e.weight;
      if (roll <= 0) {
        pick = e;
        break;
      }
    }
    const x = t.sprite.x;
    const y = t.sprite.y - 8;
    this.drops.spawn(pick.itemId, pick.quantity, x, y);
    if (this.boss === null && bossOf(this.floor)) this.drops.spawn('gold_ore', 3 + Math.floor(this.floor / 10), x, y);
    this.fx.burst('sparkle', x, y, 14);
    sfx('sparkle');
    toast(`Treasure! ${pick.quantity > 1 ? `${pick.quantity}× ` : ''}${ITEMS[pick.itemId].name}`);
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

    if ((tx === this.entry.tx && ty === this.entry.ty) || (feet.tx === this.entry.tx && feet.ty === this.entry.ty)) {
      return { verb: 'Climb out', key: 'E', run: () => this.leave(false) };
    }
    const down = this.ladderDown;
    if (down && ((tx === down.tx && ty === down.ty) || (feet.tx === down.tx && feet.ty === down.ty))) {
      return { verb: `Climb down to floor ${this.floor + 1}`, key: 'E', run: () => this.descend() };
    }
    const chest = this.treasure;
    if (chest && chest.sprite.visible && !chest.opened && ((tx === chest.tx && ty === chest.ty) || Math.hypot(this.player.x - chest.sprite.x, this.player.y - chest.sprite.y) < 14)) {
      return { verb: 'Open treasure chest', key: 'E', run: () => this.openTreasure() };
    }
    if (this.slimeInFront()) {
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
    const damage = (tool?.kind === 'sword' ? tool.power : tool ? 1 : 0) + (tool ? this.host.state.attackBonus : 0);
    if (!tool) return;
    this.player.useTool(texture, 'swing', () => {
      for (const s of this.slimesInFront()) this.hitSlime(s, damage);
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
    this.rocks.delete(this.key(rock.tx, rock.ty));
    this.walls.remove(rock.zone, true, true);
    rock.sprite.destroy();
    this.fx.burst('stone', rock.sprite.x, rock.sprite.y - 6, 10);
    sfx('rockBreak');
    const def: MineRockDef = MINE.rocks[rock.kind];
    for (const d of def.drops) {
      if (d.chance !== undefined && Math.random() > d.chance) continue;
      this.drops.spawn(d.itemId, Phaser.Math.Between(d.min, d.max) + (skills.bonus('mining') ? 1 : 0), rock.sprite.x, rock.sprite.y - 6);
    }
    skills.gain('mining', rock.kind === 'stone' ? 4 : rock.kind === 'gem' ? 12 : 8);
    // Old things buried in the rock: pots up high, fossils deep down.
    if (Math.random() < 0.012) this.drops.spawn(this.floor < 15 ? 'clay_pot' : 'fossil', 1, rock.sprite.x, rock.sprite.y - 6);
    if (!this.ladderDown && this.floor < MINE.floors && (rock.ladder || Math.random() < MINE.ladderChance)) this.revealLadder(rock.tx, rock.ty);
  }

  private revealLadder(tx: number, ty: number): void {
    const size = GAME_CONFIG.tileSize;
    this.ladderDown = { tx, ty };
    this.ladderSprite = this.add.image(tx * size + size / 2, ty * size + size / 2, TEXTURES.ladderDown).setDepth(DEPTH.floor + 0.2);
    this.fx.pop(this.ladderSprite);
    this.fx.burst('sparkle', tx * size + 8, ty * size + 6, 8);
    sfx('sparkle');
    toast('You found a ladder down!');
  }

  private descend(): void {
    if (this.leaving) return;
    this.leaving = true;
    sfx('step', { rate: 0.6 });
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.restart({ floor: this.floor + 1, host: this.host } satisfies MineSceneData),
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

  // ---------- Slimes ----------

  private slimesInFront(): Slime[] {
    const [dx, dy] = DIRECTION_OFFSET[this.player.facingDirection];
    const cx = this.player.x + dx * 12;
    const cy = this.player.y - 4 + dy * 12;
    return this.slimes.filter((s) => Math.hypot(s.sprite.x - cx, s.sprite.y - 4 * (s.boss?.scale ?? 1) - cy) < 15 + (s.boss ? s.boss.scale * 6 : 0));
  }

  private slimeInFront(): boolean {
    return this.slimesInFront().length > 0;
  }

  private hitSlime(s: Slime, damage: number): void {
    if (damage <= 0) return;
    s.hp -= damage;
    s.flash = 120;
    s.sprite.setTintFill(0xffffff);
    // Knock it back (bosses barely budge).
    const a = Math.atan2(s.sprite.y - this.player.y, s.sprite.x - this.player.x);
    const push = s.boss ? 4 : 14;
    this.moveSlime(s, Math.cos(a) * push, Math.sin(a) * push);
    s.timer = s.boss ? 250 : 500;
    sfx('clunk', { rate: 1.6, volume: 0.7 });
    if (s.boss) gameEvents.emit('mine:boss', { name: s.boss.name, hp: Math.max(0, s.hp), maxHp: s.maxHp });
    if (s.hp > 0) return;
    const { x, y } = s.sprite;
    this.fx.burst(s.kind === 'crab' ? 'stone' : 'leaf', x, y - 5, s.boss ? 30 : 10);
    sfx('rockBreak', { rate: s.boss ? 0.6 : 1.8, volume: s.boss ? 1 : 0.6 });
    for (const d of MONSTERS[s.kind].drops) if (Math.random() < d.chance) this.drops.spawn(d.itemId, 1, x, y - 4);
    if (s.kind === 'slime' && this.floor >= 5 && Math.random() < 0.15) this.drops.spawn('iron_ore', 1, x, y - 4);
    s.sprite.destroy();
    s.shadow.destroy();
    this.slimes.splice(this.slimes.indexOf(s), 1);
    if (s.boss) {
      this.boss = null;
      gameEvents.emit('mine:boss', null);
      toast(`You defeated ${s.boss.name}!`);
      this.cameras.main.shake(300, 0.01);
      for (let i = 0; i < 4; i++) this.drops.spawn(i % 2 ? 'gold_ore' : 'amethyst', 1, x + (i - 1.5) * 6, y - 4);
      if (this.treasure) {
        this.treasure.sprite.setVisible(true);
        this.fx.pop(this.treasure.sprite);
      }
      const size = GAME_CONFIG.tileSize;
      if (this.floor < MINE.floors && !this.ladderDown) this.revealLadder(Math.floor(x / size), Math.floor((y - 3) / size));
      else if (this.floor >= MINE.floors) toast('You have conquered the deepest floor of the mine!');
    }
  }

  private updateSlimes(delta: number, frozen: boolean): void {
    for (const s of [...this.slimes]) {
      if (s.flash > 0) {
        s.flash -= delta;
        if (s.flash <= 0) s.sprite.clearTint().setTint(s.tint);
      }
      if (!frozen) {
        const dx = this.player.x - s.sprite.x;
        const dy = this.player.y - s.sprite.y;
        const d = Math.hypot(dx, dy);
        if (s.kind === 'bat' || s.kind === 'ghost') {
          // Flyers drift continuously: bats swoop erratically, ghosts glide straight at you.
          s.timer -= delta;
          if (s.timer <= 0) {
            const chase = d < (s.kind === 'ghost' ? 160 : 120);
            const jitter = s.kind === 'bat' ? this.rng.range(-0.9, 0.9) : this.rng.range(-0.2, 0.2);
            const a = chase ? Math.atan2(dy, dx) + jitter : this.rng.range(0, Math.PI * 2);
            s.vx = Math.cos(a) * s.speed * (chase ? 1 : 0.4);
            s.vy = Math.sin(a) * s.speed * (chase ? 1 : 0.4);
            s.timer = s.kind === 'bat' ? this.rng.range(250, 600) : this.rng.range(500, 900);
          }
          this.moveSlime(s, (s.vx * delta) / 1000, (s.vy * delta) / 1000);
          s.sprite.setFrame(Math.floor(this.time.now / (s.kind === 'bat' ? 110 : 300)) % 2);
        } else {
          s.timer -= delta;
          if (s.timer <= 0 && s.timer > -delta) {
            // Start a hop (slimes) or a scuttle (crabs): towards the player if close, otherwise somewhere random.
            const chase = d < (s.boss ? 200 : 110);
            const a = chase ? Math.atan2(dy, dx) + this.rng.range(-0.3, 0.3) : this.rng.range(0, Math.PI * 2);
            const speed = chase ? s.speed : s.speed * 0.5;
            s.vx = Math.cos(a) * speed;
            s.vy = Math.sin(a) * speed;
            s.sprite.setFrame(1);
          }
          if (s.timer < 0) {
            this.moveSlime(s, (s.vx * delta) / 1000, (s.vy * delta) / 1000);
            if (s.kind === 'crab') s.sprite.setFrame(Math.floor(this.time.now / 120) % 2);
            if (s.timer < (s.kind === 'crab' ? -700 : -380)) {
              s.timer = this.rng.range(450, 1100) * (s.boss ? 0.6 : 1);
              s.sprite.setFrame(0);
            }
          }
        }
        // Touching the player hurts.
        const reach = 10 + (s.boss ? s.boss.scale * 5 : 0);
        if (this.invulnerable <= 0 && Math.hypot(this.player.x - s.sprite.x, this.player.y - 2 - s.sprite.y) < reach) this.hurtPlayer(s.damage, s);
      }
      const flying = s.kind === 'bat' || s.kind === 'ghost';
      s.sprite.setDepth(DEPTH.ySortBase + s.sprite.y + (flying ? 20 : 0));
      s.shadow.setPosition(s.sprite.x, s.sprite.y - 1 + (flying ? 8 : 0));
      if (flying) s.sprite.y += Math.sin(this.time.now / 200 + s.sprite.x) * 0.05;
    }
  }

  private moveSlime(s: Slime, dx: number, dy: number): void {
    const size = GAME_CONFIG.tileSize;
    const nx = s.sprite.x + dx;
    const ny = s.sprite.y + dy;
    const tx = Math.floor(nx / size);
    const ty = Math.floor((ny - 3) / size);
    const flies = MONSTERS[s.kind].flies;
    if (tx < 1 || ty < 1 || tx >= this.width - 1 || ty >= this.height - 1) return;
    if (flies !== 'walls' && this.isWall(tx, ty)) return;
    if (!flies && this.rocks.has(this.key(tx, ty))) return;
    s.sprite.setPosition(nx, ny);
  }

  private hurtPlayer(damage: number, from: Slime): void {
    this.invulnerable = INVULNERABLE_MS;
    const left = this.host.state.hurt(Math.max(1, Math.round(damage * (1 - this.host.state.defense))));
    sfx('clunk', { rate: 0.7 });
    this.cameras.main.shake(140, 0.006);
    this.player.sprite.setTintFill(0xff6a5a);
    this.time.delayedCall(140, () => this.player.sprite.clearTint());
    // Bounce away from the slime.
    const a = Math.atan2(this.player.y - from.sprite.y, this.player.x - from.sprite.x);
    this.player.sprite.body.reset(this.player.x + Math.cos(a) * 8, this.player.y + Math.sin(a) * 8);
    if (left <= 0) {
      toast('You fainted…');
      this.leave(true);
    }
  }

  // ---------- Helpers ----------

  private isWall(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return true;
    return this.wall[ty * this.width + tx] === 1;
  }

  private touchesFloor(tx: number, ty: number): boolean {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!this.isWall(tx + dx, ty + dy)) return true;
    return false;
  }

  private key(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  /** A large dark sheet with a soft hole of light around the player (it's the miner's lantern). */
  private lightTexture(): string {
    const key = 'mine-lantern';
    if (this.textures.exists(key)) return key;
    const size = 1400;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, 120);
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
