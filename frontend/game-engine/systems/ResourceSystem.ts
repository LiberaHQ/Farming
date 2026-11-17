import * as Phaser from 'phaser';
import { skills } from '../state/skills';
import {
  BERRY_REGROW_DAYS,
  BERRY_YIELD,
  GAME_CONFIG,
  RESOURCES,
  type ResourceDef,
  type ResourceSave,
  type Season,
  type ToolKind,
  type WorldObjectKind,
  type WorldObjectSpec,
} from '@farming/shared';
import { objectTextureKey, TEXTURES, type FxKind } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import type { DropSystem } from './DropSystem';
import type { FxSystem } from './FxSystem';
import type { GrassRustleSystem } from './GrassRustleSystem';
import type { Occluder, OcclusionSystem } from './OcclusionSystem';

interface ObjectDef {
  /** Pixel row of the sprite's base, divided by its height. */
  originY: number;
  /** Width in tiles (footprint), default 1. */
  widthTiles?: number;
  /** Feet-level collision box (centred on the base), or none if walkable. */
  collider?: { width: number; height: number };
  shadow?: string;
  /** Tall objects that can hide the player behind them. */
  occluder?: { halfWidth: number; height: number };
  /** Particle colour when hit. */
  fx: FxKind;
}

const sameSpec = (a: WorldObjectSpec | null, b: WorldObjectSpec) =>
  !!a && a.kind === b.kind && a.tx === b.tx && a.ty === b.ty && a.variant === b.variant;

const OBJECT_DEFS: Record<WorldObjectKind, ObjectDef> = {
  oak: { originY: 41 / 44, collider: { width: 10, height: 6 }, shadow: TEXTURES.shadowLarge, occluder: { halfWidth: 14, height: 40 }, fx: 'wood' },
  pine: { originY: 44 / 46, collider: { width: 8, height: 6 }, shadow: TEXTURES.shadowLarge, occluder: { halfWidth: 12, height: 42 }, fx: 'wood' },
  rock: { originY: 13 / 14, collider: { width: 12, height: 7 }, shadow: TEXTURES.shadowSmall, fx: 'stone' },
  copperRock: { originY: 13 / 14, collider: { width: 12, height: 7 }, shadow: TEXTURES.shadowSmall, fx: 'stone' },
  bush: { originY: 13 / 14, collider: { width: 12, height: 6 }, shadow: TEXTURES.shadowSmall, fx: 'leaf' },
  stump: { originY: 11 / 12, collider: { width: 10, height: 6 }, shadow: TEXTURES.shadowSmall, fx: 'wood' },
  tallGrass: { originY: 1, fx: 'leaf' },
  mine: { originY: 39 / 40, widthTiles: 2, collider: { width: 34, height: 14 }, fx: 'stone' },
  board: { originY: 25 / 26, collider: { width: 14, height: 6 }, shadow: TEXTURES.shadowSmall, fx: 'wood' },
  stall: { originY: 45 / 46, widthTiles: 2, collider: { width: 34, height: 8 }, shadow: TEXTURES.shadowLarge, occluder: { halfWidth: 20, height: 42 }, fx: 'wood' },
};

export interface WorldNode {
  spec: WorldObjectSpec;
  x: number;
  baseY: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image | null;
  zone: Phaser.GameObjects.Zone | null;
  occluder: Occluder | null;
  hp: number;
  hasBerries: boolean;
  /** Day the berries come back after picking. */
  berryDueDay: number | null;
  /** For stumps left by felled trees: the tree that will regrow here. */
  regrowsInto: WorldObjectSpec | null;
  alive: boolean;
  /** Waiting for the server to confirm this player destroyed it. */
  claiming?: boolean;
}

export type HitResult = 'damaged' | 'destroyed' | 'immune';

export type { NodeSave, ResourceSave } from '@farming/shared';

interface Deps {
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  occlusion: OcclusionSystem;
  rustle: GrassRustleSystem;
  fx: FxSystem;
  drops: DropSystem;
  /** Tiles claimed by something else (e.g. tilled soil) block respawns. */
  isTileReserved: (tx: number, ty: number) => boolean;
  playerPosition: () => { x: number; y: number };
  /**
   * Called before a node is destroyed by the player. Single-player proceeds
   * at once; in co-op the server first confirms nobody else got there first.
   */
  claim: (node: WorldNode, proceed: () => void) => void;
}


/**
 * Owns every environmental object: spawning, hits, destruction, drops and
 * respawning. Other systems query it by tile.
 */
export class ResourceSystem {
  private readonly byTile = new Map<number, WorldNode>();
  private pending: Array<{ spec: WorldObjectSpec; dueDay: number }> = [];
  private season: Season = 'spring';
  private day = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldWidth: number,
    private readonly deps: Deps,
  ) {}

  /** Sets the calendar before spawning, so art and berries match the season. */
  setCalendar(day: number, season: Season): void {
    this.day = day;
    this.season = season;
  }

  spawnAll(specs: WorldObjectSpec[]): void {
    for (const spec of specs) this.spawn(spec);
  }

  /** Daily upkeep: seasonal art, berries regrowing, due respawns. */
  onNewDay(day: number, season: Season): void {
    this.day = day;
    if (season !== this.season) {
      this.season = season;
      for (const node of this.nodes()) {
        if (node.spec.kind === 'bush' && node.spec.variant === 1) node.hasBerries = season !== 'winter';
        this.refreshTexture(node);
      }
    }
    for (const node of this.nodes()) {
      if (node.spec.kind === 'bush' && !node.hasBerries && node.berryDueDay !== null && day >= node.berryDueDay && season !== 'winter') {
        node.hasBerries = true;
        node.berryDueDay = null;
        this.refreshTexture(node);
      }
    }
    const due = this.pending.filter((p) => p.dueDay <= day);
    this.pending = this.pending.filter((p) => p.dueDay > day);
    for (const p of due) if (!this.tryRespawn(p.spec)) this.pending.push({ spec: p.spec, dueDay: day + 1 });
  }

  serialize(): ResourceSave {
    return {
      nodes: this.nodes().map((n) => ({ spec: n.spec, hasBerries: n.hasBerries, berryDueDay: n.berryDueDay, regrowsInto: n.regrowsInto })),
      pending: this.pending.map((p) => ({ spec: p.spec, dueDay: p.dueDay })),
    };
  }

  restore(save: ResourceSave): void {
    for (const n of save.nodes) {
      const node = this.spawn(n.spec, { regrowsInto: n.regrowsInto ?? undefined });
      node.hasBerries = !!n.hasBerries;
      node.berryDueDay = n.berryDueDay ?? null;
      this.refreshTexture(node);
    }
    this.pending = save.pending.map((p) => ({ spec: p.spec, dueDay: p.dueDay }));
  }

  /** Removes stalls, notice boards and mine entrances that aren't where the map now puts them (the market moved, which moved the mine). */
  pruneFixtures(valid: WorldObjectSpec[]): void {
    const keep = new Set(valid.map((o) => `${o.kind}:${o.tx},${o.ty}`));
    for (const node of [...this.nodes()]) {
      const { kind, tx, ty } = node.spec;
      if ((kind === 'stall' || kind === 'board' || kind === 'mine') && !keep.has(`${kind}:${tx},${ty}`)) {
        this.remove(node);
        node.sprite.destroy();
      }
    }
  }

  /**
   * Makes sure a fixed structure (stall, notice board) exists — used when an
   * older save predates it. Clears whatever grew in its way.
   */
  ensure(spec: WorldObjectSpec): void {
    const width = OBJECT_DEFS[spec.kind].widthTiles ?? 1;
    const here = this.nodeAt(spec.tx, spec.ty);
    if (here && here.spec.kind === spec.kind && here.spec.variant === spec.variant) return;
    for (let i = 0; i < width; i++) {
      const node = this.nodeAt(spec.tx + i, spec.ty);
      if (node) {
        this.remove(node);
        node.sprite.destroy();
      }
    }
    this.spawn(spec);
  }

  /** Removes natural objects (trees, rocks…) inside an area, e.g. the market in an older save. */
  clearArea(area: { x0: number; y0: number; x1: number; y1: number }): void {
    for (const node of this.nodes()) {
      const { tx, ty, kind } = node.spec;
      if (kind === 'stall' || kind === 'board' || kind === 'mine') continue;
      if (tx >= area.x0 && tx <= area.x1 && ty >= area.y0 && ty <= area.y1) {
        this.remove(node);
        node.sprite.destroy();
      }
    }
    this.pending = this.pending.filter(
      (p) => !(p.spec.tx >= area.x0 && p.spec.tx <= area.x1 && p.spec.ty >= area.y0 && p.spec.ty <= area.y1),
    );
  }

  /** Hides trees, rocks and bushes well outside the camera (cheaper rendering on big maps). */
  cull(view: { x: number; y: number; right: number; bottom: number }): void {
    const m = 64;
    for (const n of this.nodes()) {
      if (!n.alive) continue;
      const on = n.x > view.x - m && n.x < view.right + m && n.baseY > view.y - m && n.baseY < view.bottom + m + 48;
      if (n.sprite.visible !== on) {
        n.sprite.setVisible(on);
        n.shadow?.setVisible(on);
      }
    }
  }

  /** Every object's kind and tile, for the world map. */
  markers(): Array<{ kind: WorldObjectKind; tx: number; ty: number }> {
    return this.nodes().map((n) => ({ kind: n.spec.kind, tx: n.spec.tx, ty: n.spec.ty }));
  }

  /** A random tree standing inside a rectangle (for lightning). */
  randomTreeIn(rect: { x: number; y: number; width: number; height: number }): WorldNode | null {
    const trees = this.nodes().filter(
      (n) => (n.spec.kind === 'oak' || n.spec.kind === 'pine') && n.x > rect.x + 16 && n.x < rect.x + rect.width - 16 && n.baseY > rect.y + 40 && n.baseY < rect.y + rect.height,
    );
    return trees.length ? trees[Math.floor(Math.random() * trees.length)] : null;
  }

  private nodes(): WorldNode[] {
    return [...new Set(this.byTile.values())];
  }

  private refreshTexture(node: WorldNode): void {
    node.sprite.setTexture(this.textureFor(node.spec, node.hasBerries));
  }

  private textureFor(spec: WorldObjectSpec, hasBerries: boolean): string {
    const variant = spec.kind === 'bush' ? (hasBerries ? 1 : 0) : spec.variant;
    return objectTextureKey(spec.kind, variant, this.season);
  }

  nodeAt(tx: number, ty: number): WorldNode | undefined {
    return this.byTile.get(this.key(tx, ty));
  }

  isBlocked(tx: number, ty: number): boolean {
    return this.byTile.has(this.key(tx, ty));
  }

  /** Which tool (if any) can break this node. */
  defFor(node: WorldNode): ResourceDef | undefined {
    return RESOURCES[node.spec.kind];
  }

  spawn(spec: WorldObjectSpec, options: { regrowsInto?: WorldObjectSpec; animate?: boolean } = {}): WorldNode {
    const size = GAME_CONFIG.tileSize;
    const def = OBJECT_DEFS[spec.kind];
    const widthTiles = def.widthTiles ?? 1;
    const x = spec.tx * size + (widthTiles * size) / 2;
    const baseY = spec.kind === 'tallGrass' ? spec.ty * size + size : spec.ty * size + size - 2;

    const hasBerries = spec.kind === 'bush' && spec.variant === 1 && this.season !== 'winter';
    const sprite = this.scene.add
      .image(x, baseY, this.textureFor(spec, hasBerries))
      .setOrigin(0.5, def.originY)
      .setDepth(DEPTH.ySortBase + baseY);
    const shadow = def.shadow ? this.scene.add.image(x, baseY - 1, def.shadow).setDepth(DEPTH.shadow) : null;

    let zone: Phaser.GameObjects.Zone | null = null;
    if (def.collider) {
      const { width, height } = def.collider;
      zone = this.scene.add.zone(x, baseY - height / 2, width, height);
      this.deps.obstacles.add(zone);
    }

    const node: WorldNode = {
      spec,
      x,
      baseY,
      sprite,
      shadow,
      zone,
      occluder: null,
      hp: RESOURCES[spec.kind]?.hp ?? 0,
      hasBerries,
      berryDueDay: null,
      regrowsInto: options.regrowsInto ?? null,
      alive: true,
    };
    if (def.occluder) {
      node.occluder = { sprite, x, baseY, ...def.occluder };
      this.deps.occlusion.add(node.occluder, spec.tx, spec.ty);
    }
    if (spec.kind === 'tallGrass') this.deps.rustle.add(sprite, spec.tx, spec.ty);
    for (let i = 0; i < widthTiles; i++) this.byTile.set(this.key(spec.tx + i, spec.ty), node);
    if (options.animate) this.deps.fx.pop(sprite);
    return node;
  }

  hit(node: WorldNode, tool: { kind: ToolKind; power: number } | null): HitResult {
    const def = this.defFor(node);
    if (!node.alive || !def || node.claiming) return 'immune';
    if (def.tool !== 'any' && tool?.kind !== def.tool) {
      this.deps.fx.shake(node.sprite);
      sfx('clunk');
      return 'immune';
    }
    const objectDef = OBJECT_DEFS[node.spec.kind];
    node.hp -= def.tool === 'any' ? node.hp : (tool?.power ?? 1);
    this.deps.fx.burst(objectDef.fx, node.x, node.baseY - 6, 5);
    const kind = node.spec.kind;
    if (kind === 'tallGrass') sfx('swish');
    else if (objectDef.fx === 'stone') sfx('mine');
    else sfx('chop', { rate: kind === 'bush' ? 1.25 : 1 });
    if (node.hp > 0) {
      this.deps.fx.shake(node.sprite);
      return 'damaged';
    }
    node.claiming = true;
    this.deps.claim(node, () => {
      node.claiming = false;
      if (node.alive) this.destroy(node, def, true);
    });
    // If the claim is refused the node is already gone for someone else; the server's update removes it.
    return 'destroyed';
  }

  /** Another co-op player destroyed the node on this tile (they got the drops). */
  destroyAt(tx: number, ty: number): void {
    const node = this.nodeAt(tx, ty);
    const def = node ? this.defFor(node) : undefined;
    if (node && def) this.destroy(node, def, false);
  }

  /** Picks berries from a berry bush. Returns false if there are none. */
  pickBerries(node: WorldNode, drops = true): boolean {
    if (!node.alive || !node.hasBerries) return false;
    node.hasBerries = false;
    node.berryDueDay = this.day + BERRY_REGROW_DAYS;
    sfx('rustle');
    this.refreshTexture(node);
    this.deps.fx.shake(node.sprite);
    this.deps.fx.burst('leaf', node.x, node.baseY - 6, 4);
    if (drops) {
      this.deps.drops.spawn('berries', Phaser.Math.Between(BERRY_YIELD[0], BERRY_YIELD[1]) + (skills.bonus('foraging') ? 1 : 0), node.x, node.baseY - 4);
      skills.gain('foraging', 3);
    }
    return true;
  }

  private destroy(node: WorldNode, def: ResourceDef, drops: boolean): void {
    this.remove(node);
    const { x, baseY, spec } = node;

    // Visual exit: trees topple, everything else bursts.
    const sprite = node.sprite;
    this.scene.tweens.killTweensOf(sprite);
    if (spec.kind === 'oak' || spec.kind === 'pine') {
      const lean = this.deps.playerPosition().x < x ? 1 : -1;
      this.scene.tweens.add({
        targets: sprite,
        angle: 80 * lean,
        alpha: 0,
        duration: 650,
        ease: 'Quad.easeIn',
        onComplete: () => sprite.destroy(),
      });
      this.scene.time.delayedCall(520, () => this.deps.fx.burst('leaf', x + 26 * lean, baseY - 8, 14));
      sfx('treeFall');
    } else {
      sprite.destroy();
      this.deps.fx.burst(OBJECT_DEFS[spec.kind].fx, x, baseY - 6, 10);
      if (OBJECT_DEFS[spec.kind].fx === 'stone') sfx('rockBreak');
      else if (spec.kind === 'bush') sfx('rustle');
    }

    const skill = def.tool === 'pickaxe' ? 'mining' : 'foraging';
    for (const drop of drops ? def.drops : []) {
      if (drop.chance !== undefined && Math.random() > drop.chance) continue;
      this.deps.drops.spawn(drop.itemId, Phaser.Math.Between(drop.min, drop.max) + (skills.bonus(skill) ? 1 : 0), x, baseY - 6);
    }
    if (drops) skills.gain(skill, spec.kind === 'oak' || spec.kind === 'pine' ? 8 : spec.kind === 'rock' ? 4 : spec.kind === 'stump' ? 5 : 7);

    if (def.leaves) {
      // The stump stands in for the tree until it regrows.
      this.spawn({ kind: def.leaves, tx: spec.tx, ty: spec.ty, variant: 0 }, { regrowsInto: spec });
      this.pending.push({ spec, dueDay: this.day + def.respawnDays });
    } else if (!node.regrowsInto) {
      this.pending.push({ spec, dueDay: this.day + def.respawnDays });
    }
  }

  private remove(node: WorldNode): void {
    node.alive = false;
    const widthTiles = OBJECT_DEFS[node.spec.kind].widthTiles ?? 1;
    for (let i = 0; i < widthTiles; i++) {
      const k = this.key(node.spec.tx + i, node.spec.ty);
      if (this.byTile.get(k) === node) this.byTile.delete(k);
    }
    node.shadow?.destroy();
    if (node.zone) this.deps.obstacles.remove(node.zone, true, true);
    if (node.occluder) {
      node.occluder.sprite.alpha = 1;
      this.deps.occlusion.remove(node.occluder, node.spec.tx, node.spec.ty);
    }
    if (node.spec.kind === 'tallGrass') this.deps.rustle.remove(node.spec.tx, node.spec.ty);
  }

  /** Returns false if the spot is temporarily unavailable (try again tomorrow). */
  private tryRespawn(spec: WorldObjectSpec): boolean {
    const existing = this.nodeAt(spec.tx, spec.ty);
    if (existing && existing.regrowsInto !== spec && !sameSpec(existing.regrowsInto, spec)) return true; // something else lives here now
    if (this.deps.isTileReserved(spec.tx, spec.ty)) return true; // the player built or farmed here: give up

    // Don't grow a solid object on top of the player.
    const size = GAME_CONFIG.tileSize;
    const p = this.deps.playerPosition();
    const cx = spec.tx * size + size / 2;
    const cy = spec.ty * size + size - 4;
    if (OBJECT_DEFS[spec.kind].collider && Math.abs(p.x - cx) < 14 && Math.abs(p.y - cy) < 12) return false;

    if (existing) {
      this.remove(existing);
      existing.sprite.destroy();
    }
    this.spawn(spec, { animate: true });
    return true;
  }

  private key(tx: number, ty: number): number {
    return ty * this.worldWidth + tx;
  }
}
