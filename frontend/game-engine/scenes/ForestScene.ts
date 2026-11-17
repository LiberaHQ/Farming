import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { FORAGE, GAME_CONFIG, ITEMS, type ItemId } from '@farming/shared';
import { itemTextureKey, npcTextureKey, objectTextureKey, placeableTextureKey, TEXTURES } from '../assets/registerTextures';
import { PixelCanvas } from '../assets/PixelCanvas';
import { sfx } from '../audio/sfx';
import { drawDeer, drawFox, drawOwl } from '../assets/wildlife';
import { LightingSystem } from '../systems/LightingSystem';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface ForestSceneData {
  host: AreaHost;
  /** Forage and hardwood taken today (each spot once a day). */
  forage: { taken(day: number): number[]; take(day: number, id: number): void };
}

const W = 40;
const H = 28;
/** Big old stumps give hardwood once a day; ids 100+ in the forage record. */
const STUMP_ID = 100;
const HERMIT = { tx: 9, ty: 6 };

const HERMIT_LINES = [
  "Hm. A visitor. Don't step on the morels.",
  'The forest gives what each season can spare. Spring is generous; winter, less so.',
  'Those old stumps? Oak, three hundred years if a day. Hardwood keeps forever.',
  "I'll pay double for anything you forage. The town folk don't know what's good.",
  'Bats in the mine, ghosts deeper down. I went once. Never again.',
  "Your grandfather used to bring me hazelnuts. He'd be glad someone's farming again.",
];

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * The old forest west of the market: dense trees, seasonal mushrooms, herbs
 * and berries on the ground each morning, ancient stumps for hardwood, and a
 * hermit who pays double for forage.
 */
export class ForestScene extends AreaScene<ForestSceneData> {
  private forage!: ForestSceneData['forage'];
  private solid: boolean[] = [];
  private items: Array<{ id: number; sprite: Phaser.GameObjects.Image; itemId: ItemId }> = [];
  private stumps: Array<{ id: number; tx: number; ty: number; sprite: Phaser.GameObjects.Image; cut: boolean }> = [];
  private hermit!: Phaser.GameObjects.Sprite;
  private lineIndex = 0;
  private fox: { sprite: Phaser.GameObjects.Image; state: 'trot' | 'sit' | 'flee'; t: number } | null = null;
  /** Deer grazing in the clearings; they bound away when you get close. */
  private deer: Array<{ sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; state: 'graze' | 'walk' | 'flee'; t: number; target: { x: number; y: number } | null; wait: number }> = [];
  private owl: { sprite: Phaser.GameObjects.Image; blink: number } | null = null;

  constructor() {
    super(SCENES.Forest);
  }

  init(data: ForestSceneData): void {
    super.init(data);
    this.forage = data.forage;
    this.items = [];
    this.stumps = [];
    this.fox = null;
    this.deer = [];
    this.owl = null;
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    const { season, day } = this.host.calendar();
    const rng = createRng('forest-layout');
    this.solid = Array(W * H).fill(false);
    const key = `forest-ground-${season}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, this.drawGround(season));
    this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#1e3a1e');

    // Trees everywhere except the trail, the clearing and the hermit's yard.
    const open = (tx: number, ty: number) => {
      const trail = Math.abs(ty - (14 + Math.round(Math.sin(tx * 0.25) * 2))) <= 1;
      const clearing = Math.hypot(tx - 20, ty - 18) < 5;
      const yard = tx >= HERMIT.tx - 3 && tx <= HERMIT.tx + 4 && ty >= HERMIT.ty - 2 && ty <= HERMIT.ty + 4;
      const branch = tx >= HERMIT.tx && tx <= HERMIT.tx + 1 && ty > HERMIT.ty && ty < 15;
      return trail || clearing || yard || branch || tx >= W - 2;
    };
    for (let ty = 1; ty < H - 1; ty += 2) {
      for (let tx = 1; tx < W - 2; tx += 2) {
        const x = tx + rng.int(0, 1);
        const y = ty + rng.int(0, 1);
        if (open(x, y) || rng.chance(0.18)) continue;
        const kind = rng.chance(0.55) ? 'pine' : 'oak';
        const variant = rng.int(0, kind === 'oak' ? 2 : 1);
        const tex = objectTextureKey(kind, variant, season);
        const baseY = y * size + size - 2;
        this.add.image(x * size + size / 2, baseY, tex).setOrigin(0.5, kind === 'oak' ? 41 / 44 : 44 / 46).setDepth(DEPTH.ySortBase + baseY);
        this.add.image(x * size + size / 2, baseY - 1, TEXTURES.shadowLarge).setDepth(DEPTH.shadow);
        this.solid[y * W + x] = true;
      }
    }
    // The hermit's cabin and the hermit.
    const cabinBase = HERMIT.ty * size + size - 2;
    this.add.image((HERMIT.tx + 1.5) * size, cabinBase, placeableTextureKey('cottage')).setOrigin(0.5, 75 / 76).setDepth(DEPTH.ySortBase + cabinBase).setTint(0xb8a890).setScale(0.85);
    for (let i = 0; i < 3; i++) this.solid[HERMIT.ty * W + HERMIT.tx + i] = true;
    this.hermit = this.add.sprite((HERMIT.tx + 3.5) * size, (HERMIT.ty + 2) * size + 12, npcTextureKey('tobin'), 0).setOrigin(0.5, 1).setTint(0xb8a8c8);
    this.hermit.setDepth(DEPTH.ySortBase + this.hermit.y);
    this.solid[(HERMIT.ty + 2) * W + HERMIT.tx + 3] = true;

    // Ancient stumps for hardwood.
    const taken = new Set(this.forage.taken(day));
    const stumpSpots = [
      [16, 17],
      [24, 20],
      [30, 11],
    ];
    stumpSpots.forEach(([tx, ty], i) => {
      const id = STUMP_ID + i;
      const baseY = ty * size + size - 2;
      const sprite = this.add.image(tx * size + size / 2, baseY, objectTextureKey('stump', 0)).setOrigin(0.5, 11 / 12).setDepth(DEPTH.ySortBase + baseY).setScale(1.4);
      const cut = taken.has(id);
      if (cut) sprite.setAlpha(0.45);
      this.solid[ty * W + tx] = true;
      this.stumps.push({ id, tx, ty, sprite, cut });
    });

    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(W, H, (tx, ty) => this.isSolid(tx, ty));
    this.walls.add(this.add.zone((W * size) / 2, -4, W * size, 8));
    this.walls.add(this.add.zone((W * size) / 2, H * size + 4, W * size, 8));
    this.walls.add(this.add.zone(-4, (H * size) / 2, 8, H * size));

    const entryY = 14 + Math.round(Math.sin((W - 3) * 0.25) * 2);
    this.setupArea(W, H, { x: (W - 3) * size, y: entryY * size + 12, facing: 'left' });
    this.spawnForage(day, season);
    this.setupAtmosphere({ night: true, lights: () => [{ x: (HERMIT.tx + 1.5) * size, y: HERMIT.ty * size - 4, radius: 46 }] });
    this.spawnWildlife();
    gameEvents.emit('area:label', { label: '🌲 The Old Forest' });
    // Birdsong and rustling.
    this.time.addEvent({ delay: 3400, loop: true, callback: () => sfx('rustle', { volume: 0.12, rate: 0.7 + Math.random() * 0.4 }) });
  }

  protected tick(delta: number): void {
    this.updateWildlife(delta);
    // Walk off the right edge to go home.
    if (!this.leaving && this.player.x > W * GAME_CONFIG.tileSize - 6) this.leave();
    const day = this.host.calendar().day;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (Math.hypot(it.sprite.x - this.player.x, it.sprite.y - this.player.y + 4) > 9) continue;
      if (this.host.state.inventory.add(it.itemId, 1) > 0) continue;
      this.forage.take(day, it.id);
      skills.gain('foraging', 5);
      gameEvents.emit('item:collected', { itemId: it.itemId, quantity: 1 });
      sfx('pickup');
      it.sprite.destroy();
      this.items.splice(i, 1);
    }
  }

  /** Trail height (tiles) at a column. */
  private trailY(tx: number): number {
    return 14 + Math.sin(tx * 0.25) * 2;
  }

  /** A fox on the trail at dawn; an owl in an old oak at night. */
  private spawnWildlife(): void {
    const size = GAME_CONFIG.tileSize;
    const { minute } = this.host.calendar();
    const tex = (key: string, draw: () => PixelCanvas) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
      return key;
    };
    for (const f of [0, 1, 2]) tex(`fox-${f}`, () => drawFox(f));
    for (const f of [0, 1]) tex(`owl-${f}`, () => drawOwl(f));
    for (const f of [0, 1, 2]) tex(`deer-${f}`, () => drawDeer(f));
    // Two or three deer graze in the daytime (they keep away in storms and deep snow).
    const { weather, day } = this.host.calendar();
    if (minute >= 6 * 60 && minute < 19 * 60 && weather !== 'snow') {
      const rng = createRng(`forest-deer:${day}`);
      const count = rng.int(2, 3);
      for (let i = 0, tries = 0; i < count && tries < 200; tries++) {
        const tx = rng.int(3, W - 6);
        const ty = rng.int(3, H - 4);
        if (this.isSolid(tx, ty) || this.isSolid(tx + 1, ty)) continue;
        const x = tx * size + 8;
        const y = ty * size + 14;
        const sprite = this.add.image(x, y, 'deer-2').setOrigin(0.5, 1).setFlipX(rng.chance(0.5));
        const shadow = this.add.image(x, y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(1.6, 1);
        this.deer.push({ sprite, shadow, state: 'graze', t: rng.int(0, 2000), target: null, wait: 2000 + rng.int(0, 4000) });
        i++;
      }
    }
    if (minute >= 6 * 60 && minute < 8 * 60) {
      const x = 4 * size;
      const sprite = this.add.image(x, this.trailY(4) * size + 10, 'fox-0').setOrigin(0.5, 1);
      this.fox = { sprite, state: 'trot', t: 0 };
    }
    if (LightingSystem.darkness(minute) > 0.5) {
      // Perched on a branch by the clearing, where the trail opens up.
      const sprite = this.add.image(23 * size, 15.6 * size, 'owl-0').setOrigin(0.5, 1).setDepth(DEPTH.lighting + 1);
      this.owl = { sprite, blink: 2000 };
    }
  }

  private updateDeer(delta: number): void {
    const size = GAME_CONFIG.tileSize;
    for (let i = this.deer.length - 1; i >= 0; i--) {
      const d = this.deer[i];
      const s = d.sprite;
      d.t += delta;
      const dist = Math.hypot(s.x - this.player.x, s.y - this.player.y);
      if (d.state !== 'flee' && dist < 4 * size) {
        // Startled: a white flash of tail and away it bounds.
        d.state = 'flee';
        const away = Math.sign(s.x - this.player.x) || 1;
        d.target = { x: s.x + away * 30 * size, y: s.y + (Math.random() - 0.5) * 4 * size };
        sfx('rustle', { volume: 0.4, rate: 1.4 });
      }
      if (d.state === 'graze') {
        // Head down, now and then looking up.
        s.setTexture(Math.floor(d.t / 2200) % 3 === 2 ? 'deer-0' : 'deer-2');
        d.wait -= delta;
        if (d.wait <= 0) {
          const tx = Math.floor(s.x / size) + Phaser.Math.Between(-3, 3);
          const ty = Math.floor(s.y / size) + Phaser.Math.Between(-2, 2);
          if (!this.isSolid(tx, ty)) {
            d.target = { x: tx * size + 8, y: ty * size + 14 };
            d.state = 'walk';
          }
          d.wait = 3000 + Math.random() * 5000;
        }
      } else if (d.target) {
        const speed = d.state === 'flee' ? 130 : 22;
        const dx = d.target.x - s.x;
        const dy = d.target.y - s.y;
        const len = Math.hypot(dx, dy);
        if (len < 2) {
          d.target = null;
          d.state = 'graze';
        } else {
          const step = Math.min(len, speed * (delta / 1000));
          s.x += (dx / len) * step;
          s.y += (dy / len) * step - (d.state === 'flee' ? Math.sin((d.t % 420) / 420 * Math.PI) * 0.6 : 0);
          s.setTexture(`deer-${Math.floor(d.t / (d.state === 'flee' ? 120 : 260)) % 2}`).setFlipX(dx < 0);
        }
      }
      s.setDepth(DEPTH.ySortBase + s.y);
      d.shadow.setPosition(s.x, s.y - 1);
      if (d.state === 'flee' && (s.x < -40 || s.x > W * size + 40 || Math.hypot(s.x - this.player.x, s.y - this.player.y) > 18 * size)) {
        s.destroy();
        d.shadow.destroy();
        this.deer.splice(i, 1);
      }
    }
  }

  private updateWildlife(delta: number): void {
    const size = GAME_CONFIG.tileSize;
    this.updateDeer(delta);
    if (this.owl) {
      const o = this.owl;
      o.blink -= delta;
      if (o.blink <= 0) {
        o.sprite.setTexture('owl-1');
        this.time.delayedCall(180, () => o.sprite.setTexture('owl-0'));
        o.blink = 1800 + Math.random() * 3000;
        // Now and then it turns its head the other way.
        if (Math.random() < 0.3) o.sprite.setFlipX(!o.sprite.flipX);
      }
      if (Math.hypot(o.sprite.x - this.player.x, o.sprite.y - this.player.y) < 7 * size) this.spot('owl', o.sprite.x, o.sprite.y - 14);
    }
    const f = this.fox;
    if (!f) return;
    f.t += delta;
    const dist = Math.hypot(f.sprite.x - this.player.x, f.sprite.y - this.player.y);
    if (f.state === 'trot') {
      f.sprite.x += 0.035 * delta;
      f.sprite.y = this.trailY(f.sprite.x / size) * size + 10;
      f.sprite.setTexture(`fox-${Math.floor(f.t / 160) % 2}`).setFlipX(false);
      if (dist < 5 * size) {
        f.state = 'sit';
        f.t = 0;
        f.sprite.setTexture('fox-2').setFlipX(this.player.x < f.sprite.x);
        this.spot('fox', f.sprite.x, f.sprite.y - 14);
      } else if (f.sprite.x > (W - 6) * size) f.state = 'flee';
    } else if (f.state === 'sit') {
      if (f.t > 2600 || dist < 2.5 * size) {
        f.state = 'flee';
        f.t = 0;
      }
    } else {
      // Bounds off the way it came, into the trees.
      const away = this.player.x > f.sprite.x ? -1 : 1;
      f.sprite.x += away * 0.09 * delta;
      f.sprite.y -= 0.02 * delta;
      f.sprite.setTexture(`fox-${Math.floor(f.t / 90) % 2}`).setFlipX(away < 0);
      f.sprite.setAlpha(Math.max(0, 1 - f.t / 1200));
      if (f.t > 1200) {
        f.sprite.destroy();
        this.fox = null;
        return;
      }
    }
    f.sprite.setDepth(DEPTH.ySortBase + f.sprite.y);
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    if (feet.tx >= W - 2) return { verb: 'Back to the farm', key: 'E', run: () => this.leave() };
    const hermitNear = Math.hypot(this.hermit.x - this.player.x, this.hermit.y - this.player.y) < 22;
    if (hermitNear) {
      const stack = this.host.state.inventory.selectedStack;
      const forage = stack && (Object.values(FORAGE).flat() as ItemId[]).includes(stack.itemId);
      if (forage && stack && mode === 'use') {
        const price = (ITEMS[stack.itemId].sellPrice ?? 0) * 2;
        return {
          verb: `Sell ${stack.quantity}× ${ITEMS[stack.itemId].name} to the hermit (${price * stack.quantity}g)`,
          key: 'Space',
          run: () => {
            const slot = this.host.state.inventory.selected;
            const n = this.host.state.inventory.removeAt(slot, stack.quantity);
            if (n <= 0) return;
            this.host.state.earn(price * n);
            sfx('coin');
            toast(`The hermit paid ${price * n}g. "Good finds."`);
          },
        };
      }
      return {
        verb: 'Talk to the hermit',
        key: 'E',
        run: () => {
          const line = HERMIT_LINES[this.lineIndex++ % HERMIT_LINES.length];
          if (this.host.say) this.host.say('The Hermit', line);
          else toast(line);
        },
      };
    }
    const stump = this.stumps.find((s) => s.tx === tx && s.ty === ty);
    if (stump) {
      const stack = this.host.state.inventory.selectedStack;
      const tool = stack ? ITEMS[stack.itemId].tool : undefined;
      if (stump.cut) return { verb: 'Already cut today', key: 'Space', info: true, run: () => toast('The stump will be ready for more hardwood tomorrow.') };
      if (tool?.kind !== 'axe') return { verb: 'Needs an axe', key: 'Space', blocked: true, run: () => undefined };
      const cost = skills.toolCost('axe', GAME_CONFIG.energy.toolCost * 2);
      return {
        verb: 'Chop hardwood',
        key: 'Space',
        run: () => {
          if (!this.host.state.spendEnergy(cost)) return toast("You're too tired.");
          this.player.useTool(itemTextureKey(stack!.itemId), 'swing', () => {
            stump.cut = true;
            stump.sprite.setAlpha(0.45);
            this.forage.take(this.host.calendar().day, stump.id);
            this.fx.burst('wood', stump.sprite.x, stump.sprite.y - 8, 10);
            sfx('chop');
            this.drops.spawn('hardwood', (tool.power >= 3 ? 3 : 2) + (skills.bonus('foraging') ? 1 : 0), stump.sprite.x, stump.sprite.y - 6);
            skills.gain('foraging', 10);
          });
        },
      };
    }
    return null;
  }

  private isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return this.solid[ty * W + tx];
  }

  private spawnForage(day: number, season: keyof typeof FORAGE): void {
    const size = GAME_CONFIG.tileSize;
    const taken = new Set(this.forage.taken(day));
    const rng = createRng(`forest-forage:${day}`);
    const pool = FORAGE[season];
    const count = rng.int(6, 10);
    for (let id = 0, tries = 0; id < count && tries < 400; tries++) {
      const tx = rng.int(2, W - 4);
      const ty = rng.int(2, H - 3);
      if (this.isSolid(tx, ty)) continue;
      const itemId = pool[rng.int(0, pool.length - 1)];
      if (!taken.has(id)) {
        const sprite = this.add.image(tx * size + 8, ty * size + 10, itemTextureKey(itemId)).setDepth(DEPTH.ySortBase + ty * size + 10).setScale(0.75);
        this.items.push({ id, sprite, itemId });
      }
      id++;
    }
  }

  private drawGround(season: string): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const rng = createRng('forest-ground');
    const p = new PixelCanvas(W * size, H * size);
    const base = season === 'winter' ? ['#dfe8ee', '#cdd8e0'] : season === 'fall' ? ['#7a8a3a', '#6a7a32'] : ['#3f7a3a', '#376e33'];
    p.rect(0, 0, W * size, H * size, base[0]);
    for (let i = 0; i < W * H * 3; i++) p.rect(rng.int(0, W * size - 2), rng.int(0, H * size - 1), 2, 1, base[1]);
    // The trail.
    // Ragged, wandering edges (one pixel column at a time) instead of a straight band.
    const trail = season === 'winter' ? ['#c8c0b8', '#b4aca4'] : ['#9a7a4a', '#8a6a3e'];
    let top = 0;
    let bottom = 0;
    for (let x = 0; x < W * size; x++) {
      const cy = (14 + Math.sin((x / size) * 0.25) * 2) * size;
      top = Math.max(-3, Math.min(3, top + (rng.chance(0.3) ? (rng.chance(0.5) ? 1 : -1) : 0)));
      bottom = Math.max(-3, Math.min(3, bottom + (rng.chance(0.3) ? (rng.chance(0.5) ? 1 : -1) : 0)));
      const y0 = Math.round(cy - 4 + top);
      const y1 = Math.round(cy + size + 4 + bottom);
      p.rect(x, y0, 1, y1 - y0, trail[0]);
      if (rng.chance(0.3)) p.set(x, y0 + rng.int(2, y1 - y0 - 3), trail[1]);
      // Stray specks of trail in the grass, and ground showing through at the edges.
      if (rng.chance(0.2)) p.set(x, y0 - 1 - rng.int(0, 2), trail[0]);
      if (rng.chance(0.2)) p.set(x, y1 + rng.int(0, 2), trail[0]);
      if (rng.chance(0.15)) p.set(x, y0 + rng.int(0, 1), base[0]);
      if (rng.chance(0.15)) p.set(x, y1 - 1 - rng.int(0, 1), base[0]);
    }
    // Fallen leaves / needles.
    const fleck = season === 'fall' ? ['#d9823b', '#c8452e', '#e8b83a'] : season === 'spring' ? ['#f4b8d0', '#ffffff'] : ['#2f5a2a'];
    for (let i = 0; i < 400; i++) p.set(rng.int(0, W * size - 1), rng.int(0, H * size - 1), fleck[rng.int(0, fleck.length - 1)]);
    return p.toCanvas();
  }
}
