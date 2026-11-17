import * as Phaser from 'phaser';
import { GAME_CONFIG } from '@farming/shared';
import { itemTextureKey, TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';

type Kind = 'cat' | 'dog';

/**
 * Your pets (a cat, a dog, or both): they trot after you around the farm, nap
 * by the cottage door at night (and while you're away), and can be petted once
 * a day. Strays waiting to be adopted sit by the door.
 */
export class PetSystem {
  private sprites: Array<{ kind: Kind; sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image; stray: boolean }> = [];
  private bob = 0;
  /** Told to stay: the pet waits where it is until called again. */
  staying = false;
  /** A trick in progress: fetching a stick or digging a hole. */
  private task:
    | { type: 'fetch'; kind: Kind; stick: Phaser.GameObjects.Image; phase: 'wait' | 'out' | 'back'; done: () => void; t: number }
    | { type: 'dig'; kind: Kind; t: number; done: (x: number, y: number) => void }
    | null = null;

  get busy(): boolean {
    return this.task !== null;
  }

  /** Throw a stick from the player to a point; the pet runs for it and brings it back. */
  fetch(kind: Kind, from: { x: number; y: number }, to: { x: number; y: number }, done: () => void): void {
    if (this.task || !this.pet(kind)) return;
    const stick = this.scene.add.image(from.x, from.y - 14, itemTextureKey('wood')).setScale(0.6).setDepth(DEPTH.fx);
    this.task = { type: 'fetch', kind, stick, phase: 'wait', done, t: 0 };
    // A little arc through the air, spinning.
    this.scene.tweens.add({ targets: stick, x: to.x, duration: 520, ease: 'Linear' });
    this.scene.tweens.add({ targets: stick, y: { from: from.y - 14, to: to.y }, duration: 520, ease: 'Quad.easeIn' });
    this.scene.tweens.add({
      targets: stick,
      angle: 720,
      duration: 520,
      onComplete: () => {
        stick.setAngle(10).setDepth(DEPTH.ySortBase + to.y - 1);
        if (this.task?.type === 'fetch') this.task.phase = 'out';
      },
    });
  }

  /** The pet stops to dig; `done` gets where it dug. */
  dig(kind: Kind, done: (x: number, y: number) => void): void {
    if (this.task || !this.pet(kind)) return;
    this.task = { type: 'dig', kind, t: 0, done };
  }

  /** An adopted pet's sprite entry. */
  private pet(kind?: Kind) {
    return this.sprites.find((s) => !s.stray && (!kind || s.kind === kind));
  }

  /** A little show-off when petted again: a spin, a roll or a hop. */
  trick(kind?: Kind): string {
    const s = this.pet(kind);
    if (!s) return '';
    const pick = Math.floor(Math.random() * 3);
    if (pick === 0) {
      this.scene.tweens.add({ targets: s.sprite, angle: 360, duration: 420, onComplete: () => s.sprite.setAngle(0) });
      return 'does a little spin';
    }
    if (pick === 1) {
      this.scene.tweens.add({ targets: s.sprite, scaleY: -1, duration: 200, yoyo: true, hold: 300, onComplete: () => s.sprite.setScale(1) });
      return s.kind === 'cat' ? 'rolls over for a belly rub (careful!)' : 'rolls over for a belly rub';
    }
    this.scene.tweens.add({ targets: s.sprite, y: s.sprite.y - 10, duration: 140, yoyo: true, repeat: 1 });
    return s.kind === 'cat' ? 'leaps after an imaginary bug' : 'jumps up for a high five';
  }

  private runTask(delta: number, s: (typeof this.sprites)[number], player: { x: number; y: number }): void {
    const task = this.task!;
    const spr = s.sprite;
    const moveTo = (x: number, y: number, speed: number) => {
      const dx = x - spr.x;
      const dy = y - spr.y;
      const d = Math.hypot(dx, dy);
      if (d < 3) return true;
      const step = Math.min(d, speed * (delta / 1000));
      spr.x += (dx / d) * step;
      spr.y += (dy / d) * step;
      if (Math.abs(dx) > 1) spr.setFlipX(dx < 0);
      spr.setFrame(Math.floor(this.bob / 110) % 2);
      return false;
    };
    if (task.type === 'fetch') {
      task.t += delta;
      // Never get stuck: after a while the stick is just "back".
      if (task.t > 9000) {
        task.stick.destroy();
        this.task = null;
        task.done();
        return;
      }
      if (task.phase === 'wait') {
        spr.setFrame(0);
        return;
      }
      if (task.phase === 'out') {
        if (moveTo(task.stick.x, task.stick.y + 2, GAME_CONFIG.player.runSpeed * 1.1)) task.phase = 'back';
        return;
      }
      task.stick.setPosition(spr.x + (spr.flipX ? -5 : 5), spr.y - 8).setAngle(0).setDepth(spr.depth + 0.1);
      if (moveTo(player.x + (spr.x < player.x ? -12 : 12), player.y + 4, GAME_CONFIG.player.runSpeed)) {
        task.stick.destroy();
        this.task = null;
        this.hop(task.kind);
        task.done();
      }
      return;
    }
    task.t += delta;
    spr.setFrame(Math.floor(task.t / 90) % 2);
    spr.setAngle(Math.sin(task.t / 40) * 6);
    if (Math.floor(task.t / 180) !== Math.floor((task.t - delta) / 180)) {
      const dirt = this.scene.add.rectangle(spr.x + (spr.flipX ? 6 : -6), spr.y - 2, 2, 2, 0x7a5632).setDepth(DEPTH.fx);
      this.scene.tweens.add({ targets: dirt, x: dirt.x + (spr.flipX ? 10 : -10), y: dirt.y - 8, alpha: 0, duration: 380, onComplete: () => dirt.destroy() });
    }
    if (task.t > 1700) {
      spr.setAngle(0);
      this.task = null;
      this.hop(task.kind);
      task.done(spr.x, spr.y);
    }
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly door: () => { x: number; y: number },
  ) {}

  /** Shows your pets, and any strays waiting by the door to be adopted. */
  show(pets: readonly Kind[], strays: readonly Kind[] = []): void {
    this.cancelTask();
    for (const s of this.sprites) {
      s.sprite.destroy();
      s.shadow.destroy();
    }
    this.sprites = [];
    const d = this.door();
    const add = (kind: Kind, stray: boolean) => {
      const x = d.x + (kind === 'cat' ? -20 : 20);
      const y = d.y + 10;
      const sprite = this.scene.add.sprite(x, y, kind === 'cat' ? TEXTURES.petCat : TEXTURES.petDog, 0).setOrigin(0.5, 1);
      const shadow = this.scene.add.image(x, y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(0.8);
      this.sprites.push({ kind, sprite, shadow, stray });
    };
    for (const k of pets) add(k, false);
    for (const k of strays) if (!pets.includes(k)) add(k, true);
  }

  /** Puts a pet at a spot (e.g. where it was told to stay). */
  place(kind: Kind, x: number, y: number): void {
    const s = this.pet(kind);
    if (!s) return;
    s.sprite.setPosition(x, y);
    s.shadow.setPosition(x, y - 1);
  }

  /** Whether the pet near a point is a stray waiting by the door. */
  isStray(kind: Kind): boolean {
    return this.sprites.some((s) => s.kind === kind && s.stray);
  }

  /** The pet (or stray) close to a point, if any. */
  near(x: number, y: number, range = 20): Kind | null {
    let best: { kind: Kind; d: number } | null = null;
    for (const s of this.sprites) {
      const d = Math.hypot(s.sprite.x - x, s.sprite.y - y);
      if (d < range && (!best || d < best.d)) best = { kind: s.kind, d };
    }
    return best?.kind ?? null;
  }

  position(kind?: Kind): { x: number; y: number } | null {
    const s = this.pet(kind);
    return s ? { x: s.sprite.x, y: s.sprite.y } : null;
  }

  /** Follow the player, or nap by the door. */
  update(delta: number, player: { x: number; y: number }, opts: { follow: boolean; sleep: boolean }): void {
    this.bob += delta;
    for (const s of this.sprites) {
      const spr = s.sprite;
      if (s.stray) {
        // Strays wait by the door, blinking.
        spr.setFrame(Math.floor((this.bob + (s.kind === 'cat' ? 450 : 0)) / 900) % 4 === 0 ? 1 : 0);
      } else if (this.task?.kind === s.kind && opts.follow && !opts.sleep) {
        this.runTask(delta, s, player);
      } else if (this.staying && !opts.sleep && opts.follow) {
        // Sits where it was told to stay, blinking and watching you.
        if (Math.abs(player.x - spr.x) > 4) spr.setFlipX(player.x < spr.x);
        spr.setFrame(Math.floor(this.bob / 900) % 4 === 0 ? 1 : 0);
      } else if (opts.sleep || !opts.follow) {
        const d = this.door();
        const home = { x: d.x + (s.kind === 'cat' ? -20 : 20), y: d.y + 10 };
        if (opts.sleep && Math.hypot(spr.x - home.x, spr.y - home.y) > 2) spr.setPosition(home.x, home.y);
        spr.setFrame(opts.sleep ? 2 : Math.floor(this.bob / 900) % 4 === 0 ? 1 : 0);
      } else {
        // With two pets, each keeps to its own side of you so they don't pile up.
        const two = this.sprites.filter((p) => !p.stray).length > 1;
        const side = two ? (s.kind === 'cat' ? -20 : 20) : 0;
        const gap = two ? 6 : 26;
        const dx = player.x + side - spr.x;
        const dy = player.y - spr.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 260) {
          spr.setPosition(player.x + (side || -18), player.y + 4);
        } else if (dist > gap) {
          const speed = (dist > 80 ? GAME_CONFIG.player.runSpeed : GAME_CONFIG.player.walkSpeed) * (delta / 1000);
          spr.x += (dx / dist) * speed;
          spr.y += (dy / dist) * speed;
          if (Math.abs(dx) > 2) spr.setFlipX(dx < 0);
          spr.setFrame(Math.floor(this.bob / 140) % 2);
        } else {
          spr.setFrame(0);
        }
      }
      spr.setDepth(DEPTH.ySortBase + spr.y);
      s.shadow.setPosition(spr.x, spr.y - 1);
    }
  }

  /** Drop any trick in progress (e.g. when you go somewhere else). */
  cancelTask(): void {
    if (this.task?.type === 'fetch') this.task.stick.destroy();
    for (const s of this.sprites) s.sprite.setAngle(0);
    this.task = null;
  }

  setVisible(v: boolean): void {
    for (const s of this.sprites) {
      s.sprite.setVisible(v);
      s.shadow.setVisible(v);
    }
  }

  hop(kind?: Kind): void {
    for (const s of this.sprites.filter((p) => !p.stray && (!kind || p.kind === kind))) this.scene.tweens.add({ targets: s.sprite, y: s.sprite.y - 6, duration: 120, yoyo: true });
  }
}
