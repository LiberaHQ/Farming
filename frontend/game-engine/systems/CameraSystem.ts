import * as Phaser from 'phaser';
import { GAME_CONFIG } from '@farming/shared';

/**
 * Smooth-follow camera with integer zoom. Integer zoom keeps every art pixel
 * the same size on screen, so pixel art stays crisp at any window size.
 */
export class CameraSystem {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    private readonly scene: Phaser.Scene,
    target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
    private readonly worldWidth: number,
    private readonly worldHeight: number,
  ) {
    const { followLerp } = GAME_CONFIG.camera;
    this.camera = scene.cameras.main;
    this.camera.setBounds(0, 0, worldWidth, worldHeight);
    this.camera.setRoundPixels(true);
    this.camera.startFollow(target, true, followLerp, followLerp);
    this.applyZoom();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    const detach = () => scene.scale.off(Phaser.Scale.Events.RESIZE, this.applyZoom, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, detach);
    scene.events.once(Phaser.Scenes.Events.DESTROY, detach);
  }

  private applyZoom(): void {
    const { width, height } = this.scene.scale;
    const { targetVisibleTilesY, minZoom, maxZoom } = GAME_CONFIG.camera;
    let zoom = Phaser.Math.Clamp(Math.round(height / (targetVisibleTilesY * GAME_CONFIG.tileSize)), minZoom, maxZoom);
    // Never show past the world's edge on very large screens.
    while (zoom < maxZoom && (width / zoom > this.worldWidth || height / zoom > this.worldHeight)) zoom++;
    this.camera.setZoom(zoom);
  }
}
