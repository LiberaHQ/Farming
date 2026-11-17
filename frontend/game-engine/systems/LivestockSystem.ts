import * as Phaser from 'phaser';
import { BARN, GAME_CONFIG, LIVESTOCK, livestockMorning, livestockName, type LivestockKind, type LivestockSave } from '@farming/shared';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import type { Placed } from './BuildSystem';
import type { FxSystem } from './FxSystem';

interface Beast {
  data: LivestockSave;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  marker: Phaser.GameObjects.Image | null;
  target: { x: number; y: number } | null;
  wait: number;
  graze: number;
}

const SPEC: Record<LivestockKind, { texture: string; originY: number; speed: number; roam: number }> = {
  cow: { texture: TEXTURES.cow, originY: 15 / 16, speed: 14, roam: 44 },
  sheep: { texture: TEXTURES.sheep, originY: 13 / 14, speed: 16, roam: 40 },
};

/** Where a barn's animals gather: just in front of its door. */
export function barnDoor(barn: { tx: number; ty: number }): { x: number; y: number } {
  const size = GAME_CONFIG.tileSize;
  return { x: (barn.tx + 1) * size + size / 2, y: (barn.ty + 1) * size + 12 };
}

/** The barn an animal belongs to (from its home point). */
export function barnOf(a: { homeX: number; homeY: number }): { tx: number; ty: number } {
  const size = GAME_CONFIG.tileSize;
  return { tx: Math.round((a.homeX - size / 2) / size) - 1, ty: Math.round((a.homeY - 12) / size) - 1 };
}

/**
 * Cows and sheep. They graze around their barn, eat its hay each morning,
 * grow happier when fed and petted, and have milk or wool ready for you
 * when they're content.
 */
export class LivestockSystem {
  private readonly beasts: Beast[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: FxSystem,
    private readonly walkable: (x: number, y: number) => boolean,
  ) {}

  restore(list: LivestockSave[] | undefined): void {
    for (const d of list ?? []) this.add({ ...d });
  }

  add(data: LivestockSave): Beast {
    const spec = SPEC[data.kind];
    const sprite = this.scene.add.sprite(data.homeX + Phaser.Math.Between(-20, 20), data.homeY + Phaser.Math.Between(0, 16), spec.texture, 0).setOrigin(0.5, spec.originY);
    const shadow = this.scene.add.image(sprite.x, sprite.y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(data.kind === 'cow' ? 1.3 : 1.1, 1);
    const beast: Beast = { data, sprite, shadow, marker: null, target: null, wait: Phaser.Math.Between(0, 3000), graze: 0 };
    this.beasts.push(beast);
    this.refreshMarker(beast);
    return beast;
  }

  /** A new animal (released by the player). Id and name come from the server in co-op. */
  create(kind: LivestockKind, barn: { tx: number; ty: number }, id?: number, name?: string): LivestockSave {
    const door = barnDoor(barn);
    const nextId = id ?? this.beasts.reduce((m, b) => Math.max(m, b.data.id), 0) + 1;
    const data: LivestockSave = { id: nextId, kind, name: name ?? livestockName(nextId), homeX: door.x, homeY: door.y, happiness: 30, ready: false, pettedDay: 0, fed: false };
    this.add(data);
    this.fx.burst('heart', door.x, door.y - 10, 5);
    return data;
  }

  /** How many animals live in a barn. */
  countIn(barn: { tx: number; ty: number }): number {
    return this.beasts.filter((b) => {
      const home = barnOf(b.data);
      return home.tx === barn.tx && home.ty === barn.ty;
    }).length;
  }

  /** A barn with room for one more animal. */
  barnWithSpace(barns: Placed[]): Placed | undefined {
    return barns.find((b) => this.countIn(b) < BARN.capacity);
  }

  /** The animal standing on a tile (generous: big animals cover more than one). */
  at(tx: number, ty: number): LivestockSave | undefined {
    const size = GAME_CONFIG.tileSize;
    const cx = tx * size + size / 2;
    const cy = ty * size + size / 2;
    return this.beasts.find((b) => Math.abs(b.sprite.x - cx) < 14 && Math.abs(b.sprite.y - 6 - cy) < 11)?.data;
  }

  get(id: number): LivestockSave | undefined {
    return this.beasts.find((b) => b.data.id === id)?.data;
  }

  occupies(tx: number, ty: number): boolean {
    return !!this.at(tx, ty);
  }

  pet(id: number, day: number): boolean {
    const b = this.beasts.find((x) => x.data.id === id);
    if (!b || b.data.pettedDay === day) return false;
    b.data.pettedDay = day;
    b.data.happiness = Math.min(100, b.data.happiness + BARN.petted);
    this.fx.burst('heart', b.sprite.x, b.sprite.y - 16, 5);
    b.wait = 1500;
    b.target = null;
    return true;
  }

  /** Takes the milk or wool. Returns false if there was none. */
  collect(id: number): boolean {
    const b = this.beasts.find((x) => x.data.id === id);
    if (!b || !b.data.ready) return false;
    b.data.ready = false;
    this.refreshMarker(b);
    this.fx.burst('sparkle', b.sprite.x, b.sprite.y - 14, 6);
    return true;
  }

  /** Single-player morning (co-op gets the result from the server). */
  morning(barns: Placed[]): void {
    const troughs = barns.map((b) => ({ tx: b.tx, ty: b.ty, hay: b.hay ?? 0, placed: b }));
    livestockMorning(
      this.beasts.map((b) => b.data),
      troughs,
      (a) => barnOf(a),
    );
    for (const t of troughs) t.placed.hay = t.hay;
    for (const b of this.beasts) {
      b.sprite.setPosition(b.data.homeX, b.data.homeY + 8);
      this.refreshMarker(b);
    }
  }

  serialize(): LivestockSave[] {
    return this.beasts.map((b) => ({ ...b.data }));
  }

  /** Name and mood for the action button. */
  describe(a: LivestockSave): string {
    const mood = a.happiness >= 70 ? 'very happy' : a.happiness >= 35 ? 'content' : a.happiness >= BARN.produceAt ? 'a bit glum' : 'unhappy';
    return `${a.name} the ${LIVESTOCK[a.kind].name.toLowerCase()} · ${mood}`;
  }

  /** Called when the server says an animal changed (co-op). */
  refresh(id: number): void {
    const b = this.beasts.find((x) => x.data.id === id);
    if (b) this.refreshMarker(b);
  }

  update(delta: number, night: boolean): void {
    for (const b of this.beasts) {
      const s = b.sprite;
      const spec = SPEC[b.data.kind];
      if (b.marker) b.marker.setPosition(s.x, s.y - (b.data.kind === 'cow' ? 20 : 17) + Math.sin(this.scene.time.now / 300) * 1.2);
      if (night) {
        s.setFrame(0);
      } else if (!b.target) {
        b.wait -= delta;
        b.graze -= delta;
        if (b.graze <= 0) {
          s.setFrame(Number(s.frame.name) === 1 ? 0 : 1);
          b.graze = Phaser.Math.Between(900, 3200);
        }
        if (b.wait <= 0) {
          b.target = { x: b.data.homeX + Phaser.Math.Between(-spec.roam, spec.roam), y: b.data.homeY + Phaser.Math.Between(0, spec.roam) };
          s.setFrame(0);
        }
      } else {
        const dx = b.target.x - s.x;
        const dy = b.target.y - s.y;
        const dist = Math.hypot(dx, dy);
        const step = Math.min(dist, (spec.speed * delta) / 1000);
        const nx = s.x + (dx / (dist || 1)) * step;
        const ny = s.y + (dy / (dist || 1)) * step;
        const size = GAME_CONFIG.tileSize;
        if (dist < 1 || !this.walkable(Math.floor(nx / size), Math.floor((ny - 2) / size))) {
          b.target = null;
          b.wait = Phaser.Math.Between(2000, 6000);
        } else {
          s.setPosition(nx, ny).setFlipX(dx > 0);
        }
      }
      s.setDepth(DEPTH.ySortBase + s.y);
      b.shadow.setPosition(s.x, s.y - 1);
    }
  }

  private refreshMarker(b: Beast): void {
    if (b.data.ready && !b.marker) {
      b.marker = this.scene.add.image(b.sprite.x, b.sprite.y - 18, TEXTURES.ready).setDepth(DEPTH.fx - 5);
    } else if (!b.data.ready && b.marker) {
      b.marker.destroy();
      b.marker = null;
    }
  }
}
