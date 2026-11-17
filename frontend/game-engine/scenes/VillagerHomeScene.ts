import * as Phaser from 'phaser';
import { FURNITURE, GAME_CONFIG, HOME_LIFE, ITEMS, NPCS, type FurnitureKind, type ItemId, type NpcId } from '@farming/shared';
import { drawRoom, FURNITURE_ORIGIN, type RoomStyle } from '../assets/interior';
import { drawAnvil, drawClock, drawOven, drawPhoto, drawRockingChair, drawSeedShelf, drawToolRack, drawWallNets, drawWorkbench } from '../assets/places';
import type { PixelCanvas } from '../assets/PixelCanvas';
import { furnitureTextureKey, itemTextureKey, npcTextureKey, TEXTURES } from '../assets/registerTextures';
import { DEPTH, SCENES } from '../constants';
import { standFrame } from '../entities/Player';
import { gameEvents } from '../events/GameEventBus';
import { LightingSystem } from '../systems/LightingSystem';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface HomeSceneData {
  host: AreaHost;
  npc: NpcId;
  /** Chat with them (counts as today's talk; the world shows the line). */
  talk(): void;
  /** Whether they have a treat for you today, and handing it over. */
  canTreat(): boolean;
  treat(): void;
  /** Give the item in a hotbar slot as a gift. */
  gift(slot: number): void;
}

const W = 11;
const H = 8;

const STYLES: Record<NpcId, RoomStyle> = {
  mira: { wall: '#e4ecd4', wainscot: '#5a8a5a', wainscotLight: '#7aaa72', floorA: '#b8875a', floorB: '#ae7e52', grain: '#8a5e3a' },
  rosa: { wall: '#f8e4e0', wainscot: '#b8505e', wainscotLight: '#d8707a', floorA: '#d8c0a0', floorB: '#cfb696', grain: '#a88a68', tiles: true },
  bram: { wall: '#c8c0b4', wainscot: '#5a5448', wainscotLight: '#7a7466', floorA: '#8a8478', floorB: '#7e786c', grain: '#5e584e', tiles: true },
  finn: { wall: '#d8e8ee', wainscot: '#3a6a9a', wainscotLight: '#5a8aba', floorA: '#a8865a', floorB: '#9e7c52', grain: '#7a5a38' },
  willa: { wall: '#f0e2c8', wainscot: '#8a5a32', wainscotLight: '#a8763f', floorA: '#c8945a', floorB: '#be8a52', grain: '#946636' },
  tobin: { wall: '#ecdcc0', wainscot: '#7a3a2e', wainscotLight: '#a8584a', floorA: '#a0703f', floorB: '#986838', grain: '#74502c' },
};

type Prop =
  | { furniture: FurnitureKind; tx: number; ty: number; items?: ItemId[] }
  | { art: string; draw: () => PixelCanvas; tx: number; ty: number; w: number; wall?: boolean; light?: boolean };

/** Each home's furnishings: a bed, a table, and the things that make it theirs. */
const LAYOUTS: Record<NpcId, Prop[]> = {
  mira: [
    { art: 'home-seedshelf', draw: drawSeedShelf, tx: 7, ty: 2, w: 2 },
    { furniture: 'house_plant', tx: 9, ty: 2 },
    { furniture: 'house_plant', tx: 6, ty: 2 },
    { furniture: 'flower_pot', tx: 9, ty: 5 },
    { furniture: 'table', tx: 6, ty: 4, items: ['turnip', 'carrot'] },
    { furniture: 'chair', tx: 8, ty: 4 },
    { furniture: 'painting', tx: 3, ty: 1 },
    { furniture: 'rug', tx: 4, ty: 4 },
  ],
  rosa: [
    { art: 'home-oven', draw: drawOven, tx: 7, ty: 2, w: 2, light: true },
    { furniture: 'table', tx: 5, ty: 4, items: ['bread', 'pumpkin_pie'] },
    { furniture: 'chair', tx: 7, ty: 4 },
    { furniture: 'wall_shelf', tx: 3, ty: 1, items: ['berry_jam', 'egg'] },
    { furniture: 'flower_pot', tx: 9, ty: 2 },
    { furniture: 'rug', tx: 4, ty: 5 },
  ],
  bram: [
    { furniture: 'fireplace', tx: 7, ty: 2 },
    { art: 'home-anvil', draw: drawAnvil, tx: 6, ty: 4, w: 1 },
    { art: 'home-toolrack', draw: drawToolRack, tx: 3, ty: 1, w: 2, wall: true },
    { furniture: 'table', tx: 8, ty: 5, items: ['iron_ore', 'gold_ore'] },
    { furniture: 'chair', tx: 9, ty: 3 },
    { furniture: 'floor_lamp', tx: 9, ty: 2 },
  ],
  finn: [
    { furniture: 'aquarium', tx: 7, ty: 2, items: ['sunfish', 'trout', 'golden_carp'] },
    { art: 'home-nets', draw: drawWallNets, tx: 3, ty: 1, w: 2, wall: true },
    { furniture: 'table', tx: 6, ty: 5, items: ['grilled_fish'] },
    { furniture: 'chair', tx: 8, ty: 5 },
    { furniture: 'floor_lamp', tx: 9, ty: 2 },
    { furniture: 'rug', tx: 4, ty: 4 },
  ],
  willa: [
    { art: 'home-workbench', draw: drawWorkbench, tx: 7, ty: 2, w: 2 },
    { furniture: 'bookshelf', tx: 5, ty: 2 },
    { furniture: 'chair', tx: 9, ty: 4 },
    { furniture: 'chair', tx: 6, ty: 5 },
    { furniture: 'bench', tx: 8, ty: 5 },
    { furniture: 'painting', tx: 3, ty: 1 },
    { furniture: 'house_plant', tx: 9, ty: 2 },
  ],
  tobin: [
    { furniture: 'fireplace', tx: 7, ty: 2 },
    { art: 'home-rocking', draw: drawRockingChair, tx: 7, ty: 4, w: 1 },
    { art: 'home-clock', draw: drawClock, tx: 9, ty: 2, w: 1 },
    { art: 'home-photo', draw: drawPhoto, tx: 3, ty: 1, w: 1, wall: true },
    { art: 'home-photo', draw: drawPhoto, tx: 5, ty: 1, w: 1, wall: true },
    { furniture: 'bookshelf', tx: 5, ty: 2 },
    { furniture: 'rug', tx: 4, ty: 4 },
    { furniture: 'house_plant', tx: 9, ty: 5 },
  ],
};

/** Where each villager stands at home. */
const SPOT: Record<NpcId, { tx: number; ty: number }> = {
  mira: { tx: 7, ty: 3 },
  rosa: { tx: 8, ty: 3 },
  bram: { tx: 5, ty: 4 },
  finn: { tx: 6, ty: 3 },
  willa: { tx: 7, ty: 3 },
  tobin: { tx: 8, ty: 4 },
};

/**
 * Inside a villager's house: their own furniture and things, the villager at
 * home to chat with (and, once you're good friends, a little treat each day).
 */
export class VillagerHomeScene extends AreaScene<HomeSceneData> {
  private data_!: HomeSceneData;
  private villager!: Phaser.GameObjects.Sprite;
  private night!: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  private solid = new Set<string>();

  constructor() {
    super(SCENES.Home);
  }

  init(data: HomeSceneData): void {
    super.init(data);
    this.data_ = data;
    this.glows = [];
    this.solid = new Set();
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    const id = this.data_.npc;
    const key = `home-room-${id}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawRoom(W, H, size, STYLES[id]));
    this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#1a1210');
    this.walls = this.physics.add.staticGroup();
    const doorTx = Math.floor(W / 2);
    this.addSolidRuns(W, H, (tx, ty) => (tx === 0 || tx === W - 1 || ty < 2 || ty === H - 1) && !(tx === doorTx && ty === H - 1));

    // The bed in the corner.
    const bedBase = 4 * size - 1;
    this.add.image(2 * size, bedBase, TEXTURES.bed).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + bedBase);
    this.walls.add(this.add.zone(2 * size, 3 * size, size * 2, size * 2 - 4));
    for (const t of ['1,2', '2,2', '1,3', '2,3']) this.solid.add(t);

    for (const prop of LAYOUTS[id]) this.placeProp(prop);

    const spot = SPOT[id];
    const vx = spot.tx * size + size / 2;
    const vy = spot.ty * size + 12;
    this.villager = this.add.sprite(vx, vy, npcTextureKey(id), standFrame('down')).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + vy);
    this.walls.add(this.add.zone(vx, vy - 4, 10, 6));
    this.solid.add(`${spot.tx},${spot.ty}`);

    this.setupArea(W, H, { x: doorTx * size + size / 2, y: (H - 2) * size + 12, facing: 'up' });
    this.cameras.main.setBounds(-size * 2, -size * 2, (W + 4) * size, (H + 4) * size);
    this.night = this.add.rectangle(0, 0, W * size, H * size, 0x0a0820, 0).setOrigin(0).setDepth(DEPTH.lighting);
    gameEvents.emit('area:label', { label: `🏠 ${NPCS[id].name}'s house` });
    // A little greeting.
    this.time.delayedCall(450, () => this.bubble(HOME_LIFE[id].lines[0]));
  }

  private tex(key: string, draw: () => PixelCanvas): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw().toCanvas());
    return key;
  }

  private placeProp(prop: Prop): void {
    const size = GAME_CONFIG.tileSize;
    if ('furniture' in prop) {
      const def = FURNITURE[prop.furniture];
      const x = prop.tx * size + (def.width * size) / 2;
      const baseY = def.layer === 'floor' ? prop.ty * size + (def.height * size) / 2 : def.layer === 'wall' ? prop.ty * size + 6 : (prop.ty + def.height) * size - 1;
      const sprite = this.add
        .image(x, baseY, furnitureTextureKey(prop.furniture))
        .setOrigin(0.5, FURNITURE_ORIGIN[prop.furniture])
        .setDepth(def.layer === 'floor' ? DEPTH.floor : def.layer === 'wall' ? DEPTH.soil : DEPTH.ySortBase + baseY);
      if (def.layer === 'object') {
        this.walls.add(this.add.zone(x, baseY - 4, def.width * size - 4, 8));
        for (let i = 0; i < def.width; i++) this.solid.add(`${prop.tx + i},${prop.ty}`);
      }
      if (def.light) this.glows.push(this.add.image(x, baseY - 22, TEXTURES.light).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setDepth(DEPTH.lighting + 1).setTint(0xffd27a));
      // Things on show (bread on the table, fish in the tank…).
      const items = prop.items ?? [];
      items.forEach((itemId, i) => {
        const n = items.length;
        const ix = x + (i - (n - 1) / 2) * (def.width * size * 0.7) / Math.max(1, n);
        const iy = def.layer === 'wall' ? baseY - 2 : sprite.y - sprite.displayHeight + (prop.furniture === 'aquarium' ? 12 : 4);
        this.add.image(ix, iy, itemTextureKey(itemId)).setScale(0.6).setDepth(sprite.depth + 0.1);
      });
      return;
    }
    const x = prop.tx * size + (prop.w * size) / 2;
    const baseY = prop.wall ? prop.ty * size + 6 : (prop.ty + 1) * size - 1;
    this.add
      .image(x, baseY, this.tex(prop.art, prop.draw))
      .setOrigin(0.5, prop.wall ? 0.5 : 1)
      .setDepth(prop.wall ? DEPTH.soil : DEPTH.ySortBase + baseY);
    if (!prop.wall) {
      this.walls.add(this.add.zone(x, baseY - 4, prop.w * size - 4, 8));
      for (let i = 0; i < prop.w; i++) this.solid.add(`${prop.tx + i},${prop.ty}`);
    }
    if (prop.light) this.glows.push(this.add.image(x, baseY - 14, TEXTURES.light).setBlendMode(Phaser.BlendModes.ADD).setScale(0.7).setDepth(DEPTH.lighting + 1).setTint(0xffa040));
  }

  private bubble(text: string): void {
    const label = this.add
      .text(this.villager.x, this.villager.y - 24, text, { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '5px', color: '#3a2a20', align: 'center', wordWrap: { width: 80 }, backgroundColor: '#fff8e8', padding: { x: 3, y: 2 } })
      .setOrigin(0.5, 1)
      .setResolution(6)
      .setDepth(DEPTH.fx);
    this.tweens.add({ targets: label, alpha: 0, delay: 3200, duration: 400, onComplete: () => label.destroy() });
  }

  protected tick(): void {
    const dark = LightingSystem.darkness(this.host.calendar().minute);
    this.night.setFillStyle(0x0a0820, dark * 0.4);
    for (const g of this.glows) g.setAlpha(0.25 + dark * 0.6);
    // The villager turns to look at you.
    const dx = this.player.x - this.villager.x;
    const dy = this.player.y - this.villager.y;
    const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.villager.setFrame(standFrame(facing));
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    const doorTx = Math.floor(W / 2);
    if ((tx === doorTx && ty === H - 1) || feet.ty >= H - 2 && Math.abs(feet.tx - doorTx) <= 0 && this.player.facingDirection === 'down') {
      return { verb: 'Go outside', key: 'E', run: () => this.leave() };
    }
    const near = Math.hypot(this.villager.x - (tx * size + 8), this.villager.y - (ty * size + 12)) < 14;
    if (near) {
      const name = NPCS[this.data_.npc].name;
      const stack = this.host.state.inventory.selectedStack;
      if (mode === 'use' && stack && !ITEMS[stack.itemId].tool) {
        return { verb: `Give ${ITEMS[stack.itemId].name} to ${name}`, key: 'Space', run: () => this.data_.gift(this.host.state.inventory.selected) };
      }
      if (this.data_.canTreat()) return { verb: `${name} has something for you`, key: 'E', run: () => this.data_.treat() };
      return { verb: `Talk to ${name}`, key: 'E', run: () => this.data_.talk() };
    }
    if (this.solid.has(`${tx},${ty}`) && mode === 'interact') {
      return { verb: `${NPCS[this.data_.npc].name}'s things`, key: 'E', info: true, run: () => gameEvents.emit('toast', { text: `${NPCS[this.data_.npc].name}'s home: ${HOME_LIFE[this.data_.npc].style}.` }) };
    }
    return null;
  }
}
