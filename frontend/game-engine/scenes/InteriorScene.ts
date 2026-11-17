import * as Phaser from 'phaser';
import { COTTAGE_ROOMS, FURNITURE, GAME_CONFIG, ITEMS, SPOUSE_LINES, STARTER_FURNITURE, TABLETOP_DECOR, furnitureOf, type FurnitureKind, type InteriorSave, type ItemId, type NpcId } from '@farming/shared';
import { furnitureTextureKey, itemTextureKey, npcTextureKey, TEXTURES } from '../assets/registerTextures';
import { drawRoom, FURNITURE_ORIGIN } from '../assets/interior';
import { sfx } from '../audio/sfx';
import { DEPTH, SCENES } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { LightingSystem } from '../systems/LightingSystem';
import { AreaScene, type AreaAction, type AreaHost } from './AreaScene';

export interface InteriorSceneData {
  host: AreaHost;
  interior: InteriorSave;
  /** Persist furniture changes. */
  onChange: (interior: InteriorSave) => void;
  sleep: () => void;
  /** Your spouse, if married: they're at home. */
  spouse?: { id: NpcId; name: string; pet?: 'cat' | 'dog' };
}

interface Piece {
  kind: FurnitureKind;
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone | null;
  glow: Phaser.GameObjects.Image | null;
  /** Items on show (display tables, shelves, the aquarium). */
  items: ItemId[];
  shown: Phaser.GameObjects.Image[];
}

const toast = (text: string) => gameEvents.emit('toast', { text });

/**
 * Inside your cottage: your bed, and furniture you buy from Willa. Select a
 * piece in the hotbar and press Space to place it; press E on it to pick it
 * back up. A House Extension makes the room bigger.
 */
export class InteriorScene extends AreaScene<InteriorSceneData> {
  private interior!: InteriorSave;
  private onChange!: (interior: InteriorSave) => void;
  private sleepNow!: () => void;
  private pieces: Piece[] = [];
  private ghost!: Phaser.GameObjects.Image;
  private night!: Phaser.GameObjects.Rectangle;
  private roomW = 11;
  private roomH = 8;
  /** Bed footprint: top-left two tiles wide, two tall. */
  private readonly bed = { tx: 1, ty: 2, w: 2, h: 2 };

  private spouse: InteriorSceneData['spouse'];
  private spouseSprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super(SCENES.Interior);
  }

  init(data: InteriorSceneData): void {
    super.init(data);
    this.spouse = data.spouse;
    this.spouseSprite = null;
    this.interior = { level: data.interior.level, furniture: data.interior.furniture.map((f) => ({ ...f, ...(f.items ? { items: [...f.items] } : {}) })), furnished: data.interior.furnished };
    this.onChange = data.onChange;
    this.sleepNow = data.sleep;
    this.pieces = [];
  }

  create(): void {
    const size = GAME_CONFIG.tileSize;
    const room = COTTAGE_ROOMS[Math.min(this.interior.level, COTTAGE_ROOMS.length - 1)];
    this.roomW = room.width;
    this.roomH = room.height;
    const key = `room-${room.width}x${room.height}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawRoom(room.width, room.height));
    this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.ground);
    this.cameras.main.setBackgroundColor('#1a1210');

    this.walls = this.physics.add.staticGroup();
    this.addSolidRuns(room.width, room.height, (tx, ty) => this.isWall(tx, ty) && !this.isDoor(tx, ty));
    // The bed.
    const bedBase = (this.bed.ty + this.bed.h) * size - 1;
    this.add.image(this.bed.tx * size + size, bedBase, TEXTURES.bed).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + bedBase);
    this.walls.add(this.add.zone(this.bed.tx * size + size, this.bed.ty * size + size, size * 2, size * 2 - 4));

    // A new cottage comes furnished: a stove, a fireplace, a table and a few things on show.
    if (!this.interior.furnished) {
      for (const s of STARTER_FURNITURE) {
        const def = FURNITURE[s.kind];
        let fits = true;
        for (let dx = 0; dx < def.width && fits; dx++) {
          for (let dy = 0; dy < def.height && fits; dy++) {
            const x = s.tx + dx;
            const y = s.ty + dy;
            if (def.layer === 'wall') fits = y === 1 && x > 0 && x < room.width - 1;
            else fits = !this.isWall(x, y) && !this.inBed(x, y) && !this.interior.furniture.some((f) => FURNITURE[f.kind].layer === def.layer && this.covers(f, x, y));
          }
        }
        if (fits) this.interior.furniture.push({ kind: s.kind, tx: s.tx, ty: s.ty, ...(s.items ? { items: [...s.items] } : {}) });
      }
      this.interior.furnished = true;
      this.onChange(this.interior);
    }
    for (const f of this.interior.furniture) this.spawn(f.kind, f.tx, f.ty, f.items ?? []);

    const door = this.doorTile();
    if (this.spouse) {
      const sx = (room.width - 3) * size + size / 2;
      const sy = 4 * size + 12;
      this.spouseSprite = this.add.sprite(sx, sy, npcTextureKey(this.spouse.id), 0).setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + sy);
      this.walls.add(this.add.zone(sx, sy - 4, 10, 6));
    }
    this.setupArea(room.width, room.height, { x: door.tx * size + size / 2, y: (door.ty - 1) * size + 12, facing: 'up' });
    this.cameras.main.setBounds(-size * 2, -size * 2, (room.width + 4) * size, (room.height + 4) * size);

    this.ghost = this.add.image(0, 0, TEXTURES.bed).setAlpha(0.55).setVisible(false).setDepth(DEPTH.cursor - 1);
    this.night = this.add.rectangle(0, 0, room.width * size, room.height * size, 0x0a0820, 0).setOrigin(0).setDepth(DEPTH.lighting);
    gameEvents.emit('area:label', { label: '🏠 Your cottage' });
  }

  protected tick(): void {
    // Evenings get dim indoors; lamps glow.
    const dark = LightingSystem.darkness(this.host.calendar().minute);
    this.night.setFillStyle(0x0a0820, dark * 0.45);
    for (const p of this.pieces) p.glow?.setAlpha(0.25 + dark * 0.6);
    this.drawGhost();
  }

  protected resolve(mode: 'use' | 'interact'): AreaAction | null {
    const { tx, ty } = this.target();
    const feet = this.player.tile;
    if (this.isDoor(tx, ty) || this.isDoor(feet.tx, feet.ty + 1) || feet.ty >= this.roomH - 1) {
      return { verb: 'Go outside', key: 'E', run: () => this.leave() };
    }
    if (this.inBed(tx, ty)) return { verb: 'Go to bed', key: 'E', run: () => this.sleepNow() };
    if (this.spouse && this.spouseSprite && Math.hypot(this.spouseSprite.x - (tx * GAME_CONFIG.tileSize + 8), this.spouseSprite.y - (ty * GAME_CONFIG.tileSize + 12)) < 16) {
      const spouse = this.spouse;
      return {
        verb: `Talk to ${spouse.name}`,
        key: 'E',
        run: () => this.host.say?.(spouse.name, SPOUSE_LINES[Math.floor(Math.random() * SPOUSE_LINES.length)]),
      };
    }
    const piece = this.pieceAt(tx, ty) ?? this.pieceAt(tx, ty - 1);
    if (piece) {
      const special = this.pieceAction(piece, mode);
      if (special) return special;
      if (piece.kind === 'stove' || piece.kind === 'fireplace' || FURNITURE[piece.kind].display) return null;
    }
    if (piece && (mode === 'interact' || !this.placingKind())) {
      return {
        verb: `Pick up ${ITEMS[piece.kind].name}`,
        key: 'E',
        run: () => {
          if (this.host.state.inventory.add(piece.kind, 1) > 0) return toast('Your backpack is full.');
          this.removePiece(piece);
          sfx('place', { rate: 1.3 });
        },
      };
    }
    const kind = this.placingKind();
    if (kind && mode === 'use') {
      const spot = this.placementFor(kind, tx, ty);
      if (!spot) return { verb: FURNITURE[kind].layer === 'wall' ? 'Face the wall to hang it' : "Can't place here", key: 'Space', blocked: true, run: () => undefined };
      return {
        verb: `Place ${ITEMS[kind].name}`,
        key: 'Space',
        run: () => {
          const slot = this.host.state.inventory.selected;
          if (this.host.state.inventory.removeAt(slot, 1) !== 1) return;
          this.spawn(kind, spot.tx, spot.ty);
          this.interior.furniture.push({ kind, tx: spot.tx, ty: spot.ty });
          this.onChange(this.interior);
          sfx('place');
        },
      };
    }
    return null;
  }

  // ---------- Furniture ----------

  /** Displays, the stove and the fireplace do something before they're picked up. */
  private pieceAction(piece: Piece, mode: 'use' | 'interact'): AreaAction | null {
    const def = FURNITURE[piece.kind];
    const stack = this.host.state.inventory.selectedStack;
    const item = stack ? ITEMS[stack.itemId] : null;
    const pickaxe = item?.tool?.kind === 'pickaxe';
    if (def.display) {
      const asFurniture = stack ? furnitureOf(stack.itemId) : null;
      const showable = stack && item && !item.tool && (!asFurniture || TABLETOP_DECOR.has(asFurniture)) && (!def.fishOnly || item.category === 'fish');
      if (mode === 'use' && showable && piece.items.length < def.display) {
        return {
          verb: piece.kind === 'aquarium' ? `Put ${item.name} in the aquarium` : `Put ${item.name} on the ${ITEMS[piece.kind].name.toLowerCase()}`,
          key: 'Space',
          run: () => {
            if (this.host.state.inventory.removeAt(this.host.state.inventory.selected, 1) !== 1) return;
            piece.items.push(stack.itemId);
            this.renderItems(piece);
            this.saveItems(piece);
            sfx('place', { rate: 1.2 });
          },
        };
      }
      if (mode === 'use' && stack && def.fishOnly && item?.category !== 'fish' && !pickaxe && !asFurniture) {
        return { verb: 'Only fish go in the aquarium', key: 'Space', blocked: true, run: () => undefined };
      }
      if (piece.items.length > 0 && !(mode === 'use' && pickaxe)) {
        const last = piece.items[piece.items.length - 1];
        return {
          verb: `Take the ${ITEMS[last].name}`,
          key: 'E',
          run: () => {
            if (this.host.state.inventory.add(last, 1) > 0) return toast('Your backpack is full.');
            piece.items.pop();
            this.renderItems(piece);
            this.saveItems(piece);
            sfx('pickup');
          },
        };
      }
      if (piece.items.length === 0 && !pickaxe) {
        return { verb: `${ITEMS[piece.kind].name} · hold an item and press Space to show it off`, key: 'E', blocked: false, run: () => toast(`Select something in your hotbar — ${def.fishOnly ? 'a fish' : 'a fish, a gem, a dish, a stone'} — and press Space to put it on show. Pick the furniture up with the pickaxe.`) };
      }
    }
    if (piece.kind === 'stove' && !(mode === 'use' && pickaxe)) return { verb: 'Cook something', key: 'E', run: () => this.host.openCooking?.() };
    if (piece.kind === 'fireplace' && !(mode === 'use' && pickaxe)) return { verb: 'Warm up by the fire (+15 energy)', key: 'E', run: () => this.host.rest?.() };
    // Bigger pieces come up with the pickaxe so E stays free for using them.
    if ((piece.kind === 'stove' || piece.kind === 'fireplace' || def.display) && !(mode === 'use' && pickaxe)) return null;
    if ((piece.kind === 'stove' || piece.kind === 'fireplace' || def.display) && mode === 'use' && pickaxe) {
      return {
        verb: `Pick up ${ITEMS[piece.kind].name}`,
        key: 'Space',
        run: () => {
          if (this.host.state.inventory.add(piece.kind, 1) > 0) return toast('Your backpack is full.');
          this.removePiece(piece);
          sfx('place', { rate: 1.3 });
        },
      };
    }
    return null;
  }

  private placingKind(): FurnitureKind | null {
    const stack = this.host.state.inventory.selectedStack;
    return stack ? furnitureOf(stack.itemId) : null;
  }

  /** Where a piece would go when facing (tx, ty): wall pieces hang on the wall above. */
  private placementFor(kind: FurnitureKind, tx: number, ty: number): { tx: number; ty: number } | null {
    const def = FURNITURE[kind];
    if (def.layer === 'wall') {
      // Hang on the wall row (row 1) above where you're facing.
      if (ty > 2) return null;
      const spot = { tx, ty: 1 };
      for (let i = 0; i < def.width; i++) if (spot.tx + i <= 0 || spot.tx + i >= this.roomW - 1 || this.pieces.some((p) => FURNITURE[p.kind].layer === 'wall' && this.covers(p, spot.tx + i, 1))) return null;
      return spot;
    }
    for (let dy = 0; dy < def.height; dy++) {
      for (let dx = 0; dx < def.width; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (y < 2 || this.isWall(x, y) || this.inBed(x, y)) return null;
        const feet = this.player.tile;
        if (def.layer === 'object' && x === feet.tx && y === feet.ty) return null;
        if (this.pieces.some((p) => FURNITURE[p.kind].layer === def.layer && this.covers(p, x, y))) return null;
        if (def.layer === 'object' && this.pieces.some((p) => FURNITURE[p.kind].layer === 'object' && this.covers(p, x, y))) return null;
      }
    }
    return { tx, ty };
  }

  private spawn(kind: FurnitureKind, tx: number, ty: number, items: ItemId[] = []): void {
    const size = GAME_CONFIG.tileSize;
    const def = FURNITURE[kind];
    const x = tx * size + (def.width * size) / 2;
    const layer = def.layer;
    const baseY = layer === 'floor' ? ty * size + (def.height * size) / 2 : layer === 'wall' ? ty * size + 6 : (ty + def.height) * size - 1;
    const sprite = this.add
      .image(x, baseY, furnitureTextureKey(kind))
      .setOrigin(0.5, FURNITURE_ORIGIN[kind])
      .setDepth(layer === 'floor' ? DEPTH.floor : layer === 'wall' ? DEPTH.soil : DEPTH.ySortBase + baseY);
    let zone: Phaser.GameObjects.Zone | null = null;
    if (layer === 'object') {
      zone = this.add.zone(x, baseY - 4, def.width * size - 4, 8);
      this.walls.add(zone);
    }
    const glow = def.light ? this.add.image(x, baseY - 22, TEXTURES.light).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setDepth(DEPTH.lighting + 1).setTint(0xffd27a) : null;
    const piece: Piece = { kind, tx, ty, sprite, zone, glow, items: [...items], shown: [] };
    this.pieces.push(piece);
    this.renderItems(piece);
  }

  /** Draws whatever is on show on a display piece. */
  private renderItems(piece: Piece): void {
    for (const s of piece.shown) s.destroy();
    piece.shown = [];
    const def = FURNITURE[piece.kind];
    if (!def.display) return;
    const { sprite } = piece;
    const depth = sprite.depth + 0.5;
    piece.items.forEach((itemId, i) => {
      let x = sprite.x;
      let y = sprite.y;
      let scale = 0.7;
      if (piece.kind === 'display_table') y = sprite.y - 14;
      else if (piece.kind === 'table') {
        x = sprite.x + (i === 0 ? -9 : 9);
        y = sprite.y - 15;
      } else if (piece.kind === 'bench') {
        x = sprite.x + (i === 0 ? -4 : 4);
        y = sprite.y - 7;
        scale = 0.55;
      }
      else if (piece.kind === 'wall_shelf') {
        x = sprite.x + (i === 0 ? -8 : 8);
        y = sprite.y + 2;
      } else if (piece.kind === 'aquarium') {
        x = sprite.x - 9 + i * 9;
        y = sprite.y - 14 - (i % 2) * 4;
        scale = 0.55;
      }
      const img = this.add.image(x, y, itemTextureKey(itemId)).setOrigin(0.5, 1).setScale(scale).setDepth(depth);
      if (piece.kind === 'aquarium') {
        img.setAlpha(0.9);
        this.tweens.add({ targets: img, x: x + 5, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onYoyo: () => img.toggleFlipX(), onRepeat: () => img.toggleFlipX() });
      }
      piece.shown.push(img);
    });
  }

  private saveItems(piece: Piece): void {
    const f = this.interior.furniture.find((x) => x.kind === piece.kind && x.tx === piece.tx && x.ty === piece.ty);
    if (f) f.items = [...piece.items];
    this.onChange(this.interior);
  }

  private removePiece(piece: Piece): void {
    // Whatever was on show goes back in the backpack (or stays if there's no room).
    for (const id of [...piece.items]) {
      if (this.host.state.inventory.add(id, 1) > 0) {
        this.renderItems(piece);
        this.saveItems(piece);
        return void toast('Make room in your backpack for what is on display first.');
      }
      piece.items.shift();
    }
    for (const s of piece.shown) s.destroy();
    piece.sprite.destroy();
    piece.glow?.destroy();
    if (piece.zone) this.walls.remove(piece.zone, true, true);
    this.pieces.splice(this.pieces.indexOf(piece), 1);
    const i = this.interior.furniture.findIndex((f) => f.kind === piece.kind && f.tx === piece.tx && f.ty === piece.ty);
    if (i >= 0) this.interior.furniture.splice(i, 1);
    this.onChange(this.interior);
  }

  private pieceAt(tx: number, ty: number): Piece | undefined {
    // Objects first (they sit on rugs), then wall pieces, then rugs.
    const order = ['object', 'wall', 'floor'] as const;
    for (const layer of order) {
      const p = this.pieces.find((x) => FURNITURE[x.kind].layer === layer && this.covers(x, tx, ty));
      if (p) return p;
    }
    return undefined;
  }

  private covers(p: { kind: FurnitureKind; tx: number; ty: number }, x: number, y: number): boolean {
    const def = FURNITURE[p.kind];
    return x >= p.tx && x < p.tx + def.width && y >= p.ty && y < p.ty + def.height;
  }

  private drawGhost(): void {
    const kind = this.placingKind();
    if (!kind || this.host.isFrozen()) return void this.ghost.setVisible(false);
    const { tx, ty } = this.target();
    const spot = this.placementFor(kind, tx, ty);
    const def = FURNITURE[kind];
    const size = GAME_CONFIG.tileSize;
    const p = spot ?? (def.layer === 'wall' ? { tx, ty: 1 } : { tx, ty });
    const baseY = def.layer === 'floor' ? p.ty * size + (def.height * size) / 2 : def.layer === 'wall' ? p.ty * size + 6 : (p.ty + def.height) * size - 1;
    this.ghost
      .setTexture(furnitureTextureKey(kind))
      .setOrigin(0.5, FURNITURE_ORIGIN[kind])
      .setPosition(p.tx * size + (def.width * size) / 2, baseY)
      .setTint(spot ? 0x9cff9c : 0xff8f80)
      .setVisible(true);
  }

  // ---------- Room ----------

  private isWall(tx: number, ty: number): boolean {
    return tx <= 0 || tx >= this.roomW - 1 || ty <= 1 || ty >= this.roomH - 1;
  }

  private doorTile(): { tx: number; ty: number } {
    return { tx: Math.floor(this.roomW / 2), ty: this.roomH - 1 };
  }

  private isDoor(tx: number, ty: number): boolean {
    const d = this.doorTile();
    return tx === d.tx && ty === d.ty;
  }

  private inBed(tx: number, ty: number): boolean {
    return tx >= this.bed.tx && tx < this.bed.tx + this.bed.w && ty >= this.bed.ty && ty < this.bed.ty + this.bed.h;
  }
}
