import * as Phaser from 'phaser';
import { GAME_CONFIG, Terrain, type Season, type WeatherKind } from '@farming/shared';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { createRng } from '../utils/random';
import { drawFrog, drawSquirrel } from '../assets/wildlife';
import { sfx } from '../audio/sfx';

interface Duck {
  sprite: Phaser.GameObjects.Sprite;
  home: { x: number; y: number };
  target: { x: number; y: number };
  wait: number;
  frame: number;
}

interface Flyer {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  phase: number;
  life: number;
}

export interface AmbientContext {
  /** Where you are, so critters can scatter when you come close. */
  player: { x: number; y: number };
  minute: number;
  season: Season;
  weather: WeatherKind;
  /** 0 = full day, 1 = deep night. */
  darkness: number;
}

const BUTTERFLY_TINTS = [0xffe27a, 0xffffff, 0xf7a8d8, 0xa8d4ff, 0xffb46b];
const MAX_BUTTERFLIES = 7;
const MAX_FIREFLIES = 16;
const MAX_LEAVES = 14;
const MAX_SQUIRRELS = 3;
const MAX_FROGS = 5;

interface Critter {
  kind: 'squirrel' | 'frog';
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  /** Where it hides when startled (a tree for squirrels, the water for frogs). */
  refuge: { x: number; y: number };
  target: { x: number; y: number } | null;
  wait: number;
  fleeing: boolean;
  t: number;
}

/**
 * Small touches that make the world feel alive: ducks paddling on ponds,
 * butterflies on sunny days, fireflies on warm nights, leaves drifting
 * down in fall. Purely cosmetic; nothing here is saved.
 */
export class AmbientLifeSystem {
  private readonly ducks: Duck[] = [];
  private readonly butterflies: Flyer[] = [];
  private readonly fireflies: Flyer[] = [];
  private readonly leaves: Flyer[] = [];
  private spawnTimer = 0;
  private readonly critters: Critter[] = [];
  private critterTimer = 2000;
  private oaks: Array<{ x: number; y: number }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
  ) {
    this.spawnDucks();
    const size = GAME_CONFIG.tileSize;
    this.oaks = world.objects.filter((o) => o.kind === 'oak').map((o) => ({ x: o.tx * size + 8, y: (o.ty + 1) * size - 2 }));
    for (const f of [0, 1]) {
      if (!scene.textures.exists(`squirrel-${f}`)) scene.textures.addCanvas(`squirrel-${f}`, drawSquirrel(f).toCanvas());
      if (!scene.textures.exists(`frog-${f}`)) scene.textures.addCanvas(`frog-${f}`, drawFrog(f).toCanvas());
    }
  }

  /** Squirrels by the oaks (dry days, not winter) and frogs by the water when it rains. */
  private updateCritters(delta: number, ctx: AmbientContext, view: Phaser.Geom.Rectangle): void {
    const dt = delta / 1000;
    const rain = ctx.weather === 'rain';
    const daytime = ctx.darkness < 0.35;
    this.critterTimer -= delta;
    if (this.critterTimer <= 0) {
      this.critterTimer = 1500;
      const squirrels = this.critters.filter((c) => c.kind === 'squirrel').length;
      const frogs = this.critters.filter((c) => c.kind === 'frog').length;
      if (daytime && !rain && ctx.weather !== 'snow' && ctx.season !== 'winter' && squirrels < MAX_SQUIRRELS) this.spawnSquirrel(view);
      if (rain && ctx.season !== 'winter' && frogs < MAX_FROGS) this.spawnFrog(view);
    }
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const c = this.critters[i];
      c.t += delta;
      const s = c.sprite;
      const near = Math.hypot(ctx.player.x - s.x, ctx.player.y - s.y) < (c.kind === 'squirrel' ? 46 : 30);
      if (near && !c.fleeing) {
        c.fleeing = true;
        c.target = c.refuge;
        if (c.kind === 'frog') sfx('ribbit', { volume: 0.4, rate: 1.1 });
      }
      const gone = (c.kind === 'squirrel' && (!daytime || rain)) || (c.kind === 'frog' && !rain);
      if (gone && !c.fleeing) {
        c.fleeing = true;
        c.target = c.refuge;
      }
      if (c.target) {
        const dx = c.target.x - s.x;
        const dy = c.target.y - s.y;
        const d = Math.hypot(dx, dy);
        const speed = c.kind === 'squirrel' ? (c.fleeing ? 110 : 45) : c.fleeing ? 70 : 30;
        // Frogs move in hops; squirrels in quick scampers.
        const hopping = c.kind === 'frog' ? Math.floor(c.t / 260) % 2 === 0 : true;
        if (d < 2) {
          c.target = null;
          c.wait = 800 + Math.random() * 2600;
          s.setTexture(`${c.kind}-0`);
          if (c.fleeing) {
            // Up the tree / into the water.
            this.scene.tweens.add({ targets: s, y: s.y - (c.kind === 'squirrel' ? 22 : 0), alpha: 0, duration: c.kind === 'squirrel' ? 380 : 200, onComplete: () => this.dropCritter(c) });
            c.target = null;
            c.wait = 99999;
          }
        } else if (hopping) {
          const step = Math.min(d, speed * dt);
          s.x += (dx / d) * step;
          s.y += (dy / d) * step - (c.kind === 'frog' ? Math.sin((c.t % 520) / 520 * Math.PI) * 0.35 : 0);
          s.setFlipX(dx < 0).setTexture(`${c.kind}-1`);
        } else s.setTexture(`${c.kind}-0`);
      } else {
        c.wait -= delta;
        if (c.wait <= 0) {
          c.wait = 1000 + Math.random() * 3000;
          const r = c.kind === 'squirrel' ? 40 : 18;
          c.target = { x: c.refuge.x + (Math.random() - 0.5) * r * 2, y: c.refuge.y + 6 + Math.random() * r };
          if (c.kind === 'frog' && Math.random() < 0.4) sfx('ribbit', { volume: 0.25, rate: 0.9 + Math.random() * 0.3 });
        }
      }
      s.setDepth(DEPTH.ySortBase + s.y);
      c.shadow.setPosition(s.x, s.y).setAlpha(s.alpha * 0.6);
      if (this.farFrom(view, s.x, s.y) && i < this.critters.length) this.dropCritter(c);
    }
  }

  private dropCritter(c: Critter): void {
    const i = this.critters.indexOf(c);
    if (i < 0) return;
    c.sprite.destroy();
    c.shadow.destroy();
    this.critters.splice(i, 1);
  }

  private addCritter(kind: Critter['kind'], x: number, y: number, refuge: { x: number; y: number }): void {
    const sprite = this.scene.add.image(x, y, `${kind}-0`).setOrigin(0.5, 1);
    const shadow = this.scene.add.image(x, y, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(kind === 'squirrel' ? 0.6 : 0.5);
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 400 });
    this.critters.push({ kind, sprite, shadow, refuge, target: null, wait: 600 + Math.random() * 1500, fleeing: false, t: 0 });
  }

  private spawnSquirrel(view: Phaser.Geom.Rectangle): void {
    const inView = this.oaks.filter((o) => o.x > view.x && o.x < view.right && o.y > view.y + 20 && o.y < view.bottom);
    if (!inView.length) return;
    const tree = inView[Math.floor(Math.random() * inView.length)];
    // Comes down from the tree.
    this.addCritter('squirrel', tree.x + (Math.random() < 0.5 ? -8 : 8), tree.y + 4, tree);
  }

  private spawnFrog(view: Phaser.Geom.Rectangle): void {
    const size = GAME_CONFIG.tileSize;
    for (let tries = 0; tries < 25; tries++) {
      const tx = Math.floor((view.x + Math.random() * view.width) / size);
      const ty = Math.floor((view.y + Math.random() * view.height) / size);
      if (terrainAt(this.world, tx, ty) !== Terrain.Grass) continue;
      const water = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].find(([dx, dy]) => terrainAt(this.world, tx + dx, ty + dy) === Terrain.Water);
      if (!water) continue;
      this.addCritter('frog', tx * size + 8, ty * size + 12, { x: (tx + water[0]) * size + 8, y: (ty + water[1]) * size + 10 });
      return;
    }
  }

  update(delta: number, ctx: AmbientContext): void {
    const view = this.scene.cameras.main.worldView;
    const dt = delta / 1000;
    const wet = ctx.weather === 'rain' || ctx.weather === 'snow';
    const day = ctx.darkness < 0.2;
    const night = ctx.darkness > 0.45;

    this.updateDucks(delta, ctx);
    this.updateCritters(delta, ctx, view);

    // Spawn a few things near the camera from time to time.
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 350;
      if (day && !wet && (ctx.season === 'spring' || ctx.season === 'summer') && this.butterflies.length < MAX_BUTTERFLIES) {
        this.spawnButterfly(view);
      }
      if (night && !wet && ctx.season !== 'winter' && this.fireflies.length < MAX_FIREFLIES) this.spawnFirefly(view);
      if ((ctx.season === 'fall' || ctx.season === 'spring') && this.leaves.length < MAX_LEAVES) this.spawnLeaf(view, ctx.season === 'spring');
    }

    // Butterflies: wandering, flapping, flying off when it gets dark or wet.
    for (let i = this.butterflies.length - 1; i >= 0; i--) {
      const b = this.butterflies[i];
      b.phase += delta;
      b.life -= delta;
      if (Math.random() < dt * 0.8) {
        b.vx = Phaser.Math.Clamp(b.vx + (Math.random() - 0.5) * 30, -18, 18);
        b.vy = Phaser.Math.Clamp(b.vy + (Math.random() - 0.5) * 30, -14, 14);
      }
      const s = b.sprite as Phaser.GameObjects.Sprite;
      s.x += b.vx * dt;
      s.y += b.vy * dt + Math.sin(b.phase / 120) * 0.25;
      s.setFrame(Math.floor(b.phase / 90) % 2);
      s.setFlipX(b.vx < 0);
      s.setDepth(DEPTH.ySortBase + s.y + 20);
      const leaving = !day || wet || b.life <= 0;
      if (leaving) s.alpha -= dt * 1.5;
      if (s.alpha <= 0 || this.farFrom(view, s.x, s.y)) this.remove(this.butterflies, i);
    }

    // Fireflies: slow drift, soft pulsing glow above the night overlay.
    for (let i = this.fireflies.length - 1; i >= 0; i--) {
      const f = this.fireflies[i];
      f.phase += delta;
      f.life -= delta;
      if (Math.random() < dt * 0.6) {
        f.vx = Phaser.Math.Clamp(f.vx + (Math.random() - 0.5) * 10, -6, 6);
        f.vy = Phaser.Math.Clamp(f.vy + (Math.random() - 0.5) * 10, -6, 6);
      }
      f.sprite.x += f.vx * dt;
      f.sprite.y += f.vy * dt;
      const glow = 0.35 + 0.65 * Math.max(0, Math.sin(f.phase / 420));
      const fade = Math.min(1, f.life / 800, (f.phase + 1) / 800);
      f.sprite.setAlpha(glow * fade * (night ? 1 : Math.max(0, 1 - (0.45 - ctx.darkness) * 8)));
      if (f.life <= 0 || this.farFrom(view, f.sprite.x, f.sprite.y)) this.remove(this.fireflies, i);
    }

    // Leaves: fall and sway, spinning gently.
    for (let i = this.leaves.length - 1; i >= 0; i--) {
      const l = this.leaves[i];
      l.phase += delta;
      l.life -= delta;
      l.sprite.x += (l.vx + Math.sin(l.phase / 400) * 10) * dt;
      l.sprite.y += l.vy * dt;
      l.sprite.setAngle(Math.sin(l.phase / 300) * 40);
      if (l.life < 600) l.sprite.setAlpha(l.life / 600);
      if (l.life <= 0 || l.sprite.y > view.bottom + 10) this.remove(this.leaves, i);
    }
  }

  // ---------- Ducks ----------

  /** A few ducks on the larger stretches of water. */
  private spawnDucks(): void {
    const rng = createRng(`${this.world.seed}:ducks`);
    const size = GAME_CONFIG.tileSize;
    const open = (tx: number, ty: number) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (terrainAt(this.world, tx + dx, ty + dy) !== Terrain.Water) return false;
      return true;
    };
    const spots: Array<{ tx: number; ty: number }> = [];
    for (let attempt = 0; attempt < 4000 && spots.length < 4; attempt++) {
      const tx = rng.int(2, this.world.width - 3);
      const ty = rng.int(2, this.world.height - 3);
      if (!open(tx, ty) || spots.some((s) => Math.hypot(s.tx - tx, s.ty - ty) < 12)) continue;
      spots.push({ tx, ty });
    }
    for (const spot of spots) {
      // Families of one to three.
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i++) {
        const home = { x: spot.tx * size + 8 + i * 9, y: spot.ty * size + 8 + (i % 2) * 5 };
        const sprite = this.scene.add.sprite(home.x, home.y, TEXTURES.duck, 0).setOrigin(0.5, 0.8);
        this.ducks.push({ sprite, home, target: { ...home }, wait: rng.range(0, 3000), frame: 0 });
      }
    }
  }

  private updateDucks(delta: number, ctx: AmbientContext): void {
    const size = GAME_CONFIG.tileSize;
    const hidden = ctx.season === 'winter';
    for (const d of this.ducks) {
      d.sprite.setVisible(!hidden);
      if (hidden) continue;
      const s = d.sprite;
      s.setDepth(DEPTH.ySortBase + s.y);
      // Gentle bob.
      d.frame += delta;
      s.y += Math.sin(d.frame / 500) * 0.01;
      if (d.wait > 0) {
        d.wait -= delta;
        s.setFrame(0);
        continue;
      }
      const dx = d.target.x - s.x;
      const dy = d.target.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        d.wait = 1500 + Math.random() * (ctx.darkness > 0.5 ? 9000 : 4000);
        for (let tries = 0; tries < 8; tries++) {
          const tx = d.home.x + (Math.random() - 0.5) * 40;
          const ty = d.home.y + (Math.random() - 0.5) * 26;
          if (terrainAt(this.world, Math.floor(tx / size), Math.floor(ty / size)) === Terrain.Water) {
            d.target = { x: tx, y: ty };
            break;
          }
        }
        continue;
      }
      const step = Math.min(dist, (9 * delta) / 1000);
      s.x += (dx / dist) * step;
      s.y += (dy / dist) * step;
      if (Math.abs(dx) > 0.5) s.setFlipX(dx < 0);
      s.setFrame(Math.floor(d.frame / 260) % 2);
    }
  }

  // ---------- Flyers ----------

  private spawnButterfly(view: Phaser.Geom.Rectangle): void {
    const size = GAME_CONFIG.tileSize;
    const x = view.x + Math.random() * view.width;
    const y = view.y + Math.random() * view.height;
    if (terrainAt(this.world, Math.floor(x / size), Math.floor(y / size)) !== Terrain.Grass) return;
    const sprite = this.scene.add
      .sprite(x, y, TEXTURES.butterfly, 0)
      .setTint(BUTTERFLY_TINTS[Math.floor(Math.random() * BUTTERFLY_TINTS.length)]);
    this.butterflies.push({ sprite, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 14, phase: Math.random() * 1000, life: 15000 + Math.random() * 20000 });
  }

  private spawnFirefly(view: Phaser.Geom.Rectangle): void {
    const size = GAME_CONFIG.tileSize;
    const x = view.x + Math.random() * view.width;
    const y = view.y + Math.random() * view.height;
    const t = terrainAt(this.world, Math.floor(x / size), Math.floor(y / size));
    if (t !== Terrain.Grass && t !== Terrain.Water) return;
    const sprite = this.scene.add
      .image(x, y, TEXTURES.firefly)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.lighting + 1)
      .setAlpha(0);
    this.fireflies.push({ sprite, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, phase: 0, life: 6000 + Math.random() * 9000 });
  }

  private spawnLeaf(view: Phaser.Geom.Rectangle, petal = false): void {
    const sprite = this.scene.add
      .image(view.x + Math.random() * view.width, view.y - 6, TEXTURES.leaf)
      .setDepth(DEPTH.weather - 1)
      .setTint(petal ? [0xffc8dc, 0xffffff, 0xf4a6c6][Math.floor(Math.random() * 3)] : [0xffffff, 0xffd08a, 0xe8a060][Math.floor(Math.random() * 3)]);
    if (petal) sprite.setScale(0.7);
    this.leaves.push({ sprite, vx: 6 + Math.random() * 10, vy: 14 + Math.random() * 12, phase: Math.random() * 2000, life: 9000 + Math.random() * 6000 });
  }

  private farFrom(view: Phaser.Geom.Rectangle, x: number, y: number): boolean {
    const m = 80;
    return x < view.x - m || x > view.right + m || y < view.y - m || y > view.bottom + m;
  }

  private remove(list: Flyer[], i: number): void {
    list[i].sprite.destroy();
    list.splice(i, 1);
  }
}
