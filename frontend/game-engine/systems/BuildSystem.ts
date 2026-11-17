import type * as Phaser from 'phaser';
import {
  isStorage,
  STORAGE_SIZE,
  GAME_CONFIG,
  greenhouseArea,
  isMachineKind,
  PLACEABLES,
  Terrain,
  underGlass,
  isItemId,
  type ItemId,
  type MachineState,
  type PlaceableKind,
  type PlacedSave,
} from '@farming/shared';
import { fenceTextureKey, placeableTextureKey, TEXTURES, type SpritePlaceable } from '../assets/registerTextures';
import { TILE } from '../assets/tileIndex';
import { DEPTH } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import { terrainAt, type WorldData } from '../maps/WorldData';
import { Inventory, type InventorySlot } from '../state/Inventory';
import type { LightSource } from './LightingSystem';
import type { FxSystem } from './FxSystem';
import type { Occluder, OcclusionSystem } from './OcclusionSystem';

export interface Placed {
  kind: PlaceableKind;
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Image | null;
  shadow: Phaser.GameObjects.Image | null;
  zone: Phaser.GameObjects.Zone | null;
  occluder: Occluder | null;
  /** Chests only. */
  storage: Inventory | null;
  /** Kegs and jars: what's brewing. */
  machine?: MachineState | null;
  /** Barns: hay in the trough. */
  hay?: number;
  /** "Ready!" marker above a finished machine; the glass outline of a greenhouse's patch. */
  marker?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics | null;
}

export type { PlacedSave } from '@farming/shared';

interface Visual {
  originY: number;
  collider: { width: number; height: number };
}

const VISUALS: Partial<Record<PlaceableKind, Visual>> = {
  fence: { originY: 1, collider: { width: 16, height: 6 } },
  lamp_post: { originY: 33 / 34, collider: { width: 6, height: 5 } },
  chest: { originY: 15 / 16, collider: { width: 12, height: 7 } },
  cottage: { originY: 75 / 76, collider: { width: 48, height: 12 } },
  sprinkler: { originY: 15 / 16, collider: { width: 8, height: 5 } },
  iron_sprinkler: { originY: 13 / 14, collider: { width: 8, height: 5 } },
  gold_sprinkler: { originY: 13 / 14, collider: { width: 8, height: 5 } },
  silo: { originY: 45 / 46, collider: { width: 26, height: 10 } },
  well: { originY: 31 / 32, collider: { width: 26, height: 8 } },
  shed: { originY: 39 / 40, collider: { width: 44, height: 14 } },
  statue: { originY: 27 / 28, collider: { width: 10, height: 5 } },
  flower_bed: { originY: 11 / 12, collider: { width: 14, height: 6 } },
  birdbath: { originY: 17 / 18, collider: { width: 8, height: 5 } },
  gnome: { originY: 15 / 16, collider: { width: 6, height: 4 } },
  collector: { originY: 15 / 16, collider: { width: 10, height: 6 } },
  cabin: { originY: 35 / 36, collider: { width: 28, height: 10 } },
  bench: { originY: 13 / 14, collider: { width: 14, height: 5 } },
  flower_pot: { originY: 17 / 18, collider: { width: 8, height: 5 } },
  scarecrow: { originY: 27 / 28, collider: { width: 6, height: 4 } },
  keg: { originY: 21 / 22, collider: { width: 12, height: 6 } },
  preserves_jar: { originY: 17 / 18, collider: { width: 10, height: 5 } },
  greenhouse: { originY: 43 / 44, collider: { width: 46, height: 14 } },
  barn: { originY: 45 / 46, collider: { width: 44, height: 14 } },
  cheese_press: { originY: 19 / 20, collider: { width: 12, height: 6 } },
  loom: { originY: 19 / 20, collider: { width: 14, height: 6 } },
  mailbox: { originY: 19 / 20, collider: { width: 8, height: 5 } },
  shipping_bin: { originY: 15 / 16, collider: { width: 14, height: 8 } },
  crab_pot: { originY: 13 / 14, collider: { width: 1, height: 1 } },
};

/**
 * Player-built structures: fences (auto-connecting), floor paths, lamp posts,
 * chests, and the player's cottage. Owns their sprites, colliders, storage
 * and light sources, and serialises them for saving.
 */
export class BuildSystem {
  private readonly byTile = new Map<number, Placed>();
  private readonly all = new Set<Placed>();
  /** Chest whose contents the UI is currently showing. */
  openChest: Placed | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
    private readonly floor: Phaser.Tilemaps.TilemapLayer,
    private readonly obstacles: Phaser.Physics.Arcade.StaticGroup,
    private readonly occlusion: OcclusionSystem,
    private readonly fx: FxSystem,
  ) {
    floor.setDepth(DEPTH.floor);
  }

  at(tx: number, ty: number): Placed | undefined {
    return this.byTile.get(this.key(tx, ty));
  }

  /** Tiles kept clear for landmarks (villagers' houses, the museum): nothing can be built or dug there. */
  reserved: (tx: number, ty: number) => boolean = () => false;

  isBlocked(tx: number, ty: number): boolean {
    return this.byTile.has(this.key(tx, ty)) || this.reserved(tx, ty);
  }

  /** Tiles a placement of `kind` at (tx, ty) would cover. */
  footprint(kind: PlaceableKind, tx: number, ty: number): Array<[number, number]> {
    return Array.from({ length: PLACEABLES[kind].width }, (_, i) => [tx + i, ty] as [number, number]);
  }

  /**
   * Whether `kind` can go at (tx, ty). `occupied` reports tiles taken by other
   * systems (resources, soil, animals, the player).
   */
  canPlace(kind: PlaceableKind, tx: number, ty: number, occupied: (tx: number, ty: number) => boolean): boolean {
    return this.footprint(kind, tx, ty).every(
      ([x, y]) => terrainAt(this.world, x, y) === (PLACEABLES[kind].onWater ? Terrain.Water : Terrain.Grass) && !this.isBlocked(x, y) && !occupied(x, y),
    );
  }

  place(kind: PlaceableKind, tx: number, ty: number, items?: InventorySlot[], machine?: MachineState | null, hay?: number): Placed {
    const size = GAME_CONFIG.tileSize;
    const def = PLACEABLES[kind];
    const placed: Placed = { kind, tx, ty, sprite: null, shadow: null, zone: null, occluder: null, storage: null };

    if (def.floor) {
      this.floor.putTileAt(kind === 'wood_path' ? TILE.WOOD_PATH : TILE.STONE_PATH, tx, ty);
    } else {
      const visual = VISUALS[kind]!;
      const x = tx * size + (def.width * size) / 2;
      const baseY = kind === 'fence' ? ty * size + size : ty * size + size - 2;
      const texture = kind === 'fence' ? fenceTextureKey(false, false) : placeableTextureKey(kind as SpritePlaceable);
      placed.sprite = this.scene.add
        .image(x, baseY, texture)
        .setOrigin(0.5, visual.originY)
        .setDepth(DEPTH.ySortBase + baseY);
      if (kind !== 'fence') {
        placed.shadow = this.scene.add
          .image(x, baseY - 1, kind === 'cottage' ? TEXTURES.shadowLarge : TEXTURES.shadowSmall)
          .setDepth(DEPTH.shadow)
          .setScale(kind === 'cottage' ? 3 : 1, 1);
      }
      const { width, height } = visual.collider;
      placed.zone = this.scene.add.zone(x, baseY - height / 2 - (kind === 'fence' ? 2 : 0), width, height);
      this.obstacles.add(placed.zone);
      if (kind === 'cottage') {
        placed.occluder = { sprite: placed.sprite, x, baseY, halfWidth: 32, height: 70 };
        this.occlusion.add(placed.occluder, tx + 1, ty);
      }
    }

    if (isStorage(kind)) {
      placed.storage = new Inventory(STORAGE_SIZE[kind]!, 0, () => {
        if (this.openChest === placed) this.emitChest();
      });
      for (const s of items ?? []) if (s && isItemId(s.itemId) && s.quantity > 0) placed.storage.add(s.itemId, s.quantity, s.q ?? 0);
    }

    if (isMachineKind(kind)) placed.machine = machine ?? null;
    if (kind === 'barn') placed.hay = Math.max(0, Math.floor(hay ?? 0));
    if (kind === 'greenhouse') placed.marker = this.drawGlassPatch(tx, ty);

    for (const [x, y] of this.footprint(kind, tx, ty)) this.byTile.set(this.key(x, y), placed);
    this.all.add(placed);
    if (kind === 'fence') this.refreshFences(tx, ty);
    return placed;
  }

  /** Removes a structure and returns the item it gives back (or null). */
  /** Takes a piece down. Fixed buildings (no item) only go when `force` is set. */
  remove(placed: Placed, force = false): ItemId | null {
    const def = PLACEABLES[placed.kind];
    if (!def.item && !force) return null;
    for (const [x, y] of this.footprint(placed.kind, placed.tx, placed.ty)) this.byTile.delete(this.key(x, y));
    this.all.delete(placed);
    if (def.floor) this.floor.removeTileAt(placed.tx, placed.ty);
    placed.sprite?.destroy();
    placed.shadow?.destroy();
    placed.marker?.destroy();
    if (placed.zone) this.obstacles.remove(placed.zone, true, true);
    const size = GAME_CONFIG.tileSize;
    this.fx.burst(def.floor || placed.kind === 'lamp_post' ? 'stone' : 'wood', placed.tx * size + 8, placed.ty * size + 10, 6);
    if (placed.kind === 'fence') this.refreshFences(placed.tx, placed.ty);
    return def.item;
  }

  /** Sets a chest's contents (co-op: the server owns shared chests). */
  setChestItems(tx: number, ty: number, items: readonly (InventorySlot | null)[]): void {
    this.at(tx, ty)?.storage?.replace(items);
  }

  /** Whether a tile is in a greenhouse's sheltered patch (crops there grow in any season). */
  isSheltered(tx: number, ty: number): boolean {
    return underGlass([...this.all], tx, ty);
  }

  /** Loads (state) or empties (null) a keg or jar. */
  setMachine(placed: Placed, state: MachineState | null, now: number): void {
    placed.machine = state;
    this.refreshMachine(placed, now);
  }

  /** A bobbing marker above any structure (e.g. new mail). */
  showMarker(p: Placed, on: boolean): void {
    if (on && !p.marker && p.sprite) {
      const marker = this.scene.add.image(p.sprite.x, p.sprite.getBounds().top - 4, TEXTURES.ready).setDepth(DEPTH.ySortBase + p.sprite.y + 1);
      this.scene.tweens.add({ targets: marker, y: marker.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      p.marker = marker;
    } else if (!on && p.marker) {
      p.marker.destroy();
      p.marker = null;
    }
  }

  /** Shows the "ready" marker on machines that have finished. Call on each clock tick. */
  refreshMachines(now: number): void {
    for (const p of this.all) if (isMachineKind(p.kind)) this.refreshMachine(p, now);
  }

  private refreshMachine(p: Placed, now: number): void {
    const ready = !!p.machine && now >= p.machine.readyAt;
    if (ready && !p.marker && p.sprite) {
      const size = GAME_CONFIG.tileSize;
      const marker = this.scene.add.image(p.tx * size + size / 2, p.sprite.getBounds().top - 4, TEXTURES.ready).setDepth(DEPTH.ySortBase + p.ty * size + size);
      this.scene.tweens.add({ targets: marker, y: marker.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      p.marker = marker;
    } else if (!ready && p.marker) {
      p.marker.destroy();
      p.marker = null;
    }
    // Working machines bubble now and then.
    if (p.machine && !ready && p.sprite && Math.random() < 0.3) this.fx.burst('water', p.sprite.x, p.sprite.getBounds().top + 2, 2);
  }

  /** A faint glass-coloured outline of the patch a greenhouse shelters. */
  private drawGlassPatch(tx: number, ty: number): Phaser.GameObjects.Graphics {
    const size = GAME_CONFIG.tileSize;
    const a = greenhouseArea({ tx, ty });
    const g = this.scene.add.graphics().setDepth(DEPTH.soil + 0.5);
    const x = a.x0 * size;
    const y = a.y0 * size;
    const w = (a.x1 - a.x0 + 1) * size;
    const h = (a.y1 - a.y0 + 1) * size;
    g.fillStyle(0xbfe6e8, 0.08).fillRect(x, y, w, h);
    g.lineStyle(1, 0xe8f8f8, 0.35).strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return g;
  }

  /** Every placed structure of one kind. */
  ofKind(kind: PlaceableKind): Placed[] {
    return [...this.all].filter((p) => p.kind === kind);
  }

  /** Light sources for the night: lamp posts and the cottage's windows. */
  lights(): LightSource[] {
    const size = GAME_CONFIG.tileSize;
    const out: LightSource[] = [];
    for (const p of this.all) {
      if (p.kind === 'lamp_post') out.push({ x: p.tx * size + 8, y: p.ty * size + 4, radius: PLACEABLES.lamp_post.light! });
      if (p.kind === 'cottage') {
        const baseY = p.ty * size + size - 2;
        // The two front windows and the lantern by the door.
        out.push({ x: p.tx * size + 7, y: baseY - 30, radius: 32 }, { x: p.tx * size + 40, y: baseY - 30, radius: 32 }, { x: p.tx * size + 33, y: baseY - 32, radius: 24 });
      }
    }
    return out;
  }

  openChestUi(placed: Placed): void {
    this.openChest = placed;
    this.emitChest();
  }

  emitChest(): void {
    if (this.openChest?.storage) gameEvents.emit('chest:contents', { slots: this.openChest.storage.snapshot().slots });
  }

  serialize(): PlacedSave[] {
    return [...this.all].map((p) => ({
      kind: p.kind,
      tx: p.tx,
      ty: p.ty,
      ...(p.storage ? { items: p.storage.snapshot().slots } : {}),
      ...(p.machine ? { machine: { ...p.machine } } : {}),
      ...(p.kind === 'barn' ? { hay: p.hay ?? 0 } : {}),
    }));
  }

  private refreshFences(tx: number, ty: number): void {
    for (const x of [tx - 1, tx, tx + 1]) {
      const p = this.at(x, ty);
      if (p?.kind !== 'fence' || !p.sprite) continue;
      const east = this.at(x + 1, ty)?.kind === 'fence';
      const west = this.at(x - 1, ty)?.kind === 'fence';
      p.sprite.setTexture(fenceTextureKey(east, west));
    }
  }

  private key(tx: number, ty: number): number {
    return ty * this.world.width + tx;
  }
}

export function chestIsEmpty(placed: Placed): boolean {
  return !placed.storage || placed.storage.slots.every((s) => s === null);
}

