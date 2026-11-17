import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { GAME_CONFIG, tideLevel, type ItemId, type Season } from '@farming/shared';
import { itemTextureKey } from '../assets/registerTextures';
import { PixelCanvas } from '../assets/PixelCanvas';
import {
  drawBeachBall,
  drawBeachSign,
  drawBoat,
  drawBollard,
  drawBonfire,
  drawCrab,
  drawDeckChair,
  drawDriftwood,
  drawDuneGrass,
  drawGull,
  drawLifeguardTower,
  drawPalm,
  drawPierLantern,
  drawSandcastle,
  drawShoreRock,
  drawStarfish,
  drawTowel,
  drawUmbrella,
} from '../assets/beach';
import { sfx } from '../audio/sfx';
import { drawDolphin } from '../assets/wildlife';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { FishingSystem } from '../systems/FishingSystem';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface BeachSceneData {
  host: AreaHost;
  /** Shells and coral picked today (each spot can be picked once a day). */
  forage: { taken(day: number): number[]; take(day: number, id: number): void };
  /** Coming in from the farm, or back from the island in the boat. */
  arrival?: 'gate' | 'boat';
  /** The old rowing boat by the pier: patch it up once, then row to the island. */
  boat: { repaired(): boolean; repair(): boolean; sail(): void };
}

const W = 34;
const H = 22;
const SHORE = 24; // first water column
const PIER = { y: 9, x0: 20, x1: 31 };
/** The rowing boat is tied up beside the pier over these three columns. */
const BOAT_TX = 28;

type Tile = 'grass' | 'sand' | 'wet' | 'water' | 'pier';

/** How far the tide moves the waterline (px): up the sand at high tide, out past the rock pools at low tide. */
const TIDE_HIGH = -22;
const TIDE_LOW = 42;
const tideOffset = (minute: number) => TIDE_HIGH + (TIDE_LOW - TIDE_HIGH) * tideLevel(minute);
/** Rock pools in the strip the low tide uncovers: tile rows (avoiding the pier) and the item ids for today's finds. */
const POOL_ROWS = [3, 6.5, 12.5, 16, 19.5];
const POOL_ID = 40;

/** The waterline (in pixels) at a given height: a gentle, irregular curve. */
const shoreX = (y: number) => (SHORE + Math.sin((y / 16) * 0.6) * 1.2 + Math.sin((y / 16) * 1.7 + 1) * 0.35) * 16;
/** Where the meadow gives way to sand. */
const meadowX = (y: number) => (3.7 + Math.sin((y / 16) * 0.45 + 2) * 0.6 + Math.sin((y / 16) * 1.3) * 0.3) * 16;
/** Cheap deterministic per-pixel noise in [0, 1). */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * The beach east of the farm: sand, a little pier, and the open sea. Shells
 * and coral wash up each morning, and the sea has its own fish (tuna, and a
 * rare pufferfish on sunny afternoons).
 */
export class BeachScene extends AreaScene<BeachSceneData> {
  private forage!: BeachSceneData['forage'];
  private boatHost!: BeachSceneData['boat'];
  private arrival: 'gate' | 'boat' = 'gate';
  private boatPatch: Phaser.GameObjects.Graphics | null = null;
  private fishing!: FishingSystem;
  private tiles: Tile[] = [];
  private items: Array<{ id: number; sprite: Phaser.GameObjects.Image; itemId: ItemId; pool?: boolean }> = [];
  /** The sea that rises and falls with the tide (drawn over the low-tide beach). */
  private tideWater!: Phaser.GameObjects.Image;
  private foamNear!: Phaser.GameObjects.Graphics;
  private foamFar!: Phaser.GameObjects.Graphics;
  private tide = 0;
  private tideLabel = '';
  private safe = { x: 0, y: 0 };
  private dolphinTimer = 8000;
  private bonfire = { x: 0, y: 0 };
  /** Tiles taken by decorations (shells don't wash up there). */
  private decorTiles = new Set<string>();
  private crabs: Array<{ sprite: Phaser.GameObjects.Image; dir: number; x0: number; x1: number; pause: number; t: number; key: string }> = [];
  private gulls: Array<{ sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; vx: number; t: number; key: string }> = [];

  constructor() {
    super(SCENES.Beach);
  }

  init(data: BeachSceneData): void {
    super.init(data);
    this.forage = data.forage;
    this.boatHost = data.boat;
    this.arrival = data.arrival ?? 'gate';
    this.boatPatch = null;
    this.items = [];
    this.decorTiles = new Set();
    this.crabs = [];
    this.gulls = [];
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    this.tiles = [];
    for (let ty = 0; ty < H; ty++) {
      for (let tx = 0; tx < W; tx++) {
        // Classify each tile by where its centre falls against the smooth shoreline and meadow edge.
        const cx = tx * GAME_CONFIG.tileSize + 8;
        const cy = ty * GAME_CONFIG.tileSize + 8;
        let t: Tile = cx < meadowX(cy) ? 'grass' : cx >= shoreX(cy) ? 'water' : cx >= shoreX(cy) - 16 ? 'wet' : 'sand';
        if (ty === PIER.y && tx >= PIER.x0 && tx <= PIER.x1) t = 'pier';
        this.tiles.push(t);
      }
    }
    const season = this.host.calendar().season;
    const key = `beach-ground-v3-${season}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, this.drawGround(season));
    this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.ground);
    const waterKey = `beach-tide-${season}`;
    if (!this.textures.exists(waterKey)) this.textures.addCanvas(waterKey, this.drawTideWater(season));
    this.tide = tideOffset(this.host.calendar().minute);
    this.tideWater = this.add.image(this.tide, 0, waterKey).setOrigin(0).setDepth(DEPTH.ground + 0.3);
    if (!this.textures.exists('beach-pier')) this.textures.addCanvas('beach-pier', this.drawPier());
    this.add.image(PIER.x0 * size, PIER.y * size, 'beach-pier').setOrigin(0).setDepth(DEPTH.ground + 0.5);
    this.cameras.main.setBackgroundColor('#3a83b5');

    this.walls = this.physics.add.staticGroup();
    // Open sea past the low-tide line is always solid; the strip the tide covers is checked every frame.
    this.addSolidRuns(W, H, (tx, ty) => this.tileAt(tx, ty) !== 'pier' && tx * size >= shoreX(ty * size + 8) + TIDE_LOW + 4);
    // The top and bottom edges.
    this.walls.add(this.add.zone((W * size) / 2, -4, W * size, 8));
    this.walls.add(this.add.zone((W * size) / 2, H * size + 4, W * size, 8));

    if (this.arrival === 'boat') this.setupArea(W, H, { x: (BOAT_TX + 1) * size, y: PIER.y * size + 12, facing: 'left' });
    else this.setupArea(W, H, { x: 2 * size, y: 11 * size + 12, facing: 'right' });
    this.safe = { x: this.player.x, y: this.player.y };
    this.decorate();
    this.setupAtmosphere({
      night: true,
      lights: () => [
        { x: this.bonfire.x, y: this.bonfire.y - 8, radius: 56 },
        { x: PIER.x1 * size + 8, y: PIER.y * size - 20, radius: 40 },
      ],
    });
    this.fishing = new FishingSystem(this, this.player, this.host.state, this.drops, this.fx);
    this.fishing.isHeld = () => this.controls.useHeld();
    this.spawnForage();
    this.spawnPools();
    this.updateTide(0);
    // Waves lapping.
    this.time.addEvent({ delay: 2600, loop: true, callback: () => sfx('splash', { volume: 0.12, rate: 0.6 + Math.random() * 0.2 }) });
  }

  protected tick(delta: number, frozen: boolean): void {
    if (frozen) this.fishing.cancel();
    const intent = this.controls.getMoveIntent();
    if (this.fishing.active && (intent.x !== 0 || intent.y !== 0)) this.fishing.cancel();
    this.fishing.update(delta);
    this.animateLife(delta);
    this.updateTide(delta);
    this.keepOutOfSea();
    this.maybeDolphins(delta);
    // Walk off the left edge to go home.
    if (!this.leaving && this.player.x < 6) this.leave();
    // Pick up shells by walking over them.
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.pool && !it.sprite.visible) continue;
      if (Math.hypot(it.sprite.x - this.player.x, it.sprite.y - this.player.y + 4) > 9) continue;
      if (this.host.state.inventory.add(it.itemId, 1) > 0) continue;
      this.forage.take(this.host.calendar().day, it.id);
      skills.gain('foraging', 4);
      gameEvents.emit('item:collected', { itemId: it.itemId, quantity: 1 });
      sfx('pickup');
      it.sprite.destroy();
      this.items.splice(i, 1);
    }
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    if (this.fishing.reeling) return { verb: 'Reeling — hold to raise the bar!', key: 'Space', info: true, run: () => undefined };
    if (this.fishing.active) {
      return this.fishing.biting
        ? { verb: 'Reel in!', key: 'E', run: () => this.fishing.reel() }
        : { verb: 'Waiting for a bite…', key: 'E', info: true, run: () => this.fishing.reel() };
    }
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    if (feet.tx <= 1) return { verb: 'Back to the farm', key: 'E', run: () => this.leave() };
    const stack = this.host.state.inventory.selectedStack;
    const rod = stack?.itemId === 'fishing_rod';
    // The rowing boat beside the pier.
    if (feet.ty === PIER.y && ty === PIER.y + 1 && tx >= BOAT_TX && tx <= BOAT_TX + 2 && !(mode === 'use' && rod)) {
      if (this.boatHost.repaired()) return { verb: 'Row to the island', key: 'E', run: () => this.travel(() => this.boatHost.sail()) };
      return {
        verb: 'Repair the boat (40 wood, 8 hardwood, 20 fiber)',
        key: 'E',
        run: () => {
          if (!this.boatHost.repair()) return;
          this.boatPatch?.destroy();
          this.boatPatch = null;
          this.fx.burst('wood', (BOAT_TX + 1) * GAME_CONFIG.tileSize, (PIER.y + 1) * GAME_CONFIG.tileSize + 8, 12);
          sfx('craft');
        },
      };
    }
    if (mode === 'use' && rod) {
      // Cast from the shore or the pier into the sea (one tile further from the pier's edge is fine too).
      const water = this.isSea(tx, ty) ? { tx, ty } : null;
      if (!water) return { verb: 'Face the sea to fish', key: 'Space', info: true, run: () => undefined };
      if (this.host.state.energy < 3) return { verb: 'Too tired', key: 'Space', blocked: true, run: () => undefined };
      return { verb: 'Cast line (sea)', key: 'Space', run: () => this.fishing.cast(water.tx, water.ty, { ...this.host.calendar(), water: 'ocean' }) };
    }
    return null;
  }

  private tex(key: string, draw: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
    return key;
  }

  /**
   * Dresses the beach: palms and dune grass, umbrellas with towels and deck
   * chairs, a lifeguard tower, a sandcastle, a bonfire, driftwood and rocks,
   * a welcome sign, a lantern and bollards on the pier, a boat bobbing at
   * its side, crabs on the sand and gulls overhead.
   */
  private decorate(): void {
    const size = GAME_CONFIG.tileSize;
    const ys = (y: number) => DEPTH.ySortBase + y;
    // A standing thing whose base sits on tile (tx, ty); `solid` tiles block walking.
    const stand = (key: string, tx: number, ty: number, opts: { dx?: number; solid?: number; flip?: boolean } = {}) => {
      const x = tx * size + 8 + (opts.dx ?? 0);
      const base = (ty + 1) * size - 2;
      const img = this.add.image(x, base, key).setOrigin(0.5, 1).setDepth(ys(base)).setFlipX(!!opts.flip);
      const w = opts.solid ?? 0;
      // Keep shells off the thing and the tile just above it (where tall art overlaps).
      for (let i = 0; i < Math.max(1, w); i++) for (const y of [ty, ty - 1]) this.decorTiles.add(`${tx - Math.floor((w - 1) / 2) + i},${y}`);
      if (w > 0) this.walls.add(this.add.zone(x, base - 4, w * size - 4, 8));
      return img;
    };
    // Something lying flat on the sand.
    const flat = (key: string, tx: number, ty: number, w = 1, h = 1) => {
      for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) this.decorTiles.add(`${tx + i},${ty + j}`);
      return this.add.image(tx * size, ty * size, key).setOrigin(0).setDepth(DEPTH.ground + 0.5);
    };

    // Dune grass along the edge of the meadow.
    const dune = this.tex('beach-dune', drawDuneGrass);
    const winterDune = this.host.calendar().season === 'winter';
    for (const ty of [1, 3, 6, 14, 16, 19, 20]) {
      const tuft = stand(dune, 4 + (ty % 2), ty, { flip: ty % 3 === 0 });
      if (winterDune) tuft.setTint(0xc8c0a8);
    }

    // Palms.
    const palmR = this.tex('beach-palm-r', () => drawPalm(1));
    const palmL = this.tex('beach-palm-l', () => drawPalm(-1));
    stand(palmR, 7, 3, { solid: 1, dx: 2 });
    stand(palmL, 6, 19, { solid: 1 });
    stand(palmR, 18, 20, { solid: 1 });
    stand(palmL, 14, 2, { solid: 1 });

    // Two picnic spots: umbrella, towel, deck chair.
    flat(this.tex('beach-towel-red', () => drawTowel('#d2404c', '#f6efe0')), 11, 5, 1, 2);
    stand(this.tex('beach-umb-red', () => drawUmbrella('#d2404c', '#f6efe0')), 10, 6, { solid: 1 });
    stand(this.tex('beach-chair-blue', () => drawDeckChair('#3a83b5')), 13, 6, { solid: 1 });
    flat(this.tex('beach-towel-blue', () => drawTowel('#3a83b5', '#f4d24a')), 15, 14, 1, 2);
    stand(this.tex('beach-umb-teal', () => drawUmbrella('#2f9a8a', '#f4d24a')), 14, 15, { solid: 1 });
    stand(this.tex('beach-chair-red', () => drawDeckChair('#ea7194')), 17, 15, { solid: 1, flip: true });
    const ball = stand(this.tex('beach-ball', drawBeachBall), 12, 14);
    this.tweens.add({ targets: ball, y: ball.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });

    // The lifeguard keeps watch over the water.
    stand(this.tex('beach-tower', drawLifeguardTower), 20, 4, { solid: 2 });
    // A sandcastle, a bonfire for the evenings, and things the sea left behind.
    stand(this.tex('beach-castle', drawSandcastle), 17, 12, { solid: 2 });
    const fire0 = this.tex('beach-fire-0', () => drawBonfire(0));
    const fire1 = this.tex('beach-fire-1', () => drawBonfire(1));
    const fire = stand(fire0, 9, 16, { solid: 1 });
    this.bonfire = { x: fire.x, y: fire.y };
    this.time.addEvent({ delay: 180, loop: true, callback: () => fire.setTexture(fire.texture.key === fire0 ? fire1 : fire0) });
    const glow = this.add.circle(fire.x, fire.y - 8, 18, 0xffb040, 0.18).setDepth(DEPTH.ground + 0.6);
    this.tweens.add({ targets: glow, scale: 1.15, alpha: 0.26, duration: 420, yoyo: true, repeat: -1 });
    stand(this.tex('beach-drift', drawDriftwood), 20, 17, { solid: 2 });
    const rock = this.tex('beach-rock', drawShoreRock);
    stand(rock, 22, 2, { solid: 1 });
    stand(rock, 21, 20, { solid: 1, flip: true });
    stand(rock, 23, 13, { solid: 1 });
    const star = this.tex('beach-star', drawStarfish);
    flat(star, 19, 7);
    flat(star, 8, 12);

    // A welcome sign by the path in.
    const sign = stand(this.tex('beach-sign', drawBeachSign), 6, 8, { solid: 2 });
    this.add
      .text(sign.x, sign.y - 15, 'THE BEACH', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '5px', fontStyle: 'bold', color: '#fff8d0' })
      .setOrigin(0.5, 1)
      .setResolution(8)
      .setDepth(sign.depth + 1);

    // The pier: bollards along its edges, a lantern at the end, a boat tied up beside it.
    const bollard = this.tex('beach-bollard', drawBollard);
    for (const tx of [PIER.x0 + 2, PIER.x0 + 6, PIER.x1 - 2]) {
      this.add.image(tx * size + 8, PIER.y * size + 2, bollard).setOrigin(0.5, 1).setDepth(ys(PIER.y * size));
      // (none on the side where the boat is tied up)
      if (tx < BOAT_TX || tx > BOAT_TX + 2) this.add.image(tx * size + 8, (PIER.y + 1) * size + 4, bollard).setOrigin(0.5, 1).setDepth(ys((PIER.y + 1) * size + 4));
    }
    this.add.image(PIER.x1 * size + 8, PIER.y * size + 4, this.tex('beach-lantern', drawPierLantern)).setOrigin(0.5, 1).setDepth(ys(PIER.y * size + 4));
    const boat = this.add.image((BOAT_TX + 1) * size, (PIER.y + 1) * size + 9, this.tex('beach-boat', drawBoat)).setDepth(DEPTH.ground + 0.7);
    this.tweens.add({ targets: boat, y: boat.y + 2, angle: 2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (!this.boatHost.repaired()) {
      // A hole in the hull and a loose plank: it needs fixing before it goes anywhere.
      const g = this.add.graphics().setDepth(DEPTH.ground + 0.71);
      g.fillStyle(0x2b1d1a, 1).fillEllipse(-4, 0, 7, 4);
      g.fillStyle(0x6e4638, 1).fillRect(3, -3, 6, 2);
      g.setPosition(boat.x, boat.y);
      this.tweens.add({ targets: g, y: g.y + 2, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.boatPatch = g;
    }

    // Waves: two lines of foam that follow the shore, rolling up the sand and back out.
    const waveLine = (offset: number, alpha: number, width: number) => {
      const g = this.add.graphics().setDepth(DEPTH.ground + 0.4);
      g.lineStyle(width, 0xf4fbfd, alpha);
      // Broken where the pier crosses the water.
      const pierTop = PIER.y * size - 2;
      const pierBottom = (PIER.y + 1) * size + 2;
      let drawing = false;
      g.beginPath();
      for (let y = 0; y <= H * size; y += 4) {
        const x = shoreX(y) + offset + Math.sin(y * 0.15) * 1.5;
        if (y > pierTop && y < pierBottom) {
          drawing = false;
          continue;
        }
        if (!drawing) g.moveTo(x, y);
        else g.lineTo(x, y);
        drawing = true;
      }
      g.strokePath();
      return g;
    };
    // Moved with the tide (and lapping back and forth) in updateTide().
    this.foamNear = waveLine(3, 0.85, 2);
    this.foamFar = waveLine(14, 0.4, 1.5);
    // Sun glints twinkling on the sea.
    for (let i = 0; i < 14; i++) {
      const y = 8 + Math.random() * (H * size - 16);
      const x = shoreX(y) + TIDE_LOW + 20 + Math.random() * Math.max(10, W * size - shoreX(y) - TIDE_LOW - 24);
      if (Math.abs(y - (PIER.y * size + 8)) < 12) continue;
      const glint = this.add.rectangle(x, y, 3, 1, 0xffffff, 0).setDepth(DEPTH.ground + 0.45);
      this.tweens.add({ targets: glint, alpha: 0.9, duration: 500, delay: Math.random() * 4000, yoyo: true, repeat: -1, repeatDelay: 2000 + Math.random() * 3000 });
    }

    // Crabs that scuttle sideways and stop now and then.
    const crabKeys = [this.tex('beach-crab-0', () => drawCrab(0)), this.tex('beach-crab-1', () => drawCrab(1))];
    for (const [tx, ty, span] of [[19, 10, 3], [12, 19, 4], [21, 15, 2]] as const) {
      const sprite = this.add.image(tx * size + 8, ty * size + 12, crabKeys[0]).setDepth(ys(ty * size + 12));
      this.crabs.push({ sprite, dir: 1, x0: sprite.x - span * 8, x1: sprite.x + span * 8, pause: 0, t: 0, key: crabKeys[0] });
    }

    // Gulls gliding across the sky (above everything).
    const gullKeys = [this.tex('beach-gull-0', () => drawGull(0)), this.tex('beach-gull-1', () => drawGull(1))];
    for (let i = 0; i < 3; i++) {
      const sprite = this.add.image(-20 - i * 140, (2 + i * 6) * size, gullKeys[0]).setDepth(DEPTH.ySortBase + H * size + 50);
      // A soft shadow far below shows they're up in the air.
      const shadow = this.add.ellipse(sprite.x, sprite.y + 34, 9, 3, 0x000000, 0.14).setDepth(DEPTH.ground + 0.5);
      this.gulls.push({ sprite, shadow, vx: 0.018 + i * 0.006, t: i * 120, key: gullKeys[0] });
    }
  }

  /** Crabs scuttle, gulls glide and flap. */
  private animateLife(delta: number): void {
    const size = GAME_CONFIG.tileSize;
    for (const c of this.crabs) {
      c.t += delta;
      if (c.pause > 0) {
        c.pause -= delta;
        continue;
      }
      // Hide from the player when they come close.
      const near = Math.hypot(c.sprite.x - this.player.x, c.sprite.y - this.player.y) < 22;
      const speed = near ? 0.06 : 0.02;
      if (near) c.dir = c.sprite.x < this.player.x ? -1 : 1;
      c.sprite.x += c.dir * speed * delta;
      if (c.sprite.x < c.x0 || c.sprite.x > c.x1) {
        c.sprite.x = Phaser.Math.Clamp(c.sprite.x, c.x0, c.x1);
        c.dir *= -1;
        c.pause = 600 + Math.random() * 1800;
      }
      const frame = Math.floor(c.t / 120) % 2;
      c.sprite.setTexture(`beach-crab-${frame}`);
    }
    for (const g of this.gulls) {
      g.t += delta;
      g.sprite.x += g.vx * delta;
      g.sprite.y += Math.sin(g.t / 700) * 0.04 * delta * 0.3;
      g.sprite.setTexture(`beach-gull-${Math.floor(g.t / 260) % 2}`);
      g.shadow.setPosition(g.sprite.x, g.sprite.y + 34);
      if (g.sprite.x > W * size + 30) {
        g.sprite.x = -30;
        g.sprite.y = (1 + Math.random() * (H - 4)) * size;
      }
    }
  }

  /** Is this tile under the sea right now (the tide moves the waterline)? */
  private isSea(tx: number, ty: number): boolean {
    const size = GAME_CONFIG.tileSize;
    if (this.tileAt(tx, ty) === 'pier') return false;
    if (tx >= W) return true;
    return tx * size + 8 >= shoreX(ty * size + 8) + this.tide;
  }

  /** Moves the sea with the tide, laps the foam, hides/shows rock pools, and names the tide on the label. */
  private updateTide(_delta: number): void {
    const { minute } = this.host.calendar();
    this.tide = tideOffset(minute);
    this.tideWater.x = this.tide;
    const lap = Math.sin(this.time.now / 820) * 4;
    this.foamNear.x = this.tide + lap - 2;
    this.foamNear.alpha = 0.55 + 0.3 * Math.sin(this.time.now / 820);
    this.foamFar.x = this.tide + Math.sin(this.time.now / 820 - 1.2) * 5;
    for (const it of this.items) {
      if (!it.pool) continue;
      it.sprite.setVisible(it.sprite.x + 10 < shoreX(it.sprite.y) + this.tide);
    }
    const level = tideLevel(minute);
    const rising = tideLevel(minute + 10) < level;
    const label = level > 0.8 ? 'low tide 🐚' : level < 0.2 ? 'high tide' : rising ? 'tide coming in' : 'tide going out';
    if (label !== this.tideLabel) {
      this.tideLabel = label;
      gameEvents.emit('area:label', { label: `🏖 The Beach · ${label}` });
    }
  }

  /** The tide doesn't have walls: step back if the player wades in (or the sea comes in under them). */
  private keepOutOfSea(): void {
    const size = GAME_CONFIG.tileSize;
    const { x, y } = this.player;
    const onPier = y >= PIER.y * size && y < (PIER.y + 1) * size + 2 && x >= PIER.x0 * size - 4;
    const wet = !onPier && x >= shoreX(y) + this.tide - 3;
    if (!wet) {
      this.safe = { x, y };
      return;
    }
    // Back to the last dry spot; if the tide itself caught up, nudge up the beach.
    const fallback = shoreX(y) + this.tide - 6;
    const sx = this.safe.x < shoreX(this.safe.y) + this.tide - 3 ? this.safe.x : fallback;
    this.player.placeAt(sx, this.safe.x === sx ? this.safe.y : y, this.player.facingDirection);
  }

  /**
   * Rock pools: uncovered when the tide goes out, each with one find a day —
   * sea urchins, sea stars, coral, the odd crab, and rarely a rainbow shell.
   */
  private spawnPools(): void {
    const size = GAME_CONFIG.tileSize;
    const day = this.host.calendar().day;
    const taken = new Set(this.forage.taken(day));
    const rng = createRng(`beach-pools:${day}`);
    POOL_ROWS.forEach((row, i) => {
      const id = POOL_ID + i;
      const roll = rng.next();
      const itemId: ItemId = roll < 0.1 ? 'rainbow_shell' : roll < 0.38 ? 'sea_urchin' : roll < 0.66 ? 'sea_star' : roll < 0.84 ? 'coral' : 'crab';
      if (taken.has(id)) return;
      const y = row * size;
      const x = shoreX(y) + 20;
      const sprite = this.add.image(x, y + 1, itemTextureKey(itemId)).setScale(0.7).setDepth(DEPTH.ySortBase + y + 2);
      this.items.push({ id, sprite, itemId, pool: true });
    });
  }

  /** On a dry day, a pod of dolphins leaps out beyond the pier now and then. */
  private maybeDolphins(delta: number): void {
    const { minute, weather } = this.host.calendar();
    if (minute < 600 || minute > 1020 || weather === 'rain' || weather === 'snow') return;
    this.dolphinTimer -= delta;
    if (this.dolphinTimer > 0) return;
    this.dolphinTimer = 14000 + Math.random() * 16000;
    const size = GAME_CONFIG.tileSize;
    const key = this.textures.exists('beach-dolphin') ? 'beach-dolphin' : (this.textures.addCanvas('beach-dolphin', drawDolphin().toCanvas()), 'beach-dolphin');
    // Somewhere you might see them: roughly level with the player, out past the low-tide line.
    const y = Phaser.Math.Clamp(this.player.y + (Math.random() - 0.5) * 120, 2 * size, (H - 3) * size);
    const x0 = Math.min(shoreX(y) + TIDE_LOW + 16 + Math.random() * 30, W * size - 110);
    for (let i = 0; i < 3; i++) {
      const sx = x0 + i * 22;
      const sy = y + i * 6;
      const dolphin = this.add.image(sx, sy, key).setDepth(DEPTH.ground + 0.6).setAlpha(0).setAngle(-25);
      this.tweens.add({
        targets: dolphin,
        delay: i * 260,
        props: { x: sx + 40, y: { value: sy - 14, yoyo: true, ease: 'Sine.easeOut' }, angle: 25, alpha: { value: 1, yoyo: true, hold: 500 } },
        duration: 900,
        onStart: () => this.splash(sx, sy + 4),
        // Logged once you actually see one leap.
        onUpdate: () => {
          if (dolphin.alpha > 0.5 && this.cameras.main.worldView.contains(dolphin.x, dolphin.y)) this.spot('dolphin', dolphin.x, dolphin.y - 8);
        },
        onComplete: () => {
          this.splash(sx + 40, sy + 4);
          dolphin.destroy();
        },
      });
    }
  }

  private splash(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const drop = this.add.rectangle(x, y, 2, 2, 0xf4fbfd, 0.9).setDepth(DEPTH.ground + 0.65);
      this.tweens.add({ targets: drop, x: x + (Math.random() - 0.5) * 16, y: y - 4 - Math.random() * 8, alpha: 0, duration: 450, onComplete: () => drop.destroy() });
    }
  }

  private tileAt(tx: number, ty: number): Tile {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return 'water';
    return this.tiles[ty * W + tx];
  }

  /** A handful of shells and coral on the sand, the same spots all day. */
  private spawnForage(): void {
    const size = GAME_CONFIG.tileSize;
    const day = this.host.calendar().day;
    const taken = new Set(this.forage.taken(day));
    const rng = createRng(`beach-forage:${day}`);
    const count = rng.int(4, 7);
    for (let id = 0, tries = 0; id < count && tries < 200; tries++) {
      const tx = rng.int(6, SHORE - 4);
      const ty = rng.int(2, H - 3);
      if (this.tileAt(tx, ty) === 'pier' || this.decorTiles.has(`${tx},${ty}`)) continue;
      const itemId = rng.chance(0.25) ? 'coral' : 'seashell';
      if (!taken.has(id)) {
        const sprite = this.add.image(tx * size + 8, ty * size + 10, itemTextureKey(itemId)).setDepth(DEPTH.ySortBase + ty * size + 10).setScale(0.75);
        this.items.push({ id, sprite, itemId });
      }
      id++;
    }
  }

  /**
   * The beach, painted pixel by pixel so every border is a smooth curve:
   * meadow (or snow) fading into sand, rippled sand with a trail of
   * footprints, wet sand darkening toward the water, and a sea that goes from
   * turquoise shallows to deep blue with wave streaks.
   */
  /** The pier (drawn above the tide, so the sea passes underneath it). */
  private drawPier(): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const len = (PIER.x1 - PIER.x0 + 1) * size;
    const canvas = document.createElement('canvas');
    canvas.width = len;
    canvas.height = size + 3;
    const ctx = canvas.getContext('2d')!;
    for (let x = 0; x < len; x++) {
      ctx.fillStyle = ['#a8723f', '#9a6636', '#b47e48'][Math.floor(x / 4) % 3];
      ctx.fillRect(x, 1, 1, size - 2);
      if (x % 4 === 3) {
        ctx.fillStyle = '#6f4626';
        ctx.fillRect(x, 1, 1, size - 2);
      }
    }
    ctx.fillStyle = '#c9905a';
    ctx.fillRect(0, 1, len, 1);
    ctx.fillStyle = 'rgba(16,40,70,0.35)';
    ctx.fillRect(0, size - 1, len, 3);
    return canvas;
  }

  /**
   * The sea that comes and goes: everything right of the high-tide line, from
   * turquoise shallows at its edge to deep blue, with wave streaks. Moved
   * left/right with the tide over the low-tide beach.
   */
  private drawTideWater(season: Season): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const pw = W * size + (TIDE_LOW - TIDE_HIGH);
    const ph = H * size;
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(pw, ph);
    const d8 = img.data;
    const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const shallow = rgb('#5cb8c8');
    const sea = rgb('#3a83b5');
    const deep = rgb('#265f8c');
    const foam = rgb('#f4fbfd');
    const winter = season === 'winter';
    for (let y = 0; y < ph; y++) {
      const edge = shoreX(y);
      for (let x = 0; x < pw; x++) {
        const d = x - edge;
        if (d < 0) continue;
        const n = hash(x + 7, y + 3);
        let c = d < 26 ? mix(shallow, sea, d / 26) : mix(sea, deep, Math.min(1, (d - 26) / 70));
        const streak = Math.sin(x * 0.09 + y * 0.6 + Math.sin(y * 0.13) * 2);
        if (streak > 0.97 && n > 0.25) c = mix(c, foam, 0.45);
        if (d < 4 && n < 0.6) c = mix(c, foam, 0.7);
        if (winter) c = mix(c, rgb('#2a4a6a'), 0.15);
        const o = (y * pw + x) * 4;
        d8[o] = c[0];
        d8[o + 1] = c[1];
        d8[o + 2] = c[2];
        d8[o + 3] = d < 3 ? 200 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  private drawGround(season: Season): HTMLCanvasElement {
    const size = GAME_CONFIG.tileSize;
    const pw = W * size;
    const ph = H * size;
    const canvas = document.createElement('canvas');
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(pw, ph);
    const data = img.data;
    const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const winter = season === 'winter';
    const meadow = winter
      ? [rgb('#e9eff3'), rgb('#dbe4ea'), rgb('#ffffff')]
      : season === 'fall'
        ? [rgb('#8a9a46'), rgb('#7a8a3c'), rgb('#a8a85a')]
        : [rgb('#6aa84f'), rgb('#5a9a42'), rgb('#82bc5e')];
    const sand = [rgb(winter ? '#e6dcc0' : '#ecd8a4'), rgb(winter ? '#d6ccb0' : '#dcc48e'), rgb(winter ? '#f4eedc' : '#f6e6b8')];
    const wet = rgb(winter ? '#b8ac90' : '#c4a872');
    const wetDark = rgb(winter ? '#a09680' : '#ab9060');
    const shallow = rgb('#5cb8c8');
    const sea = rgb('#3a83b5');
    const deep = rgb('#265f8c');
    const foam = rgb('#f4fbfd');
    // Footprints from the meadow toward the pier.
    const prints = new Set<string>();
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      const x = Math.round(5 * size + t * (PIER.x0 * size - 5 * size));
      const y = Math.round((11.5 - t * 1.8) * size + Math.sin(i * 0.9) * 4 + (i % 2 ? 3 : -3));
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]) prints.add(`${x + dx},${y + dy}`);
    }
    for (let y = 0; y < ph; y++) {
      const mx = meadowX(y);
      const sx = shoreX(y);
      for (let x = 0; x < pw; x++) {
        const n = hash(x, y);
        let c: number[];
        const toMeadow = mx - x;
        // The ground is the low-tide beach; the sea on top of it rises and falls.
        const toShore = sx + TIDE_LOW - x;
        if (toMeadow > 0 || (toMeadow > -3 && n < 0.5 + toMeadow / 6)) {
          // Meadow, with a ragged, speckled edge into the sand.
          c = n < 0.12 ? meadow[1] : n > 0.93 ? meadow[2] : meadow[0];
          if ((x * 7 + y * 3) % 23 === 0 && !winter) c = meadow[1];
        } else if (toShore > 0) {
          // Sand: speckles and soft wind ripples; wet near the water.
          const ripple = Math.sin(x * 0.11 + Math.sin(y * 0.05) * 3 + y * 0.35);
          c = n < 0.1 ? sand[1] : n > 0.95 ? sand[2] : sand[0];
          if (ripple > 0.93 && n > 0.3) c = sand[1];
          if (toMeadow > -10 && n < 0.06) c = meadow[0];
          if (prints.has(`${x},${y}`)) c = sand[1];
          // Wet, darker sand across the strip the tide covers twice a day.
          const intertidal = sx + TIDE_LOW - x < TIDE_LOW - TIDE_HIGH + 10;
          if (intertidal || toShore < 22) {
            const t = intertidal ? Math.max(0.55, 1 - toShore / (TIDE_LOW - TIDE_HIGH + 10)) : 1 - toShore / 22;
            c = mix(c, t > 0.75 ? wetDark : wet, Math.min(1, t * 1.2));
            if (n > 0.985) c = foam;
          }
          if (toShore < 2) c = foam;
        } else {
          // Sea: turquoise shallows, blue, then deep water, with wave streaks.
          const d = -toShore;
          c = d < 26 ? mix(shallow, sea, d / 26) : mix(sea, deep, Math.min(1, (d - 26) / 70));
          const streak = Math.sin(x * 0.09 + y * 0.6 + Math.sin(y * 0.13) * 2);
          if (streak > 0.97 && n > 0.25) c = mix(c, foam, 0.45);
          if (d < 4 && n < 0.6) c = mix(c, foam, 0.7);
          if (winter) c = mix(c, rgb('#2a4a6a'), 0.15);
        }
        const o = (y * pw + x) * 4;
        data[o] = c[0];
        data[o + 1] = c[1];
        data[o + 2] = c[2];
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // Rock pools: a ring of dark rock round a little pool of clear water, uncovered at low tide.
    for (const row of POOL_ROWS) {
      const cy = row * size;
      const cx = shoreX(cy) + 20;
      for (let y = -8; y <= 8; y++) {
        for (let x = -14; x <= 14; x++) {
          const r = (x / 13) ** 2 + (y / 7) ** 2 + (hash(x + 99, y + Math.round(cy)) - 0.5) * 0.25;
          if (r > 1) continue;
          ctx.fillStyle = r > 0.62 ? (hash(x, y) > 0.5 ? '#6a7179' : '#4f6a5a') : r > 0.45 ? '#3e8a96' : '#5cb8c8';
          ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
        }
      }
      ctx.fillStyle = '#bcc2c7';
      ctx.fillRect(Math.round(cx - 9), Math.round(cy - 6), 4, 1);
      ctx.fillStyle = '#f4fbfd';
      ctx.fillRect(Math.round(cx - 2), Math.round(cy - 1), 3, 1);
    }
    return canvas;
  }
}
