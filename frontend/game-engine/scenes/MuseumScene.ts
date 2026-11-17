import * as Phaser from 'phaser';
import {
  CARNIVAL_VISITOR_LOOKS,
  FURNITURE,
  GAME_CONFIG,
  ITEMS,
  MUSEUM_ITEMS,
  MUSEUM_SET_IDS,
  MUSEUM_SETS,
  NPCS,
  whereToGet,
  type FurnitureKind,
  type ItemId,
  type MuseumSetId,
  type NpcId,
} from '@farming/shared';
import { drawRoom, FURNITURE_ORIGIN, type RoomStyle } from '../assets/interior';
import { drawBanner, drawCuratorDesk, drawDinoSkeleton, drawGlassCase, drawGlobe, drawPedestal, drawRopePost, drawShipCase, drawValleyMap } from '../assets/places';
import type { PixelCanvas } from '../assets/PixelCanvas';
import { addCharacterSheet, furnitureTextureKey, itemTextureKey, npcTextureKey } from '../assets/registerTextures';
import { drawOwl } from '../assets/wildlife';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';
import { CarnivalPeople, type Person } from './carnival/CarnivalPeople';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface MuseumSceneData {
  host: AreaHost;
  /** Items already on display. */
  donated(): ReadonlySet<ItemId>;
  /** Give one of an item from the backpack (true if it went on display). */
  donate(itemId: ItemId): boolean;
}

const W = 26;
const H = 15;
const T = GAME_CONFIG.tileSize;
const DOOR_TX = Math.floor(W / 2);
const STYLE: RoomStyle = { wall: '#ece4d0', wainscot: '#8a6a4a', wainscotLight: '#a8885e', floorA: '#d8d0bc', floorB: '#c8bea8', grain: '#b0a68e', tiles: true };

/** Where each set's pedestals stand. */
const LAYOUT: Record<MuseumSetId, Array<[number, number]>> = {
  fish: Array.from({ length: 13 }, (_, i) => [2 + i, 3] as [number, number]),
  shore: Array.from({ length: 6 }, (_, i) => [2, 5 + i] as [number, number]),
  minerals: Array.from({ length: 9 }, (_, i) => [24, 3 + i] as [number, number]),
  artifacts: [
    [6, 7],
    [7, 7],
    [8, 7],
    [6, 9],
    [7, 9],
    [8, 9],
  ],
};
const LABELS: Record<MuseumSetId, { x: number; y: number; color: string; trim: string; wall: boolean }> = {
  fish: { x: 8, y: 1, color: '#3a6a9a', trim: '#a8d0f0', wall: true },
  shore: { x: 2, y: 4.4, color: '#c86a6a', trim: '#f8d0c0', wall: false },
  minerals: { x: 24, y: 1, color: '#6a4a8a', trim: '#e8d0ff', wall: true },
  artifacts: { x: 7, y: 6.2, color: '#8a6a2a', trim: '#f4e0a0', wall: false },
};
/** The dinosaur on its plinth (left column, door row), the ship, the globe, the desk. */
const DINO = { tx: 14, ty: 7, w: 5 };
const SHIP = { tx: 19, ty: 4 };
const GLOBE = { tx: 21, ty: 11 };
const CASE = { tx: 3, ty: 12 };
const DESK = { tx: 17, ty: 12 };
/** Furniture dressing the hall. */
const DRESSING: Array<{ kind: FurnitureKind; tx: number; ty: number }> = [
  { kind: 'house_plant', tx: 16, ty: 2 },
  { kind: 'house_plant', tx: 22, ty: 2 },
  { kind: 'house_plant', tx: 1, ty: 12 },
  { kind: 'house_plant', tx: 24, ty: 12 },
  { kind: 'bench', tx: 15, ty: 10 },
  { kind: 'bench', tx: 17, ty: 10 },
  { kind: 'bench', tx: 9, ty: 12 },
  { kind: 'statue', tx: 11, ty: 7 },
  { kind: 'floor_lamp', tx: 12, ty: 12 },
  { kind: 'floor_lamp', tx: 14, ty: 12 },
  { kind: 'painting', tx: 15, ty: 1 },
  { kind: 'painting', tx: 19, ty: 1 },
];
/** Things visitors say while they look around. */
const VISITOR_LINES = [
  'Look at the size of it!',
  'Is that a real fossil?',
  'I caught one of those once. Bigger, though.',
  'Shh, this is a museum.',
  'Ooh, shiny!',
  'Who found all this?',
  'My grandpa had a coin like that.',
  'I could stay here all day.',
  'The little owl runs the place, you know.',
  'Look, the ship has tiny sails!',
  'Where is that rock from?',
  'Hoo-hoo! …Sorry, I was copying the owl.',
];

interface Exhibit {
  itemId: ItemId;
  set: MuseumSetId;
  tx: number;
  ty: number;
  icon: Phaser.GameObjects.Image;
}

/**
 * The valley museum: four collections on pedestals (fish, shore finds, stones
 * and gems, artifacts), a dinosaur skeleton behind brass ropes, a model ship, a
 * globe, a map of the valley, paintings, benches — and a crowd of visitors
 * (townsfolk and a few villagers) strolling between the exhibits. Professor
 * Hoot, an old owl, runs the place from the desk by the door.
 */
export class MuseumScene extends AreaScene<MuseumSceneData> {
  private data_!: MuseumSceneData;
  private exhibits: Exhibit[] = [];
  private owl!: Phaser.GameObjects.Image;
  private blink = 2000;
  private solid = new Set<string>();
  private people!: CarnivalPeople;

  constructor() {
    super(SCENES.Museum);
  }

  init(data: MuseumSceneData): void {
    super.init(data);
    this.data_ = data;
    this.exhibits = [];
    this.solid = new Set();
  }

  private tex(key: string, draw: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
    return key;
  }

  private isWall(tx: number, ty: number): boolean {
    return (tx <= 0 || tx >= W - 1 || ty < 2 || ty >= H - 1) && !(tx === DOOR_TX && ty === H - 1);
  }

  private isSolid(tx: number, ty: number): boolean {
    return this.isWall(tx, ty) || this.solid.has(`${tx},${ty}`);
  }

  private block(tx: number, ty: number, w = 1, h = 1): void {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) this.solid.add(`${tx + dx},${ty - dy}`);
  }

  create(): void {
    if (!this.textures.exists('museum-hall-2')) this.textures.addCanvas('museum-hall-2', drawRoom(W, H, T, STYLE));
    this.add.image(0, 0, 'museum-hall-2').setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#1a1612');
    const ys = (y: number) => DEPTH.ySortBase + y;

    // A long red runner from the door.
    const runner = this.add.graphics().setDepth(DEPTH.floor);
    runner.fillStyle(0x8a2a2a, 1).fillRect(DOOR_TX * T + 2, 10 * T, T - 4, 4 * T);
    runner.fillStyle(0xc8a050, 1).fillRect(DOOR_TX * T + 2, 10 * T, 1, 4 * T).fillRect(DOOR_TX * T + T - 3, 10 * T, 1, 4 * T);

    // Pedestals for the four collections.
    const pedestal = this.tex('museum-pedestal', drawPedestal);
    const donated = this.data_.donated();
    for (const set of MUSEUM_SET_IDS) {
      const items = MUSEUM_SETS[set].items;
      LAYOUT[set].forEach(([tx, ty], i) => {
        const itemId = items[i];
        if (!itemId) return;
        const baseY = (ty + 1) * T - 1;
        const x = tx * T + T / 2;
        this.add.image(x, baseY, pedestal).setOrigin(0.5, 1).setDepth(ys(baseY));
        this.block(tx, ty);
        const icon = this.add.image(x, baseY - 17, itemTextureKey(itemId)).setScale(0.7).setDepth(ys(baseY) + 0.2);
        const ex = { itemId, set, tx, ty, icon };
        this.showExhibit(ex, donated.has(itemId));
        this.exhibits.push(ex);
      });
      const l = LABELS[set];
      if (l.wall) this.add.image(l.x * T + T / 2, T + 4, this.tex(`museum-banner-${set}`, () => drawBanner(l.color, l.trim))).setScale(0.8).setDepth(DEPTH.soil);
      this.label(l.x * T + T / 2, l.wall ? 2 * T + 2 : l.y * T, MUSEUM_SETS[set].name.toUpperCase());
    }

    // The dinosaur, roped off.
    const dinoBase = (DINO.ty + 1) * T - 1;
    const dinoX = (DINO.tx + DINO.w / 2) * T;
    this.add.image(dinoX, dinoBase, this.tex('museum-dino', drawDinoSkeleton)).setOrigin(0.5, 1).setDepth(ys(dinoBase));
    this.block(DINO.tx, DINO.ty, DINO.w, 2);
    this.label(dinoX, dinoBase + 3, 'VALLEY REX · 66 MILLION YEARS OLD', '4px');
    const post = this.tex('museum-post', drawRopePost);
    const posts = [DINO.tx - 0.5, DINO.tx + DINO.w + 0.5].map((tx) => ({ x: tx * T, y: (DINO.ty + 1) * T + 6 }));
    const rope = this.add.graphics().setDepth(ys(posts[0].y - 1));
    rope.lineStyle(1.5, 0x8a2a2a, 1);
    rope.beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const x = posts[0].x + (posts[1].x - posts[0].x) * t;
      const y = posts[0].y - 9 + Math.sin(t * Math.PI) * 3;
      if (i === 0) rope.moveTo(x, y);
      else rope.lineTo(x, y);
    }
    rope.strokePath();
    for (const pp of posts) this.add.image(pp.x, pp.y, post).setOrigin(0.5, 1).setDepth(ys(pp.y));

    // The model ship, the globe, a glass case of curios, and the map on the wall.
    const shipBase = (SHIP.ty + 1) * T - 1;
    this.add.image((SHIP.tx + 1) * T, shipBase, this.tex('museum-ship', drawShipCase)).setOrigin(0.5, 1).setDepth(ys(shipBase));
    this.block(SHIP.tx, SHIP.ty, 2, 1);
    this.label((SHIP.tx + 1) * T, shipBase + 2, 'THE FIRST FERRY', '4px');
    const globeBase = (GLOBE.ty + 1) * T - 1;
    this.add.image(GLOBE.tx * T + T / 2, globeBase, this.tex('museum-globe', drawGlobe)).setOrigin(0.5, 1).setDepth(ys(globeBase));
    this.block(GLOBE.tx, GLOBE.ty);
    const caseBase = (CASE.ty + 1) * T - 1;
    const caseX = (CASE.tx + 1) * T;
    this.add.image(caseX, caseBase, this.tex('museum-case', drawGlassCase)).setOrigin(0.5, 1).setDepth(ys(caseBase));
    (['old_coin', 'pearl', 'arrowhead'] as ItemId[]).forEach((it, i) => this.add.image(caseX - 9 + i * 9, caseBase - 15, itemTextureKey(it)).setScale(0.5).setDepth(ys(caseBase) + 0.1).setAlpha(0.85));
    this.block(CASE.tx, CASE.ty, 2, 1);
    this.label(caseX, caseBase + 2, 'CURIOS (ON LOAN)', '4px');
    this.add.image(12 * T, T + 6, this.tex('museum-map', drawValleyMap)).setDepth(DEPTH.soil);

    // Plants, benches, a statue, lamps and paintings.
    for (const d of DRESSING) {
      const def = FURNITURE[d.kind];
      const x = d.tx * T + (def.width * T) / 2;
      const wall = def.layer === 'wall';
      const baseY = wall ? d.ty * T + 6 : (d.ty + def.height) * T - 1;
      this.add
        .image(x, baseY, furnitureTextureKey(d.kind))
        .setOrigin(0.5, wall ? 0.5 : FURNITURE_ORIGIN[d.kind])
        .setDepth(wall ? DEPTH.soil : ys(baseY));
      if (!wall) this.block(d.tx, d.ty, def.width);
    }

    // The curator's desk, and the curator.
    const deskBase = (DESK.ty + 1) * T - 1;
    const dx = (DESK.tx + 1) * T;
    this.add.image(dx, deskBase, this.tex('museum-desk', drawCuratorDesk)).setOrigin(0.5, 1).setDepth(ys(deskBase));
    this.block(DESK.tx, DESK.ty, 2, 1);
    for (const f of [0, 1]) this.tex(`owl-${f}`, () => drawOwl(f));
    this.owl = this.add.image(dx + 2, deskBase - 18, 'owl-0').setOrigin(0.5, 1).setScale(1.2).setDepth(ys(deskBase) + 1);

    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(W, H, (tx, ty) => this.isSolid(tx, ty));
    this.setupArea(W, H, { x: DOOR_TX * T + T / 2, y: (H - 2) * T + 12, facing: 'up' });
    this.cameras.main.setBounds(-T * 2, -T * 2, (W + 4) * T, (H + 4) * T);
    this.spawnVisitors();
    gameEvents.emit('area:label', { label: `🏛 Museum · ${donated.size}/${MUSEUM_ITEMS.length}` });
  }

  private label(x: number, y: number, text: string, size = '5px'): void {
    this.add
      .text(x, y, text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: size, fontStyle: 'bold', color: '#3a2a20', backgroundColor: '#f4ead2', padding: { x: 2, y: 1 }, resolution: 8 })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ySortBase + 13 * T);
  }

  /** Townsfolk and a few villagers wandering between the exhibits. */
  private spawnVisitors(): void {
    const { day, minute } = this.host.calendar();
    // Spots in front of the exhibits that visitors drift between.
    const spots: Array<{ x: number; y: number }> = [];
    const add = (tx: number, ty: number) => {
      if (!this.isSolid(tx, ty)) spots.push({ x: tx * T + 8, y: ty * T + 12 });
    };
    for (let tx = 3; tx <= 12; tx += 2) add(tx, 4);
    for (let ty = 5; ty <= 10; ty += 2) add(3, ty);
    for (let ty = 4; ty <= 9; ty += 2) add(23, ty);
    for (const tx of [14, 16, 18]) add(tx, 9);
    add(19, 6);
    add(20, 6);
    add(20, 11);
    add(7, 11);
    add(10, 9);
    add(4, 11);
    this.people = new CarnivalPeople(this, (tx, ty) => this.isSolid(tx, ty), spots);
    const rng = createRng(`museum-visitors:${day}`);
    const count = minute >= 10 * 60 && minute < 17 * 60 ? 9 : 6;
    for (let i = 0; i < count; i++) {
      const look = (i * 3 + day) % CARNIVAL_VISITOR_LOOKS.length;
      const key = `carnival-visitor-${look}`;
      if (!this.textures.exists(key)) addCharacterSheet(this, key, CARNIVAL_VISITOR_LOOKS[look]);
      const at = spots[rng.int(0, spots.length - 1)];
      this.people.addVisitor(key, 'Visitor', at.x, at.y, { calls: VISITOR_LINES });
    }
    // Two or three villagers who aren't at their stalls today.
    const ids = Object.keys(NPCS) as NpcId[];
    const picks = [ids[day % ids.length], ids[(day + 2) % ids.length], ids[(day + 4) % ids.length]].slice(0, minute >= 16 * 60 ? 3 : 2);
    for (const id of picks) {
      const at = spots[rng.int(0, spots.length - 1)];
      this.people.addVisitor(npcTextureKey(id), NPCS[id].name, at.x, at.y, {
        villager: id,
        calls: ['What a collection!', 'Have you seen the dinosaur?', 'Professor Hoot knows everything.', 'I come here on my days off.'],
      });
    }
  }

  private showExhibit(ex: Exhibit, onShow: boolean): void {
    if (onShow) ex.icon.clearTint().setAlpha(1);
    else ex.icon.setTint(0x2b1d1a).setAlpha(0.28);
  }

  protected tick(delta: number): void {
    this.people.update(delta, { x: this.player.x, y: this.player.y });
    this.blink -= delta;
    if (this.blink <= 0) {
      this.owl.setTexture('owl-1');
      this.time.delayedCall(170, () => this.owl.setTexture('owl-0'));
      this.blink = 2200 + Math.random() * 3000;
      if (Math.random() < 0.3) this.owl.setFlipX(!this.owl.flipX);
    }
  }

  private donate(ex: Exhibit): void {
    if (!this.data_.donate(ex.itemId)) return;
    this.showExhibit(ex, true);
    this.tweens.add({ targets: ex.icon, scale: 0.95, duration: 160, yoyo: true });
    sfx('pickup');
    gameEvents.emit('area:label', { label: `🏛 Museum · ${this.data_.donated().size}/${MUSEUM_ITEMS.length}` });
    // The crowd appreciates it.
    const near = this.people.people.filter((p) => Math.hypot(p.sprite.x - this.player.x, p.sprite.y - this.player.y) < 90).slice(0, 2);
    near.forEach((p, i) => this.time.delayedCall(250 + i * 300, () => this.people.say(p, i ? 'Bravo!' : 'Ooh, a new one!')));
  }

  private nearOwl(tx: number, ty: number): boolean {
    return ty >= DESK.ty - 1 && ty <= DESK.ty + 1 && tx >= DESK.tx - 1 && tx <= DESK.tx + 2;
  }

  private talkTo(p: Person): void {
    this.people.attend(p, { x: this.player.x, y: this.player.y });
    p.lineIndex = (p.lineIndex + 1) % p.calls.length;
    this.people.say(p, p.calls[p.lineIndex]);
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    if ((tx === DOOR_TX && ty === H - 1) || (feet.ty >= H - 2 && feet.tx === DOOR_TX && this.player.facingDirection === 'down')) {
      return { verb: 'Go outside', key: 'E', run: () => this.leave() };
    }
    const toast = (text: string) => gameEvents.emit('toast', { text });
    const inv = this.host.state.inventory;
    const donated = this.data_.donated();
    const ex = this.exhibits.find((e) => e.tx === tx && e.ty === ty);
    if (ex) {
      const name = ITEMS[ex.itemId].name;
      if (donated.has(ex.itemId)) return { verb: `${name} · on display`, key: 'E', info: true, run: () => toast(`${name}: ${ITEMS[ex.itemId].description}`) };
      if (inv.count(ex.itemId) > 0) return { verb: `Donate ${name}`, key: mode === 'use' ? 'Space' : 'E', run: () => this.donate(ex) };
      return { verb: `Empty · ${name}`, key: 'E', info: true, run: () => toast(`${name} goes here. Where to find it: ${whereToGet(ex.itemId)}.`) };
    }
    const person = this.people.at(tx * T + 8, ty * T + 8, 13);
    if (person && mode === 'interact') return { verb: `Talk to ${person.name === 'Visitor' ? 'the visitor' : person.name}`, key: 'E', run: () => this.talkTo(person) };
    if (this.nearOwl(tx, ty)) {
      const fresh = this.exhibits.filter((e) => !donated.has(e.itemId) && inv.count(e.itemId) > 0);
      if (fresh.length) {
        return {
          verb: `Donate ${fresh.length} new find${fresh.length === 1 ? '' : 's'}`,
          key: 'E',
          run: () => {
            for (const e of fresh) this.donate(e);
          },
        };
      }
      return {
        verb: 'Talk to Professor Hoot',
        key: 'E',
        run: () => {
          const total = MUSEUM_ITEMS.length;
          const n = donated.size;
          const sets = MUSEUM_SET_IDS.map((id) => {
            const s = MUSEUM_SETS[id];
            return `${s.name} ${s.items.filter((i) => donated.has(i)).length}/${s.items.length}`;
          }).join(' · ');
          const text =
            n === 0
              ? 'Hoo! A visitor! Welcome to the valley museum. Bring me fish, shells, stones and old things, and I shall put them on display. Finish a collection and I will make it worth your while.'
              : n === total
                ? 'Every display is full. Hoo, hoo! You have made this the finest little museum in the land.'
                : `You've filled ${n} of ${total} displays. ${sets}.`;
          if (this.host.say) this.host.say('Professor Hoot', text);
          else toast(text);
        },
      };
    }
    const blurbs: Array<[(x: number, y: number) => boolean, string]> = [
      [(x, y) => x >= DINO.tx && x < DINO.tx + DINO.w && y >= DINO.ty - 1 && y <= DINO.ty + 1, 'The Valley Rex: a skeleton dug out of the cliffs a century ago. Please do not feed the dinosaur.'],
      [(x, y) => (x === SHIP.tx || x === SHIP.tx + 1) && y === SHIP.ty, 'A model of the first ferry that crossed to the valley, built by Willa’s great-grandmother.'],
      [(x, y) => x === GLOBE.tx && y === GLOBE.ty, 'A very old globe. The valley is the tiny red dot. Hoo knew?'],
      [(x, y) => (x === CASE.tx || x === CASE.tx + 1) && y === CASE.ty, 'Curios on loan from the Professor’s own collection.'],
    ];
    const hit = blurbs.find(([test]) => test(tx, ty));
    if (hit && mode === 'interact') return { verb: 'Read the plaque', key: 'E', info: true, run: () => toast(hit[1]) };
    return null;
  }
}
