import * as Phaser from 'phaser';
import { GAME_CONFIG, ITEMS, type ItemId } from '@farming/shared';
import { drawFriendlyGhost } from '../assets/valley';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import type { PlayerState } from '../state/PlayerState';

const T = GAME_CONFIG.tileSize;
/** Elsie is out from 10pm until the day ends (2am). */
export const GHOST_HOURS = { from: 22 * 60, to: 26 * 60 } as const;
const NAME = 'Elsie';

/** Her three lost belongings, in the order she asks for them. */
const BELONGINGS: Array<{ itemId: ItemId; ask: string; remind: string; thanks: string[] }> = [
  {
    itemId: 'silver_locket',
    ask: 'First, my silver locket. I dropped it by the river, near where the path crosses the water.',
    remind: 'My locket should be by the river, close to the bridge.',
    thanks: ['My locket! Mother’s portrait is still inside… Thank you, truly.', 'Here, a little something. Ghosts have no use for coins.'],
  },
  {
    itemId: 'reading_glasses',
    ask: 'Next, my reading glasses. I used to read beside the old mine entrance, where it was quiet.',
    remind: 'My glasses are somewhere near the old mine entrance.',
    thanks: ['My spectacles! Now I can read the names on these old stones again.', 'Take these. They drifted out of me the night I lost them. Spooky, I know.'],
  },
  {
    itemId: 'music_box',
    ask: 'Last, my music box. I hid it in the woods at the far north of the valley, so nobody would take it.',
    remind: 'My music box is hidden in the far northern woods.',
    thanks: [
      'My music box…',
      '*She winds it. A soft, tinkling tune drifts over the graves, and Elsie hums along, glowing brighter.*',
      'I think I can rest now. Please, take this ring. It kept me lucky once.',
      'Goodbye, friend. Look up at the stars now and then.',
    ],
  },
];
const REWARDS: Array<{ gold: number; items: Array<{ itemId: ItemId; quantity: number }> }> = [
  { gold: 300, items: [] },
  { gold: 500, items: [{ itemId: 'ectoplasm', quantity: 3 }] },
  { gold: 1000, items: [{ itemId: 'spirit_ring', quantity: 1 }] },
];

export interface GhostDeps {
  state: PlayerState;
  /** Her quest state (read fresh each time: a loaded save replaces it). */
  ghost(): { stage: number; asked: boolean };
  say(lines: Array<{ speaker: string; text: string }>): void;
  /** Marks the belonging's spot on the map with the glowing trail. */
  guide(tx: number, ty: number): void;
  mark(id: string): void;
  /** Put something on the ground by the player (backpack full). */
  drop(itemId: ItemId, quantity: number): void;
}

/**
 * Elsie, the friendly ghost of the old graveyard. She floats over her grave
 * late at night and asks you to find three things she lost. Each one lies
 * glinting somewhere in the valley until you pick it up.
 */
export class GhostSystem {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly glints: Phaser.GameObjects.Graphics[];
  private shown = false;
  private frameAt = 0;
  private frame = 0;
  private wispAt = 0;
  private readonly home: { x: number; y: number };

  constructor(
    private readonly scene: Phaser.Scene,
    /** Elsie's headstone tile. */
    private readonly grave: { tx: number; ty: number },
    /** Where each belonging lies. */
    readonly spots: Array<{ tx: number; ty: number }>,
    private readonly deps: GhostDeps,
  ) {
    for (const f of [0, 1]) {
      const key = `ghost-elsie-${f}`;
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, drawFriendlyGhost(f).toCanvas());
    }
    this.home = { x: (grave.tx + 0.5) * T, y: (grave.ty + 1) * T + 4 };
    this.sprite = scene.add.image(this.home.x, this.home.y, 'ghost-elsie-0').setOrigin(0.5, 1).setAlpha(0).setVisible(false);
    this.glints = spots.map((s) => {
      const g = scene.add.graphics().setDepth(DEPTH.ySortBase + (s.ty + 1) * T).setVisible(false);
      g.fillStyle(0xffffff, 1).fillRect(-1, -3, 2, 6).fillRect(-3, -1, 6, 2);
      g.fillStyle(0xfff1a8, 1).fillRect(-1, -1, 2, 2);
      g.setPosition((s.tx + 0.5) * T, (s.ty + 0.5) * T);
      return g;
    });
  }

  /** She's out tonight (and hasn't moved on yet). */
  present(minute: number): boolean {
    return this.deps.ghost().stage < BELONGINGS.length && minute >= GHOST_HOURS.from && minute < GHOST_HOURS.to;
  }

  get position(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /** A soft glow around her at night (for the lighting). */
  light(): { x: number; y: number; radius: number } | null {
    return this.shown ? { x: this.sprite.x, y: this.sprite.y - 10, radius: 26 } : null;
  }

  update(minute: number, player: { x: number; y: number }, away: boolean): void {
    const now = this.scene.time.now;
    const want = this.present(minute) && !away;
    if (want !== this.shown) {
      this.shown = want;
      this.scene.tweens.killTweensOf(this.sprite);
      if (want) {
        this.sprite.setVisible(true).setAlpha(0);
        this.scene.tweens.add({ targets: this.sprite, alpha: 0.82, duration: 1600 });
        if (Math.hypot(player.x - this.home.x, player.y - this.home.y) < 10 * T) sfx('ghost', { volume: 0.6 });
      } else {
        this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 900, onComplete: () => this.sprite.setVisible(false) });
      }
    }
    if (this.shown) {
      // Bob gently over the grave, drifting a little toward you when you're close.
      const t = now / 1000;
      const near = Math.hypot(player.x - this.home.x, player.y - this.home.y) < 3 * T;
      const lean = near ? Phaser.Math.Clamp((player.x - this.home.x) * 0.15, -5, 5) : Math.sin(t * 0.6) * 4;
      this.sprite.setPosition(this.home.x + lean, this.home.y - 6 + Math.sin(t * 2.2) * 2.5);
      this.sprite.setFlipX(player.x < this.sprite.x - 2);
      this.sprite.setDepth(DEPTH.ySortBase + this.home.y + 8);
      if (now > this.frameAt) {
        this.frameAt = now + 420;
        this.frame = 1 - this.frame;
        this.sprite.setTexture(`ghost-elsie-${this.frame}`);
      }
      if (now > this.wispAt) {
        this.wispAt = now + 260;
        this.wisp(this.sprite.x + Phaser.Math.Between(-5, 5), this.sprite.y - 2);
      }
    }
    // The belonging she's asked for glints where it lies (day and night).
    const { stage, asked } = this.deps.ghost();
    this.glints.forEach((g, i) => {
      const on = asked && stage === i && this.deps.state.inventory.count(BELONGINGS[i].itemId) === 0;
      g.setVisible(on);
      if (on) {
        const pulse = 0.55 + 0.45 * Math.sin(now / 240 + i);
        g.setAlpha(pulse).setScale(0.7 + pulse * 0.5);
      }
    });
  }

  /** A belonging is lying on this tile (and she's asked for it). */
  belongingAt(tx: number, ty: number): ItemId | null {
    const { stage, asked } = this.deps.ghost();
    const spot = this.spots[stage];
    if (!asked || !spot || spot.tx !== tx || spot.ty !== ty) return null;
    const id = BELONGINGS[stage].itemId;
    return this.deps.state.inventory.count(id) === 0 ? id : null;
  }

  pickUp(tx: number, ty: number): void {
    const id = this.belongingAt(tx, ty);
    if (!id) return;
    if (this.deps.state.inventory.add(id, 1) > 0) {
      gameEvents.emit('toast', { text: 'Your backpack is full. Make some room first.' });
      return;
    }
    sfx('sparkle');
    gameEvents.emit('toast', { text: `You found ${NAME}'s ${ITEMS[id].name.toLowerCase()}! Bring it to the graveyard after 10pm.` });
  }

  /** Talking to her at night. */
  talk(): void {
    const g = this.deps.ghost();
    const stage = g.stage;
    if (stage >= BELONGINGS.length) return;
    sfx('ghost', { volume: 0.5 });
    const lines: Array<{ speaker: string; text: string }> = [];
    const say = (text: string) => lines.push({ speaker: NAME, text });
    if (!g.asked) {
      if (stage === 0) {
        say('Oh! You… you can see me? How wonderful. Nobody has looked my way in a very long time.');
        say('I’m Elsie. I kept the little schoolhouse here, long before there was a market.');
        say('I can’t rest until I have my things back. Three of them. Would you help me look?');
      }
      say(BELONGINGS[stage].ask);
      say('I’ve marked the spot on your map. It will glint when you get close.');
      g.asked = true;
      this.deps.say(lines);
      this.guide(stage);
      return;
    }
    const want = BELONGINGS[stage];
    if (this.deps.state.inventory.count(want.itemId) === 0) {
      say(`Any luck? ${want.remind}`);
      say('Follow the glowing trail on your map.');
      this.deps.say(lines);
      this.guide(stage);
      return;
    }
    // She gets it back.
    this.deps.state.inventory.remove(want.itemId, 1);
    for (const t of want.thanks) say(t);
    const reward = REWARDS[stage];
    this.deps.state.receiveGold(reward.gold);
    const gifts: string[] = [`${reward.gold}g`];
    for (const r of reward.items) {
      const left = this.deps.state.inventory.add(r.itemId, r.quantity);
      if (left > 0) this.deps.drop(r.itemId, left);
      gifts.push(r.quantity > 1 ? `${r.quantity} ${ITEMS[r.itemId].name}` : ITEMS[r.itemId].name);
    }
    gameEvents.emit('toast', { text: `👻 ${NAME} gave you ${gifts.join(' and ')}.` });
    sfx('coin');
    g.stage += 1;
    g.asked = false;
    if (g.stage < BELONGINGS.length) {
      say(BELONGINGS[g.stage].ask);
      say('I’ve marked it on your map, like before.');
      g.asked = true;
      this.guide(g.stage);
    } else {
      this.deps.mark('ghost_rest');
      this.farewell();
    }
    this.deps.say(lines);
  }

  /** She drifts up into the night sky and is gone. */
  private farewell(): void {
    this.shown = false;
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - 60,
      alpha: 0,
      duration: 3000,
      delay: 600,
      onComplete: () => this.sprite.setVisible(false),
    });
    for (let i = 0; i < 14; i++) this.scene.time.delayedCall(i * 160, () => this.wisp(this.sprite.x + Phaser.Math.Between(-8, 8), this.sprite.y - Phaser.Math.Between(0, 14)));
  }

  private guide(stage: number): void {
    const s = this.spots[stage];
    if (s) this.deps.guide(s.tx, s.ty);
  }

  private wisp(x: number, y: number): void {
    const d = this.scene.add.rectangle(x, y, 2, 2, 0xd8ecff, 0.8).setDepth(this.sprite.depth - 1);
    this.scene.tweens.add({ targets: d, y: y - 10 - Math.random() * 8, alpha: 0, duration: 1000, onComplete: () => d.destroy() });
  }
}

/** What the headstones say (index 0 is Elsie's). */
export const EPITAPHS = [
  'Elsie Marsh. Teacher, friend, and finder of lost things.',
  'Old Ned. He finally got some rest.',
  'Here lies Pip the goat. He ate the previous headstone.',
  'Agatha Thorn. Grew the biggest pumpkin the valley ever saw.',
  '“I told you I was ill.” — Barnaby',
  'Captain Hollis. Drove the first train through the valley.',
];
