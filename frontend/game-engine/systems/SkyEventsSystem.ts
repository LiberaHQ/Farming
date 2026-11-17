import * as Phaser from 'phaser';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';

export interface SkyContext {
  /** A thunderstorm is going on. */
  storm: boolean;
  /** Show the rainbow (the dry morning after a storm). */
  rainbow: boolean;
  /** The summer meteor shower is on. */
  meteors: boolean;
  /** 0 (day) … 1 (deep night). */
  darkness: number;
}

/**
 * Things that happen in the sky over the farm: lightning flashes (and the odd
 * bolt hitting a tree), a rainbow after a storm, shooting stars during the
 * meteor shower. Everything is drawn in world space over the current view.
 */
export class SkyEventsSystem {
  private flash: Phaser.GameObjects.Rectangle;
  private bolt: Phaser.GameObjects.Graphics;
  private rainbowG: Phaser.GameObjects.Graphics;
  private rainbowSize = { w: 0, h: 0 };
  private rainbowAlpha = 0;
  private lightningIn = 4000;
  private meteorIn = 600;
  private stars: Array<{ line: Phaser.GameObjects.Graphics; x: number; y: number; vx: number; vy: number; life: number; max: number }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    /** Asked for a tree to strike (in view); returns its top and base, or null. */
    private readonly pickTree: () => { x: number; top: number; base: number } | null,
    /** A bolt hit a tree at this base point. */
    private readonly onStrike: (x: number, base: number) => void,
  ) {
    this.flash = scene.add.rectangle(0, 0, 10, 10, 0xf4f8ff, 0).setOrigin(0).setDepth(DEPTH.lighting + 5);
    this.bolt = scene.add.graphics().setDepth(DEPTH.lighting + 6);
    this.rainbowG = scene.add.graphics().setDepth(DEPTH.lighting - 0.5);
  }

  update(delta: number, ctx: SkyContext): void {
    const view = this.scene.cameras.main.worldView;
    this.flash.setPosition(view.x, view.y).setSize(view.width, view.height);

    // Lightning.
    if (ctx.storm) {
      this.lightningIn -= delta;
      if (this.lightningIn <= 0) {
        this.lightningIn = 7000 + Math.random() * 11000;
        this.strike(Math.random() < 0.45);
      }
    } else this.lightningIn = 3000 + Math.random() * 4000;

    // The rainbow fades in and out.
    const target = ctx.rainbow ? 0.55 : 0;
    this.rainbowAlpha += (target - this.rainbowAlpha) * Math.min(1, delta / 1500);
    if (this.rainbowAlpha > 0.01) {
      if (this.rainbowSize.w !== Math.round(view.width) || this.rainbowSize.h !== Math.round(view.height)) this.drawRainbow(view.width, view.height);
      this.rainbowG.setVisible(true).setPosition(view.x, view.y).setAlpha(this.rainbowAlpha);
    } else this.rainbowG.setVisible(false);

    // Shooting stars.
    if (ctx.meteors && ctx.darkness > 0.12) {
      this.meteorIn -= delta;
      if (this.meteorIn <= 0) {
        this.meteorIn = 150 + Math.random() * 550;
        this.spawnStar(view);
      }
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.life += delta;
      s.x += s.vx * (delta / 1000);
      s.y += s.vy * (delta / 1000);
      const k = 1 - s.life / s.max;
      s.line.clear();
      s.line.lineStyle(3, 0xbfd8ff, Math.max(0, k) * 0.35);
      s.line.lineBetween(s.x, s.y, s.x - s.vx * 0.16, s.y - s.vy * 0.16);
      s.line.lineStyle(1.4, 0xffffff, Math.max(0, k));
      s.line.lineBetween(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      s.line.fillStyle(0xfff4c8, Math.max(0, k)).fillCircle(s.x, s.y, 1.6);
      if (s.life >= s.max) {
        s.line.destroy();
        this.stars.splice(i, 1);
      }
    }
  }

  /** A flash (or two), thunder a moment later, and sometimes a bolt into a tree. */
  private strike(bolt: boolean): void {
    const tree = bolt ? this.pickTree() : null;
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(0.75);
    this.scene.tweens.add({
      targets: this.flash,
      alpha: 0,
      duration: 160,
      onComplete: () => {
        this.flash.setAlpha(0.45);
        this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 420 });
      },
    });
    if (tree) {
      const g = this.bolt;
      g.clear();
      const view = this.scene.cameras.main.worldView;
      let x = tree.x + (Math.random() - 0.5) * 40;
      let y = view.y;
      g.lineStyle(2.5, 0xffffff, 1);
      g.beginPath();
      g.moveTo(x, y);
      while (y < tree.top) {
        y = Math.min(tree.top, y + 8 + Math.random() * 10);
        x += (tree.x - x) * 0.35 + (Math.random() - 0.5) * 10;
        g.lineTo(x, y);
      }
      g.strokePath();
      g.lineStyle(1, 0xbfd8ff, 0.8);
      g.strokePath();
      g.setAlpha(1);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 420, delay: 220 });
      this.onStrike(tree.x, tree.base);
    }
    this.scene.time.delayedCall(tree ? 120 : 400 + Math.random() * 1400, () => sfx('thunder', { volume: tree ? 1 : 0.6, rate: 0.9 + Math.random() * 0.2 }));
  }

  private drawRainbow(w: number, h: number): void {
    this.rainbowSize = { w: Math.round(w), h: Math.round(h) };
    const g = this.rainbowG;
    g.clear();
    const colors = [0xe0443e, 0xf0883a, 0xf4d24a, 0x6ab04c, 0x4a8ad8, 0x6a5ab8, 0x9a5ac8];
    const cx = w * 0.62;
    const cy = h * 1.05;
    const r0 = Math.max(w, h) * 0.78;
    const band = Math.max(3, w / 90);
    colors.forEach((c, i) => {
      g.lineStyle(band, c, 1);
      g.beginPath();
      g.arc(cx, cy, r0 - i * band, Math.PI * 1.08, Math.PI * 1.92);
      g.strokePath();
    });
  }

  private spawnStar(view: Phaser.Geom.Rectangle): void {
    const line = this.scene.add.graphics().setDepth(DEPTH.lighting + 4);
    const x = view.x + Math.random() * view.width * 0.9;
    const y = view.y + Math.random() * view.height * 0.4;
    const speed = 220 + Math.random() * 160;
    const angle = Math.PI * (0.15 + Math.random() * 0.2);
    this.stars.push({ line, x, y, vx: Math.cos(angle) * speed * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(angle) * speed, life: 0, max: 700 + Math.random() * 700 });
  }
}
