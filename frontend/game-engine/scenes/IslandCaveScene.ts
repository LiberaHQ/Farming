import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { CAVE_TREASURE, CAVE_TREASURE_GOLD, GAME_CONFIG, ITEMS, type IslandSave, type ItemId } from '@farming/shared';
import { drawClam, drawCrystalRock, drawGlowCrystal, drawIdolChest } from '../assets/places';
import { PixelCanvas } from '../assets/PixelCanvas';
import { itemTextureKey } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { LightingSystem, type LightSource } from '../systems/LightingSystem';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface IslandCaveSceneData {
  host: AreaHost;
  island: IslandSave;
  changed(): void;
  /** Back out onto the island. */
  exit(): void;
}

const W = 22;
const H = 16;
const EXIT = { tx: 11, ty: H - 2 };
const POOL = { tx: 4, ty: 4, w: 4, h: 3 };
const CLAM = { tx: 5, ty: 5 };
const CHEST = { tx: 16, ty: 3 };
/** Crystal rocks (ids 100+ in the island's daily list) and the clam (120). */
const ROCK_SPOTS: Array<[number, number]> = [
  [9, 4],
  [13, 6],
  [17, 8],
  [6, 10],
  [15, 11],
  [10, 9],
];
const ROCK_ID = 100;
const CLAM_ID = 120;
const GLOWS: Array<[number, number, string, string]> = [
  [2, 8, '#6ac8f0', '#d8f4ff'],
  [19, 4, '#b07ad0', '#f0d8ff'],
  [8, 13, '#6ad0a0', '#d8fff0'],
  [19, 12, '#6ac8f0', '#d8f4ff'],
  [12, 2, '#f0a85a', '#fff0c8'],
];

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * The cave behind the island's boulder: glowing crystals, a still pool with a
 * giant clam (sometimes a pearl), crystal rocks with rubies and jade that grow
 * back each day, and an ancient chest holding the island's treasure.
 */
export class IslandCaveScene extends AreaScene<IslandCaveSceneData> {
  private data_!: IslandCaveSceneData;
  private dark!: LightingSystem;
  private rocks: Array<{ id: number; tx: number; ty: number; kind: 'ruby' | 'jade' | 'plain'; sprite: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone }> = [];
  private chest!: Phaser.GameObjects.Image;
  private clam!: Phaser.GameObjects.Image;
  private glows: LightSource[] = [];
  private dripTimer = 1500;

  constructor() {
    super(SCENES.IslandCave);
  }

  init(data: IslandCaveSceneData): void {
    super.init(data);
    this.data_ = data;
    this.rocks = [];
    this.glows = [];
  }

  private tex(key: string, draw: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
    return key;
  }

  private isWall(tx: number, ty: number): boolean {
    if (tx <= 0 || ty <= 1 || tx >= W - 1 || ty >= H - 1) return !(tx === EXIT.tx && ty === H - 1);
    // A few pillars of rock.
    return (tx === 7 && ty === 7) || (tx === 14 && ty === 3) || (tx === 12 && ty === 12) || (tx === 3 && ty === 12);
  }

  private inPool(tx: number, ty: number): boolean {
    return tx >= POOL.tx && tx < POOL.tx + POOL.w && ty >= POOL.ty && ty < POOL.ty + POOL.h;
  }

  private taken(): Set<number> {
    const { day } = this.host.calendar();
    return new Set(this.data_.island.day === day ? this.data_.island.taken : []);
  }

  private take(id: number): void {
    const { day } = this.host.calendar();
    const isl = this.data_.island;
    if (isl.day !== day) {
      isl.day = day;
      isl.taken = [];
    }
    isl.taken.push(id);
    this.data_.changed();
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    if (!this.textures.exists('island-cave-ground')) this.textures.addCanvas('island-cave-ground', this.drawGround());
    this.add.image(0, 0, 'island-cave-ground').setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#0c0a10');
    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(W, H, (tx, ty) => this.isWall(tx, ty) || this.inPool(tx, ty));

    const ys = (y: number) => DEPTH.ySortBase + y;
    for (const [tx, ty, c, l] of GLOWS) {
      const base = (ty + 1) * size - 2;
      const img = this.add.image(tx * size + 8, base, this.tex(`cave-glow-${c}`, () => drawGlowCrystal(c, l))).setOrigin(0.5, 1).setDepth(ys(base));
      this.tweens.add({ targets: img, alpha: 0.75, duration: 1400 + tx * 40, yoyo: true, repeat: -1 });
      this.glows.push({ x: tx * size + 8, y: base - 8, radius: 46 });
    }
    // The pool and its clam.
    const taken = this.taken();
    const clamBase = (CLAM.ty + 1) * size - 2;
    this.clam = this.add.image(CLAM.tx * size + 8, clamBase, this.tex(`cave-clam-${!taken.has(CLAM_ID)}`, () => drawClam(!taken.has(CLAM_ID)))).setOrigin(0.5, 1).setDepth(ys(clamBase));
    this.glows.push({ x: CLAM.tx * size + 8, y: clamBase - 6, radius: 30 });
    // Crystal rocks (which kind changes from day to day).
    const rng = createRng(`island-cave:${this.host.calendar().day}`);
    ROCK_SPOTS.forEach(([tx, ty], i) => {
      const id = ROCK_ID + i;
      if (taken.has(id)) return;
      const roll = rng.next();
      const kind = roll < 0.25 ? 'ruby' : roll < 0.6 ? 'jade' : 'plain';
      const base = (ty + 1) * size - 1;
      const sprite = this.add.image(tx * size + 8, base, this.tex(`cave-rock-${kind}`, () => drawCrystalRock(kind))).setOrigin(0.5, 1).setDepth(ys(base));
      const zone = this.add.zone(tx * size + 8, ty * size + 8, size, size);
      this.walls.add(zone);
      this.rocks.push({ id, tx, ty, kind, sprite, zone });
    });
    // The ancient chest.
    const chestBase = (CHEST.ty + 1) * size - 1;
    const open = this.data_.island.chest;
    this.chest = this.add.image(CHEST.tx * size + 8, chestBase, this.tex(`cave-chest-${open}`, () => drawIdolChest(open))).setOrigin(0.5, 1).setDepth(ys(chestBase));
    this.walls.add(this.add.zone(CHEST.tx * size + 8, chestBase - 6, size, 10));
    if (!open) this.glows.push({ x: CHEST.tx * size + 8, y: chestBase - 8, radius: 34 });

    this.setupArea(W, H, { x: EXIT.tx * size + 8, y: EXIT.ty * size + 10, facing: 'up' });
    this.dark = new LightingSystem(this, 'lighting-island-cave');
    gameEvents.emit('area:label', { label: '🕯 The Island Cave' });
  }

  private drawGround(): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const p = new PixelCanvas(W * size, H * size);
    for (let y = 0; y < H * size; y++) {
      for (let x = 0; x < W * size; x++) {
        const tx = Math.floor(x / size);
        const ty = Math.floor(y / size);
        const n = hash(x >> 1, y >> 1);
        let c: string;
        if (this.isWall(tx, ty)) c = n < 0.3 ? '#2a2430' : n < 0.7 ? '#342c3a' : '#3e3646';
        else if (this.inPool(tx, ty)) {
          const edge = x - POOL.tx * size < 2 || y - POOL.ty * size < 2 || (POOL.tx + POOL.w) * size - x <= 2 || (POOL.ty + POOL.h) * size - y <= 2;
          c = edge ? '#5a6878' : n < 0.1 ? '#4ab8d0' : '#1e5a78';
        } else c = n < 0.15 ? '#4a4252' : n < 0.25 ? '#5a5262' : '#524a5a';
        p.set(x, y, c);
      }
    }
    // The way out glows faintly with daylight.
    for (let y = (H - 1) * size; y < H * size; y++) for (let x = EXIT.tx * size; x < (EXIT.tx + 1) * size; x++) p.set(x, y, '#a89a7a');
    return p.toCanvas();
  }

  protected tick(delta: number): void {
    // Always dark in here: your lantern and the crystals light the way.
    this.dark.update(60, 'sunny', [...this.glows, { x: this.player.x, y: this.player.y - 10, radius: 52 }, { x: EXIT.tx * 16 + 8, y: H * 16, radius: 40 }]);
    this.dripTimer -= delta;
    if (this.dripTimer <= 0) {
      this.dripTimer = 1800 + Math.random() * 3000;
      sfx('splash', { volume: 0.06, rate: 1.6 + Math.random() * 0.4 });
    }
    if (!this.leaving && this.player.y > (H - 1) * 16 + 4) this.travel(() => this.data_.exit());
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    const toast = (text: string) => gameEvents.emit('toast', { text });
    if (feet.tx === EXIT.tx && feet.ty >= EXIT.ty) return { verb: 'Back out to the island', key: 'E', run: () => this.travel(() => this.data_.exit()) };

    const rock = this.rocks.find((r) => r.tx === tx && r.ty === ty);
    if (rock) {
      const stack = this.host.state.inventory.selectedStack;
      const tool = stack ? ITEMS[stack.itemId].tool : undefined;
      const name = rock.kind === 'ruby' ? 'Ruby crystals' : rock.kind === 'jade' ? 'Jade crystals' : 'Crystal rock';
      if (tool?.kind !== 'pickaxe') return { verb: `${name} · needs a pickaxe`, key: 'Space', blocked: true, run: () => undefined };
      return {
        verb: `Mine ${name.toLowerCase()}`,
        key: 'Space',
        run: () => {
          if (!this.host.state.spendEnergy(skills.toolCost('pickaxe', GAME_CONFIG.energy.toolCost))) return toast("You're too tired.");
          this.player.useTool(itemTextureKey(stack!.itemId), 'swing', () => this.breakRock(rock));
        },
      };
    }
    if (Math.abs(tx - CLAM.tx) <= 0 && Math.abs(ty - CLAM.ty) <= 1 && (ty === CLAM.ty || ty === CLAM.ty + 1)) {
      if (this.taken().has(CLAM_ID)) return { verb: 'The clam is shut tight', key: 'E', info: true, run: () => toast('The giant clam has closed for today. Come back tomorrow.') };
      return { verb: 'Reach into the giant clam', key: mode === 'use' ? 'Space' : 'E', run: () => this.openClam() };
    }
    if (tx === CHEST.tx && ty === CHEST.ty) {
      if (this.data_.island.chest) return { verb: 'An empty chest', key: 'E', info: true, run: () => toast('The ancient chest is empty now.') };
      return { verb: 'Open the ancient chest', key: 'E', run: () => this.openChest() };
    }
    return null;
  }

  private breakRock(rock: IslandCaveScene['rocks'][number]): void {
    this.fx.burst('stone', rock.sprite.x, rock.sprite.y - 6, 12);
    sfx('rockBreak');
    rock.sprite.destroy();
    this.walls.remove(rock.zone, true, true);
    this.rocks = this.rocks.filter((r) => r !== rock);
    this.take(rock.id);
    const drops: Array<[ItemId, number]> = [['stone', Phaser.Math.Between(1, 3) + (skills.bonus('mining') ? 1 : 0)]];
    skills.gain('mining', rock.kind === 'plain' ? 6 : 12);
    if (rock.kind === 'ruby') drops.push(['ruby', 1]);
    if (rock.kind === 'jade') drops.push(['jade', 1]);
    if (rock.kind === 'plain' && Math.random() < 0.3) drops.push(['amethyst', 1]);
    if (Math.random() < (rock.kind === 'plain' ? 0.18 : 0.08)) drops.push(['stone_tablet', 1]);
    for (const [itemId, n] of drops) this.drops.spawn(itemId, n, rock.sprite.x, rock.sprite.y - 6);
  }

  private openClam(): void {
    this.take(CLAM_ID);
    this.clam.setTexture(this.tex('cave-clam-false', () => drawClam(false)));
    const pearl = Math.random() < 0.35;
    this.drops.spawn(pearl ? 'pearl' : 'coral', 1, this.clam.x, this.clam.y + 6);
    sfx(pearl ? 'pickup' : 'splash');
    gameEvents.emit('toast', { text: pearl ? 'A pearl! The clam shuts with a slow, sulky clap.' : 'Just a bit of coral this time. The clam shuts.' });
  }

  private openChest(): void {
    this.data_.island.chest = true;
    this.data_.changed();
    this.chest.setTexture(this.tex('cave-chest-true', () => drawIdolChest(true)));
    this.fx.burst('sparkle', this.chest.x, this.chest.y - 10, 18);
    sfx('coin');
    this.host.state.earn(CAVE_TREASURE_GOLD);
    for (const { itemId, quantity } of CAVE_TREASURE) this.drops.spawn(itemId, quantity, this.chest.x, this.chest.y + 8);
    gameEvents.emit('toast', { text: `The ancient chest! A golden idol, gems and ${CAVE_TREASURE_GOLD}g in old coins.` });
  }
}
