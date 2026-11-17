import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { daily } from '../state/daily';
import {
  GAME_CONFIG,
  ISLAND_CROPS,
  ISLAND_PLOTS,
  ITEMS,
  PARROT_TRADES,
  islandCropForSeed,
  rollQuality,
  type IslandSave,
  type ItemId,
} from '@farming/shared';
import { drawBoat, drawPalm, drawShoreRock } from '../assets/beach';
import { drawBoulder, drawCliff, drawCrate, drawHibiscus, drawHut, drawIslandCrop, drawParrot, drawTikiTorch, drawTurtle } from '../assets/places';
import { PixelCanvas } from '../assets/PixelCanvas';
import { itemTextureKey } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { FishingSystem } from '../systems/FishingSystem';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface IslandSceneData {
  host: AreaHost;
  /** Your island progress (the scene changes it and calls `changed`). */
  island: IslandSave;
  changed(): void;
  /** Where you come in: off the boat at the dock, or out of the cave. */
  arrival: 'dock' | 'cave';
  /** Row back to the beach. */
  sail(): void;
  enterCave(): void;
}

const W = 44;
const H = 32;
const CX = 23;
const CY = 16.5;
const RX = 17;
const RY = 12;
/** The dock runs west from the shore along this row. */
const DOCK = { y: 17, x0: 2, x1: 7 };
const HUT = { tx: 13, ty: 9 };
const PARROT = { tx: 17, ty: 10 };
const CRATES = [
  { tx: 18, ty: 10 },
  { tx: 19, ty: 10 },
];
const GARDEN = { tx: 13, ty: 12, cols: 4 };
const CLIFF = { tx: 27, ty: 9 };
const MOUTH = [CLIFF.tx + 1, CLIFF.tx + 2];
const PALMS: Array<[number, number, number]> = [
  [10, 15, 1],
  [9, 21, -1],
  [22, 6, 1],
  [33, 13, -1],
  [35, 20, 1],
  [24, 24, -1],
  [15, 25, 1],
  [30, 25, -1],
];
const ROCKS: Array<[number, number]> = [
  [36, 10],
  [12, 23],
  [38, 17],
];
const TURTLE_Y = 26;
/** Forage ids (in the island's daily list): coconuts 0–7; the cave uses 100+. */
const COCONUT_ID = 0;

/** How far a point is from the island's centre, 1 = the shoreline (with a wobbly coast). */
function islandRadius(x: number, y: number): number {
  const dx = (x - CX) / RX;
  const dy = (y - CY) / RY;
  const a = Math.atan2(dy, dx);
  const wobble = 1 + 0.07 * Math.sin(3 * a + 0.6) + 0.045 * Math.sin(5 * a + 2) + 0.03 * Math.sin(9 * a);
  return Math.sqrt(dx * dx + dy * dy) / wobble;
}

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * A small tropical island across the water from the beach: a dock where the
 * boat ties up, palms dropping coconuts, an empty hut whose parrot trades seeds
 * for coconuts, a garden where pineapples and taro grow in any season without
 * watering, reef fish all around, a sea turtle some mornings — and a cave
 * hidden behind a cracked boulder.
 */
export class IslandScene extends AreaScene<IslandSceneData> {
  private data_!: IslandSceneData;
  private fishing!: FishingSystem;
  private solid = new Set<string>();
  private coconuts: Array<{ id: number; sprite: Phaser.GameObjects.Image }> = [];
  private plotSprites: Array<Phaser.GameObjects.Image | null> = [];
  private boulder: { sprite: Phaser.GameObjects.Image; hits: number; zone: Phaser.GameObjects.Zone } | null = null;
  private parrot!: Phaser.GameObjects.Image;
  private parrotTimer = 1200;
  private torches: Array<{ x: number; y: number; flame: Phaser.GameObjects.Image }> = [];
  private turtle: { sprite: Phaser.GameObjects.Image; t: number; dir: number } | null = null;

  constructor() {
    super(SCENES.Island);
  }

  init(data: IslandSceneData): void {
    super.init(data);
    this.data_ = data;
    this.solid = new Set();
    this.coconuts = [];
    this.plotSprites = [];
    this.boulder = null;
    this.torches = [];
    this.turtle = null;
  }

  private tex(key: string, draw: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
    return key;
  }

  private isDock(tx: number, ty: number): boolean {
    return ty === DOCK.y && tx >= DOCK.x0 && tx <= DOCK.x1;
  }

  /** Land you can stand on (sand, grass, or the dock). */
  private isLand(tx: number, ty: number): boolean {
    return this.isDock(tx, ty) || islandRadius(tx + 0.5, ty + 0.5) <= 0.97;
  }

  isWater(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < W && ty < H && !this.isLand(tx, ty);
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    const { day, season } = this.host.calendar();
    if (!this.textures.exists('island-ground')) this.textures.addCanvas('island-ground', this.drawGround());
    this.add.image(0, 0, 'island-ground').setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#2a78b0');
    this.walls = this.physics.add.staticGroup();
    this.decorate();
    this.addSolidRuns(W, H, (tx, ty) => !this.isLand(tx, ty) || this.solid.has(`${tx},${ty}`));

    const start =
      this.data_.arrival === 'cave'
        ? { x: (MOUTH[0] + 1) * size, y: (CLIFF.ty + 1) * size + 12, facing: 'down' as const }
        : { x: (DOCK.x0 + 1) * size + 8, y: DOCK.y * size + 12, facing: 'right' as const };
    this.setupArea(W, H, start);
    this.setupAtmosphere({
      night: true,
      lights: () => this.torches.map((t) => ({ x: t.x, y: t.y - 22, radius: 44 })),
    });
    this.fishing = new FishingSystem(this, this.player, this.host.state, this.drops, this.fx);
    this.fishing.isHeld = () => this.controls.useHeld();
    this.spawnCoconuts(day);
    this.drawGarden();
    this.maybeTurtle();
    gameEvents.emit('area:label', { label: `🏝 The Island${season === 'winter' ? ' · warm even in winter' : ''}` });
    this.time.addEvent({ delay: 2800, loop: true, callback: () => sfx('splash', { volume: 0.1, rate: 0.6 + Math.random() * 0.2 }) });
  }

  // ---------- Map ----------

  private drawGround(): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const p = new PixelCanvas(W * size, H * size);
    for (let y = 0; y < H * size; y++) {
      for (let x = 0; x < W * size; x++) {
        const r = islandRadius(x / size, y / size);
        const n = hash(x, y);
        let c: string;
        if (r > 1.25) c = n < 0.05 ? '#3a8ac0' : (Math.floor(y / 3) + Math.floor(x / 9)) % 13 === 0 ? '#3a8ac0' : '#2a78b0';
        else if (r > 1.04) c = n < 0.08 ? '#7ad0d8' : r > 1.15 ? '#3aa0c8' : '#4ab8d0';
        else if (r > 0.985) c = n < 0.5 ? '#f4f8f8' : '#c8ecec';
        else if (r > 0.93) c = n < 0.2 ? '#c8a874' : '#d4b884';
        else if (r > 0.74 + n * 0.05) c = n < 0.06 ? '#e0c890' : n < 0.1 ? '#fff4d0' : '#f0dca8';
        else c = n < 0.12 ? '#3f8a3a' : n < 0.18 ? '#5aaa4a' : '#4a9a40';
        p.set(x, y, c);
      }
    }
    // Sandy path from the dock to the hut.
    for (let x = (DOCK.x1 + 1) * size; x < HUT.tx * size + 24; x++) {
      const cy = (DOCK.y + 0.5) * size - ((x - (DOCK.x1 + 1) * size) / ((HUT.tx - DOCK.x1) * size)) * 6 * size;
      for (let dy = -5; dy <= 5; dy++) if (hash(x, dy + 99) > 0.15 || Math.abs(dy) < 4) p.set(x, Math.round(cy + dy), hash(x, dy) < 0.1 ? '#e0c890' : '#f0dca8');
    }
    // The dock.
    for (let tx = DOCK.x0; tx <= DOCK.x1; tx++) {
      for (let y = DOCK.y * size - 1; y < (DOCK.y + 1) * size + 1; y++) {
        for (let x = tx * size; x < (tx + 1) * size; x++) p.set(x, y, x % 6 === 0 ? '#6e4638' : (x + y) % 11 === 0 ? '#8a5a32' : '#a8703d');
      }
      p.rect(tx * size + 2, (DOCK.y + 1) * size + 1, 3, 3, '#5a3a26');
      p.rect(tx * size + 2, DOCK.y * size - 4, 3, 3, '#5a3a26');
    }
    // The garden's soil.
    for (let i = 0; i < ISLAND_PLOTS; i++) {
      const { tx, ty } = this.plotTile(i);
      p.rect(tx * size + 1, ty * size + 1, size - 2, size - 2, '#6a4a2a');
      for (let k = 0; k < 6; k++) p.rect(tx * size + 2, ty * size + 3 + k * 2, size - 4, 1, k % 2 ? '#5a3a1e' : '#7a5632');
    }
    return p.toCanvas();
  }

  private plotTile(i: number): { tx: number; ty: number } {
    return { tx: GARDEN.tx + (i % GARDEN.cols), ty: GARDEN.ty + Math.floor(i / GARDEN.cols) };
  }

  private block(tx: number, ty: number, w = 1): void {
    for (let i = 0; i < w; i++) this.solid.add(`${tx + i},${ty}`);
  }

  private decorate(): void {
    const size = GAME_CONFIG.tileSize;
    const ys = (y: number) => DEPTH.ySortBase + y;
    // The boat, tied up at the end of the dock.
    const boat = this.add.image(DOCK.x0 * size - 6, DOCK.y * size + 24, this.tex('beach-boat', drawBoat)).setDepth(DEPTH.ground + 0.7);
    this.tweens.add({ targets: boat, y: boat.y + 2, angle: 2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // The hut, the parrot and its crates.
    const hutBase = (HUT.ty + 1) * size - 1;
    this.add.image((HUT.tx + 1.5) * size, hutBase, this.tex('island-hut', drawHut)).setOrigin(0.5, 1).setDepth(ys(hutBase));
    this.block(HUT.tx, HUT.ty, 3);
    this.block(HUT.tx, HUT.ty - 1, 3);
    for (const f of [0, 1]) this.tex(`island-parrot-${f}`, () => drawParrot(f));
    const pBase = (PARROT.ty + 1) * size - 1;
    this.parrot = this.add.image(PARROT.tx * size + 8, pBase, 'island-parrot-0').setOrigin(0.5, 1).setDepth(ys(pBase));
    this.block(PARROT.tx, PARROT.ty);
    const crate = this.tex('island-crate', drawCrate);
    CRATES.forEach((c, i) => {
      const base = (c.ty + 1) * size - 1;
      this.add.image(c.tx * size + 8, base, crate).setOrigin(0.5, 1).setDepth(ys(base));
      this.add.image(c.tx * size + 8, base - 8, itemTextureKey(PARROT_TRADES[i].get.itemId)).setScale(0.55).setDepth(ys(base) + 0.1);
      this.block(c.tx, c.ty);
    });
    // The rock face with the cave.
    const cliffBase = (CLIFF.ty + 1) * size - 1;
    this.add.image((CLIFF.tx + 2) * size, cliffBase, this.tex('island-cliff', drawCliff)).setOrigin(0.5, 1).setDepth(ys(cliffBase - 2));
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 4; dx++) if (!(dy === 0 && MOUTH.includes(CLIFF.tx + dx))) this.block(CLIFF.tx + dx, CLIFF.ty - dy);
    if (!this.data_.island.cave) {
      const bx = (MOUTH[0] + 1) * size;
      const by = (CLIFF.ty + 1) * size + 4;
      const sprite = this.add.image(bx, by, this.tex('island-boulder', drawBoulder)).setOrigin(0.5, 1).setDepth(ys(by));
      const zone = this.add.zone(bx, (CLIFF.ty + 1) * size - 4, 2 * size, size);
      this.boulder = { sprite, hits: 0, zone };
      for (const tx of MOUTH) this.block(tx, CLIFF.ty);
    }
    // Palms, rocks and flowers.
    PALMS.forEach(([tx, ty, lean], i) => {
      const base = (ty + 1) * size - 1;
      this.add.image(tx * size + 8, base, this.tex(`beach-palm-${lean}`, () => drawPalm(lean))).setOrigin(20 / 40, 1).setDepth(ys(base)).setFlipX(i % 3 === 0);
      this.block(tx, ty);
    });
    for (const [tx, ty] of ROCKS) {
      const base = (ty + 1) * size - 1;
      this.add.image(tx * size + 8, base, this.tex('beach-rock', drawShoreRock)).setOrigin(0.5, 1).setDepth(ys(base));
      this.block(tx, ty);
    }
    const rng = createRng('island-flowers');
    const colors = ['#e0443e', '#f07a8a', '#f4d24a', '#f8f0f0'];
    for (let n = 0, tries = 0; n < 14 && tries < 400; tries++) {
      const tx = rng.int(8, W - 8);
      const ty = rng.int(5, H - 5);
      if (islandRadius(tx + 0.5, ty + 0.5) > 0.7 || this.solid.has(`${tx},${ty}`) || this.isGarden(tx, ty) || Math.abs(ty - DOCK.y) < 2 && tx < HUT.tx) continue;
      if (tx >= CLIFF.tx - 1 && tx <= CLIFF.tx + 4 && ty >= CLIFF.ty - 3 && ty <= CLIFF.ty + 2) continue;
      if (tx >= HUT.tx - 1 && tx <= CRATES[1].tx + 1 && ty >= HUT.ty - 2 && ty <= GARDEN.ty + 2) continue;
      const color = colors[rng.int(0, colors.length - 1)];
      const base = (ty + 1) * size - 2;
      this.add.image(tx * size + 8, base, this.tex(`island-hibiscus-${color}`, () => drawHibiscus(color))).setOrigin(0.5, 1).setDepth(ys(base));
      n++;
    }
    // Tiki torches by the dock and the hut (lit at night).
    const torch = this.tex('island-torch', drawTikiTorch);
    for (const [tx, ty] of [
      [DOCK.x1 + 1, DOCK.y - 1],
      [DOCK.x1 + 1, DOCK.y + 1],
      [HUT.tx - 1, HUT.ty + 1],
      [CLIFF.tx - 1, CLIFF.ty + 1],
    ] as const) {
      const base = (ty + 1) * size - 2;
      const x = tx * size + 8;
      const img = this.add.image(x, base, torch).setOrigin(0.5, 1).setDepth(ys(base));
      this.tweens.add({ targets: img, scaleX: 0.92, duration: 220 + tx * 7, yoyo: true, repeat: -1 });
      this.torches.push({ x, y: base, flame: img });
      this.block(tx, ty);
    }
  }

  private isGarden(tx: number, ty: number): boolean {
    return tx >= GARDEN.tx && tx < GARDEN.tx + GARDEN.cols && ty >= GARDEN.ty && ty < GARDEN.ty + Math.ceil(ISLAND_PLOTS / GARDEN.cols);
  }

  // ---------- Coconuts, garden, turtle ----------

  private spawnCoconuts(day: number): void {
    const size = GAME_CONFIG.tileSize;
    const taken = new Set(this.data_.island.day === day ? this.data_.island.taken : []);
    const rng = createRng(`island-coconuts:${day}`);
    PALMS.forEach(([tx, ty], i) => {
      const id = COCONUT_ID + i;
      if (taken.has(id) || !rng.chance(0.75)) return;
      const dx = rng.chance(0.5) ? -1 : 1;
      const x = (tx + dx) * size + 8;
      const y = (ty + 1) * size + 2;
      if (!this.isLand(tx + dx, ty + 1)) return;
      const sprite = this.add.image(x, y, itemTextureKey('coconut')).setScale(0.6).setDepth(DEPTH.ySortBase + y);
      this.coconuts.push({ id, sprite });
    });
  }

  private take(id: number): void {
    const { day } = this.host.calendar();
    const isl = this.data_.island;
    if (isl.day !== day) {
      isl.day = day;
      isl.taken = [];
    }
    isl.taken.push(id);
    this.data_.changed();
  }

  private cropStage(i: number): { id: 'pineapple' | 'taro'; stage: number; ripe: boolean } | null {
    const plot = this.data_.island.plots[i];
    if (!plot) return null;
    const def = ISLAND_CROPS[plot.crop as 'pineapple' | 'taro'];
    if (!def) return null;
    const age = this.host.calendar().day - plot.day;
    const ripe = age >= def.days;
    return { id: def.id, stage: ripe ? 3 : Math.min(2, Math.floor((age / def.days) * 3)), ripe };
  }

  private drawGarden(): void {
    const size = GAME_CONFIG.tileSize;
    for (const s of this.plotSprites) s?.destroy();
    this.plotSprites = [];
    for (let i = 0; i < ISLAND_PLOTS; i++) {
      const crop = this.cropStage(i);
      if (!crop) {
        this.plotSprites.push(null);
        continue;
      }
      const { tx, ty } = this.plotTile(i);
      const key = this.tex(`island-crop-${crop.id}-${crop.stage}`, () => drawIslandCrop(crop.id, crop.stage));
      const base = (ty + 1) * size - 1;
      this.plotSprites.push(this.add.image(tx * size + 8, base, key).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base));
    }
  }

  private maybeTurtle(): void {
    const { minute, weather } = this.host.calendar();
    if (minute < 6 * 60 || minute >= 11 * 60 || weather === 'snow') return;
    for (const f of [0, 1]) this.tex(`island-turtle-${f}`, () => drawTurtle(f));
    const size = GAME_CONFIG.tileSize;
    const sprite = this.add.image(20 * size, TURTLE_Y * size + 6, 'island-turtle-0').setDepth(DEPTH.ySortBase + TURTLE_Y * size);
    this.turtle = { sprite, t: 0, dir: 1 };
  }

  protected tick(delta: number, frozen: boolean): void {
    if (frozen) this.fishing.cancel();
    const intent = this.controls.getMoveIntent();
    if (this.fishing.active && (intent.x !== 0 || intent.y !== 0)) this.fishing.cancel();
    this.fishing.update(delta);
    // The parrot bobs its head.
    this.parrotTimer -= delta;
    if (this.parrotTimer <= 0) {
      this.parrot.setTexture('island-parrot-1');
      this.time.delayedCall(200, () => this.parrot.setTexture('island-parrot-0'));
      this.parrotTimer = 900 + Math.random() * 2400;
      if (Math.random() < 0.25) this.parrot.setFlipX(!this.parrot.flipX);
    }
    // Coconuts are picked up by walking over them.
    for (let i = this.coconuts.length - 1; i >= 0; i--) {
      const c = this.coconuts[i];
      if (Math.hypot(c.sprite.x - this.player.x, c.sprite.y - this.player.y + 4) > 9) continue;
      if (this.host.state.inventory.add('coconut', 1) > 0) continue;
      this.take(c.id);
      skills.gain('foraging', 3);
      gameEvents.emit('item:collected', { itemId: 'coconut', quantity: 1 });
      sfx('pickup');
      c.sprite.destroy();
      this.coconuts.splice(i, 1);
    }
    // The turtle paddles up the sand and back.
    const t = this.turtle;
    if (t) {
      t.t += delta;
      const size = GAME_CONFIG.tileSize;
      t.sprite.setTexture(`island-turtle-${Math.floor(t.t / 400) % 2}`);
      t.sprite.x += t.dir * 0.006 * delta;
      if (t.sprite.x > 27 * size) t.dir = -1;
      if (t.sprite.x < 18 * size) t.dir = 1;
      t.sprite.setFlipX(t.dir < 0);
      if (Math.hypot(t.sprite.x - this.player.x, t.sprite.y - this.player.y) < 6 * size) this.spot('turtle', t.sprite.x, t.sprite.y - 8);
    }
  }

  // ---------- Actions ----------

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    if (this.fishing.reeling) return { verb: 'Reeling — hold to raise the bar!', key: 'Space', info: true, run: () => undefined };
    if (this.fishing.active) {
      return this.fishing.biting ? { verb: 'Reel in!', key: 'E', run: () => this.fishing.reel() } : { verb: 'Waiting for a bite…', key: 'E', info: true, run: () => this.fishing.reel() };
    }
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    const inv = this.host.state.inventory;
    const stack = inv.selectedStack;
    const toast = (text: string) => gameEvents.emit('toast', { text });

    // Back to the boat.
    if (this.isDock(feet.tx, feet.ty) && feet.tx <= DOCK.x0 + 1) return { verb: 'Row back to the beach', key: 'E', run: () => this.travel(() => this.data_.sail()) };

    // Fishing from the shore or the dock.
    if (mode === 'use' && stack?.itemId === 'fishing_rod') {
      if (!this.isWater(tx, ty)) return { verb: 'Face the sea to fish', key: 'Space', info: true, run: () => undefined };
      if (this.host.state.energy < 3) return { verb: 'Too tired', key: 'Space', blocked: true, run: () => undefined };
      return { verb: 'Cast line (reef)', key: 'Space', run: () => this.fishing.cast(tx, ty, { ...this.host.calendar(), water: 'island' }) };
    }

    // The cave: a cracked boulder first, then the way in.
    if (ty === CLIFF.ty && MOUTH.includes(tx)) {
      if (this.boulder) {
        const tool = stack ? ITEMS[stack.itemId].tool : undefined;
        if (tool?.kind !== 'pickaxe') return { verb: 'A cracked boulder · needs a pickaxe', key: 'Space', blocked: true, run: () => toast('Something echoes behind this boulder. A pickaxe might break it.') };
        if (tool.power < 2) return { verb: 'Too hard for this pickaxe', key: 'Space', blocked: true, run: () => toast('The boulder is too hard. A copper pickaxe or better might do it.') };
        return {
          verb: 'Break the boulder',
          key: 'Space',
          run: () => {
            if (!this.host.state.spendEnergy(skills.toolCost('pickaxe', GAME_CONFIG.energy.toolCost))) return toast("You're too tired.");
            this.player.useTool(itemTextureKey(stack!.itemId), 'swing', () => this.hitBoulder());
          },
        };
      }
      return { verb: 'Enter the cave', key: 'E', run: () => this.travel(() => this.data_.enterCave()) };
    }

    // The parrot and its trades.
    if (tx === PARROT.tx && ty === PARROT.ty) {
      const lines = ['Squawk! Coconuts! Coconuts for seeds!', 'Pretty bird! Pretty bird wants coconuts!', 'Pineapple! Taro! Fair trade! Squawk!', 'Rawk! The cave, the cave! Shiny things!'];
      return { verb: 'Talk to the parrot', key: 'E', run: () => toast(`🦜 ${lines[Math.floor(Math.random() * lines.length)]}`) };
    }
    const crateIndex = CRATES.findIndex((c) => c.tx === tx && c.ty === ty);
    if (crateIndex >= 0) {
      const trade = PARROT_TRADES[crateIndex];
      const label = `${trade.get.quantity}× ${ITEMS[trade.get.itemId].name} for ${trade.give.quantity} coconuts`;
      if (inv.count(trade.give.itemId) < trade.give.quantity) return { verb: label, key: 'E', blocked: true, run: () => toast(`The parrot wants ${trade.give.quantity} coconuts for that. Look under the palms.`) };
      return {
        verb: `Trade: ${label}`,
        key: mode === 'use' ? 'Space' : 'E',
        run: () => {
          if (inv.count(trade.give.itemId) < trade.give.quantity) return;
          inv.remove(trade.give.itemId, trade.give.quantity);
          if (inv.add(trade.get.itemId, trade.get.quantity) > 0) this.drops.spawn(trade.get.itemId, trade.get.quantity, this.player.x, this.player.y - 4);
          gameEvents.emit('item:collected', { itemId: trade.get.itemId, quantity: trade.get.quantity });
          sfx('coin');
          toast('🦜 Squawk! Pleasure doing business!');
        },
      };
    }

    // The garden.
    if (this.isGarden(tx, ty)) {
      const i = (ty - GARDEN.ty) * GARDEN.cols + (tx - GARDEN.tx);
      if (i >= ISLAND_PLOTS) return null;
      const crop = this.cropStage(i);
      if (crop?.ripe) return { verb: `Harvest ${ISLAND_CROPS[crop.id].name}`, key: mode === 'use' ? 'Space' : 'E', run: () => this.harvest(i) };
      if (crop) {
        const def = ISLAND_CROPS[crop.id];
        const left = def.days - (this.host.calendar().day - this.data_.island.plots[i]!.day);
        return { verb: `${def.name} · ready in ${left} day${left === 1 ? '' : 's'}`, key: 'E', info: true, run: () => toast(`${def.name} · ready in ${left} day${left === 1 ? '' : 's'}. The island soil stays moist — no watering needed.`) };
      }
      const seed = stack ? islandCropForSeed(stack.itemId) : undefined;
      if (seed && mode === 'use') return { verb: `Plant ${seed.name}`, key: 'Space', run: () => this.plant(i, stack!.itemId) };
      return { verb: 'Island garden plot', key: 'E', info: true, run: () => toast('Rich island soil. Plant pineapple seeds or taro tubers here — the parrot trades them for coconuts.') };
    }
    if (tx >= HUT.tx && tx < HUT.tx + 3 && ty === HUT.ty) {
      return { verb: 'An empty hut', key: 'E', info: true, run: () => toast('Nobody has lived here for years. A faded note on the door: "Gone fishing. Feed the bird."') };
    }
    return null;
  }

  private hitBoulder(): void {
    const b = this.boulder;
    if (!b) return;
    b.hits += 1;
    this.fx.burst('stone', b.sprite.x, b.sprite.y - 10, 8);
    sfx('mine');
    if (b.hits < 3) {
      this.fx.shake(b.sprite);
      return;
    }
    sfx('rockBreak');
    this.fx.burst('stone', b.sprite.x, b.sprite.y - 10, 18);
    b.sprite.destroy();
    this.boulder = null;
    this.data_.island.cave = true;
    this.data_.changed();
    // Open the way: rebuild the walls without the mouth tiles.
    for (const tx of MOUTH) this.solid.delete(`${tx},${CLIFF.ty}`);
    this.walls.clear(true, true);
    this.addSolidRuns(W, H, (tx, ty) => !this.isLand(tx, ty) || this.solid.has(`${tx},${ty}`));
    gameEvents.emit('toast', { text: 'The boulder crumbles — there is a cave behind it!' });
  }

  private plant(i: number, seed: ItemId): void {
    const crop = islandCropForSeed(seed);
    const inv = this.host.state.inventory;
    if (!crop || this.data_.island.plots[i] || inv.removeAt(inv.selected, 1) !== 1) return;
    this.data_.island.plots[i] = { crop: crop.id, day: this.host.calendar().day };
    this.data_.changed();
    sfx('plant');
    this.drawGarden();
  }

  private harvest(i: number): void {
    const crop = this.cropStage(i);
    if (!crop?.ripe) return;
    const def = ISLAND_CROPS[crop.id];
    const { tx, ty } = this.plotTile(i);
    const n = Phaser.Math.Between(def.yield[0], def.yield[1]) + (this.host.state.hasBuff('luck') && Math.random() < 0.5 ? 1 : 0) + (skills.bonus('farming') ? 1 : 0);
    skills.gain('farming', def.id === 'pineapple' ? 14 : 8);
    daily.note('harvest');
    this.data_.island.plots[i] = null;
    this.data_.changed();
    sfx('harvest');
    const q = rollQuality({ level: skills.level('farming'), lucky: this.host.state.hasBuff('luck') });
    this.drops.spawn(def.harvest, n, tx * GAME_CONFIG.tileSize + 8, ty * GAME_CONFIG.tileSize + 8, q);
    this.drawGarden();
  }
}
