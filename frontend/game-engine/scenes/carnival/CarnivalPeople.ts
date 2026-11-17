import * as Phaser from 'phaser';
import { GAME_CONFIG, type CarnivalStaffDef, type NpcId } from '@farming/shared';
import { TEXTURES } from '../../assets/registerTextures';
import { DEPTH } from '../../constants';

type Dir = 'down' | 'left' | 'right' | 'up';
const ROW: Record<Dir, number> = { down: 0, left: 1, right: 2, up: 3 };
const T = GAME_CONFIG.tileSize;

export interface Person {
  kind: 'staff' | 'visitor' | 'villager';
  name: string;
  staff?: CarnivalStaffDef;
  villager?: NpcId;
  sprite: Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Image;
  balloon?: Phaser.GameObjects.Image;
  facing: Dir;
  /** Where staff face when nobody's near. */
  restFacing: Dir;
  /** Staff stand still; visitors wander between attractions. */
  wanders: boolean;
  target: { x: number; y: number } | null;
  wait: number;
  calls: string[];
  bubbleIn: number;
  lineIndex: number;
  /** Little hop when the crowd cheers. */
  hop: number;
}

interface Bubble {
  person: Person;
  container: Phaser.GameObjects.Container;
  ttl: number;
}

/**
 * The people at the carnival: staff at their booths who turn to face you and
 * call out now and then, and visitors who stroll between the attractions,
 * some with balloons, chatting and cheering.
 */
export class CarnivalPeople {
  readonly people: Person[] = [];
  private bubbles: Bubble[] = [];
  private stepClock = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly isSolid: (tx: number, ty: number) => boolean,
    /** Places visitors like to go: in front of tents, rides, the stage… */
    private readonly attractions: Array<{ x: number; y: number }>,
  ) {}

  addStaff(def: CarnivalStaffDef, texture: string, x: number, y: number, opts: { facing?: Dir; inside?: boolean; depth?: number } = {}): Person {
    const sprite = this.scene.add.sprite(x, y, texture, ROW[opts.facing ?? 'down'] * 3).setOrigin(0.5, 1);
    sprite.setDepth(opts.depth ?? DEPTH.ySortBase + y);
    const shadow = opts.inside ? undefined : this.scene.add.image(x, y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow);
    const p: Person = {
      kind: 'staff',
      name: def.name,
      staff: def,
      sprite,
      shadow,
      facing: opts.facing ?? 'down',
      restFacing: opts.facing ?? 'down',
      wanders: false,
      target: null,
      wait: 0,
      calls: def.calls,
      bubbleIn: 3000 + Math.random() * 9000,
      lineIndex: 0,
      hop: 0,
    };
    this.people.push(p);
    return p;
  }

  addVisitor(texture: string, name: string, x: number, y: number, opts: { villager?: NpcId; balloon?: string; calls: string[] }): Person {
    const sprite = this.scene.add.sprite(x, y, texture, 0).setOrigin(0.5, 1);
    sprite.setDepth(DEPTH.ySortBase + y);
    const shadow = this.scene.add.image(x, y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow);
    const balloon = opts.balloon ? this.scene.add.image(x + 5, y - 14, opts.balloon).setOrigin(0.5, 1) : undefined;
    const p: Person = {
      kind: opts.villager ? 'villager' : 'visitor',
      name,
      villager: opts.villager,
      sprite,
      shadow,
      balloon,
      facing: 'down',
      restFacing: 'down',
      wanders: true,
      target: null,
      wait: Math.random() * 2500,
      calls: opts.calls,
      bubbleIn: 4000 + Math.random() * 12000,
      lineIndex: 0,
      hop: 0,
    };
    this.people.push(p);
    return p;
  }

  /** Whoever is standing on (or right by) this point. */
  at(x: number, y: number, radius = 12): Person | null {
    let best: Person | null = null;
    let bestD = radius;
    for (const p of this.people) {
      const d = Math.hypot(p.sprite.x - x, p.sprite.y - 6 - y);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }

  /** Turn to someone and stop for a moment (when you talk to them). */
  attend(p: Person, to: { x: number; y: number }): void {
    this.face(p, to);
    p.target = null;
    p.wait = 4000;
  }

  say(p: Person, text: string, ms = 2600): void {
    this.clearBubble(p);
    const container = this.makeBubble(text);
    this.bubbles.push({ person: p, container, ttl: ms });
    this.placeBubble(p, container);
    p.bubbleIn = 7000 + Math.random() * 9000;
  }

  /** The crowd reacts when you win: a few cheers and little hops. */
  cheer(player: { x: number; y: number }, tickets: number): void {
    if (tickets < 4) return;
    const cheers = tickets >= 12 ? ['WOW!', 'Amazing!', 'What a champ!', 'Incredible!'] : ['Hooray!', 'Nice one!', 'Bravo!', 'Well done!'];
    const near = this.people.filter((p) => Math.hypot(p.sprite.x - player.x, p.sprite.y - player.y) < 140).slice(0, 4);
    near.forEach((p, i) => {
      this.scene.time.delayedCall(i * 220, () => {
        this.face(p, player);
        if (p.hop <= 0) this.baseYs.set(p, p.sprite.y);
        p.hop = 400;
        this.say(p, cheers[(i + tickets) % cheers.length], 2000);
      });
    });
  }

  update(delta: number, player: { x: number; y: number }): void {
    this.stepClock += delta;
    let talking = this.bubbles.length;
    for (const p of this.people) {
      const dist = Math.hypot(p.sprite.x - player.x, p.sprite.y - player.y);
      if (p.wanders) this.wander(p, delta);
      else {
        // Staff turn to face you when you come close.
        if (dist < 56) this.face(p, player);
        else if (p.facing !== p.restFacing) this.setFacing(p, p.restFacing, false);
      }
      if (p.hop > 0) {
        const base = this.baseYs.get(p) ?? p.sprite.y;
        p.hop = Math.max(0, p.hop - delta);
        p.sprite.setY(p.hop > 0 ? Math.round(base - Math.sin((p.hop / 400) * Math.PI) * 4) : base);
      }
      // Calls and chatter when you're within earshot.
      p.bubbleIn -= delta;
      if (p.bubbleIn <= 0) {
        p.bubbleIn = 6000 + Math.random() * 10000;
        if (dist < 170 && talking < 3 && p.calls.length) {
          this.say(p, p.calls[Math.floor(Math.random() * p.calls.length)]);
          talking++;
        }
      }
      p.shadow?.setPosition(p.sprite.x, this.baseY(p) - 1);
      p.balloon?.setPosition(p.sprite.x + (p.facing === 'left' ? -5 : 5), p.sprite.y - 12 + Math.sin(this.stepClock / 400 + p.sprite.x) * 1.5).setDepth(p.sprite.depth + 0.1);
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.ttl -= delta;
      this.placeBubble(b.person, b.container);
      if (b.ttl <= 0) {
        b.container.destroy();
        this.bubbles.splice(i, 1);
      }
    }
  }

  // ---------- Walking about ----------

  private baseYs = new WeakMap<Person, number>();
  private baseY(p: Person): number {
    return p.hop > 0 ? (this.baseYs.get(p) ?? p.sprite.y) : p.sprite.y;
  }

  private wander(p: Person, delta: number): void {
    if (p.hop > 0) return;
    if (p.wait > 0) {
      p.wait -= delta;
      this.setFacing(p, p.facing, false);
      return;
    }
    if (!p.target) {
      p.target = this.pickTarget();
      if (!p.target) {
        p.wait = 1500;
        return;
      }
    }
    const speed = 0.022 * delta;
    const dx = p.target.x - p.sprite.x;
    const dy = p.target.y - p.sprite.y;
    if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1.5) {
      p.target = null;
      p.wait = 1500 + Math.random() * 4500;
      // Look at whatever they came to see.
      if (Math.random() < 0.7) this.setFacing(p, 'up', false);
      return;
    }
    // Walk along x first, then y, like everyone else in the valley.
    const horizontal = Math.abs(dx) >= 1.5;
    const stepX = horizontal ? Math.sign(dx) * Math.min(speed, Math.abs(dx)) : 0;
    const stepY = horizontal ? 0 : Math.sign(dy) * Math.min(speed, Math.abs(dy));
    const nx = p.sprite.x + stepX;
    const ny = p.sprite.y + stepY;
    const probeX = nx + Math.sign(stepX) * 5;
    const probeY = ny - 3 + Math.sign(stepY) * 3;
    if (this.isSolid(Math.floor(probeX / T), Math.floor(probeY / T))) {
      p.target = null;
      p.wait = 400 + Math.random() * 800;
      return;
    }
    p.sprite.setPosition(nx, ny);
    p.sprite.setDepth(DEPTH.ySortBase + ny);
    this.setFacing(p, horizontal ? (stepX < 0 ? 'left' : 'right') : stepY < 0 ? 'up' : 'down', true);
  }

  private pickTarget(): { x: number; y: number } | null {
    for (let i = 0; i < 8; i++) {
      const a = this.attractions[Math.floor(Math.random() * this.attractions.length)];
      const x = a.x + Math.round((Math.random() - 0.5) * 28);
      const y = a.y + Math.round((Math.random() - 0.5) * 12);
      if (!this.isSolid(Math.floor(x / T), Math.floor((y - 3) / T))) return { x, y };
    }
    return null;
  }

  private face(p: Person, to: { x: number; y: number }): void {
    const dx = to.x - p.sprite.x;
    const dy = to.y - p.sprite.y;
    this.setFacing(p, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up', false);
  }

  private setFacing(p: Person, dir: Dir, walking: boolean): void {
    p.facing = dir;
    const frame = ROW[dir] * 3 + (walking ? 1 + (Math.floor(this.stepClock / 160) % 2) : 0);
    if (p.sprite.frame.name !== String(frame)) p.sprite.setFrame(frame);
  }

  // ---------- Speech bubbles ----------

  private makeBubble(text: string): Phaser.GameObjects.Container {
    const label = this.scene.add
      .text(0, 0, text, { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '5px', color: '#3a2a20', align: 'center', wordWrap: { width: 70 }, resolution: 6 })
      .setOrigin(0.5, 1);
    const w = Math.ceil(label.width) + 6;
    const h = Math.ceil(label.height) + 3;
    label.setPosition(0, -4.5);
    const g = this.scene.add.graphics();
    g.fillStyle(0x3a2a20, 0.3).fillRoundedRect(-w / 2 + 1, -h - 2, w, h, 2);
    g.fillStyle(0xfff8e8, 0.97).fillRoundedRect(-w / 2, -h - 3, w, h, 2);
    g.fillTriangle(-2, -3.5, 2, -3.5, 0, -0.5);
    return this.scene.add.container(0, 0, [g, label]).setDepth(DEPTH.fx + 5);
  }

  private placeBubble(p: Person, c: Phaser.GameObjects.Container): void {
    c.setPosition(Math.round(p.sprite.x), Math.round(p.sprite.y - 23));
  }

  private clearBubble(p: Person): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      if (this.bubbles[i].person !== p) continue;
      this.bubbles[i].container.destroy();
      this.bubbles.splice(i, 1);
    }
  }
}
