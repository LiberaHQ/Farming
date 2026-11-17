import * as Phaser from 'phaser';
import {
  CARNIVAL_GAMES,
  CARNIVAL_RIDES,
  CARNIVAL_STAFF,
  CARNIVAL_VISITOR_LOOKS,
  FIREWORKS_FROM,
  GAME_CONFIG,
  GOLDEN_HOUR,
  isGoldenHour,
  NPCS,
  VISITOR_CALLS,
  type CarnivalGameId,
  type CarnivalStaffId,
  type NpcId,
} from '@farming/shared';
import {
  CARNIVAL_COLORS as C,
  drawArch,
  drawBooth,
  drawCardBoard,
  drawCrystalBall,
  drawHandBalloon,
  drawStage,
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
import { addCharacterSheet, furnitureTextureKey, npcTextureKey, objectTextureKey, placeableTextureKey } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';
import { CarnivalPeople, type Person } from './carnival/CarnivalPeople';

/** What the carnival needs from the world scene (tokens, panels, the daily spin). */
export interface CarnivalHost {
  /** Pay for a game and open it. */
  play(game: CarnivalGameId): void;
  /** Open the ticket booth, prize booth or treat cart. */
  open(view: 'tokens' | 'prizes' | 'treats' | 'card'): void;
  /** Today's free spin (false if already used). */
  canSpin(): boolean;
  spin(): void;
  /** Pay a token for a ride; false if you have none. */
  ride(kind: keyof typeof CARNIVAL_RIDES): boolean;
  /** Called with the tickets won after each game (the crowd cheers). */
  onCheer(cb: ((tickets: number) => void) | null): void;
  /** Madame Zara's free daily fortune. */
  canFortune(): boolean;
  fortune(): void;
  /** Tip the juggler once a day for luck. */
  canTip(): boolean;
  tip(): boolean;
  /** Chat with a villager enjoying the carnival (counts as today's talk). */
  talkVillager(id: NpcId, line: string): void;
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
  | { kind: 'tokens' | 'prizes' | 'treats' | 'wheel' | 'exit' | 'fortune' | 'stage' | 'card' }
  | { kind: 'ride'; ride: keyof typeof CARNIVAL_RIDES };


/** What villagers say when you meet them at the carnival. */
const VILLAGER_LINES: Record<string, string[]> = {
  mira: ['I won a jar of jam at the Ring Toss. Me! Winning jam!', "Don't tell anyone, but I ride the carousel twice every visit."],
  rosa: ['The cotton candy here is nearly as good as my bread. Nearly.', 'I come for the lights. The whole valley glows from up on the Ferris wheel.'],
  bram: ['Rang that High Striker bell on my first swing. Hurt my shoulder. Worth it.', 'Brutus says nobody beats my record. We will see about that.'],
  finn: ["Duck Shoot isn't fishing, but I'll take it.", 'Dot gave away a golden carp once. A golden carp! At a carnival!'],
  willa: ['Whoever built that Ferris wheel knew their joinery. Lovely work.', "I'm saving my tickets for the trophy. Fifty-two so far."],
  tobin: ['Best night of the week, this. Have you tried the Wheel of Fortune?', 'Madame Zara told me I would find something lost. Found my hat the next day!'],
};

const VISITOR_TALK = [
  "Golden hour's from six — every ticket counts double!",
  "Madame Zara's fortunes really work, you know.",
  "Have you seen today's challenge on the board by the arch?",
  'I saw someone ring the High Striker bell once. Once!',
  'Play all five games in a day and you get bonus tickets.',
  'Jojo dropped a ball earlier. Nobody said anything.',
  'Stay for the fireworks after dark!',
  'Golden slimes are worth three in Whack-a-Slime.',
];

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * The carnival out along the main path: game tents, the High Striker, the Wheel of
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
  private people!: CarnivalPeople;
  private staffAt = new Map<CarnivalStaffId, Person>();
  private balls: Phaser.GameObjects.Arc[] = [];
  private jojo = { x: 0, y: 0 };
  private night!: Phaser.GameObjects.Graphics;
  private nightAlpha = -1;
  private fireworkIn = 0;
  private labelSig = '';
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
    this.balls = [];
    this.staffAt.clear();
    this.elapsed = 0;
    this.labelSig = '';
    this.nightAlpha = -1;
    this.fireworkIn = 1500;
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

    this.people = new CarnivalPeople(this, (tx, ty) => this.isSolid(tx, ty), this.attractions());
    this.buildRides();
    this.buildGames();
    this.buildBooths();
    this.buildDecor();
    this.buildShows();
    this.spawnVisitors();

    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(W, H, (tx, ty) => this.isSolid(tx, ty));
    this.walls.add(this.add.zone((W * T) / 2, -4, W * T, 8));
    this.walls.add(this.add.zone(-4, (H * T) / 2, 8, H * T));
    this.walls.add(this.add.zone(W * T + 4, (H * T) / 2, 8, H * T));

    this.setupArea(W, H, { x: 18 * T + 8, y: 24 * T + 12, facing: 'up' });
    // Dusk falls over the grounds; the lights and fireworks shine through.
    this.night = this.add.graphics().setDepth(DEPTH.lighting);
    // Rain or snow over the fairground (its own dusk overlay stays as the night sky).
    this.setupAtmosphere({ night: false });
    this.spawnFireflies();
    this.updateLabel();
    this.carnival.onCheer((tickets) => this.people.cheer({ x: this.player.x, y: this.player.y }, tickets));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.carnival.onCheer(null));
    sfx('quest', { volume: 0.4 });
  }

  /** Where visitors like to stand and look. */
  private attractions(): Array<{ x: number; y: number }> {
    const pts: Array<[number, number]> = [
      [5.5, 16.2],
      [11.5, 16.2],
      [25.5, 16.2],
      [31.5, 16.2],
      [18.5, 15.2],
      [7.5, 10.4],
      [29.5, 10.4],
      [14.5, 10.4],
      [21.5, 10.4],
      [7.5, 21.2],
      [26.5, 20.2],
      [27.5, 20.4],
      [13, 23.2],
      [23, 23.2],
      [18.5, 19],
      [10, 13],
      [20, 17],
      [16, 21],
    ];
    return pts.map(([x, y]) => ({ x: x * T, y: y * T }));
  }

  /** Staff who stand in one place; textures generated from their looks. */
  private staff(id: CarnivalStaffId, x: number, y: number, opts: { facing?: 'down' | 'left' | 'right' | 'up'; inside?: boolean; depth?: number } = {}): Person {
    const key = `carnival-staff-${id}`;
    if (!this.textures.exists(key)) addCharacterSheet(this, key, CARNIVAL_STAFF[id].look);
    const p = this.people.addStaff(CARNIVAL_STAFF[id], key, x, y, opts);
    this.staffAt.set(id, p);
    return p;
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
      // The host stands behind the counter (the counter is drawn again in front of them).
      const host = ({ ring_toss: 'host_ring', whack: 'host_whack', ducks: 'host_ducks', memory: 'host_memory' } as const)[game as 'ring_toss'];
      this.staff(host, x + 9, base - 6, { inside: true, depth: DEPTH.ySortBase + base + 0.6 });
      this.add
        .image(x, base, `carnival-tent-${game}`)
        .setOrigin(0.5, 1)
        .setCrop(0, 33, 48, 13)
        .setDepth(DEPTH.ySortBase + base + 0.7);
      this.block(tx - 1, tx + 1, 13, 14, { kind: 'game', game });
      const def = CARNIVAL_GAMES[game];
      this.sign(`${def.name.toUpperCase()}`, x, base - 46, DEPTH.ySortBase + base + 1);
    }

    // High Striker, between the Ferris wheel and the centre.
    const sx = 14 * T + T / 2;
    const sBase = 9 * T;
    this.stand(this.texture('carnival-striker', drawStriker), sx, sBase);
    this.block(14, 14, 8, 8, { kind: 'game', game: 'strength' });
    this.staff('host_strength', 13 * T + 6, sBase - 2, { facing: 'right' });
    this.block(13, 13, 8, 8);
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
    this.staff('pip', 15 * T + 8, base - 2);
    this.block(15, 15, 21, 21);

    // Prize booth, balloons on either side.
    const px = 23 * T;
    this.stand(this.texture('carnival-booth-prizes', () => drawBooth(C.purple, C.purpleLight)), px, base);
    this.block(22, 23, 21, 21, { kind: 'prizes' });
    this.sign('PRIZES', px, base - 41, DEPTH.ySortBase + base + 1);
    for (const dx of [-24, 24]) this.stand(furnitureTextureKey('balloons'), px + dx, base - 2);
    this.add.image(px - 2, base - 15, furnitureTextureKey('plush_bear')).setOrigin(0.5, 1).setScale(0.75).setDepth(DEPTH.ySortBase + base + 1);
    this.add.image(px + 7, base - 15, furnitureTextureKey('carnival_trophy')).setOrigin(0.5, 1).setScale(0.6).setDepth(DEPTH.ySortBase + base + 1);
    this.staff('dot', 26 * T + 8, base - 2, { facing: 'left' });
    this.block(26, 26, 21, 21);

    // Treat cart.
    const cx = 7 * T + T / 2;
    const cBase = 20 * T;
    this.stand(this.texture('carnival-treat-cart', drawTreatCart), cx, cBase);
    this.block(6, 8, 19, 19, { kind: 'treats' });
    this.staff('gus', 9 * T + 8, cBase - 2, { facing: 'left' });
    this.block(9, 9, 19, 19);
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
      [30, 19],
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
        const dot = this.add.rectangle(pts[i].x, pts[i].y + 1, 2, 2, colors[(i + a) % colors.length]).setDepth(DEPTH.lighting + 1);
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

  /** Madame Zara's tent, Jojo's stage and the carnival-card board. */
  private buildShows(): void {
    // Fortune teller's tent, between the High Striker and the carousel.
    const fx = 21 * T + 8;
    const fBase = 9 * T;
    const tent = this.texture('carnival-tent-fortune', () => drawTent('#3a2a6a', '#5a4a90'));
    this.stand(tent, fx, fBase);
    this.staff('zara', fx - 8, fBase - 6, { inside: true, depth: DEPTH.ySortBase + fBase + 0.6 });
    this.add.image(fx, fBase, tent).setOrigin(0.5, 1).setCrop(0, 33, 48, 13).setDepth(DEPTH.ySortBase + fBase + 0.7);
    this.add.image(fx + 8, fBase - 11, this.texture('carnival-crystal', drawCrystalBall)).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + fBase + 0.8);
    this.block(20, 22, 7, 8, { kind: 'fortune' });
    this.sign('FORTUNES', fx, fBase - 46, DEPTH.ySortBase + fBase + 1, '#d7a8ff');

    // Jojo's stage, east of the plaza.
    const sx = 27 * T;
    const sBase = 19 * T;
    this.stand(this.texture('carnival-stage', drawStage), sx, sBase);
    this.staff('jojo', sx, sBase - 9, { depth: DEPTH.ySortBase + sBase + 0.5 });
    this.jojo = { x: sx, y: sBase - 9 };
    const colors = [0xd2404c, 0xf4d24a, 0x58a4d2];
    this.balls = colors.map((c) => this.add.circle(sx, sBase - 30, 1.6, c).setStrokeStyle(0.6, 0x2b1d1a).setDepth(DEPTH.ySortBase + sBase + 1));
    this.block(25, 28, 17, 18, { kind: 'stage' });
    this.sign("JOJO'S SHOW", sx, sBase - 40, DEPTH.ySortBase + sBase + 1, '#fff1a8');

    // The carnival card board by the arch.
    const bx = 21 * T + 8;
    const bBase = 24 * T;
    this.stand(this.texture('carnival-card-board', drawCardBoard), bx, bBase);
    this.block(21, 21, 23, 23, { kind: 'card' });
    this.sign('TODAY', bx, bBase - 30, DEPTH.ySortBase + bBase + 1);
  }

  /** Visitors stroll about; in the evening a couple of villagers come too. */
  private spawnVisitors(): void {
    const { day, minute } = this.host.calendar();
    const rng = createRng(`carnival-visitors:${day}`);
    const evening = minute >= 16 * 60;
    const count = evening ? 9 : 6;
    const balloons: Array<[string, string]> = [
      [C.red, C.redLight],
      [C.blue, C.blueLight],
      [C.gold, '#fff1a8'],
      [C.pink, '#ffb0c8'],
    ];
    const plazaSpot = () => {
      for (let i = 0; i < 40; i++) {
        const tx = rng.int(3, 32);
        const ty = rng.int(10, 22);
        if (!this.isSolid(tx, ty)) return { x: tx * T + 8, y: ty * T + 12 };
      }
      return { x: 18 * T + 8, y: 18 * T + 12 };
    };
    for (let i = 0; i < count; i++) {
      const look = CARNIVAL_VISITOR_LOOKS[(i + day) % CARNIVAL_VISITOR_LOOKS.length];
      const key = `carnival-visitor-${(i + day) % CARNIVAL_VISITOR_LOOKS.length}`;
      if (!this.textures.exists(key)) addCharacterSheet(this, key, look);
      const at = plazaSpot();
      const b = rng.chance(0.45) ? balloons[rng.int(0, balloons.length - 1)] : null;
      const balloon = b ? this.texture(`carnival-hand-balloon-${b[0]}`, () => drawHandBalloon(b[0], b[1])) : undefined;
      this.people.addVisitor(key, 'Visitor', at.x, at.y, { balloon, calls: VISITOR_CALLS });
    }
    if (evening && minute < 24 * 60) {
      const ids = Object.keys(NPCS) as NpcId[];
      for (const id of [ids[day % ids.length], ids[(day + 3) % ids.length]]) {
        const at = plazaSpot();
        this.people.addVisitor(npcTextureKey(id), NPCS[id].name, at.x, at.y, { villager: id, calls: ['What fun!', 'Over here!', 'Lovely evening!'] });
      }
    }
  }

  /** After dark (and when it isn't raining or snowing), fireflies drift around the fairground. */
  private fireflies: Array<{ dot: Phaser.GameObjects.Arc; halo: Phaser.GameObjects.Arc; x: number; y: number; phase: number }> = [];
  private spawnFireflies(): void {
    this.fireflies = [];
    const { minute, weather } = this.host.calendar();
    if (minute < 20 * 60 || weather === 'rain' || weather === 'snow') return;
    for (let i = 0; i < 26; i++) {
      const x = Phaser.Math.Between(2 * T, (W - 2) * T);
      const y = Phaser.Math.Between(9 * T, (H - 2) * T);
      const halo = this.add.circle(x, y, 6, 0xd8ff7a, 0.22).setDepth(DEPTH.lighting + 2).setBlendMode(Phaser.BlendModes.ADD);
      const dot = this.add.circle(x, y, 2, 0xf4ffb0, 1).setDepth(DEPTH.lighting + 3).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: [dot, halo], alpha: 0.08, duration: 700 + Math.random() * 900, yoyo: true, repeat: -1, delay: Math.random() * 1500 });
      this.fireflies.push({ dot, halo, x, y, phase: Math.random() * Math.PI * 2 });
    }
  }

  private updateLabel(): void {
    const { minute } = this.host.calendar();
    const golden = isGoldenHour(minute);
    const sig = String(golden);
    if (sig === this.labelSig) return;
    this.labelSig = sig;
    gameEvents.emit('area:label', { label: golden ? '🎡 The Carnival · ✨ Golden hour: tickets ×2' : '🎡 The Carnival' });
    if (golden && minute < GOLDEN_HOUR.from + 30) {
      const pip = this.staffAt.get('pip');
      if (pip) this.people.say(pip, "It's golden hour! Double tickets!", 3500);
    }
  }

  private firework(): void {
    // Somewhere in the sky above whatever you're looking at.
    const view = this.cameras.main.worldView;
    const x = Phaser.Math.Between(Math.round(view.x + 30), Math.round(view.right - 30));
    const y = Phaser.Math.Between(Math.round(view.y + 18), Math.round(view.y + Math.min(110, view.height * 0.4)));
    const colors = [0xf4d24a, 0xd2404c, 0x58a4d2, 0x84c95a, 0xea7194, 0xd7a8ff];
    const color = colors[Phaser.Math.Between(0, colors.length - 1)];
    // A rocket trail up, then the burst.
    const rocket = this.add.rectangle(x, y + 70, 1, 3, 0xfff1a8).setDepth(DEPTH.lighting + 2);
    this.tweens.add({
      targets: rocket,
      y,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        rocket.destroy();
        const n = 22;
        const flash = this.add.circle(x, y, 6, 0xffffff, 0.8).setDepth(DEPTH.lighting + 2);
        this.tweens.add({ targets: flash, scale: 2.5, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const r = 22 + Math.random() * 14;
          const spark = this.add.rectangle(x, y, 3, 3, i % 4 === 0 ? 0xffffff : color).setDepth(DEPTH.lighting + 2);
          this.tweens.add({ targets: spark, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r + 8, alpha: 0, duration: 1300 + Math.random() * 400, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
        }
        sfx('sparkle', { volume: 0.25, rate: 0.6 + Math.random() * 0.4 });
      },
    });
  }

  // ---------- Every frame ----------

  protected tick(delta: number): void {
    this.elapsed += delta;
    // Fireflies wander in slow loops; seeing them close up logs a sighting.
    for (const f of this.fireflies) {
      const t = this.elapsed * 0.0006 + f.phase;
      f.dot.setPosition(f.x + Math.sin(t) * 14 + Math.sin(t * 2.3) * 5, f.y + Math.cos(t * 0.8) * 9);
      f.halo.setPosition(f.dot.x, f.dot.y);
      if (Math.hypot(f.dot.x - this.player.x, f.dot.y - this.player.y) < 72) this.spot('fireflies', f.dot.x, f.dot.y);
    }
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
    this.people.update(delta, { x: this.player.x, y: this.player.y });
    // Jojo juggles three balls in a loop.
    this.balls.forEach((ball, i) => {
      const t = this.elapsed * 0.006 + (i * Math.PI * 2) / 3;
      ball.setPosition(this.jojo.x + Math.cos(t) * 6, this.jojo.y - 26 - Math.abs(Math.sin(t)) * 10);
    });
    // Evening light, golden hour and fireworks after dark.
    const { minute } = this.host.calendar();
    const dusk = minute < 17 * 60 ? 0 : minute < 20 * 60 ? ((minute - 17 * 60) / 180) * 0.55 : 0.58;
    if (Math.abs(dusk - this.nightAlpha) > 0.01) {
      this.nightAlpha = dusk;
      this.night.clear().fillStyle(0x141448, dusk).fillRect(-T * 4, -T * 4, (W + 8) * T, (H + 8) * T);
    }
    for (const b of this.bulbs) b.dot.setScale(dusk > 0.15 ? 1.5 : 1);
    if (minute >= FIREWORKS_FROM) {
      this.fireworkIn -= delta;
      if (this.fireworkIn <= 0) {
        this.fireworkIn = 900 + Math.random() * 1600;
        this.firework();
      }
    }
    if (Math.floor(this.elapsed / 1000) !== Math.floor((this.elapsed - delta) / 1000)) this.updateLabel();
  }

  // ---------- Actions ----------

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const feet = this.player.tile;
    if (feet.ty >= H - 2 && feet.tx >= 16 && feet.tx <= 20) return { verb: 'Back to the valley', key: 'E', run: () => this.leave() };
    const { tx, ty } = this.target();
    const person = this.people.at(tx * T + 8, ty * T + 8, 13);
    if (person && person.kind !== 'staff') return this.chatWith(person);
    if (person?.staff && !person.staff.id.startsWith('host_') && person.staff.id !== 'zara' && person.staff.id !== 'jojo') return this.chatWith(person);
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
      case 'fortune':
        return this.carnival.canFortune()
          ? { verb: 'Have your fortune told (free today)', key: 'E', run: () => this.carnival.fortune() }
          : { verb: 'Talk to Madame Zara', key: 'E', run: () => this.staffLine('zara') };
      case 'stage':
        if (mode === 'use' && this.carnival.canTip()) {
          return {
            verb: `Tip Jojo (${10}g) for luck`,
            key: 'Space',
            run: () => {
              if (!this.carnival.tip()) return;
              const jojo = this.staffAt.get('jojo');
              if (jojo) this.people.say(jojo, 'Thank you kindly!', 2500);
            },
          };
        }
        return { verb: 'Watch Jojo juggle', key: 'E', run: () => this.staffLine('jojo') };
      case 'card':
        return { verb: "Check today's carnival card", key: 'E', run: () => this.carnival.open('card') };
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

  /** Chat with someone: staff tell you things, villagers count as today's talk, visitors share tips. */
  private chatWith(p: Person): AreaAction {
    const player = { x: this.player.x, y: this.player.y };
    if (p.staff) {
      return { verb: `Talk to ${p.name}`, key: 'E', run: () => this.staffLine(p.staff!.id) };
    }
    if (p.villager) {
      const id = p.villager;
      return {
        verb: `Talk to ${p.name}`,
        key: 'E',
        run: () => {
          this.people.attend(p, player);
          const lines = VILLAGER_LINES[id] ?? ['What a night!'];
          this.carnival.talkVillager(id, lines[p.lineIndex++ % lines.length]);
        },
      };
    }
    return {
      verb: 'Chat',
      key: 'E',
      run: () => {
        this.people.attend(p, player);
        this.people.say(p, VISITOR_TALK[Math.floor(Math.random() * VISITOR_TALK.length)], 3500);
      },
    };
  }

  private staffLine(id: CarnivalStaffId): void {
    const p = this.staffAt.get(id);
    const def = CARNIVAL_STAFF[id];
    if (!p || !def.lines.length) return;
    const line = def.lines[p.lineIndex++ % def.lines.length];
    if (this.host.say) this.host.say(`${def.name} · ${def.title}`, line);
    else toast(line);
  }

  private isSolid(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= W || ty >= H) return true;
    return this.solid[ty * W + tx];
  }
}
