import type Phaser from 'phaser';

const key = (tx: number, ty: number) => ty * 4096 + tx;

/** Makes tall grass sway when the player walks through it. */
export class GrassRustleSystem {
  private readonly tufts = new Map<number, Phaser.GameObjects.Image>();

  constructor(private readonly scene: Phaser.Scene) {}

  add(tuft: Phaser.GameObjects.Image, tx: number, ty: number): void {
    this.tufts.set(key(tx, ty), tuft);
  }

  remove(tx: number, ty: number): void {
    this.tufts.delete(key(tx, ty));
  }

  onPlayerEnterTile(tx: number, ty: number, velocityX: number): void {
    const tuft = this.tufts.get(key(tx, ty));
    if (!tuft || tuft.getData('rustling')) return;
    tuft.setData('rustling', true);
    const lean = velocityX === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(velocityX);
    this.scene.tweens.add({
      targets: tuft,
      angle: lean * 9,
      duration: 80,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        tuft.setAngle(0);
        tuft.setData('rustling', false);
      },
    });
  }
}
