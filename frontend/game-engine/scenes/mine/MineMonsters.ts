import * as Phaser from 'phaser';
import { GAME_CONFIG, MINE_ELITE, MONSTERS, mineScale, type BossDef, type MonsterKind } from '@farming/shared';
import { MINE_TEX, TEXTURES } from '../../assets/registerTextures';
import { sfx } from '../../audio/sfx';
import { DEPTH } from '../../constants';
import { gameEvents } from '../../events/GameEventBus';
import type { Player } from '../../entities/Player';
import type { FxSystem } from '../../systems/FxSystem';
import type { Rng } from '../../utils/random';

/**
 * Everything that moves in the mine and wants to hurt you: the monsters (each
 * kind with its own trick), their projectiles and the fires they start, and
 * the boss fights, which change at half health. The scene owns the cave; this
 * owns the creatures, and asks the scene (MineWorld) about walls, water,
 * rocks, the lantern and the player.
 */

export interface MineWorld {
  readonly scene: Phaser.Scene;
  readonly floor: number;
  /** Randomness for behaviour (not layout or loot). */
  readonly rng: Rng;
  readonly player: Player;
  readonly fx: FxSystem;
  isWall(tx: number, ty: number): boolean;
  isWater(tx: number, ty: number): boolean;
  hasRock(tx: number, ty: number): boolean;
  /** A free floor tile at least `minDist` tiles from the player. */
  freeTile(minDist: number): { tx: number; ty: number } | null;
  hurtPlayer(damage: number, fromX: number, fromY: number): void;
  slowPlayer(ms: number): void;
  /** The lantern: stolen (until the thief is caught), snuffed for a while, or given back. */
  stealLight(): void;
  restoreLight(): void;
  snuffLight(ms: number): void;
  /** An explosion: breaks rocks within `radius` pixels. */
  blastRocks(x: number, y: number, radius: number): void;
  /** A monster died: drop its loot (the scene decides what, from the floor's seed). */
  onKilled(m: Monster): void;
  /** Boss health for the HUD (null = no boss). */
  onBoss(info: { name: string; hp: number; maxHp: number } | null): void;
}

export interface Monster {
  id: number;
  kind: MonsterKind;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  tint: number;
  boss?: BossDef;
  elite: boolean;
  /** Carries the vault key. */
  hasKey: boolean;
  /** Called by a mini-boss: doesn't count for the floor's den. */
  summoned: boolean;
  /** Per-kind state machine. */
  state: string;
  /** Time left in the current state (ms). */
  t: number;
  /** Cooldown for its special move (ms). */
  cd: number;
  vx: number;
  vy: number;
  /** Facing (radians) for beetles and the golem. */
  angle: number;
  flash: number;
  phase2: boolean;
  /** Eels: their pool; mimics: their spot. */
  home: { x: number; y: number };
  /** Extra sprites that follow it (mound, glow, key, weak spot). */
  extras: Phaser.GameObjects.GameObject[];
  mound?: Phaser.GameObjects.Sprite;
  glow?: Phaser.GameObjects.Image;
  keyIcon?: Phaser.GameObjects.Image;
  /** Lantern thief: holding your light. */
  carrying?: boolean;
  /** Jumping (King Slime): where it lands. */
  target?: { x: number; y: number };
  /** The Shade: time until it next calls ghosts (ms). */
  summonIn?: number;
}

interface Projectile {
  kind: 'goo' | 'fire' | 'boulder';
  sprite: Phaser.GameObjects.Image;
  shadow?: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fire and boulders fly to a point. */
  target?: { x: number; y: number };
  from?: { x: number; y: number };
  life: number;
  total: number;
  damage: number;
}

interface Flame {
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Sprite;
  until: number;
  damage: number;
}

interface Shield {
  sprite: Phaser.GameObjects.Image;
  hp: number;
}

const TEXTURE: Record<MonsterKind, string> = {
  slime: TEXTURES.slime,
  bat: TEXTURES.bat,
  crab: TEXTURES.crab,
  ghost: TEXTURES.ghost,
  spitter: MINE_TEX.spitter,
  burrower: MINE_TEX.burrower,
  beetle: MINE_TEX.beetle,
  eel: MINE_TEX.eel,
  fusecap: MINE_TEX.fusecap,
  thief: MINE_TEX.thief,
  mimic: MINE_TEX.mimic,
  imp: MINE_TEX.imp,
};

const FLYERS = new Set<MonsterKind>(['bat', 'ghost']);
const SIZE = GAME_CONFIG.tileSize;
/** Above the lantern darkness, so it glows. */
const GLOW_DEPTH = DEPTH.lighting + 1;
const angleDiff = (a: number, b: number) => Math.abs(Phaser.Math.Angle.Wrap(a - b));

export class MineMonsters {
  readonly list: Monster[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly flames: Flame[] = [];
  private readonly shields: Shield[] = [];
  private boss: Monster | null = null;
  private nextId = 1;
  private flameTick = 0;
  private blockedHint = false;

  constructor(private readonly w: MineWorld) {}

  get bossAlive(): boolean {
    return !!this.boss;
  }

  /** Monsters the floor needs cleared (for monster dens): everything but summoned helpers. */
  get remaining(): number {
    return this.list.filter((m) => !m.summoned).length;
  }

  spawn(kind: MonsterKind, x: number, y: number, opts: { boss?: BossDef; elite?: boolean; summoned?: boolean; home?: { x: number; y: number } } = {}): Monster {
    const { scene, floor } = this.w;
    const def = MONSTERS[kind];
    const boss = opts.boss;
    const scale = mineScale(floor);
    const elite = !boss && !!opts.elite;
    const tint = boss?.tint ?? (elite ? MINE_ELITE.tint : 0xffffff);
    const sprite = scene.add.sprite(x, y, TEXTURE[kind], 0).setOrigin(0.5, 1).setTint(tint);
    if (boss) sprite.setScale(boss.scale);
    if (kind === 'ghost') sprite.setAlpha(0.75);
    if (kind === 'beetle') sprite.setOrigin(0.5, 0.5);
    const shadow = scene.add.image(x, y, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(boss ? boss.scale * 0.8 : 0.8);
    if (FLYERS.has(kind)) shadow.setAlpha(0.4);
    const hp = Math.round((boss?.hp ?? def.hp(floor) * scale) * (elite ? MINE_ELITE.hp : 1));
    const m: Monster = {
      id: this.nextId++,
      kind,
      sprite,
      shadow,
      hp,
      maxHp: hp,
      damage: Math.round((boss?.damage ?? def.damage(floor) * scale) * (elite ? MINE_ELITE.damage : 1)),
      speed: boss?.speed ?? def.speed(floor),
      tint,
      boss,
      elite,
      hasKey: false,
      summoned: !!opts.summoned,
      state: 'idle',
      t: this.w.rng.range(200, 1500),
      cd: this.w.rng.range(800, 2200),
      vx: 0,
      vy: 0,
      angle: this.w.rng.range(-Math.PI, Math.PI),
      flash: 0,
      phase2: false,
      home: opts.home ?? { x, y },
      extras: [],
    };
    this.setup(m);
    this.list.push(m);
    if (boss) {
      this.boss = m;
      this.reportBoss();
    }
    return m;
  }

  /** Kind-specific starting state and extra sprites. */
  private setup(m: Monster): void {
    const { scene } = this.w;
    switch (m.kind) {
      case 'burrower': {
        m.state = 'under';
        m.sprite.setVisible(false);
        m.shadow.setVisible(false);
        m.mound = scene.add.sprite(m.sprite.x, m.sprite.y, MINE_TEX.mound, 0).setOrigin(0.5, 1);
        m.extras.push(m.mound);
        break;
      }
      case 'eel':
        m.state = 'hidden';
        m.sprite.setAlpha(0);
        m.shadow.setVisible(false);
        break;
      case 'fusecap':
        m.state = 'idle';
        break;
      case 'mimic':
        m.state = 'dormant';
        m.shadow.setVisible(false);
        break;
      case 'thief':
        m.glow = this.glow(m.sprite.x, m.sprite.y, 0xffe27a, 0.35, 0.5);
        m.extras.push(m.glow);
        break;
      case 'imp':
        m.glow = this.glow(m.sprite.x, m.sprite.y, 0xff7a3a, 0, 0.6);
        m.extras.push(m.glow);
        break;
      default:
        break;
    }
    if (m.boss?.id === 'wraith' || m.boss?.id === 'shade') {
      // Glowing eyes you can follow in the dark.
      m.glow = this.glow(m.sprite.x, m.sprite.y, m.boss.id === 'wraith' ? 0xb8a0ff : 0xe0a0ff, 0.55, 0.7);
      m.extras.push(m.glow);
    }
    if (m.boss?.id === 'queen') this.growShields(m, 4);
    if (m.elite) {
      const g = this.glow(m.sprite.x, m.sprite.y, MINE_ELITE.tint, 0.25, 0.45);
      m.extras.push(g);
      if (!m.glow) m.glow = g;
    }
  }

  /** The vault key: one monster carries it, with a little key over its head. */
  giveKey(m: Monster): void {
    m.hasKey = true;
    m.keyIcon = this.w.scene.add.image(m.sprite.x, m.sprite.y - 18, MINE_TEX.key).setDepth(GLOW_DEPTH);
    m.extras.push(m.keyIcon);
  }

  private glow(x: number, y: number, tint: number, alpha: number, scale: number): Phaser.GameObjects.Image {
    return this.w.scene.add.image(x, y, TEXTURES.light).setTint(tint).setAlpha(alpha).setScale(scale).setBlendMode(Phaser.BlendModes.ADD).setDepth(GLOW_DEPTH - 0.5);
  }

  // ---------- Getting hit ----------

  /** Can a swing hit it right now? (Burrowers underground, hidden eels and leaping bosses can't be hit.) */
  hittable(m: Monster): boolean {
    if (m.kind === 'burrower') return m.state === 'up' || m.state === 'emerging';
    if (m.kind === 'eel') return m.state === 'lunge' || m.state === 'rise';
    if (m.boss?.id === 'king' && m.state === 'jump') return false;
    if (m.boss?.id === 'shade' && (m.state === 'fade' || m.state === 'gone')) return false;
    return true;
  }

  /** What's in front of the player's swing. */
  inFront(): Array<Monster | Shield> {
    const p = this.w.player;
    const dir = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.facingDirection];
    const cx = p.x + dir[0] * 12;
    const cy = p.y - 4 + dir[1] * 12;
    const out: Array<Monster | Shield> = this.list.filter(
      (m) => this.hittable(m) && Math.hypot(m.sprite.x - cx, m.sprite.y - 4 * (m.boss?.scale ?? 1) - cy) < 15 + (m.boss ? m.boss.scale * 6 : 0),
    );
    for (const s of this.shields) if (Math.hypot(s.sprite.x - cx, s.sprite.y - 6 - cy) < 14) out.push(s);
    return out;
  }

  /** Is there a dormant mimic on this tile (it looks like a chest)? */
  mimicAt(tx: number, ty: number): Monster | undefined {
    return this.list.find((m) => m.kind === 'mimic' && m.state === 'dormant' && Math.floor(m.home.x / SIZE) === tx && Math.floor((m.home.y - 2) / SIZE) === ty);
  }

  /** You opened a "chest" that was a mimic. */
  wakeMimic(m: Monster): void {
    m.state = 'awake';
    m.sprite.setFrame(2);
    m.shadow.setVisible(true);
    sfx('clunk', { rate: 0.5 });
    this.w.hurtPlayer(m.damage, m.sprite.x, m.sprite.y);
    this.w.scene.cameras.main.shake(160, 0.008);
  }

  hit(target: Monster | Shield, damage: number): void {
    if (damage <= 0) return;
    if (!('kind' in target)) {
      this.hitShield(target, damage);
      return;
    }
    const m = target;
    const p = this.w.player;
    const toPlayer = Math.atan2(p.y - m.sprite.y, p.x - m.sprite.x);
    // Shells and armour.
    if (m.kind === 'beetle' && !m.boss && angleDiff(toPlayer, m.angle) < Math.PI / 3) return this.blocked(m, 'Its shell blocks hits from the front. Get round to its side or back.');
    if (m.boss?.id === 'queen' && this.shields.length) return this.blocked(m, 'Her crystals shield her. Break them first!');
    if (m.boss?.id === 'golem' && m.phase2 && angleDiff(toPlayer, m.angle) < (Math.PI * 2) / 3) return this.blocked(m, 'Its armour is too hard. Hit the glowing spot on its back!');
    if (m.kind === 'mimic' && m.state === 'dormant') {
      m.state = 'awake';
      m.sprite.setFrame(2);
      m.shadow.setVisible(true);
    }
    if (m.kind === 'fusecap') {
      if (m.state === 'idle') {
        m.state = 'lit';
        m.t = 2000;
        sfx('whoosh', { rate: 1.8, volume: 0.5 });
        m.glow = this.glow(m.sprite.x, m.sprite.y - 6, 0xffb03a, 0.3, 0.4);
        m.extras.push(m.glow);
      }
      return;
    }
    m.hp -= damage;
    m.flash = 120;
    m.sprite.setTintFill(0xffffff);
    const push = m.boss ? 4 : 14;
    const away = toPlayer + Math.PI;
    if (m.kind !== 'eel') this.move(m, Math.cos(away) * push, Math.sin(away) * push);
    if (m.kind === 'slime' || m.kind === 'crab' || m.kind === 'spitter') m.t = m.boss ? 250 : 500;
    sfx('clunk', { rate: 1.6, volume: 0.7 });
    if (m.boss) {
      this.reportBoss();
      if (!m.phase2 && m.hp > 0 && m.hp <= m.maxHp / 2) this.enterPhase2(m);
    }
    if (m.hp <= 0) this.kill(m);
  }

  private blocked(m: Monster, text: string): void {
    sfx('clunk', { rate: 2.4, volume: 0.6 });
    this.w.fx.burst('sparkle', m.sprite.x, m.sprite.y - 6, 4);
    if (!this.blockedHint) {
      this.blockedHint = true;
      this.w.scene.time.delayedCall(10, () => this.toast(text));
    }
  }

  private hitShield(s: Shield, damage: number): void {
    s.hp -= damage;
    this.w.fx.burst('sparkle', s.sprite.x, s.sprite.y - 6, 5);
    sfx('mine', { rate: 1.5 });
    if (s.hp > 0) return;
    s.sprite.destroy();
    this.shields.splice(this.shields.indexOf(s), 1);
    sfx('rockBreak', { rate: 1.6 });
    if (!this.shields.length && this.boss) this.toast(`${this.boss.boss!.name} is exposed!`);
  }

  kill(m: Monster): void {
    const i = this.list.indexOf(m);
    if (i < 0) return;
    this.list.splice(i, 1);
    const { x, y } = m.sprite;
    this.w.fx.burst(m.kind === 'crab' || m.kind === 'beetle' ? 'stone' : 'leaf', x, y - 5, m.boss ? 30 : 10);
    sfx('rockBreak', { rate: m.boss ? 0.6 : 1.8, volume: m.boss ? 1 : 0.6 });
    if (m.carrying) {
      this.w.restoreLight();
      this.toast('You caught the thief and got your light back!');
    }
    m.sprite.destroy();
    m.shadow.destroy();
    for (const e of m.extras) e.destroy();
    if (m === this.boss) {
      this.boss = null;
      this.w.onBoss(null);
      for (const s of this.shields.splice(0)) s.sprite.destroy();
      // Its helpers flee with it.
      for (const h of this.list.filter((o) => o.summoned)) this.kill(h);
    }
    this.w.onKilled(m);
  }

  private reportBoss(): void {
    const b = this.boss;
    if (b?.boss) this.w.onBoss({ name: b.boss.name, hp: Math.max(0, b.hp), maxHp: b.maxHp });
  }

  private toast(text: string): void {
    gameEvents.emit('toast', { text });
  }

  // ---------- Boss phases ----------

  private enterPhase2(m: Monster): void {
    m.phase2 = true;
    const name = m.boss!.name;
    this.w.scene.cameras.main.shake(250, 0.008);
    sfx('whoosh', { rate: 0.5 });
    switch (m.boss!.id) {
      case 'matron':
        this.toast(`${name} calls her slimelings!`);
        for (let i = 0; i < 4; i++) this.summonNear(m, 'slime');
        break;
      case 'king':
        this.toast(`${name} is getting ready to jump. Watch its shadow!`);
        m.cd = 1200;
        break;
      case 'queen':
        this.toast(`${name}'s crystals grow back!`);
        this.growShields(m, 3);
        break;
      case 'golem':
        this.toast(`${name} curls into its armour. Only its glowing back can be hurt!`);
        m.glow = this.glow(m.sprite.x, m.sprite.y, 0xffb03a, 0.6, 0.5);
        m.extras.push(m.glow);
        break;
      case 'wraith':
        this.toast(`${name} grows restless…`);
        break;
      case 'shade':
        this.toast(`${name} calls the dead!`);
        m.cd = 1500;
        break;
    }
  }

  private summonNear(m: Monster, kind: MonsterKind): Monster | null {
    for (let tries = 0; tries < 20; tries++) {
      const a = this.w.rng.range(0, Math.PI * 2);
      const x = m.sprite.x + Math.cos(a) * 24;
      const y = m.sprite.y + Math.sin(a) * 18;
      const tx = Math.floor(x / SIZE);
      const ty = Math.floor((y - 3) / SIZE);
      if (!FLYERS.has(kind) && (this.w.isWall(tx, ty) || this.w.isWater(tx, ty) || this.w.hasRock(tx, ty))) continue;
      const s = this.spawn(kind, x, y, { summoned: true });
      if (kind === 'slime') s.sprite.setTint((s.tint = m.tint));
      this.w.fx.burst('sparkle', x, y - 4, 6);
      return s;
    }
    return null;
  }

  private growShields(m: Monster, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      const x = m.sprite.x + Math.cos(a) * 30;
      const y = m.sprite.y + Math.sin(a) * 22;
      const sprite = this.w.scene.add.image(x, y, `${MINE_TEX.crystal}-${i % 2}`).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + y).setTint(0xf0c0ff);
      this.w.fx.pop(sprite);
      this.shields.push({ sprite, hp: 3 });
    }
  }

  // ---------- Every frame ----------

  update(delta: number, frozen: boolean): void {
    for (const m of [...this.list]) {
      if (!this.list.includes(m)) continue;
      if (m.flash > 0) {
        m.flash -= delta;
        if (m.flash <= 0) m.sprite.clearTint().setTint(m.tint);
      }
      if (!frozen) this.think(m, delta);
      this.place(m);
    }
    if (frozen) return;
    this.updateProjectiles(delta);
    this.updateFlames(delta);
  }

  /** Depth, shadow and followers. */
  private place(m: Monster): void {
    const flying = FLYERS.has(m.kind);
    m.sprite.setDepth(DEPTH.ySortBase + m.sprite.y + (flying ? 20 : 0));
    m.shadow.setPosition(m.sprite.x, m.sprite.y - 1 + (flying ? 8 : 0));
    if (m.kind === 'beetle') m.shadow.setPosition(m.sprite.x, m.sprite.y + 6);
    if (flying) m.sprite.y += Math.sin(this.w.scene.time.now / 200 + m.sprite.x) * 0.05;
    const top = m.sprite.y - (m.sprite.displayHeight || 12) * (m.kind === 'beetle' ? 0.5 : 1);
    m.mound?.setPosition(m.sprite.x, m.sprite.y).setDepth(DEPTH.ySortBase + m.sprite.y - 1);
    if (m.glow) {
      if (m.boss?.id === 'golem' && m.phase2) m.glow.setPosition(m.sprite.x - Math.cos(m.angle) * 14, m.sprite.y - 10 - Math.sin(m.angle) * 8);
      else m.glow.setPosition(m.sprite.x, top + 6);
    }
    m.keyIcon?.setPosition(m.sprite.x, top - 6 + Math.sin(this.w.scene.time.now / 250) * 1.5);
  }

  private think(m: Monster, delta: number): void {
    const p = this.w.player;
    const dx = p.x - m.sprite.x;
    const dy = p.y - m.sprite.y;
    const d = Math.hypot(dx, dy);
    const toward = Math.atan2(dy, dx);
    m.cd -= delta;

    if (m.boss) this.thinkBoss(m, delta, d, toward);
    if (m.boss?.id === 'king' && m.state === 'jump') return;
    if (m.boss?.id === 'shade' && (m.state === 'fade' || m.state === 'gone' || m.state === 'appear')) return;

    switch (m.kind) {
      case 'bat':
      case 'ghost':
        this.drift(m, delta, d, toward);
        break;
      case 'spitter':
        this.spitter(m, delta, d, toward);
        break;
      case 'burrower':
        this.burrower(m, delta, d, toward);
        break;
      case 'beetle':
        this.beetle(m, delta, d, toward);
        break;
      case 'eel':
        this.eel(m, delta);
        break;
      case 'fusecap':
        this.fusecap(m, delta);
        break;
      case 'thief':
        this.thief(m, delta, d, toward);
        break;
      case 'mimic':
        if (m.state === 'dormant') {
          // A real chest never breathes: the lid twitches now and then.
          m.t -= delta;
          if (m.t <= 0) {
            m.sprite.setFrame(m.sprite.frame.name === '1' ? 0 : 1);
            m.t = m.sprite.frame.name === '1' ? 160 : this.w.rng.range(2200, 4200);
          }
          return;
        }
        this.hop(m, delta, d, toward, 1.2);
        break;
      case 'imp':
        this.imp(m, delta, d, toward);
        break;
      default:
        this.hop(m, delta, d, toward, 1);
    }
    this.touch(m, d);
  }

  /** Contact damage (each kind decides when it's dangerous). */
  private touch(m: Monster, d: number): void {
    if (m.kind === 'fusecap' || m.kind === 'thief' || (m.kind === 'mimic' && m.state === 'dormant')) return;
    if (m.kind === 'burrower' && m.state !== 'up') return;
    if (m.kind === 'eel' && m.state !== 'lunge') return;
    const reach = 10 + (m.boss ? m.boss.scale * 5 : 0) + (m.kind === 'eel' ? 6 : 0);
    if (d < reach) this.w.hurtPlayer(m.damage, m.sprite.x, m.sprite.y);
  }

  /** Slimes and crabs: hop (or scuttle) after you when close, wander otherwise. */
  private hop(m: Monster, delta: number, d: number, toward: number, pace: number): void {
    m.t -= delta;
    if (m.t <= 0 && m.t > -delta) {
      const chase = d < (m.boss ? 200 : 110) || m.kind === 'mimic';
      const a = chase ? toward + this.w.rng.range(-0.3, 0.3) : this.w.rng.range(0, Math.PI * 2);
      const speed = (chase ? m.speed : m.speed * 0.5) * pace;
      m.vx = Math.cos(a) * speed;
      m.vy = Math.sin(a) * speed;
      if (m.kind !== 'mimic') m.sprite.setFrame(1);
      m.angle = a;
    }
    if (m.t < 0) {
      this.move(m, (m.vx * delta) / 1000, (m.vy * delta) / 1000);
      if (m.kind === 'crab') m.sprite.setFrame(Math.floor(this.w.scene.time.now / 120) % 2);
      if (m.t < (m.kind === 'crab' ? -700 : -380)) {
        m.t = this.w.rng.range(450, 1100) * (m.boss ? 0.6 : 1) / pace;
        if (m.kind !== 'mimic') m.sprite.setFrame(0);
      }
    }
  }

  /** Bats swoop erratically; ghosts glide straight at you (through walls). */
  private drift(m: Monster, delta: number, d: number, toward: number): void {
    m.t -= delta;
    if (m.t <= 0) {
      const chase = d < (m.kind === 'ghost' ? 160 : 120) || !!m.boss;
      const jitter = m.kind === 'bat' ? this.w.rng.range(-0.9, 0.9) : this.w.rng.range(-0.2, 0.2);
      const a = chase ? toward + jitter : this.w.rng.range(0, Math.PI * 2);
      m.vx = Math.cos(a) * m.speed * (chase ? 1 : 0.4);
      m.vy = Math.sin(a) * m.speed * (chase ? 1 : 0.4);
      m.t = m.kind === 'bat' ? this.w.rng.range(250, 600) : this.w.rng.range(500, 900);
    }
    this.move(m, (m.vx * delta) / 1000, (m.vy * delta) / 1000);
    m.sprite.setFrame(Math.floor(this.w.scene.time.now / (m.kind === 'bat' ? 110 : 300)) % 2);
  }

  /** Keeps its distance, swells up, and spits goo that slows you. Can't spit at point-blank. */
  private spitter(m: Monster, delta: number, d: number, toward: number): void {
    if (m.state === 'charge') {
      m.t -= delta;
      m.sprite.setScale(1 + Math.sin(this.w.scene.time.now / 40) * 0.08);
      if (m.t <= 0) {
        m.state = 'idle';
        m.sprite.setScale(1).setFrame(0);
        if (d > 26) this.shoot('goo', m.sprite.x, m.sprite.y - 8, toward, 115, m.damage);
        m.cd = this.w.rng.range(2000, 2700);
      }
      return;
    }
    if (m.cd <= 0 && d > 32 && d < 150) {
      m.state = 'charge';
      m.t = 450;
      m.sprite.setFrame(1);
      return;
    }
    // Hop away when crowded, closer when far.
    m.t -= delta;
    if (m.t <= 0 && m.t > -delta) {
      const a = d < 64 ? toward + Math.PI + this.w.rng.range(-0.6, 0.6) : d > 120 ? toward + this.w.rng.range(-0.4, 0.4) : toward + Math.PI / 2 * (this.w.rng.chance(0.5) ? 1 : -1);
      m.vx = Math.cos(a) * m.speed;
      m.vy = Math.sin(a) * m.speed;
    }
    if (m.t < 0) {
      this.move(m, (m.vx * delta) / 1000, (m.vy * delta) / 1000);
      if (m.t < -380) m.t = this.w.rng.range(500, 1000);
    }
  }

  /** Tunnels as a mound, shakes, pops up beside you, then goes back under. */
  private burrower(m: Monster, delta: number, d: number, toward: number): void {
    m.t -= delta;
    const mound = m.mound!;
    switch (m.state) {
      case 'under': {
        mound.setVisible(true).setFrame(0);
        const chase = d < 170;
        const a = chase ? toward : m.angle;
        if (!chase && m.t <= 0) {
          m.angle = this.w.rng.range(0, Math.PI * 2);
          m.t = 1200;
        }
        this.move(m, (Math.cos(a) * m.speed * delta) / 1000, (Math.sin(a) * m.speed * delta) / 1000, true);
        if (chase && d < 18 && m.cd <= 0) {
          m.state = 'emerging';
          m.t = 450;
          sfx('mine', { rate: 0.6, volume: 0.6 });
        }
        break;
      }
      case 'emerging':
        mound.setFrame(1);
        mound.x += Math.sin(this.w.scene.time.now / 25) * 0.6;
        if (m.t <= 0) {
          m.state = 'up';
          m.t = 1500;
          mound.setVisible(false);
          m.sprite.setVisible(true).setFrame(0);
          m.shadow.setVisible(true);
          this.w.fx.burst('dirt', m.sprite.x, m.sprite.y - 3, 8);
        }
        break;
      case 'up':
        m.sprite.setFrame(Math.floor(this.w.scene.time.now / 160) % 2);
        if (m.t <= 0) {
          m.state = 'under';
          m.t = 900;
          m.cd = 900;
          m.sprite.setVisible(false);
          m.shadow.setVisible(false);
          this.w.fx.burst('dirt', m.sprite.x, m.sprite.y - 3, 6);
        }
        break;
    }
  }

  /** Turns slowly towards you; its shell faces where it's going. */
  private beetle(m: Monster, delta: number, d: number, toward: number): void {
    const turn = 1.7 * (delta / 1000);
    if (d < 140) {
      const diff = Phaser.Math.Angle.Wrap(toward - m.angle);
      m.angle += Phaser.Math.Clamp(diff, -turn, turn);
    } else {
      m.t -= delta;
      if (m.t <= 0) {
        m.t = this.w.rng.range(900, 1800);
        m.vx = this.w.rng.range(-1, 1);
      }
      m.angle += m.vx * turn * 0.5;
    }
    const speed = d < 140 ? m.speed : m.speed * 0.4;
    if (!this.move(m, (Math.cos(m.angle) * speed * delta) / 1000, (Math.sin(m.angle) * speed * delta) / 1000)) m.angle += Math.PI / 2;
    m.sprite.setRotation(m.angle).setFrame(Math.floor(this.w.scene.time.now / 150) % 2);
  }

  /** Waits in its pool; ripples, rises, lunges at anyone on the edge, dives. */
  private eel(m: Monster, delta: number): void {
    const p = this.w.player;
    const near = Math.hypot(p.x - m.home.x, p.y - 6 - m.home.y) < 34;
    m.t -= delta;
    switch (m.state) {
      case 'hidden':
        // A ripple now and then gives it away.
        m.sprite.setFrame(0).setAlpha(Math.max(0, Math.sin(this.w.scene.time.now / 400 + m.id)) * 0.35);
        if (near && m.cd <= 0) {
          m.state = 'rise';
          m.t = 400;
          m.sprite.setAlpha(1);
          sfx('whoosh', { rate: 1.4, volume: 0.4 });
        }
        break;
      case 'rise':
        if (m.t <= 0) {
          m.state = 'lunge';
          m.t = 650;
          m.sprite.setFrame(1);
          const a = Math.atan2(p.y - m.home.y, p.x - m.home.x);
          m.sprite.setPosition(m.home.x + Math.cos(a) * 9, m.home.y + Math.sin(a) * 9);
        }
        break;
      case 'lunge':
        if (m.t <= 0) {
          m.state = 'hidden';
          m.cd = 1400;
          m.sprite.setPosition(m.home.x, m.home.y).setFrame(0);
        }
        break;
    }
  }

  /** Lit by a hit: flickers faster and faster, then blows. */
  private fusecap(m: Monster, delta: number): void {
    if (m.state !== 'lit') {
      m.sprite.setFrame(0);
      return;
    }
    m.t -= delta;
    const rate = m.t > 1000 ? 180 : m.t > 400 ? 90 : 45;
    m.sprite.setFrame(Math.floor(this.w.scene.time.now / rate) % 2);
    if (m.t <= 0) this.explode(m);
  }

  private explode(m: Monster): void {
    const { x, y } = m.sprite;
    const radius = 30;
    this.w.scene.cameras.main.shake(220, 0.012);
    sfx('rockBreak', { rate: 0.5 });
    this.w.fx.burst('stone', x, y - 6, 18);
    this.w.fx.burst('sparkle', x, y - 6, 12);
    const p = this.w.player;
    if (Math.hypot(p.x - x, p.y - y) < radius + 4) this.w.hurtPlayer(m.damage, x, y);
    for (const o of [...this.list]) {
      if (o === m || !this.list.includes(o)) continue;
      if (Math.hypot(o.sprite.x - x, o.sprite.y - y) < radius) {
        if (o.kind === 'fusecap') this.hit(o, 1);
        else if (this.hittable(o) && !(o.boss?.id === 'queen' && this.shields.length)) {
          o.hp -= Math.round(12 * mineScale(this.w.floor));
          if (o.boss) this.reportBoss();
          if (o.hp <= 0) this.kill(o);
        }
      }
    }
    this.w.blastRocks(x, y, radius);
    this.kill(m);
  }

  /** Grabs your light and runs off with it; catch it to get it back. */
  private thief(m: Monster, delta: number, d: number, toward: number): void {
    const away = toward + Math.PI;
    if (m.carrying) {
      m.sprite.setFrame(1);
      m.glow?.setAlpha(0.7).setScale(0.9);
      m.t -= delta;
      if (m.t <= 0) {
        m.t = this.w.rng.range(300, 700);
        m.angle = away + this.w.rng.range(-0.9, 0.9);
      }
      const speed = d < 140 ? m.speed * 0.62 : m.speed * 0.3;
      if (!this.move(m, (Math.cos(m.angle) * speed * delta) / 1000, (Math.sin(m.angle) * speed * delta) / 1000)) m.angle += Math.PI / 2;
      return;
    }
    m.sprite.setFrame(0);
    const stolen = this.list.some((o) => o.carrying);
    const chase = d < 150 && !stolen;
    const a = chase ? toward : m.angle;
    m.t -= delta;
    if (!chase && m.t <= 0) {
      m.angle = this.w.rng.range(0, Math.PI * 2);
      m.t = 1000;
    }
    this.move(m, (Math.cos(a) * m.speed * (chase ? 1 : 0.4) * delta) / 1000, (Math.sin(a) * m.speed * (chase ? 1 : 0.4) * delta) / 1000);
    if (chase && d < 12) {
      m.carrying = true;
      m.t = 0;
      this.w.stealLight();
      sfx('sparkle', { rate: 1.6 });
      this.toast('A Lantern Thief stole your light! Catch it to get it back.');
    }
  }

  /** Keeps its distance, glows, and lobs fireballs that set the floor alight. */
  private imp(m: Monster, delta: number, d: number, toward: number): void {
    if (m.state === 'charge') {
      m.t -= delta;
      m.glow?.setAlpha(0.6);
      if (m.t <= 0) {
        m.state = 'idle';
        m.sprite.setFrame(0);
        m.glow?.setAlpha(0);
        const p = this.w.player;
        this.lob('fire', m.sprite.x, m.sprite.y - 12, p.x, p.y - 2, m.damage);
        m.cd = this.w.rng.range(2200, 2900);
      }
      return;
    }
    if (m.cd <= 0 && d > 30 && d < 160) {
      m.state = 'charge';
      m.t = 500;
      m.sprite.setFrame(1);
      return;
    }
    m.t -= delta;
    if (m.t <= 0) {
      m.t = this.w.rng.range(400, 800);
      m.angle = d < 70 ? toward + Math.PI + this.w.rng.range(-0.5, 0.5) : d > 115 ? toward + this.w.rng.range(-0.4, 0.4) : toward + (Math.PI / 2) * (this.w.rng.chance(0.5) ? 1 : -1);
    }
    this.move(m, (Math.cos(m.angle) * m.speed * delta) / 1000, (Math.sin(m.angle) * m.speed * delta) / 1000);
  }

  private thinkBoss(m: Monster, delta: number, d: number, toward: number): void {
    const id = m.boss!.id;
    if (id === 'king' && m.phase2) {
      if (m.state === 'jump') {
        m.t -= delta;
        const k = 1 - Math.max(0, m.t) / 900;
        const target = m.target!;
        m.shadow.setPosition(target.x, target.y - 1).setScale(m.boss!.scale * (0.3 + k * 0.6)).setAlpha(0.4 + k * 0.4);
        m.sprite.setPosition(Phaser.Math.Linear(m.home.x, target.x, k), Phaser.Math.Linear(m.home.y, target.y, k) - Math.sin(k * Math.PI) * 60);
        if (m.t <= 0) {
          m.state = 'idle';
          m.sprite.setPosition(target.x, target.y);
          m.shadow.setAlpha(1).setScale(m.boss!.scale * 0.8);
          this.w.scene.cameras.main.shake(260, 0.014);
          sfx('rockBreak', { rate: 0.5 });
          this.w.fx.burst('dirt', target.x, target.y - 2, 20);
          const p = this.w.player;
          if (Math.hypot(p.x - target.x, p.y - target.y) < 36) this.w.hurtPlayer(m.damage, target.x, target.y);
          m.cd = 3400;
        }
        return;
      }
      if (m.cd <= 0) {
        m.state = 'jump';
        m.t = 900;
        m.home = { x: m.sprite.x, y: m.sprite.y };
        m.target = { x: this.w.player.x, y: this.w.player.y };
        sfx('whoosh', { rate: 0.5 });
      }
    }
    if (id === 'golem') {
      // Turns to face you; throws boulders from a distance.
      const turn = 1.1 * (delta / 1000);
      m.angle += Phaser.Math.Clamp(Phaser.Math.Angle.Wrap(toward - m.angle), -turn, turn);
      if (m.state === 'charge') {
        m.t -= delta;
        m.sprite.setTint(0xe0c0a0);
        if (m.t <= 0) {
          m.state = 'idle';
          m.sprite.setTint(m.tint);
          const p = this.w.player;
          this.lob('boulder', m.sprite.x, m.sprite.y - 30, p.x, p.y, Math.round(m.damage * 0.8));
          m.cd = m.phase2 ? 2400 : 3000;
        }
      } else if (m.cd <= 0 && d > 40 && d < 200) {
        m.state = 'charge';
        m.t = 600;
      }
    }
    if (id === 'wraith' && m.cd <= 0) {
      if (m.state !== 'snuff') {
        m.state = 'snuff';
        m.t = 600;
        m.sprite.setTint(0xffffff);
      } else {
        m.t -= delta;
        if (m.t <= 0) {
          m.state = 'idle';
          m.sprite.setTint(m.tint);
          this.w.snuffLight(3000);
          sfx('whoosh', { rate: 0.4 });
          m.cd = m.phase2 ? 6000 : 10000;
        }
      }
    }
    if (id === 'shade') {
      if (m.state === 'fade' || m.state === 'appear') {
        m.t -= delta;
        const k = Math.max(0, m.t) / 400;
        m.sprite.setAlpha(m.state === 'fade' ? 0.75 * k : 0.75 * (1 - k));
        m.glow?.setAlpha(m.state === 'fade' ? 0.55 * k : 0.55 * (1 - k));
        if (m.t <= 0 && m.state === 'fade') {
          const spot = this.w.freeTile(5);
          if (spot) m.sprite.setPosition(spot.tx * SIZE + SIZE / 2, spot.ty * SIZE + SIZE - 3);
          m.state = 'appear';
          m.t = 400;
        } else if (m.t <= 0) m.state = 'idle';
        return;
      }
      if (m.cd <= 0) {
        m.state = 'fade';
        m.t = 400;
        m.cd = 5000;
        sfx('whoosh', { rate: 0.6, volume: 0.5 });
      }
      if (m.phase2) {
        m.summonIn = (m.summonIn ?? 0) - delta;
        if (m.summonIn <= 0) {
          m.summonIn = 8000;
          const ghosts = this.list.filter((o) => o.summoned).length;
          for (let i = 0; i < 2 && ghosts + i < 4; i++) this.summonNear(m, 'ghost');
        }
      }
    }
  }

  // ---------- Projectiles and fires ----------

  private shoot(kind: 'goo', x: number, y: number, angle: number, speed: number, damage: number): void {
    const sprite = this.w.scene.add.image(x, y, MINE_TEX.goo).setDepth(DEPTH.ySortBase + y + 20);
    this.projectiles.push({ kind, sprite, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2000, total: 2000, damage });
    sfx('whoosh', { rate: 2, volume: 0.35 });
  }

  /** Thrown in an arc to a spot on the floor (a shadow shows where it lands). */
  private lob(kind: 'fire' | 'boulder', x: number, y: number, tx: number, ty: number, damage: number): void {
    const dist = Math.hypot(tx - x, ty - y);
    const total = Math.max(450, Math.min(1100, dist * 7));
    const sprite = this.w.scene.add.image(x, y, kind === 'fire' ? MINE_TEX.fireball : MINE_TEX.boulder).setDepth(GLOW_DEPTH);
    const shadow = this.w.scene.add.image(tx, ty, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setAlpha(0.3).setScale(0.3);
    this.projectiles.push({ kind, sprite, shadow, x, y, vx: 0, vy: 0, from: { x, y }, target: { x: tx, y: ty }, life: total, total, damage });
    sfx('whoosh', { rate: kind === 'fire' ? 1.3 : 0.7, volume: 0.5 });
  }

  private updateProjectiles(delta: number): void {
    const p = this.w.player;
    for (const pr of [...this.projectiles]) {
      pr.life -= delta;
      let done = pr.life <= 0;
      if (pr.kind === 'goo') {
        pr.x += (pr.vx * delta) / 1000;
        pr.y += (pr.vy * delta) / 1000;
        pr.sprite.setPosition(pr.x, pr.y);
        if (this.w.isWall(Math.floor(pr.x / SIZE), Math.floor(pr.y / SIZE))) done = true;
        if (Math.hypot(p.x - pr.x, p.y - 6 - pr.y) < 9) {
          this.w.hurtPlayer(pr.damage, pr.x, pr.y);
          this.w.slowPlayer(2000);
          done = true;
        }
        if (done) this.w.fx.burst('leaf', pr.x, pr.y, 4);
      } else {
        const k = 1 - Math.max(0, pr.life) / pr.total;
        pr.x = Phaser.Math.Linear(pr.from!.x, pr.target!.x, k);
        pr.y = Phaser.Math.Linear(pr.from!.y, pr.target!.y, k);
        const lift = Math.sin(k * Math.PI) * (pr.kind === 'boulder' ? 40 : 26);
        pr.sprite.setPosition(pr.x, pr.y - lift).setRotation(k * 6);
        pr.shadow?.setScale(0.3 + k * 0.5).setAlpha(0.2 + k * 0.4);
        if (done) {
          const hitR = pr.kind === 'boulder' ? 18 : 12;
          if (Math.hypot(p.x - pr.x, p.y - pr.y) < hitR) this.w.hurtPlayer(pr.damage, pr.x, pr.y);
          if (pr.kind === 'fire') this.addFlame(Math.floor(pr.x / SIZE), Math.floor((pr.y - 2) / SIZE), Math.round(pr.damage * 0.5));
          else {
            this.w.fx.burst('stone', pr.x, pr.y - 4, 10);
            sfx('rockBreak', { rate: 0.8, volume: 0.6 });
          }
        }
      }
      if (done) {
        pr.sprite.destroy();
        pr.shadow?.destroy();
        this.projectiles.splice(this.projectiles.indexOf(pr), 1);
      }
    }
  }

  addFlame(tx: number, ty: number, damage: number, ms = 3000): void {
    if (this.w.isWall(tx, ty) || this.w.isWater(tx, ty)) return;
    const existing = this.flames.find((f) => f.tx === tx && f.ty === ty);
    const until = this.w.scene.time.now + ms;
    if (existing) {
      existing.until = until;
      return;
    }
    const sprite = this.w.scene.add.sprite(tx * SIZE + SIZE / 2, ty * SIZE + SIZE - 1, MINE_TEX.flame, 0).setOrigin(0.5, 1).setDepth(GLOW_DEPTH);
    this.flames.push({ tx, ty, sprite, until, damage });
    sfx('whoosh', { rate: 1.6, volume: 0.4 });
  }

  /** Standing in fire hurts (a little, often). */
  private updateFlames(delta: number): void {
    const now = this.w.scene.time.now;
    const { tx, ty } = this.w.player.tile;
    this.flameTick -= delta;
    for (const f of [...this.flames]) {
      f.sprite.setFrame(Math.floor(now / 120) % 2).setAlpha(f.until - now < 600 ? (f.until - now) / 600 : 1);
      if (now >= f.until) {
        f.sprite.destroy();
        this.flames.splice(this.flames.indexOf(f), 1);
        continue;
      }
      if (f.tx === tx && f.ty === ty && this.flameTick <= 0) {
        this.flameTick = 700;
        this.w.hurtPlayer(f.damage, f.sprite.x, f.sprite.y + 4);
      }
    }
  }

  // ---------- Movement ----------

  /** Moves a monster if the way is open; false if it bumped into something. */
  private move(m: Monster, dx: number, dy: number, underground = false): boolean {
    const nx = m.sprite.x + dx;
    const ny = m.sprite.y + dy;
    const tx = Math.floor(nx / SIZE);
    const ty = Math.floor((ny - 3) / SIZE);
    const flies = MONSTERS[m.kind].flies;
    const w = this.w.scene.physics.world.bounds;
    if (nx < SIZE || ny < SIZE || nx > w.width - SIZE || ny > w.height - SIZE / 2) return false;
    if (flies !== 'walls' && this.w.isWall(tx, ty)) return false;
    if (!flies && this.w.isWater(tx, ty)) return false;
    if (!flies && !underground && this.w.hasRock(tx, ty)) return false;
    m.sprite.setPosition(nx, ny);
    return true;
  }

  destroy(): void {
    for (const pr of this.projectiles) {
      pr.sprite.destroy();
      pr.shadow?.destroy();
    }
    for (const f of this.flames) f.sprite.destroy();
    for (const s of this.shields) s.sprite.destroy();
  }
}
