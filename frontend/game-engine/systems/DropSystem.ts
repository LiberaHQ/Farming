import * as Phaser from 'phaser';
import type { ItemId, Quality } from '@farming/shared';
import { itemTextureKey } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { sfx } from '../audio/sfx';
import { gameEvents } from '../events/GameEventBus';
import type { Inventory } from '../state/Inventory';
import { floorItems, type FloorItem } from '../state/floorItems';

interface Drop {
  sprite: Phaser.GameObjects.Image;
  itemId: ItemId;
  quantity: number;
  /** Crops and fruit: silver (1) or gold (2). */
  q?: 1 | 2;
  readyAt: number;
  /** Co-op: a drop in the shared world (eggs); the server decides who gets it. */
  sharedId?: number;
  claiming?: boolean;
  /**
   * Put down on purpose (or left from an earlier visit): it lies still until
   * the player has walked away once, so it doesn't fly straight back.
   */
  resting?: boolean;
  /** Clicked: pull it in now, from a little further than usual. */
  called?: boolean;
}

/** Asks whether this player may pick up a shared drop; calls back with the items granted (or null). */
export type DropClaimer = (id: number, done: (granted: { itemId: ItemId; quantity: number } | null) => void) => void;

const MAGNET_RADIUS = 36;
const PICKUP_RADIUS = 6;
const MAX_SPRITES_PER_SPAWN = 5;
/** Walk right onto a resting item to grab it. */
const STEP_ON_RADIUS = 10;
/** How far away a click on an item can grab it. */
const CLICK_REACH = 64;

/**
 * Items lying in the world. They pop out of whatever produced them, then get
 * pulled toward the player and into the inventory (if there is room).
 */
export class DropSystem {
  private readonly drops: Drop[] = [];
  private fullWarningAt = 0;
  private px = 0;
  private py = 0;

  private claimer: DropClaimer | null = null;

  /** `persist: false` for places that are rebuilt every visit (the mine): what's left there is lost. */
  constructor(private readonly scene: Phaser.Scene, opts: { persist?: boolean } = {}) {
    if (opts.persist === false) return;
    const area = scene.scene.key;
    for (const item of floorItems.open(area, () => this.onGround())) this.place(item);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => floorItems.close(area, this.onGround()));
  }

  /** Everything lying here that belongs to this player (not co-op shared drops). */
  private onGround(): FloorItem[] {
    return this.drops.filter((d) => d.sharedId === undefined).map((d) => ({ itemId: d.itemId, quantity: d.quantity, x: d.sprite.x, y: d.sprite.y, ...(d.q ? { q: d.q } : {}) }));
  }

  private place({ itemId, quantity, x, y, q }: FloorItem): void {
    const sprite = this.scene.add.image(x, y, itemTextureKey(itemId));
    this.pushResting({ sprite, itemId, quantity, readyAt: 0, resting: true, ...(q ? { q } : {}) });
  }

  /** A resting item can be clicked (or tapped) to pick it up when you're close enough. */
  private pushResting(drop: Drop): void {
    this.drops.push(drop);
    drop.sprite.setData('floorItem', true).setInteractive({ useHandCursor: true });
    drop.sprite.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.drops.includes(drop) || this.scene.time.now < drop.readyAt) return;
      const dist = Math.hypot(this.px - drop.sprite.x, this.py - 6 - drop.sprite.y);
      if (dist > CLICK_REACH) {
        gameEvents.emit('toast', { text: 'Too far away. Walk closer to pick it up.' });
        return;
      }
      drop.resting = false;
      drop.called = true;
    });
  }

  /**
   * Put a stack down near the player: toward the spot under the mouse
   * (screen coordinates) when there is one, else just in front of them.
   * It lands within reach, so it can always be picked back up.
   */
  tossFromPlayer(player: { x: number; y: number; facingDirection: 'up' | 'down' | 'left' | 'right' }, itemId: ItemId, quantity: number, screen?: { x: number; y: number }, q: Quality = 0): void {
    const cx = player.x;
    const cy = player.y - 6;
    let tx: number;
    let ty: number;
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    if (screen && rect.width > 0 && rect.height > 0) {
      const sx = ((screen.x - rect.left) / rect.width) * this.scene.scale.width;
      const sy = ((screen.y - rect.top) / rect.height) * this.scene.scale.height;
      const p = this.scene.cameras.main.getWorldPoint(sx, sy);
      tx = p.x;
      ty = p.y;
    } else {
      const [dx, dy] = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[player.facingDirection];
      tx = cx + dx * 18 + Phaser.Math.Between(-3, 3);
      ty = cy + dy * 18 + 4 + Phaser.Math.Between(-3, 3);
    }
    const reach = 26;
    const d = Math.hypot(tx - cx, ty - cy);
    if (d > reach) {
      tx = cx + ((tx - cx) / d) * reach;
      ty = cy + ((ty - cy) / d) * reach;
    }
    this.toss(itemId, quantity, player.x, player.y - 10, tx, ty, q);
  }

  /** The player puts a stack down: it hops from (fromX, fromY) to (toX, toY) and stays there. */
  toss(itemId: ItemId, quantity: number, fromX: number, fromY: number, toX: number, toY: number, q: Quality = 0): void {
    if (quantity <= 0) return;
    const sprite = this.scene.add.image(fromX, fromY, itemTextureKey(itemId));
    const arc = 10;
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 320,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 1;
        sprite.setPosition(fromX + (toX - fromX) * t, fromY + (toY - fromY) * t - Math.sin(Math.PI * t) * arc);
      },
      onComplete: () => this.scene.tweens.add({ targets: sprite, y: toY - 2, duration: 90, yoyo: true }),
    });
    this.pushResting({ sprite, itemId, quantity, readyAt: this.scene.time.now + 400, resting: true, ...(q ? { q } : {}) });
  }

  setClaimer(claimer: DropClaimer): void {
    this.claimer = claimer;
  }

  /** A drop that exists for every co-op player (eggs laid in the shared world). */
  spawnShared(id: number, itemId: ItemId, quantity: number, x: number, y: number): void {
    const sprite = this.scene.add.image(x, y, itemTextureKey(itemId));
    this.drops.push({ sprite, itemId, quantity, readyAt: 0, sharedId: id });
  }

  /** Someone else picked up a shared drop. */
  removeShared(id: number): void {
    const i = this.drops.findIndex((d) => d.sharedId === id);
    if (i < 0) return;
    this.drops[i].sprite.destroy();
    this.drops.splice(i, 1);
  }

  spawn(itemId: ItemId, quantity: number, x: number, y: number, q: Quality = 0): void {
    if (quantity <= 0) return;
    const pieces = Math.min(quantity, MAX_SPRITES_PER_SPAWN);
    for (let i = 0; i < pieces; i++) {
      const share = Math.floor(quantity / pieces) + (i < quantity % pieces ? 1 : 0);
      const sprite = this.scene.add.image(x, y, itemTextureKey(itemId));
      const tx = x + Phaser.Math.Between(-12, 12);
      const ty = y + Phaser.Math.Between(2, 12);
      const arc = Phaser.Math.Between(8, 14);
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 360,
        ease: 'Linear',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 1;
          sprite.setPosition(x + (tx - x) * t, y + (ty - y) * t - Math.sin(Math.PI * t) * arc);
        },
      });
      this.drops.push({ sprite, itemId, quantity: share, readyAt: this.scene.time.now + 500, ...(q ? { q } : {}) });
      if (q) this.sparkle(sprite, q);
    }
  }

  /** Silver and gold drops twinkle as they land. */
  private sparkle(sprite: Phaser.GameObjects.Image, q: 1 | 2): void {
    const color = q === 2 ? 0xffe070 : 0xe8eef8;
    for (let i = 0; i < (q === 2 ? 6 : 4); i++) {
      this.scene.time.delayedCall(200 + i * 90, () => {
        if (!sprite.active) return;
        const d = this.scene.add.rectangle(sprite.x + Phaser.Math.Between(-6, 6), sprite.y + Phaser.Math.Between(-6, 2), 2, 2, color).setDepth(sprite.depth + 1);
        this.scene.tweens.add({ targets: d, y: d.y - 8, alpha: 0, duration: 600, onComplete: () => d.destroy() });
      });
    }
  }

  private claimShared(drop: Drop, inventory: Inventory): void {
    drop.claiming = true;
    drop.sprite.setAlpha(0.4);
    this.claimer!(drop.sharedId!, (granted) => {
      const i = this.drops.indexOf(drop);
      if (i >= 0) this.drops.splice(i, 1);
      drop.sprite.destroy();
      if (!granted) return;
      const leftover = inventory.add(granted.itemId, granted.quantity);
      if (granted.quantity - leftover > 0) {
        gameEvents.emit('item:collected', { itemId: granted.itemId, quantity: granted.quantity - leftover });
        sfx('pickup', { volume: 0.7 });
      }
      if (leftover > 0) this.spawn(granted.itemId, leftover, drop.sprite.x, drop.sprite.y);
    });
  }

  update(delta: number, px: number, py: number, inventory: Inventory): void {
    const now = this.scene.time.now;
    this.px = px;
    this.py = py;
    const targetY = py - 6;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      const s = drop.sprite;
      s.setDepth(DEPTH.ySortBase + s.y + 6);
      if (now < drop.readyAt) continue;

      const dx = px - s.x;
      const dy = targetY - s.y;
      const dist = Math.hypot(dx, dy);
      if (drop.resting) {
        // Lies still until you walk away (then it's a normal pickup again) or step right onto it.
        if (dist > MAGNET_RADIUS + 6) drop.resting = false;
        else if (dist > STEP_ON_RADIUS) continue;
        else drop.resting = false;
      }
      if (dist > (drop.called ? CLICK_REACH + 8 : MAGNET_RADIUS)) continue;

      if (inventory.capacityFor(drop.itemId, drop.q ?? 0) === 0) {
        if (now > this.fullWarningAt) {
          gameEvents.emit('toast', { text: 'Inventory full' });
          this.fullWarningAt = now + 3000;
        }
        continue;
      }

      if (drop.sharedId !== undefined) {
        if (dist <= PICKUP_RADIUS * 2 && !drop.claiming && this.claimer) this.claimShared(drop, inventory);
        continue;
      }

      if (dist <= PICKUP_RADIUS) {
        const leftover = inventory.add(drop.itemId, drop.quantity, drop.q ?? 0);
        const collected = drop.quantity - leftover;
        if (collected > 0) {
          gameEvents.emit('item:collected', { itemId: drop.itemId, quantity: collected, ...(drop.q ? { q: drop.q } : {}) });
          sfx('pickup', { volume: 0.7 });
        }
        if (leftover === 0) {
          s.destroy();
          this.drops.splice(i, 1);
        } else {
          drop.quantity = leftover;
        }
        continue;
      }

      const speed = 120 + Math.max(0, MAGNET_RADIUS - dist) * 7;
      const step = Math.min(dist, (speed * delta) / 1000);
      s.setPosition(s.x + (dx / dist) * step, s.y + (dy / dist) * step);
    }
  }
}
