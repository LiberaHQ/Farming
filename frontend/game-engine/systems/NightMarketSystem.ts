import * as Phaser from 'phaser';
import { GAME_CONFIG, SPIRITS, SPIRIT_IDS, type SpiritId } from '@farming/shared';
import { drawFriendlyGhost } from '../assets/valley';
import { DEPTH } from '../constants';

const T = GAME_CONFIG.tileSize;

interface Spirit {
  id: SpiritId;
  tx: number;
  ty: number;
  home: { x: number; y: number };
  sprite: Phaser.GameObjects.Image;
  lantern: Phaser.GameObjects.Graphics;
}

/**
 * The spirits of the night market: three softly glowing figures in the old
 * graveyard, each carrying a little lantern. They fade in at 10pm once Elsie
 * is at rest, and fade away when the night ends. They're ghosts, so they
 * don't block your way.
 */
export class NightMarketSystem {
  private readonly spirits: Spirit[];
  private shown = false;
  private frameAt = 0;
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** The graveyard's north-west corner (its fence), in tiles. */
    corner: { x0: number; y0: number },
  ) {
    for (const f of [0, 1]) {
      const key = `ghost-elsie-${f}`;
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawFriendlyGhost(f).toCanvas());
    }
    this.spirits = SPIRIT_IDS.map((id) => {
      const def = SPIRITS[id];
      const tx = corner.x0 + def.cell.c;
      const ty = corner.y0 + def.cell.r;
      const home = { x: (tx + 0.5) * T, y: (ty + 1) * T + 2 };
      const sprite = scene.add.image(home.x, home.y, 'ghost-elsie-0').setOrigin(0.5, 1).setTint(def.tint).setAlpha(0).setVisible(false);
      const lantern = scene.add.graphics().setVisible(false);
      lantern.fillStyle(0x3a2a20, 1).fillRect(-2, -5, 4, 1);
      lantern.fillStyle(0xfff1a8, 1).fillRect(-2, -4, 4, 4);
      lantern.fillStyle(0xffffff, 1).fillRect(-1, -3, 2, 2);
      return { id, tx, ty, home, sprite, lantern };
    });
  }

  /** The spirit on this tile, if any (whether or not the market is open). */
  spiritAt(tx: number, ty: number): SpiritId | null {
    return this.spirits.find((s) => s.tx === tx && s.ty === ty)?.id ?? null;
  }

  /** Lantern light for each spirit while they're out. */
  lights(): Array<{ x: number; y: number; radius: number }> {
    return this.shown ? this.spirits.map((s) => ({ x: s.sprite.x + 7, y: s.sprite.y - 10, radius: 30 })) : [];
  }

  update(open: boolean, away: boolean, player: { x: number; y: number }): void {
    const want = open && !away;
    if (want !== this.shown) {
      this.shown = want;
      for (const s of this.spirits) {
        this.scene.tweens.killTweensOf([s.sprite, s.lantern]);
        if (want) {
          s.sprite.setVisible(true).setAlpha(0);
          s.lantern.setVisible(true).setAlpha(0);
          this.scene.tweens.add({ targets: s.sprite, alpha: 0.78, duration: 1800 });
          this.scene.tweens.add({ targets: s.lantern, alpha: 1, duration: 1800 });
        } else {
          this.scene.tweens.add({ targets: [s.sprite, s.lantern], alpha: 0, duration: 900, onComplete: () => (s.sprite.setVisible(false), s.lantern.setVisible(false)) });
        }
      }
    }
    if (!this.shown) return;
    const now = this.scene.time.now;
    if (now > this.frameAt) {
      this.frameAt = now + 460;
      this.frame = 1 - this.frame;
    }
    this.spirits.forEach((s, i) => {
      const t = now / 1000 + i * 1.7;
      const x = s.home.x + Math.sin(t * 0.5) * 3;
      const y = s.home.y - 5 + Math.sin(t * 2) * 2;
      s.sprite.setPosition(x, y).setTexture(`ghost-elsie-${(this.frame + i) % 2}`);
      s.sprite.setFlipX(player.x < x - 2);
      s.sprite.setDepth(DEPTH.ySortBase + s.home.y + 6);
      s.lantern.setPosition(x + (s.sprite.flipX ? -8 : 8), y - 8 + Math.sin(t * 3) * 1);
      s.lantern.setDepth(s.sprite.depth + 1);
    });
  }
}
