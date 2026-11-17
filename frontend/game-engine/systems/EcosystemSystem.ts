import * as Phaser from 'phaser';
import {
  CROPS,
  GAME_CONFIG,
  PLACEABLES,
  Terrain,
  deerMeal,
  deerVisits,
  foxScare,
  foxVisits,
  pollinatedBy,
  scaredOff,
  wildReach,
  type Season,
  type WeatherKind,
} from '@farming/shared';
import { drawDeer, drawFox } from '../assets/wildlife';
import { DEPTH } from '../constants';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { PixelCanvas } from '../assets/PixelCanvas';
import type { AnimalSystem } from './AnimalSystem';
import type { BuildSystem } from './BuildSystem';
import type { FarmingSystem } from './FarmingSystem';

const T = GAME_CONFIG.tileSize;
const MAX_BEES = 24;

/** What the wildlife got up to overnight. */
export interface DawnReport {
  /** Crops a deer ate (names, one per plot). */
  eaten: string[];
  /** Where the deer was last seen (pixels), to show it bounding off. */
  deerAt: { x: number; y: number } | null;
  /** Coop animals too spooked by a fox to lay (indices from `AnimalSystem.farmHomes`). */
  spooked: number[];
  foxAt: { x: number; y: number } | null;
  /** A fox came, and your dog chased it off. */
  dogChased: boolean;
}

interface Bee {
  key: string;
  cx: number;
  cy: number;
  phase: number;
  dot: Phaser.GameObjects.Rectangle;
}

/**
 * The farm's place in the valley's ecosystem. Deer wander in from the wild
 * some nights and graze crops they can reach; foxes creep up to the coop at
 * dawn; flower beds draw bees that pollinate nearby crops. A closed fence (or
 * water and buildings) keeps wild animals out, a scarecrow keeps deer away,
 * and a dog sees off foxes.
 */
export class EcosystemSystem {
  private hoofprints: Phaser.GameObjects.Image[] = [];
  private bees: Bee[] = [];
  private beeCheckAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly seed: string,
    private readonly world: WorldData,
    private readonly farming: FarmingSystem,
    private readonly build: BuildSystem,
    private readonly animals: AnimalSystem,
  ) {
    const tex = (key: string, draw: () => PixelCanvas) => {
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, draw().toCanvas());
    };
    for (const f of [0, 1]) {
      tex(`deer-${f}`, () => drawDeer(f));
      tex(`fox-${f}`, () => drawFox(f));
    }
    tex('hoofprints', () => {
      const p = new PixelCanvas(12, 10);
      for (const [x, y] of [[1, 1], [6, 3], [2, 6], [8, 7]] as const) {
        p.rect(x, y, 1, 2, '#4a3220');
        p.rect(x + 2, y, 1, 2, '#4a3220');
      }
      return p;
    });
  }

  /** Tiles a wild animal can reach from the edge of the map (water, fences and buildings stop it; paths don't). */
  private reach(): Uint8Array {
    return wildReach(this.world.width, this.world.height, (tx, ty) => {
      if (terrainAt(this.world, tx, ty) === Terrain.Water) return true;
      const placed = this.build.at(tx, ty);
      return !!placed && !PLACEABLES[placed.kind].floor;
    });
  }

  /** Pollinators reach this crop (not in winter, when the flowers sleep). */
  pollinated(tx: number, ty: number, season: Season): boolean {
    if (season === 'winter') return false;
    const flowers = [...this.build.ofKind('flower_bed').map((p) => ({ tx: p.tx, ty: p.ty, kind: 'flower_bed' as const })), ...this.build.ofKind('flower_pot').map((p) => ({ tx: p.tx, ty: p.ty, kind: 'flower_pot' as const }))];
    return flowers.length > 0 && pollinatedBy(tx, ty, flowers);
  }

  /**
   * The night's wildlife, worked out at dawn — before the coop animals lay.
   * Deterministic for a world and a day.
   */
  dawn(day: number, season: Season, hasDog: boolean): DawnReport {
    for (const h of this.hoofprints) h.destroy();
    this.hoofprints = [];
    const report: DawnReport = { eaten: [], deerAt: null, spooked: [], foxAt: null, dogChased: false };
    const deer = deerVisits(this.seed, day, season);
    const fox = foxVisits(this.seed, day);
    if (!deer && !fox) return report;
    const reach = this.reach();
    const reachable = (tx: number, ty: number) => reach[ty * this.world.width + tx] === 1;

    if (deer) {
      const scarecrows = this.build.ofKind('scarecrow').map((p) => ({ tx: p.tx, ty: p.ty }));
      const candidates = this.farming
        .all()
        .filter((p) => p.crop && p.crop.stage >= 1 && reachable(p.tx, p.ty) && !scaredOff(p.tx, p.ty, scarecrows))
        .map((p) => ({ tx: p.tx, ty: p.ty, ripe: this.farming.isMature(p), plot: p }));
      for (const m of deerMeal(this.seed, day, candidates)) {
        const crop = m.plot.crop;
        if (!crop) continue;
        report.eaten.push(CROPS[crop.id].name);
        this.farming.graze(m.plot);
        const print = this.scene.add.image(m.tx * T + 8, m.ty * T + 8, 'hoofprints').setDepth(DEPTH.soil + 0.2).setAlpha(0.85);
        this.hoofprints.push(print);
        report.deerAt = { x: m.tx * T + 8, y: m.ty * T + 14 };
      }
    }

    if (fox) {
      const homes = this.animals.farmHomes();
      const exposed = homes.map((h, i) => ({ h, i })).filter(({ h }) => reachable(Math.floor(h.x / T), Math.floor(h.y / T))).map(({ i }) => i);
      if (exposed.length > 0) {
        if (hasDog) report.dogChased = true;
        else {
          report.spooked = foxScare(this.seed, day, exposed);
          const h = homes[report.spooked[0]];
          report.foxAt = { x: h.x + 10, y: h.y };
        }
      }
    }
    return report;
  }

  /** After waking: the deer bounds off from the field, the fox slinks away from the coop. */
  playDawn(report: DawnReport): void {
    const flee = (key: 'deer' | 'fox', from: { x: number; y: number }) => {
      const dir = from.x < this.world.width * T * 0.5 ? -1 : 1;
      const sprite = this.scene.add.image(from.x, from.y, `${key}-0`).setOrigin(0.5, 1).setFlipX(dir < 0).setDepth(DEPTH.ySortBase + from.y);
      let frame = 0;
      const step = this.scene.time.addEvent({ delay: key === 'deer' ? 140 : 110, loop: true, callback: () => sprite.setTexture(`${key}-${(frame = 1 - frame)}`) });
      this.scene.tweens.add({
        targets: sprite,
        x: from.x + dir * 260,
        alpha: { from: 1, to: 0 },
        duration: 2800,
        ease: 'Sine.easeIn',
        onComplete: () => {
          step.remove();
          sprite.destroy();
        },
      });
    };
    if (report.deerAt) flee('deer', report.deerAt);
    if (report.foxAt) flee('fox', report.foxAt);
  }

  /** Bees drifting over flower beds and pots near the camera, on dry days outside winter. */
  update(delta: number, ctx: { minute: number; season: Season; weather: WeatherKind; away: boolean }): void {
    const active = !ctx.away && ctx.season !== 'winter' && ctx.weather !== 'rain' && ctx.weather !== 'snow' && ctx.minute >= 7 * 60 && ctx.minute < 18 * 60;
    this.beeCheckAt -= delta;
    if (this.beeCheckAt <= 0) {
      this.beeCheckAt = 600;
      const view = this.scene.cameras.main.worldView;
      const wanted = new Map<string, { x: number; y: number }>();
      if (active) {
        for (const p of [...this.build.ofKind('flower_bed'), ...this.build.ofKind('flower_pot')]) {
          const x = p.tx * T + 8;
          const y = p.ty * T + 4;
          if (x < view.x - 40 || x > view.right + 40 || y < view.y - 40 || y > view.bottom + 40) continue;
          for (const n of [0, 1]) if (wanted.size < MAX_BEES) wanted.set(`${p.tx},${p.ty},${n}`, { x, y });
        }
      }
      this.bees = this.bees.filter((b) => {
        if (wanted.has(b.key)) return true;
        b.dot.destroy();
        return false;
      });
      for (const [key, at] of wanted) {
        if (this.bees.some((b) => b.key === key)) continue;
        const dot = this.scene.add.rectangle(at.x, at.y, 2, 2, 0xf4d24a).setStrokeStyle(0.5, 0x2b1d1a).setDepth(DEPTH.ySortBase + at.y + 20);
        this.bees.push({ key, cx: at.x, cy: at.y, phase: Math.random() * 10, dot });
      }
    }
    const t = this.scene.time.now / 1000;
    for (const b of this.bees) {
      const a = t * 2.4 + b.phase;
      b.dot.setPosition(b.cx + Math.sin(a) * 7 + Math.sin(a * 2.7) * 2, b.cy - 6 + Math.cos(a * 1.3) * 4);
    }
  }
}
