import type * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { daily } from '../state/daily';
import { FISH, FISHING, GAME_CONFIG, ITEMS, type ItemId, type Season, type WeatherKind } from '@farming/shared';
import { itemTextureKey, TEXTURES } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import type { Player } from '../entities/Player';
import { gameEvents } from '../events/GameEventBus';
import type { PlayerState } from '../state/PlayerState';
import type { DropSystem } from './DropSystem';
import type { FxSystem } from './FxSystem';

type Phase = 'idle' | 'casting' | 'waiting' | 'bite' | 'reeling';

/** Meter size in world pixels. */
const METER_H = 60;
const METER_W = 10;

export interface FishingContext {
  minute: number;
  season: Season;
  weather: WeatherKind;
  /** The sea at the beach, or ponds and the river. */
  water?: 'fresh' | 'ocean' | 'island';
}

const toast = (text: string) => gameEvents.emit('toast', { text });

/** Which fish are biting right now, weighted. */
export function fishPool(ctx: FishingContext): Array<{ itemId: ItemId; weight: number; difficulty?: number }> {
  const minute = ctx.minute % (24 * 60);
  const water = ctx.water ?? 'fresh';
  return FISH.filter((f) => {
    if ((f.water ?? 'fresh') !== water) return false;
    if (f.seasons && !f.seasons.includes(ctx.season)) return false;
    if (f.weather && !f.weather.includes(ctx.weather)) return false;
    if (f.hours) {
      const from = f.hours.from % (24 * 60);
      const to = f.hours.to % (24 * 60);
      const inside = from <= to ? minute >= from && minute < to : minute >= from || minute < to;
      if (!inside) return false;
    }
    return true;
  });
}

/**
 * Fishing: cast into water, wait for the bobber to dip, then press Use while
 * the "!" is showing. Too early or too late and the fish gets away.
 */
export class FishingSystem {
  private phase: Phase = 'idle';
  private readonly line: Phaser.GameObjects.Graphics;
  private readonly bobber: Phaser.GameObjects.Image;
  /** In winter, the line goes through a hole cut in the pond ice. */
  private readonly iceHole: Phaser.GameObjects.Ellipse;
  private readonly alert: Phaser.GameObjects.Image;
  private timer = 0;
  private bob = 0;
  private target = { x: 0, y: 0 };
  private ctx: FishingContext = { minute: 0, season: 'spring', weather: 'sunny' };
  /** Is Use held? Set by the scene (keyboard, mouse, pad, touch). */
  isHeld: () => boolean = () => false;
  // The reeling minigame: a catch bar you keep over the fish.
  private readonly meter: Phaser.GameObjects.Graphics;
  private readonly fishIcon: Phaser.GameObjects.Image;
  private hooked: ItemId = 'sunfish';
  private difficulty = 1;
  private barPos = 0;
  private barVel = 0;
  private barSize = 0.3;
  private fishPos = 0.5;
  private fishTarget = 0.5;
  private fishTimer = 0;
  private progress = 0.3;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly state: PlayerState,
    private readonly drops: DropSystem,
    private readonly fx: FxSystem,
  ) {
    this.line = scene.add.graphics().setDepth(DEPTH.fx - 3);
    this.bobber = scene.add.image(0, 0, TEXTURES.bobber).setVisible(false).setDepth(DEPTH.ySortBase - 1);
    this.iceHole = scene.add.ellipse(0, 0, 12, 7, 0x1e4a68, 1).setStrokeStyle(1.5, 0xf4fcff).setVisible(false).setDepth(DEPTH.ySortBase - 1.5);
    this.alert = scene.add.image(0, 0, TEXTURES.alert).setOrigin(0.5, 1).setVisible(false).setDepth(DEPTH.fx);
    this.meter = scene.add.graphics().setDepth(DEPTH.fx + 1).setVisible(false);
    this.fishIcon = scene.add.image(0, 0, itemTextureKey('sunfish')).setDepth(DEPTH.fx + 2).setScale(0.5).setVisible(false);
  }

  /** In the reeling minigame. */
  get reeling(): boolean {
    return this.phase === 'reeling';
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get biting(): boolean {
    return this.phase === 'bite';
  }

  /** Throws the line onto a water tile. */
  cast(tx: number, ty: number, ctx: FishingContext): void {
    if (this.active) return;
    if (!this.state.spendEnergy(skills.toolCost('fishing_rod', FISHING.energyCost))) {
      toast("You're too tired to fish.");
      return;
    }
    const size = GAME_CONFIG.tileSize;
    this.ctx = ctx;
    this.target = { x: tx * size + size / 2, y: ty * size + size / 2 + 2 };
    this.phase = 'casting';
    const rod = itemTextureKey('fishing_rod');
    sfx('cast');
    this.player.useTool(rod, 'swing', () => undefined);
    // After the swing, keep the rod out and drop the bobber in.
    this.scene.time.delayedCall(340, () => {
      if (this.phase !== 'casting') return;
      this.player.hold(rod);
      this.bobber.setPosition(this.target.x, this.target.y).setVisible(true);
      const ice = this.ctx?.season === 'winter' && (this.ctx.water ?? 'fresh') === 'fresh';
      this.iceHole.setPosition(this.target.x, this.target.y + 1).setVisible(ice);
      this.fx.burst(ice ? 'stone' : 'water', this.target.x, this.target.y, 5);
      sfx('splash', { volume: 0.6 });
      this.phase = 'waiting';
      const [min, max] = FISHING.biteDelay;
      this.timer = (min + Math.random() * (max - min)) * (this.state.hasBuff('fishing') ? 0.5 : 1);
    });
  }

  /** Use pressed while the line is out. */
  reel(): void {
    if (this.phase === 'casting') return;
    if (this.phase === 'reeling') return;
    if (this.phase === 'bite') {
      this.hook();
      return;
    }
    if (this.phase === 'waiting') {
      toast('Reeled in too early — nothing on the line.');
      this.stop();
    }
  }

  /** Walking away (or opening a menu) puts the rod away. */
  cancel(): void {
    if (this.active) this.stop();
  }

  update(delta: number): void {
    if (this.phase === 'idle' || this.phase === 'casting') return;
    if (this.phase === 'reeling') {
      this.updateReel(delta);
      if (this.phase !== 'reeling') return;
    }
    this.timer -= delta;
    this.bob += delta;
    const tip = this.player.hold(itemTextureKey('fishing_rod'));

    if (this.phase === 'waiting') {
      this.bobber.y = this.target.y + Math.sin(this.bob / 280) * 0.7;
      if (this.timer <= 0) {
        this.phase = 'bite';
        this.timer = FISHING.reactionWindow;
        this.alert.setPosition(this.player.x + 9, this.player.y - 27).setVisible(true);
        sfx('bite');
        this.fx.burst('water', this.target.x, this.target.y, 4);
      }
    } else if (this.phase === 'bite') {
      // Bobber tugged under.
      this.bobber.y = this.target.y + 2 + Math.sin(this.bob / 40) * 1.2;
      this.alert.setPosition(this.player.x + 9, this.player.y - 27 - Math.abs(Math.sin(this.bob / 90)) * 2);
      if (this.timer <= 0) {
        toast('The fish got away!');
        this.stop();
        return;
      }
    }

    // A gently sagging line from the rod tip to the bobber.
    const g = this.line;
    g.clear();
    g.lineStyle(0.6, 0xf4efe0, 0.85);
    const bx = this.bobber.x;
    const by = this.bobber.y - 2;
    const mx = (tip.x + bx) / 2;
    const my = Math.max(tip.y, by) + 6;
    g.beginPath();
    g.moveTo(tip.x, tip.y);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * tip.x + 2 * (1 - t) * t * mx + t * t * bx;
      const y = (1 - t) * (1 - t) * tip.y + 2 * (1 - t) * t * my + t * t * by;
      g.lineTo(x, y);
    }
    g.strokePath();
  }

  /** Struck at the right moment: junk comes straight up, fish start the reeling minigame. */
  private hook(): void {
    if (Math.random() < FISHING.trashChance) {
      const junk = FISHING.trash[Math.floor(Math.random() * FISHING.trash.length)];
      this.land(junk);
      return;
    }
    const pool = fishPool(this.ctx);
    let roll = Math.random() * pool.reduce((sum, f) => sum + f.weight, 0);
    let pick = pool[0];
    for (const f of pool) {
      roll -= f.weight;
      if (roll <= 0) {
        pick = f;
        break;
      }
    }
    this.hooked = pick?.itemId ?? 'sunfish';
    this.difficulty = pick?.difficulty ?? 1;
    this.phase = 'reeling';
    this.alert.setVisible(false);
    this.barSize = Math.max(0.16, 0.34 - 0.035 * (this.difficulty - 1)) + (this.state.hasBuff('fishing') ? 0.08 : 0) + skills.level('fishing') * 0.012;
    this.barPos = 0;
    this.barVel = 0;
    this.fishPos = 0.4;
    this.fishTarget = 0.5;
    this.fishTimer = 0;
    this.progress = 0.3;
    this.fishIcon.setTexture(itemTextureKey(this.hooked)).setVisible(true);
    this.meter.setVisible(true);
    toast('Hooked! Hold Use to raise the green bar and keep the fish inside it.');
    sfx('bite');
  }

  private updateReel(delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    const d = this.difficulty;
    // The bar: rises while Use is held, falls otherwise; bounces off the ends.
    this.barVel += (this.isHeld() ? 3.2 : -2.6) * dt;
    this.barVel = Math.max(-1.6, Math.min(1.6, this.barVel));
    this.barPos += this.barVel * dt;
    const top = 1 - this.barSize;
    if (this.barPos < 0) {
      this.barPos = 0;
      this.barVel = Math.max(0, -this.barVel * 0.3);
    } else if (this.barPos > top) {
      this.barPos = top;
      this.barVel = Math.min(0, -this.barVel * 0.3);
    }
    // The fish darts to new spots; harder fish move more often, faster and further.
    this.fishTimer -= delta;
    if (this.fishTimer <= 0) {
      const reach = 0.25 + d * 0.13;
      this.fishTarget = Math.max(0.03, Math.min(0.97, this.fishPos + (Math.random() * 2 - 1) * reach));
      this.fishTimer = 1500 / (0.6 + d * 0.5) * (0.5 + Math.random());
    }
    const speed = 0.25 + d * 0.18;
    const gap = this.fishTarget - this.fishPos;
    this.fishPos += Math.sign(gap) * Math.min(Math.abs(gap), speed * dt);
    // Progress: fills while the fish is in the bar, drains when it isn't.
    const inside = this.fishPos >= this.barPos && this.fishPos <= this.barPos + this.barSize;
    this.progress += (inside ? 0.32 : -(0.14 + d * 0.035)) * dt;
    this.drawMeter(inside);
    if (this.progress >= 1) this.land(this.hooked);
    else if (this.progress <= 0) {
      toast(`The ${ITEMS[this.hooked].name.toLowerCase()} got away!`);
      sfx('splash', { volume: 0.5 });
      this.stop();
    }
  }

  private drawMeter(inside: boolean): void {
    const g = this.meter;
    g.clear();
    const x = this.player.x + 14;
    const yTop = this.player.y - METER_H - 4;
    // Frame.
    g.fillStyle(0x2a1a0e, 0.92);
    g.fillRoundedRect(x - 2, yTop - 2, METER_W + 9, METER_H + 4, 2);
    g.fillStyle(0x4a7aa8, 1);
    g.fillRect(x, yTop, METER_W, METER_H);
    // Catch bar.
    const barH = this.barSize * METER_H;
    const barY = yTop + METER_H - (this.barPos * METER_H + barH);
    g.fillStyle(inside ? 0x8be06a : 0x5fb04a, 0.9);
    g.fillRect(x, barY, METER_W, barH);
    // Progress strip.
    const pH = Math.max(0, Math.min(1, this.progress)) * METER_H;
    g.fillStyle(0x1a1208, 1);
    g.fillRect(x + METER_W + 2, yTop, 4, METER_H);
    g.fillStyle(this.progress > 0.66 ? 0x8be06a : this.progress > 0.33 ? 0xe8c25a : 0xe0644f, 1);
    g.fillRect(x + METER_W + 2, yTop + METER_H - pH, 4, pH);
    this.fishIcon.setPosition(x + METER_W / 2, yTop + METER_H - this.fishPos * METER_H);
  }

  private land(caught: ItemId): void {
    const { x, y } = this.target;
    this.stop();
    this.fx.burst('water', x, y, 10);
    this.fx.burst('sparkle', this.player.x, this.player.y - 18, 8);
    sfx('splash');
    sfx('catch');
    // Show the catch held up for a moment.
    const shown = this.scene.add.image(this.player.x, this.player.y - 31, itemTextureKey(caught)).setDepth(DEPTH.fx);
    this.scene.tweens.add({ targets: shown, y: shown.y - 6, alpha: 0, delay: 600, duration: 500, onComplete: () => shown.destroy() });
    if (this.state.inventory.add(caught, 1) > 0) this.drops.spawn(caught, 1, this.player.x, this.player.y + 4);
    else gameEvents.emit('item:collected', { itemId: caught, quantity: 1 });
    const rare = caught === 'golden_carp';
    const junk = (FISHING.trash as readonly ItemId[]).includes(caught);
    skills.gain('fishing', junk ? 2 : 6 + this.difficulty * 4);
    if (!junk) daily.note('fish');
    toast(rare ? `Wow! You caught a ${ITEMS[caught].name}!` : junk ? `Just some ${ITEMS[caught].name.toLowerCase()}…` : `You caught a ${ITEMS[caught].name}!`);
  }

  private stop(): void {
    this.phase = 'idle';
    this.line.clear();
    this.bobber.setVisible(false);
    this.iceHole.setVisible(false);
    this.alert.setVisible(false);
    this.meter.clear().setVisible(false);
    this.fishIcon.setVisible(false);
    this.player.hold(null);
  }
}
