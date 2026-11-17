import * as Phaser from 'phaser';
import {
  FRUIT_TREE_GROW_DAYS,
  FRUIT_TREE_MAX_FRUIT,
  FRUIT_TREES,
  GAME_CONFIG,
  ITEMS,
  fruitTreeAgeBonus,
  fruitTreeStage,
  isFruitTreeKind,
  rollQuality,
  type FruitTreeKind,
  type FruitTreeSave,
  type Season,
} from '@farming/shared';
import { drawFruitTree, FRUIT_TREE_H, FRUIT_TREE_W } from '../assets/orchard';
import { sfx } from '../audio/sfx';
import { daily } from '../state/daily';
import { DEPTH } from '../constants';
import { gameEvents } from '../events/GameEventBus';
import type { Occluder, OcclusionSystem } from './OcclusionSystem';
import type { DropSystem } from './DropSystem';
import type { FxSystem } from './FxSystem';

const T = GAME_CONFIG.tileSize;
const FRUIT_ONE: Record<FruitTreeKind, string> = { apple: 'apple', cherry: 'bunch of cherries', peach: 'peach' };
const FRUIT_PLURAL: Record<FruitTreeKind, string> = { apple: 'apples', cherry: 'bunches of cherries', peach: 'peaches' };
/** Axe hits to bring down a tree (saplings come up in one). */
const CHOP_HITS = 4;

export interface FruitTree {
  kind: FruitTreeKind;
  tx: number;
  ty: number;
  planted: number;
  fruit: number;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  zone: Phaser.GameObjects.Zone;
  occluder: Occluder;
  hits: number;
}

export interface OrchardDeps {
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  occlusion: OcclusionSystem;
  drops: DropSystem;
  fx: FxSystem;
  calendar(): { day: number; season: Season };
  farmingLevel(): number;
  lucky(): boolean;
  /** Something else is on this tile (a building, rock, tree, soil, an animal…). */
  blocked(tx: number, ty: number): boolean;
  /** A building or a rock/tree stands here (neighbours just need to be clear of these). */
  solid(tx: number, ty: number): boolean;
  /** Open grass. */
  grass(tx: number, ty: number): boolean;
}

/**
 * Fruit trees you plant from saplings. They grow for a season (sapling →
 * young → small tree → grown), then in their own season grow one fruit each
 * morning, up to three. Shake them (E) to pick the fruit; older trees give
 * better fruit. An axe takes them down.
 */
export class OrchardSystem {
  private readonly trees = new Map<string, FruitTree>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: OrchardDeps,
  ) {}

  at(tx: number, ty: number): FruitTree | undefined {
    return this.trees.get(`${tx},${ty}`);
  }

  get all(): FruitTree[] {
    return [...this.trees.values()];
  }

  age(tree: FruitTree): number {
    return Math.max(0, this.deps.calendar().day - tree.planted);
  }

  stage(tree: FruitTree): 0 | 1 | 2 | 3 {
    return fruitTreeStage(this.age(tree));
  }

  /** Why a sapling can't go here (null = it can). Trees need a tile of space all round. */
  plantProblem(tx: number, ty: number): string | null {
    if (!this.deps.grass(tx, ty) || this.deps.blocked(tx, ty)) return 'Plant it on open grass.';
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.at(tx + dx, ty + dy)) return 'Too close to another fruit tree.';
      }
    }
    // Room for the branches: the tiles beside it must be walkable ground.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) {
      if (this.deps.solid(tx + dx, ty + dy)) return 'It needs a little room around it.';
    }
    return null;
  }

  plant(kind: FruitTreeKind, tx: number, ty: number): FruitTree {
    const tree = this.create({ kind, tx, ty, planted: this.deps.calendar().day, fruit: 0 });
    this.deps.fx.pop(tree.sprite);
    this.deps.fx.burst('dirt', (tx + 0.5) * T, (ty + 0.5) * T, 6);
    sfx('plant');
    return tree;
  }

  private create(save: FruitTreeSave): FruitTree {
    const x = (save.tx + 0.5) * T;
    const baseY = (save.ty + 1) * T - 2;
    const shadow = this.scene.add.ellipse(x, baseY - 1, 18, 6, 0x000000, 0.18).setDepth(DEPTH.shadow);
    const sprite = this.scene.add.image(x, baseY + 1, '__DEFAULT').setOrigin(0.5, 1).setDepth(DEPTH.ySortBase + baseY);
    const zone = this.scene.add.zone(x, baseY - 5, 10, 8);
    this.deps.obstacles.add(zone);
    const tree: FruitTree = {
      ...save,
      sprite,
      shadow,
      zone,
      occluder: { sprite, x, baseY, halfWidth: 14, height: 40 },
      hits: 0,
    };
    this.trees.set(`${save.tx},${save.ty}`, tree);
    this.deps.occlusion.add(tree.occluder, save.tx, save.ty);
    this.refresh(tree);
    return tree;
  }

  /** Picks the right picture for its age, the season and its fruit. */
  refresh(tree: FruitTree): void {
    const { season } = this.deps.calendar();
    const stage = this.stage(tree);
    const def = FRUIT_TREES[tree.kind];
    const blossom = stage === 3 && season === def.season && tree.fruit === 0;
    const key = `ftree-${tree.kind}-${stage}-${season}-${tree.fruit}-${blossom ? 1 : 0}`;
    if (!this.scene.textures.exists(key)) this.scene.textures.addCanvas(key, drawFruitTree(tree.kind, stage, season, tree.fruit, blossom).toCanvas());
    tree.sprite.setTexture(key);
    tree.shadow.setSize(stage === 3 ? 26 : stage === 2 ? 18 : 10, stage === 3 ? 8 : 5);
    tree.occluder.height = stage === 3 ? 40 : stage === 2 ? 30 : 0;
  }

  /** Morning: grow, and in its own season set one more fruit (out of season, fruit falls). */
  onNewDay(): void {
    const { season } = this.deps.calendar();
    for (const tree of this.trees.values()) {
      if (this.stage(tree) === 3 && FRUIT_TREES[tree.kind].season === season) tree.fruit = Math.min(FRUIT_TREE_MAX_FRUIT, tree.fruit + 1);
      else tree.fruit = 0;
      tree.hits = 0;
      this.refresh(tree);
    }
  }

  /** What pressing E on it does. */
  describe(tree: FruitTree): { verb: string; info: boolean; run: () => void } {
    const def = FRUIT_TREES[tree.kind];
    const fruitName = FRUIT_PLURAL[tree.kind];
    const stage = this.stage(tree);
    if (tree.fruit > 0) return { verb: `Pick ${tree.fruit} ${tree.fruit === 1 ? FRUIT_ONE[tree.kind] : fruitName}`, info: false, run: () => this.pick(tree) };
    if (stage < 3) {
      const days = FRUIT_TREE_GROW_DAYS - this.age(tree);
      const verb = `${def.name} · grown in ${days} day${days === 1 ? '' : 's'}`;
      return { verb, info: true, run: () => gameEvents.emit('toast', { text: `${verb}. It doesn't need watering. Then it bears ${fruitName} every ${def.season}.` }) };
    }
    const { season } = this.deps.calendar();
    const verb = season === def.season ? `${def.name} · fruit tomorrow` : `${def.name} · fruits in ${def.season}`;
    return {
      verb,
      info: true,
      run: () => gameEvents.emit('toast', { text: season === def.season ? `A new ${FRUIT_ONE[tree.kind]} grows each morning, up to ${FRUIT_TREE_MAX_FRUIT}.` : `It rests until ${def.season}, then grows a fruit each morning.` }),
    };
  }

  /** Shake the fruit down. Older trees give better fruit. */
  pick(tree: FruitTree): void {
    if (tree.fruit <= 0) return;
    const def = FRUIT_TREES[tree.kind];
    const n = tree.fruit;
    tree.fruit = 0;
    this.refresh(tree);
    const x = tree.sprite.x;
    const y = tree.sprite.y - 6;
    const ageBonus = fruitTreeAgeBonus(this.age(tree));
    for (let i = 0; i < n; i++) {
      const q = rollQuality({ level: this.deps.farmingLevel(), lucky: this.deps.lucky(), ageBonus });
      this.deps.drops.spawn(def.fruit, 1, x + (i - 1) * 6, y, q);
    }
    this.shake(tree);
    this.deps.fx.burst('leaf', x, y - 16, 8);
    sfx('rustle');
    daily.note('harvest', n);
  }

  /** One axe hit. Returns true once it's down. */
  chop(tree: FruitTree): boolean {
    const stage = this.stage(tree);
    tree.hits += 1;
    this.shake(tree);
    sfx('chop');
    const needed = stage === 0 ? 1 : stage === 1 ? 2 : CHOP_HITS;
    if (tree.hits < needed) {
      if (tree.hits === 1 && stage >= 2) gameEvents.emit('toast', { text: `Chopping down your ${FRUIT_TREES[tree.kind].name.toLowerCase()}… (${needed - 1} more hits)` });
      return false;
    }
    const x = tree.sprite.x;
    const y = tree.sprite.y - 6;
    if (tree.fruit > 0) this.pick(tree);
    // A sapling comes back up whole; a bigger tree gives wood.
    if (stage === 0) this.deps.drops.spawn(FRUIT_TREES[tree.kind].sapling, 1, x, y);
    else this.deps.drops.spawn('wood', stage === 3 ? 8 : stage * 2, x, y);
    this.deps.fx.burst('leaf', x, y - 10, 12);
    this.remove(tree);
    return true;
  }

  private remove(tree: FruitTree): void {
    this.trees.delete(`${tree.tx},${tree.ty}`);
    this.deps.occlusion.remove(tree.occluder, tree.tx, tree.ty);
    this.deps.obstacles.remove(tree.zone, true, true);
    tree.sprite.destroy();
    tree.shadow.destroy();
  }

  private shake(tree: FruitTree): void {
    this.scene.tweens.killTweensOf(tree.sprite);
    tree.sprite.setAngle(0);
    this.scene.tweens.add({ targets: tree.sprite, angle: { from: -3, to: 3 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => tree.sprite.setAngle(0) });
  }

  serialize(): FruitTreeSave[] {
    return this.all.map(({ kind, tx, ty, planted, fruit }) => ({ kind, tx, ty, planted, fruit }));
  }

  restore(saves: FruitTreeSave[] | undefined): void {
    for (const s of saves ?? []) {
      if (!isFruitTreeKind(s.kind) || this.at(s.tx, s.ty)) continue;
      this.create({ kind: s.kind, tx: s.tx, ty: s.ty, planted: s.planted, fruit: Math.max(0, Math.min(FRUIT_TREE_MAX_FRUIT, s.fruit)) });
    }
  }

  /** Map markers. */
  markers(): Array<{ tx: number; ty: number; kind: FruitTreeKind; fruit: number }> {
    return this.all.map((t) => ({ tx: t.tx, ty: t.ty, kind: t.kind, fruit: t.fruit }));
  }
}

export { FRUIT_TREE_W, FRUIT_TREE_H };
