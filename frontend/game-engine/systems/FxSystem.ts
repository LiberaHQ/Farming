import type * as Phaser from 'phaser';
import { fxTextureKey, type FxKind } from '../assets/registerTextures';
import { DEPTH } from '../constants';

const KINDS: FxKind[] = ['wood', 'stone', 'leaf', 'dirt', 'water', 'sparkle'];

/** Pooled particle bursts and hit feedback. */
export class FxSystem {
  private readonly emitters = new Map<FxKind, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(private readonly scene: Phaser.Scene) {
    for (const kind of KINDS) {
      const splash = kind === 'water' || kind === 'sparkle';
      const emitter = scene.add.particles(0, 0, fxTextureKey(kind), {
        speed: splash ? { min: 20, max: 55 } : { min: 35, max: 90 },
        angle: { min: 200, max: 340 },
        gravityY: kind === 'sparkle' ? -20 : 260,
        lifespan: { min: 280, max: 480 },
        alpha: { start: 1, end: 0 },
        rotate: splash ? 0 : { min: 0, max: 360 },
        emitting: false,
      });
      emitter.setDepth(DEPTH.fx);
      this.emitters.set(kind, emitter);
    }
  }

  burst(kind: FxKind, x: number, y: number, count = 6): void {
    this.emitters.get(kind)?.explode(count, x, y);
  }

  /** Quick horizontal shake, e.g. when a tree or rock is hit. */
  shake(target: Phaser.GameObjects.Image): void {
    if (target.getData('shaking')) return;
    target.setData('shaking', true);
    const x = target.x;
    this.scene.tweens.add({
      targets: target,
      x: x + 1.5,
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        target.x = x;
        target.setData('shaking', false);
      },
    });
  }

  /** Small pop used when something grows or appears. */
  pop(target: Phaser.GameObjects.Image): void {
    target.setScale(0.6);
    this.scene.tweens.add({ targets: target, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }
}
