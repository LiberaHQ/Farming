import * as Phaser from 'phaser';
import { CARNIVAL_BARKER, CARNIVAL_GAMES, CARNIVAL_RIDES, GAME_CONFIG, type CarnivalGameId } from '@farming/shared';
import {
  CARNIVAL_COLORS as C,
  drawArch,
  drawBooth,
  drawCarnivalGround,
  drawCarousel,
  drawCarouselHorse,
  drawFerrisFrame,
  drawFerrisWheel,
  drawFortuneDisk,
  drawFortuneStand,
  drawGondola,
  drawLightPole,
  drawPrizeShelf,
  drawStriker,
  drawTent,
  drawTreatCart,
} from '../assets/carnival';
import type { PixelCanvas } from '../assets/PixelCanvas';
import { addCharacterSheet, furnitureTextureKey, objectTextureKey, placeableTextureKey, TEXTURES } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

/** What the carnival needs from the world scene (tokens, panels, the daily spin). */
export interface CarnivalHost {
  /** Pay for a game and open it. */
  play(game: CarnivalGameId): void;
  /** Open the ticket booth, prize booth or treat cart. */
  open(view: 'tokens' | 'prizes' | 'treats'): void;
  /** Today's free spin (false if already used). */
  canSpin(): boolean;
  spin(): void;
  /** Pay a token for a ride; false if you have none. */
  ride(kind: keyof typeof CARNIVAL_RIDES): boolean;
}

export interface CarnivalSceneData {
  host: AreaHost;
  carnival: CarnivalHost;
}

const W = 36;
const H = 27;
const T = GAME_CONFIG.tileSize;

type Spot =
  | { kind: 'game'; game: CarnivalGameId }
  | { kind: 'tokens' | 'prizes' | 'treats' | 'wheel' | 'barker' | 'exit' }
  | { kind: 'ride'; ride: keyof typeof CARNIVAL_RIDES };


const BARKER_LINES = [
  'Step right up, step right up! Tokens are 25 gold apiece, and every game pays out in prize tickets!',
  "Ring the bell on the High Striker and the whole valley hears it. Not many manage it, mind.",
  "The Wheel of Fortune spins free once a day. Some folk have hit the jackpot on their first go!",
  'Save your tickets for the grand prize: the Carnival Trophy. Shines like the sun on a mantelpiece.',
  "The Ferris wheel's the best view in the valley. You can see your farm from the top.",
  'Whack-a-Slime? Golden slimes are worth three. Keep your eyes peeled!',
];

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * The carnival south of the market: game tents, the High Striker, the Wheel of
 * Fortune, a Ferris wheel and a carousel, a ticket booth for tokens and a
 * prize booth for tickets. Games run in the carnival panel (React); this scene
 * is the place you walk around.
 */
export class CarnivalScene extends AreaScene<CarnivalSceneData> {
  private carnival!: CarnivalHost;
  private spots = new Map<string, Spot>();
  private solid: boolean[] = [];
  private wheel!: Phaser.GameObjects.Image;
  private gondolas: Phaser.GameObjects.Image[] = [];
  private hub = { x: 0, y: 0 };
  private disk!: Phaser.GameObjects.Image;
  private horses: Array<{ sprite: Phaser.GameObjects.Image; phase: number }> = [];
  private carouselCentre = { x: 0, y: 0 };
  private bulbs: Array<{ dot: Phaser.GameObjects.Rectangle; phase: number }> = [];
  private barker!: Phaser.GameObjects.Sprite;
  private lineIndex = 0;
  private elapsed = 0;

  constructor() {
    super(SCENES.Carnival);
  }

  init(data: CarnivalSceneData): void {
    super.init(data);
    this.carnival = data.carnival;
    this.spots.clear();
    this.gondolas = [];
    this.horses = [];
    this.bulbs = [];
    this.elapsed = 0;
  }

  create(): void {
    this.solid = Array(W * H).fill(false);
    const plaza = (tx: number, ty: number) => (ty >= 9 && ty <= 23 && tx >= 2 && tx <= 33) || (tx >= 16 && tx <= 20 && ty >= 23);
    const rng = createRng('carnival-ground');
    this.texture('carnival-ground', () => drawCarnivalGround(W, H, T, plaza, () => rng.next()));
    this.add.image(0, 0, 'carnival-ground').setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#2d5a2a');

    // Trees along the back and sides.
    const season = this.host.calendar().season;
    const trees = createRng('carnival-trees');
    for (let tx = 0; tx < W; tx += 2) this.tree(tx + trees.int(0, 1), trees.int(0, 1), trees.chance(0.5) ? 'pine' : 'oak', season);
    for (let ty = 3; ty < H - 2; ty += 3) {
      this.tree(0, ty, 'pine', season);
      this.tree(W - 1, ty, 'pine', season);
    }

    this.buildRides();
    this.buildGames();
    this.buildBooths();
    this.buildDecor();

    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(W, H, (tx, ty) => this.isSolid(tx, ty));
    this.walls.add(this.add.zone((W * T) / 2, -4, W * T, 8));
    this.walls.add(this.add.zone(-4, (H * T) / 2, 8, H * T));
    this.walls.add(this.add.zone(W * T + 4, (H * T) / 2, 8, H * T));

    this.setupArea(W, H, { x: 18 * T + 8, y: 24 * T + 12, facing: 'up' });
    gameEvents.emit('area:label', { label: '🎡 The Carnival' });
    sfx('quest', { volume: 0.4 });
  }

  // ---------- Building the grounds ----------

  private texture(key: string, draw: () => PixelCanvas | HTMLCanvasElement): string {
    if (!this.textures.exists(key)) {
      const art = draw();
      this.textures.addCanvas(key, art instanceof HTMLCanvasElement ? art : art.toCanvas());
    }
    return key;
  }

  /** A sprite standing on the ground: centred on x, feet on baseY, y-sorted. */
  private stand(key: string, x: number, baseY: number): Phaser.GameObjects.Image {
    return this.add.image(x, baseY, key).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + baseY);
  }

  private block(tx0: number, tx1: number, ty0: number, ty1: number, spot?: Spot): void {
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        this.solid[ty * W + tx] = true;
        if (spot) this.spots.set(`${tx},${ty}`, spot);
      }
    }
  }

  private tree(tx: number, ty: number, kind: 'oak' | 'pine', season: Parameters<typeof objectTextureKey>[2]): void {
    if (tx < 0 || tx >= W) return;
    const baseY = ty * T + T - 2;
    this.add.image(tx * T + T / 2, baseY, objectTextureKey(kind, 0, season)).setOrigin(0.5, kind === 'oak' ? 41 / 44 : 44 / 46).setDepth(DEPTH.ySortBase + baseY);
    this.solid[ty * W + tx] = true;
  }

  /** A sign over a booth. */
  private sign(text: string, x: number, y: number, depth: number, color = '#f4d24a'): void {
    this.add
      .text(x, y, text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '7px', fontStyle: 'bold', color, stroke: '#2b1d1a', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(8)
      .setDepth(depth);
  }

  private buildRides(): void {
    // Ferris wheel (top left).
    const fx = 7 * T;
    const fBase = 9 * T;
    this.stand(this.texture('carnival-ferris-frame', drawFerrisFrame), fx, fBase);
    this.hub = { x: fx, y: fBase - 92 + 38 };
    this.wheel = this.add.image(this.hub.x, this.hub.y, this.texture('carnival-ferris-wheel', drawFerrisWheel)).setDepth(DEPTH.ySortBase + fBase - 1);
    const cars: Array<[string, string]> = [
      [C.red, C.redLight],
      [C.blue, C.blueLight],
      [C.gold, '#fff0a8'],
      [C.green, C.greenLight],
      [C.purple, C.purpleLight],
      [C.pink, '#ffb0c8'],
      ['#e8812f', '#f6a95c'],
      [C.teal, '#6ad0c0'],
    ];
    cars.forEach(([c, l], i) => {
      this.gondolas.push(this.add.image(0, 0, this.texture(`carnival-gondola-${i}`, () => drawGondola(c, l))).setOrigin(0.5, 0).setDepth(DEPTH.ySortBase + fBase));
    });
    this.block(5, 9, 7, 8, { kind: 'ride', ride: 'ferris' });
    this.sign('FERRIS WHEEL', fx, fBase + 9, DEPTH.ySortBase + fBase + 9);

    // Carousel (top right).
    const cx = 29 * T;
    const cBase = 9 * T;
    this.stand(this.texture('carnival-carousel', drawCarousel), cx, cBase);
    this.carouselCentre = { x: cx, y: cBase - 14 };
    const horseColors: Array<[string, string]> = [
      [C.cream, C.gold],
      ['#8a5a32', '#2b1d1a'],
      [C.cream, C.pink],
      ['#c8ccd2', C.blue],
    ];
    horseColors.forEach(([b, m], i) => {
      this.horses.push({ sprite: this.add.image(0, 0, this.texture(`carnival-horse-${i}`, () => drawCarouselHorse(b, m))).setOrigin(0.5, 1), phase: (i / 4) * Math.PI * 2 });
    });
    this.block(27, 31, 6, 8, { kind: 'ride', ride: 'carousel' });
    this.sign('CAROUSEL', cx, cBase + 9, DEPTH.ySortBase + cBase + 9);
  }

  private buildGames(): void {
    const tents: Array<[CarnivalGameId, number, string, string]> = [
      ['ring_toss', 5, C.red, C.redLight],
      ['whack', 11, C.green, C.greenLight],
      ['ducks', 25, C.blue, C.blueLight],
      ['memory', 31, C.purple, C.purpleLight],
    ];
    const shelf = this.texture('carnival-prize-shelf', drawPrizeShelf);
    for (const [game, tx, stripe, light] of tents) {
      const x = tx * T + T / 2;
      const base = 15 * T;
      this.stand(this.texture(`carnival-tent-${game}`, () => drawTent(stripe, light)), x, base);
      this.add.image(x, base - 18, shelf).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + base + 0.5);
      this.block(tx - 1, tx + 1, 13, 14, { kind: 'game', game });
      const def = CARNIVAL_GAMES[game];
      this.sign(`${def.name.toUpperCase()}`, x, base - 46, DEPTH.ySortBase + base + 1);
    }

    // High Striker, between the Ferris wheel and the centre.
    const sx = 14 * T + T / 2;
    const sBase = 9 * T;
    this.stand(this.texture('carnival-striker', drawStriker), sx, sBase);
    this.block(14, 14, 8, 8, { kind: 'game', game: 'strength' });
    this.sign('HIGH STRIKER', sx, sBase + 9, DEPTH.ySortBase + sBase + 9);

    // Wheel of Fortune in the middle of the plaza.
    const wx = 18 * T + T / 2;
    const wBase = 14 * T;
    this.stand(this.texture('carnival-fortune-stand', drawFortuneStand), wx, wBase);
    this.disk = this.add.image(wx, wBase - 58 + 22, this.texture('carnival-fortune-disk', drawFortuneDisk)).setDepth(DEPTH.ySortBase + wBase + 0.5);
    this.add.image(wx, wBase - 58, this.texture('carnival-fortune-stand', drawFortuneStand)).setOrigin(0.5, 0).setCrop(18, 0, 8, 6).setDepth(DEPTH.ySortBase + wBase + 1);
    this.block(17, 19, 13, 13, { kind: 'wheel' });
    this.sign('WHEEL OF FORTUNE', wx, wBase - 60, DEPTH.ySortBase + wBase + 1);
  }

  private buildBooths(): void {
    // Ticket booth with the barker beside it.
    const tx = 13 * T;
    const base = 22 * T;
    this.stand(this.texture('carnival-booth-tokens', () => drawBooth(C.red, C.redLight)), tx, base);
    this.block(12, 13, 21, 21, { kind: 'tokens' });
    this.sign('TOKENS', tx, base - 41, DEPTH.ySortBase + base + 1);
    if (!this.textures.exists('carnival-barker')) addCharacterSheet(this, 'carnival-barker', CARNIVAL_BARKER.look);
    this.barker = this.add.sprite(15 * T + 8, base - 2, 'carnival-barker', 0).setOrigin(0.5, 1);
    this.barker.setDepth(DEPTH.ySortBase + this.barker.y);
    this.block(15, 15, 21, 21, { kind: 'barker' });

    // Prize booth, balloons on either side.
    const px = 23 * T;
    this.stand(this.texture('carnival-booth-prizes', () => drawBooth(C.purple, C.purpleLight)), px, base);
    this.block(22, 23, 21, 21, { kind: 'prizes' });
    this.sign('PRIZES', px, base - 41, DEPTH.ySortBase + base + 1);
    for (const dx of [-24, 24]) this.stand(furnitureTextureKey('balloons'), px + dx, base - 2);
    this.add.image(px - 2, base - 15, furnitureTextureKey('plush_bear')).setOrigin(0.5, 1).setScale(0.75).setDepth(DEPTH.ySortBase + base + 1);
    this.add.image(px + 7, base - 15, furnitureTextureKey('carnival_trophy')).setOrigin(0.5, 1).setScale(0.6).setDepth(DEPTH.ySortBase + base + 1);

    // Treat cart.
    const cx = 7 * T + T / 2;
    const cBase = 20 * T;
    this.stand(this.texture('carnival-treat-cart', drawTreatCart), cx, cBase);
    this.block(6, 8, 19, 19, { kind: 'treats' });
    this.sign('TREATS', cx, cBase - 38, DEPTH.ySortBase + cBase + 1);

    // The arch over the way back to the valley.
    const ax = 18 * T + T / 2;
    const aBase = 25 * T;
    this.stand(this.texture('carnival-arch', drawArch), ax, aBase);
    this.sign('CARNIVAL', ax, aBase - 36, DEPTH.ySortBase + aBase + 1, '#fff1a8');
    this.block(16, 16, 24, 24);
    this.block(20, 20, 24, 24);
    for (let tx2 = 0; tx2 < W; tx2++) if (tx2 < 16 || tx2 > 20) this.solid[(H - 1) * W + tx2] = true;
  }

  private buildDecor(): void {
    const poles: Array<[number, number]> = [
      [3, 11],
      [33, 11],
      [3, 23],
      [33, 23],
      [10, 18],
      [26, 18],
    ];
    const pole = this.texture('carnival-pole', drawLightPole);
    for (const [tx, ty] of poles) {
      this.stand(pole, tx * T + 8, ty * T + 14);
      this.solid[ty * W + tx] = true;
    }
    // Strings of lights between the poles.
    const strands: Array<[number, number]> = [
      [0, 4],
      [4, 5],
      [5, 1],
      [2, 4],
      [5, 3],
    ];
    const colors = [0xf4d24a, 0xd2404c, 0x58a4d2, 0x5aac46, 0xea7194];
    const g = this.add.graphics().setDepth(DEPTH.ySortBase + 23 * T + 30);
    g.lineStyle(1, 0x2b1d1a, 0.8);
    for (const [a, b] of strands) {
      const [ax, ay] = [poles[a][0] * T + 8, poles[a][1] * T - 18];
      const [bx, by] = [poles[b][0] * T + 8, poles[b][1] * T - 18];
      const sag = 14;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        pts.push(new Phaser.Math.Vector2(ax + (bx - ax) * t, ay + (by - ay) * t + Math.sin(t * Math.PI) * sag));
      }
      g.strokePoints(pts);
      for (let i = 1; i < 20; i += 2) {
        const dot = this.add.rectangle(pts[i].x, pts[i].y + 1, 2, 2, colors[(i + a) % colors.length]).setDepth(g.depth + 1);
        this.bulbs.push({ dot, phase: i * 0.7 + a });
      }
    }
    // Benches and a few flower pots.
    for (const [tx, ty] of [
      [28, 20],
      [9, 22],
      [26, 22],
    ] as const) {
      this.stand(placeableTextureKey('bench'), tx * T + 8, ty * T + 14);
      this.solid[ty * W + tx] = true;
    }
    for (const [tx, ty] of [
      [2, 16],
      [33, 16],
    ] as const) {
      this.stand(placeableTextureKey('flower_pot'), tx * T + 8, ty * T + 14);
      this.solid[ty * W + tx] = true;
    }
  }

  // ---------- Every frame ----------

  protected tick(delta: number): void {
    this.elapsed += delta;
    // Walk out under the arch to go home.
    if (!this.leaving && this.player.y > (H - 1) * T + 6) this.leave();

    // The Ferris wheel turns, its gondolas hanging straight down.
    const a = this.elapsed * 0.00025;
    this.wheel.setRotation(a);
    this.gondolas.forEach((g, i) => {
      const ang = a + (i / this.gondolas.length) * Math.PI * 2;
      g.setPosition(Math.round(this.hub.x + Math.cos(ang) * 32), Math.round(this.hub.y + Math.sin(ang) * 32));
    });
    // The fortune wheel idles round.
    this.disk.setRotation(this.elapsed * 0.0004);
    // Carousel horses go round and bob.
    for (const h of this.horses) {
      const t = this.elapsed * 0.0012 + h.phase;
      const front = Math.sin(t);
      h.sprite.setPosition(Math.round(this.carouselCentre.x + Math.cos(t) * 22), Math.round(this.carouselCentre.y + front * 3 + Math.sin(t * 3) * 2));
      h.sprite.setFlipX(Math.sin(t) < 0);
      h.sprite.setDepth(DEPTH.ySortBase + 9 * T + (front > 0 ? 1 : -1));
      h.sprite.setAlpha(front > -0.6 ? 1 : 0.6);
    }
    // Twinkling lights.
    for (const b of this.bulbs) b.dot.setAlpha(0.55 + 0.45 * Math.max(0, Math.sin(this.elapsed * 0.004 + b.phase)));
    // The barker turns to face you when you're close.
    const dx = this.player.x - this.barker.x;
    const dy = this.player.y - this.barker.y;
    const near = Math.hypot(dx, dy) < 48;
    const frame = !near ? 0 : Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 3 : 6) : dy < 0 ? 9 : 0;
    if (this.barker.frame.name !== String(frame)) this.barker.setFrame(frame);
  }

  // ---------- Actions ----------

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    void mode;
    const feet = this.player.tile;
    if (feet.ty >= H - 2 && feet.tx >= 16 && feet.tx <= 20) return { verb: 'Back to the valley', key: 'E', run: () => this.leave() };
    const { tx, ty } = this.target();
    const spot = this.spots.get(`${tx},${ty}`);
    if (!spot) return null;
    switch (spot.kind) {
      case 'game': {
        const def = CARNIVAL_GAMES[spot.game];
        return { verb: `Play ${def.name} (${def.cost} token${def.cost > 1 ? 's' : ''})`, key: 'E', run: () => this.carnival.play(spot.game) };
      }
      case 'wheel':
        return this.carnival.canSpin()
          ? { verb: 'Spin the Wheel of Fortune (free today)', key: 'E', run: () => this.carnival.spin() }
          : { verb: 'Free spin used — back tomorrow', key: 'E', info: true, run: () => toast('The Wheel of Fortune gives one free spin a day. Come back tomorrow!') };
      case 'tokens':
        return { verb: 'Buy tokens', key: 'E', run: () => this.carnival.open('tokens') };
      case 'prizes':
        return { verb: 'Trade prize tickets', key: 'E', run: () => this.carnival.open('prizes') };
      case 'treats':
        return { verb: 'Buy a treat', key: 'E', run: () => this.carnival.open('treats') };
      case 'barker':
        return {
          verb: 'Talk to Pip the barker',
          key: 'E',
          run: () => {
            const line = BARKER_LINES[this.lineIndex++ % BARKER_LINES.length];
            if (this.host.say) this.host.say('Pip the Barker', line);
            else toast(line);
          },
        };
      case 'ride': {
        const ride = CARNIVAL_RIDES[spot.ride];
        return {
          verb: `Ride the ${ride.name} (1 token)`,
          key: 'E',
          run: () => {
            if (!this.carnival.ride(spot.ride)) return;
            sfx('sparkle', { volume: 0.8 });
            this.cameras.main.flash(500, 255, 244, 214);
          },
        };
      }
      default:
        return null;
    }
  }

  private isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return this.solid[ty * W + tx];
  }
}
