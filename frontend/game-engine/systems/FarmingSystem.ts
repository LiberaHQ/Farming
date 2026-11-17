import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { daily } from '../state/daily';
import { CROPS, GAME_CONFIG, Terrain, rollQuality, type CropId, type PlotSave, type Season } from '@farming/shared';
import { cropTextureKey } from '../assets/registerTextures';
import { TILE } from '../assets/tileIndex';
import { DEPTH } from '../constants';
import { sfx } from '../audio/sfx';
import { terrainAt, type WorldData } from '../maps/WorldData';
import type { DropSystem } from './DropSystem';
import type { FxSystem } from './FxSystem';

export interface Crop {
  id: CropId;
  stage: number;
  sprite: Phaser.GameObjects.Image;
  /** Fertilized: better odds of silver and gold. */
  fed?: boolean;
}

export interface Plot {
  tx: number;
  ty: number;
  watered: boolean;
  crop: Crop | null;
}

export type { PlotSave } from '@farming/shared';

/**
 * Tilled soil and the crops growing in it. Soil lives on its own tilemap
 * layer above the ground; crops are y-sorted sprites.
 *
 * Growth: each morning, every crop that was watered the day before advances
 * one stage and the soil dries out, so crops need watering once a day.
 * Rain waters everything. Crops wither if the season changes under them.
 */
export class FarmingSystem {
  private readonly plots = new Map<number, Plot>();

  /** Crops sway gently in the breeze (stronger in wind and rain). */
  sway(time: number, strength: number): void {
    for (const plot of this.plots.values()) {
      const s = plot.crop?.sprite;
      if (!s || !s.visible) continue;
      s.setRotation(Math.sin(time / 650 + plot.tx * 0.7 + plot.ty * 0.3) * 0.035 * strength);
    }
  }

  /** The luck buff: harvests sometimes give one more. */
  lucky: () => boolean = () => false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
    private readonly soil: Phaser.Tilemaps.TilemapLayer,
    private readonly fx: FxSystem,
    private readonly drops: DropSystem,
  ) {
    soil.setDepth(DEPTH.soil);
  }

  /** Greenhouse shelter: tiles where any crop grows in any season. */
  private sheltered: (tx: number, ty: number) => boolean = () => false;

  setShelter(check: (tx: number, ty: number) => boolean): void {
    this.sheltered = check;
  }

  /** Whether a crop grows in the given season (anywhere under glass, always). */
  inSeason(cropId: CropId, season: Season, tx?: number, ty?: number): boolean {
    if (tx !== undefined && ty !== undefined && this.sheltered(tx, ty)) return true;
    return CROPS[cropId].seasons.includes(season);
  }

  plotAt(tx: number, ty: number): Plot | undefined {
    return this.plots.get(this.key(tx, ty));
  }

  isTilled(tx: number, ty: number): boolean {
    return this.plots.has(this.key(tx, ty));
  }

  isMature(plot: Plot): boolean {
    return !!plot.crop && plot.crop.stage >= CROPS[plot.crop.id].matureStage;
  }

  /** Only open grass can be tilled. */
  canTill(tx: number, ty: number): boolean {
    return terrainAt(this.world, tx, ty) === Terrain.Grass && !this.isTilled(tx, ty);
  }

  till(tx: number, ty: number, quiet = false): Plot {
    const plot: Plot = { tx, ty, watered: false, crop: null };
    this.plots.set(this.key(tx, ty), plot);
    this.soil.putTileAt(TILE.SOIL_DRY, tx, ty);
    if (!quiet) {
      this.fx.burst('dirt', this.centerX(tx), this.centerY(ty), 6);
      sfx('till');
    }
    return plot;
  }

  /** Clears empty soil back to grass. */
  untill(plot: Plot): boolean {
    if (plot.crop) return false;
    this.plots.delete(this.key(plot.tx, plot.ty));
    this.soil.removeTileAt(plot.tx, plot.ty);
    this.fx.burst('dirt', this.centerX(plot.tx), this.centerY(plot.ty), 6);
    sfx('till', { rate: 0.85 });
    return true;
  }

  water(plot: Plot): void {
    plot.watered = true;
    this.soil.putTileAt(TILE.SOIL_WET, plot.tx, plot.ty);
    this.fx.burst('water', this.centerX(plot.tx), this.centerY(plot.ty), 8);
    sfx('water');
  }

  plant(plot: Plot, cropId: CropId, quiet = false): void {
    const size = GAME_CONFIG.tileSize;
    const y = plot.ty * size + size - 1;
    const sprite = this.scene.add
      .image(this.centerX(plot.tx), y, cropTextureKey(cropId, 0))
      .setOrigin(0.5, 15 / 16)
      .setDepth(DEPTH.ySortBase + y - 4);
    plot.crop = { id: cropId, stage: 0, sprite };
    if (!quiet) {
      this.fx.burst('dirt', this.centerX(plot.tx), this.centerY(plot.ty), 4);
      sfx('plant');
    }
  }

  /** Fertilizer: advance one stage immediately. */
  fertilize(plot: Plot): boolean {
    if (!plot.crop || this.isMature(plot)) return false;
    plot.crop.fed = true;
    this.advance(plot);
    this.fx.burst('sparkle', this.centerX(plot.tx), this.centerY(plot.ty) - 4, 10);
    sfx('sparkle');
    return true;
  }

  /** `drops` = false when another co-op player harvested (they get the crop). */
  harvest(plot: Plot, drops = true): boolean {
    if (!plot.crop || !this.isMature(plot)) return false;
    const def = CROPS[plot.crop.id];
    const fed = !!plot.crop.fed;
    const x = this.centerX(plot.tx);
    const y = this.centerY(plot.ty);
    if (def.regrowStage !== undefined) {
      // Plants that keep producing go back to an earlier stage.
      plot.crop.stage = def.regrowStage;
      plot.crop.sprite.setTexture(cropTextureKey(plot.crop.id, plot.crop.stage));
    } else {
      plot.crop.sprite.destroy();
      plot.crop = null;
    }
    if (drops) {
      const q = rollQuality({ level: skills.level('farming'), fed: fed, lucky: this.lucky() });
      this.drops.spawn(def.harvestItem, Phaser.Math.Between(def.yield[0], def.yield[1]) + (this.lucky() && Math.random() < 0.5 ? 1 : 0) + (skills.bonus('farming') ? 1 : 0), x, y, q);
      skills.gain('farming', 7);
      daily.note('harvest');
    }
    this.fx.burst('leaf', x, y - 2, 8);
    sfx('harvest');
    return true;
  }

  private advance(plot: Plot): void {
    const crop = plot.crop;
    if (!crop) return;
    crop.stage = Math.min(crop.stage + 1, CROPS[crop.id].matureStage);
    crop.sprite.setTexture(cropTextureKey(crop.id, crop.stage));
    this.fx.pop(crop.sprite);
  }

  /**
   * Morning update. Returns how many crops withered from a season change.
   */
  onNewDay(season: Season, seasonChanged: boolean, raining: boolean): number {
    let withered = 0;
    for (const plot of this.plots.values()) {
      if (plot.crop && seasonChanged && !this.inSeason(plot.crop.id, season, plot.tx, plot.ty)) {
        plot.crop.sprite.destroy();
        plot.crop = null;
        withered++;
      }
      if (plot.crop && plot.watered && !this.isMature(plot)) this.advance(plot);
      plot.watered = false;
      this.soil.putTileAt(TILE.SOIL_DRY, plot.tx, plot.ty);
    }
    if (raining) this.waterAll();
    return withered;
  }

  /** Waters one plot without the splash (sprinklers). Returns true if it needed it. */
  soak(tx: number, ty: number): boolean {
    const plot = this.plotAt(tx, ty);
    if (!plot || plot.watered) return false;
    plot.watered = true;
    this.soil.putTileAt(TILE.SOIL_WET, plot.tx, plot.ty);
    return true;
  }

  /** Rain: every plot is watered (quietly, no splash). */
  waterAll(): void {
    for (const plot of this.plots.values()) {
      if (plot.watered) continue;
      plot.watered = true;
      this.soil.putTileAt(TILE.SOIL_WET, plot.tx, plot.ty);
    }
  }

  /** Every plot, for the world map. */
  markers(): Array<{ tx: number; ty: number; crop: boolean; ready: boolean }> {
    return [...this.plots.values()].map((p) => ({ tx: p.tx, ty: p.ty, crop: !!p.crop, ready: this.isMature(p) }));
  }

  serialize(): PlotSave[] {
    return [...this.plots.values()].map((p) => ({
      tx: p.tx,
      ty: p.ty,
      watered: p.watered,
      crop: p.crop ? { id: p.crop.id, stage: p.crop.stage, ...(p.crop.fed ? { fed: true } : {}) } : null,
    }));
  }

  restore(plots: PlotSave[]): void {
    for (const saved of plots) {
      if (terrainAt(this.world, saved.tx, saved.ty) !== Terrain.Grass || this.isTilled(saved.tx, saved.ty)) continue;
      const plot = this.till(saved.tx, saved.ty, true);
      if (saved.watered) {
        plot.watered = true;
        this.soil.putTileAt(TILE.SOIL_WET, plot.tx, plot.ty);
      }
      if (saved.crop && saved.crop.id in CROPS) {
        this.plant(plot, saved.crop.id, true);
        const crop = plot.crop!;
        crop.stage = Math.max(0, Math.min(CROPS[crop.id].matureStage, Math.floor(saved.crop.stage)));
        if (saved.crop.fed) crop.fed = true;
        crop.sprite.setTexture(cropTextureKey(crop.id, crop.stage));
      }
    }
  }

  private centerX(tx: number): number {
    return tx * GAME_CONFIG.tileSize + GAME_CONFIG.tileSize / 2;
  }

  private centerY(ty: number): number {
    return ty * GAME_CONFIG.tileSize + GAME_CONFIG.tileSize / 2;
  }

  private key(tx: number, ty: number): number {
    return ty * this.world.width + tx;
  }
}
