import * as Phaser from 'phaser';
import { GAME_CONFIG, type Direction } from '@farming/shared';
import { HORSE_FRAMES } from '../assets/horse';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { standFrame, type Player } from '../entities/Player';
import { PLAYER_FEET_ORIGIN_Y } from '../assets/playerCharacter';

const CALL_SPEED = 120;
const MOUNT_RANGE = 30;

/**
 * Your horse: stands where you left it, trots over when you call it, and
 * carries you (much faster) while you ride. While riding, the player's own
 * sprite is hidden and drawn as a rider on the horse's back instead.
 */
export class HorseSystem {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private shadow: Phaser.GameObjects.Image | null = null;
  private rider: Phaser.GameObjects.Image | null = null;
  private target: { x: number; y: number } | null = null;
  private facing: Direction = 'right';
  private t = 0;
  name = '';
  riding = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
  ) {}

  get exists(): boolean {
    return this.sprite !== null;
  }

  show(save: { name: string; x: number; y: number } | undefined): void {
    this.sprite?.destroy();
    this.shadow?.destroy();
    this.rider?.destroy();
    this.sprite = this.shadow = this.rider = null;
    this.riding = false;
    if (!save) return;
    this.name = save.name;
    this.sprite = this.scene.add.sprite(save.x, save.y, TEXTURES.horse, HORSE_FRAMES.sideStand).setOrigin(0.5, 1);
    this.shadow = this.scene.add.image(save.x, save.y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(2.2, 1.4);
    this.rider = this.scene.add.image(0, 0, TEXTURES.player, standFrame('down')).setOrigin(0.5, PLAYER_FEET_ORIGIN_Y).setVisible(false);
  }

  toSave(): { name: string; x: number; y: number } | undefined {
    if (!this.sprite) return undefined;
    return { name: this.name, x: Math.round(this.sprite.x), y: Math.round(this.sprite.y) };
  }

  distance(): number {
    return this.sprite ? Math.hypot(this.sprite.x - this.player.x, this.sprite.y - (this.player.y + 4)) : Infinity;
  }

  /** Whistle: the horse comes to you (from off-screen if it's far away). */
  call(): void {
    const s = this.sprite;
    if (!s || this.riding) return;
    if (this.distance() > 420) {
      const a = Math.random() * Math.PI * 2;
      s.setPosition(this.player.x + Math.cos(a) * 170, this.player.y + Math.sin(a) * 120);
    }
    this.target = { x: this.player.x + 14, y: this.player.y + 4 };
  }

  canMount(): boolean {
    return !!this.sprite && !this.riding && this.distance() <= MOUNT_RANGE;
  }

  mount(): void {
    if (!this.canMount()) return;
    this.riding = true;
    this.target = null;
    this.player.sprite.setAlpha(0);
    this.player.setShadowVisible(false);
    this.rider?.setVisible(true);
    this.scene.tweens.add({ targets: this.sprite, y: this.sprite!.y - 3, duration: 90, yoyo: true });
  }

  /** Get off: the horse stays beside you. */
  dismount(): void {
    if (!this.riding || !this.sprite) return;
    this.riding = false;
    this.player.sprite.setAlpha(1);
    this.player.setShadowVisible(true);
    this.rider?.setVisible(false);
    this.sprite.setPosition(this.player.x + (this.facing === 'left' ? 16 : -16), this.player.y + 4);
    this.sprite.setFrame(HORSE_FRAMES.sideStand);
  }

  /** Sends the horse home (e.g. overnight), next to a point. */
  stableAt(x: number, y: number): void {
    if (!this.sprite || this.riding) return;
    this.sprite.setPosition(x, y);
    this.target = null;
  }

  setVisible(v: boolean): void {
    this.sprite?.setVisible(v);
    this.shadow?.setVisible(v);
    this.rider?.setVisible(v && this.riding);
  }

  update(delta: number): void {
    const s = this.sprite;
    if (!s) return;
    this.t += delta;
    let moving = false;
    if (this.riding) {
      const body = this.player.sprite.body;
      moving = Math.abs(body.velocity.x) + Math.abs(body.velocity.y) > 1;
      this.facing = this.player.facingDirection;
      s.setPosition(this.player.x, this.player.y + 4);
    } else if (this.target) {
      const dx = this.target.x - s.x;
      const dy = this.target.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) this.target = null;
      else {
        const step = Math.min(d, CALL_SPEED * (delta / 1000));
        s.x += (dx / d) * step;
        s.y += (dy / d) * step;
        moving = true;
        this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      }
    }
    // Pick the frame for the direction and gait.
    const step = Math.floor(this.t / (this.riding ? 110 : 160)) % 2;
    if (this.facing === 'down') s.setFrame(HORSE_FRAMES.down[moving ? step : 0]).setFlipX(false);
    else if (this.facing === 'up') s.setFrame(HORSE_FRAMES.up[moving ? step : 0]).setFlipX(false);
    else s.setFrame(moving ? HORSE_FRAMES.sideWalk[step] : HORSE_FRAMES.sideStand).setFlipX(this.facing === 'left');
    s.setDepth(DEPTH.ySortBase + s.y - (this.riding ? 4 : 0));
    this.shadow?.setPosition(s.x, s.y - 1);
    // The rider sits in the saddle.
    if (this.rider && this.riding) {
      const bob = moving ? (step ? -1 : 0) : 0;
      const sideways = this.facing === 'left' || this.facing === 'right';
      this.rider
        .setFrame(standFrame(this.facing))
        .setPosition(s.x + (sideways ? (this.facing === 'left' ? 1 : -1) : 0), s.y - (sideways ? 14 : this.facing === 'down' ? 19 : 12) + bob)
        .setDepth(this.facing === 'down' ? s.depth - 0.1 : s.depth + 0.1);
    }
  }

  /** The pixel size of a tile, for callers placing the horse. */
  static readonly tile = GAME_CONFIG.tileSize;
}
