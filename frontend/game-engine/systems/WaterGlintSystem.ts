import * as Phaser from 'phaser';
import { GAME_CONFIG, Terrain } from '@farming/shared';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { terrainAt, type WorldData } from '../maps/WorldData';

/**
 * Small pooled glints that twinkle on open water near the camera. Gives the
 * water life without animating thousands of tiles.
 */
export class WaterGlintSystem {
  private readonly openWater: Array<{ x: number; y: number }> = [];

  constructor(
    private readonly scene: Phaser.Scene,
    world: WorldData,
    count = 28,
  ) {
    const size = GAME_CONFIG.tileSize;
    const isWater = (x: number, y: number) => terrainAt(world, x, y) === Terrain.Water;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        if (isWater(x, y) && isWater(x - 1, y) && isWater(x + 1, y) && isWater(x, y - 1) && isWater(x, y + 1)) {
          this.openWater.push({ x: x * size, y: y * size });
        }
      }
    }
    if (this.openWater.length === 0) return;

    for (let i = 0; i < count; i++) {
      const glint = scene.add.image(0, 0, TEXTURES.sparkle).setDepth(DEPTH.waterGlint).setAlpha(0);
      this.cycle(glint);
    }
  }

  private cycle(glint: Phaser.GameObjects.Image): void {
    const view = this.scene.cameras.main.worldView;
    const visible = this.openWater.filter(
      (t) => t.x > view.x - 32 && t.x < view.right + 32 && t.y > view.y - 32 && t.y < view.bottom + 32,
    );
    if (visible.length === 0) {
      this.scene.time.delayedCall(800, () => this.cycle(glint));
      return;
    }
    const tile = visible[Phaser.Math.Between(0, visible.length - 1)];
    glint.setPosition(tile.x + Phaser.Math.Between(3, 12), tile.y + Phaser.Math.Between(3, 12));
    this.scene.tweens.add({
      targets: glint,
      alpha: { from: 0, to: 0.9 },
      duration: 420,
      hold: 120,
      yoyo: true,
      delay: Phaser.Math.Between(0, 2600),
      onComplete: () => this.cycle(glint),
    });
  }
}
