import * as Phaser from 'phaser';
import { coopProduce, GAME_CONFIG, Terrain, type ChickenSave } from '@farming/shared';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { sfx } from '../audio/sfx';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { createRng } from '../utils/random';
import type { DropSystem } from './DropSystem';
import type { FxSystem } from './FxSystem';

/** 'rabbit' is wild; 'bunny' is a farm rabbit you bought. */
type AnimalKind = 'rabbit' | 'chicken' | 'duck' | 'bunny';
const FARM = new Set<AnimalKind>(['chicken', 'duck', 'bunny']);
const SAVE_KIND = { chicken: 'chicken', duck: 'duck', bunny: 'rabbit' } as const;

interface Animal {
  kind: AnimalKind;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  target: { x: number; y: number } | null;
  wait: number;
  frameTimer: number;
  fleeing: boolean;
}

export type { ChickenSave } from '@farming/shared';

const SPEC: Record<AnimalKind, { texture: string; originY: number; speed: number; roam: number }> = {
  rabbit: { texture: TEXTURES.rabbit, originY: 11 / 12, speed: 46, roam: 64 },
  chicken: { texture: TEXTURES.chicken, originY: 12 / 13, speed: 20, roam: 40 },
  duck: { texture: TEXTURES.duck, originY: 9 / 10, speed: 18, roam: 36 },
  bunny: { texture: TEXTURES.rabbit, originY: 11 / 12, speed: 26, roam: 36 },
};

const FLEE_RADIUS = 44;

/**
 * Simple wandering AI. Rabbits roam the wild and bolt from the player; they
 * vanish at night. Chickens potter around where they were released and lay
 * an egg every morning.
 */
export class AnimalSystem {
  private readonly animals: Animal[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
    private readonly isBlocked: (tx: number, ty: number) => boolean,
    private readonly drops: DropSystem,
    private readonly fx: FxSystem,
  ) {}

  /** Scatters wild rabbits across open meadow, away from spawn. */
  spawnRabbits(count: number): void {
    const rng = createRng(`${this.world.seed}:rabbits`);
    const size = GAME_CONFIG.tileSize;
    let placed = 0;
    for (let attempt = 0; attempt < count * 40 && placed < count; attempt++) {
      const tx = rng.int(3, this.world.width - 4);
      const ty = rng.int(3, this.world.height - 4);
      if (!this.walkableTile(tx, ty) || Math.hypot(tx - this.world.spawn.tx, ty - this.world.spawn.ty) < 10) continue;
      this.add('rabbit', tx * size + 8, ty * size + 12);
      placed++;
    }
  }

  addChicken(x: number, y: number, home = { x, y }, kind: 'chicken' | 'duck' | 'rabbit' = 'chicken'): void {
    this.add(kind === 'rabbit' ? 'bunny' : kind, x, y, home);
    if (kind === 'rabbit') this.animals[this.animals.length - 1].sprite.setTint(0xe8dccc);
  }

  /** The chicken standing on a tile, if any. */
  chickenAt(tx: number, ty: number): Animal | undefined {
    const size = GAME_CONFIG.tileSize;
    return this.animals.find(
      (a) => FARM.has(a.kind) && Math.floor(a.sprite.x / size) === tx && Math.floor((a.sprite.y - 2) / size) === ty,
    );
  }

  /** True if an animal is on the tile (blocks placing things on it). */
  occupies(tx: number, ty: number): boolean {
    const size = GAME_CONFIG.tileSize;
    return this.animals.some((a) => a.sprite.visible && Math.floor(a.sprite.x / size) === tx && Math.floor((a.sprite.y - 2) / size) === ty);
  }

  pet(animal: Animal): void {
    this.fx.burst('heart', animal.sprite.x, animal.sprite.y - 12, 5);
    animal.wait = 1200;
    animal.target = null;
  }

  /** Each morning every chicken lays an egg beside itself. */
  onNewDay(): void {
    for (const a of this.animals) {
      if (!FARM.has(a.kind)) continue;
      a.sprite.setPosition(a.home.x, a.home.y);
      const item = coopProduce(SAVE_KIND[a.kind as 'chicken' | 'duck' | 'bunny'], Math.random());
      if (item) this.drops.spawn(item, 1, a.home.x + 6, a.home.y - 2);
    }
  }

  update(delta: number, px: number, py: number, night: boolean): void {
    for (const a of this.animals) {
      const s = a.sprite;
      // Rabbits disappear into their burrows at night; chickens roost.
      if (a.kind === 'rabbit') {
        const targetAlpha = night ? 0 : 1;
        s.alpha += (targetAlpha - s.alpha) * 0.05;
        s.setVisible(s.alpha > 0.02);
        a.shadow.setVisible(s.visible).setAlpha(s.alpha);
        if (!s.visible) continue;
      } else if (night) {
        s.setFrame(0);
        continue;
      }

      const spec = SPEC[a.kind];
      const playerDist = Math.hypot(px - s.x, py - s.y);
      // Chickens chatter now and then when you're nearby.
      if (a.kind === 'chicken' && playerDist < 120 && Math.random() < delta / 9000) sfx('cluck', { volume: 0.5, vary: 0.15 });
      if (a.kind === 'rabbit' && playerDist < FLEE_RADIUS && !a.fleeing) {
        const angle = Math.atan2(s.y - py, s.x - px) + Phaser.Math.FloatBetween(-0.5, 0.5);
        a.target = { x: s.x + Math.cos(angle) * 56, y: s.y + Math.sin(angle) * 56 };
        a.fleeing = true;
        a.wait = 0;
      }

      if (!a.target) {
        a.wait -= delta;
        if (a.kind === 'chicken') {
          // Occasional pecking while idle.
          const pecking = Number(s.frame.name) === 1;
          if (!pecking && Math.random() < 0.01) s.setFrame(1);
          else if (pecking && Math.random() < 0.08) s.setFrame(0);
        }
        if (a.wait <= 0) {
          const center = FARM.has(a.kind) ? a.home : { x: s.x, y: s.y };
          a.target = {
            x: center.x + Phaser.Math.Between(-spec.roam, spec.roam),
            y: center.y + Phaser.Math.Between(-spec.roam, spec.roam),
          };
        }
        continue;
      }

      const dx = a.target.x - s.x;
      const dy = a.target.y - s.y;
      const dist = Math.hypot(dx, dy);
      const speed = spec.speed * (a.fleeing ? 2.2 : 1);
      const step = Math.min(dist, (speed * delta) / 1000);
      const nx = s.x + (dx / (dist || 1)) * step;
      const ny = s.y + (dy / (dist || 1)) * step;
      const size = GAME_CONFIG.tileSize;
      if (dist < 1 || !this.walkableTile(Math.floor(nx / size), Math.floor((ny - 2) / size))) {
        a.target = null;
        a.fleeing = false;
        a.wait = Phaser.Math.Between(900, 3500);
        s.setFrame(0);
        continue;
      }
      s.setPosition(nx, ny).setFlipX(dx > 0);
      a.frameTimer += delta;
      if (a.frameTimer > (a.kind === 'rabbit' ? 140 : 220)) {
        a.frameTimer = 0;
        s.setFrame(Number(s.frame.name) === 0 ? 1 : 0);
      }
    }
    for (const a of this.animals) {
      a.sprite.setDepth(DEPTH.ySortBase + a.sprite.y);
      a.shadow.setPosition(a.sprite.x, a.sprite.y - 1);
    }
  }

  serializeChickens(): ChickenSave[] {
    return this.animals
      .filter((a) => FARM.has(a.kind))
      .map((a) => ({
        x: Math.round(a.sprite.x),
        y: Math.round(a.sprite.y),
        homeX: a.home.x,
        homeY: a.home.y,
        ...(a.kind !== 'chicken' ? { kind: SAVE_KIND[a.kind as 'duck' | 'bunny'] } : {}),
      }));
  }

  private add(kind: AnimalKind, x: number, y: number, home = { x, y }): void {
    const spec = SPEC[kind];
    const sprite = this.scene.add.image(x, y, spec.texture, 0).setOrigin(0.5, spec.originY);
    const shadow = this.scene.add.image(x, y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(0.8, 0.8);
    this.animals.push({ kind, sprite, shadow, home, target: null, wait: Phaser.Math.Between(0, 2000), frameTimer: 0, fleeing: false });
  }

  private walkableTile(tx: number, ty: number): boolean {
    const t = terrainAt(this.world, tx, ty);
    return (t === Terrain.Grass || t === Terrain.Path) && !this.isBlocked(tx, ty);
  }
}
