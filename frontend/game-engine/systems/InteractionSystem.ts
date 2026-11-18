import type * as Phaser from 'phaser';
import { skills } from '../state/skills';
import { daily } from '../state/daily';
import {
  BARN,
  fruitTreeForSapling,
  QUALITY_NAMES,
  withQuality,
  CROPS,
  GAME_CONFIG,
  gameTime,
  LIVESTOCK,
  ITEMS,
  isMachineKind,
  MACHINES,
  NPCS,
  PLACEABLES,
  Terrain,
  formatClock,
  type ItemDef,
  type NpcId,
  type PlaceableKind,
  type Season,
  type WeatherKind,
  BUFF_INFO,
  rollMachineOutput,
  isStorage,
  SILO_CAPACITY,
} from '@farming/shared';
import { fenceTextureKey, itemTextureKey, placeableTextureKey, type SpritePlaceable } from '../assets/registerTextures';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import type { Player, ToolStyle } from '../entities/Player';
import { gameEvents } from '../events/GameEventBus';
import { terrainAt, type WorldData } from '../maps/WorldData';
import type { PlayerState } from '../state/PlayerState';
import type { AnimalSystem } from './AnimalSystem';
import { chestIsEmpty, type BuildSystem, type Placed } from './BuildSystem';
import type { OrchardSystem } from './OrchardSystem';
import type { DropSystem } from './DropSystem';
import type { FarmingSystem } from './FarmingSystem';
import type { FxSystem } from './FxSystem';
import type { FishingSystem } from './FishingSystem';
import type { LivestockSystem } from './LivestockSystem';
import type { Npc, NpcSystem } from './NpcSystem';
import { Social } from '../state/Social';
import type { Authority } from '../net/Authority';
import type { ResourceSystem } from './ResourceSystem';

interface Action {
  verb: string;
  /** 'both' = triggered by Use (Space/click) or Interact (E); 'use' = Use only. */
  trigger: 'use' | 'both';
  blocked?: boolean;
  /** Placement actions show a preview of the object. */
  placing?: boolean;
  /** Informational only (e.g. how long a crop has left to grow). */
  info?: boolean;
  run: () => void;
}

const DIRECTION_OFFSET = {
  down: [0, 1],
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
} as const;

export interface Calendar {
  day: number;
  minute: number;
  season: Season;
  weather: WeatherKind;
}

interface Deps {
  world: WorldData;
  player: Player;
  state: PlayerState;
  resources: ResourceSystem;
  farming: FarmingSystem;
  build: BuildSystem;
  animals: AnimalSystem;
  npcs: NpcSystem;
  drops: DropSystem;
  fx: FxSystem;
  fishing: FishingSystem;
  social: Social;
  /** Applies shared-world changes (at once alone; after the server agrees in co-op). */
  authority: Authority;
  livestock: LivestockSystem;
  calendar: () => Calendar;
  openShop: (npcId: NpcId) => void;
  openBoard: () => void;
  /** Open notice-board requests today. */
  boardRequests: () => number;
  talkTo: (npc: Npc) => void;
  giveGift: (npcId: NpcId, slot: number) => void;
  rest: () => void;
  enterMine: () => void;
  enterBeach: () => void;
  enterCottage: () => void;
  /** Where the path leaves for the beach. */
  beachGate: { tx: number; ty: number };
  forestGate: { tx: number; ty: number };
  /** The carnival's arch, on the south side of the main path a walk from the village. */
  carnivalGate: { tx: number; ty: number };
  enterCarnival: () => void;
  /** Using the Horse item. */
  releaseHorse: (x: number, y: number) => { verb: string; blocked?: boolean; run: () => void };
  /** Villagers' front doors and the museum. */
  landmark: (tx: number, ty: number) => { verb: string; info?: boolean; run: () => void } | null;
  /** Pet or stray in front of you: what to say on the button and what happens. */
  petAction: (x: number, y: number) => { verb: string; run: () => void } | null;
  enterForest: () => void;
  houseLevel: () => number;
  /** Co-op cabins and the farmhouse for guests. */
  homeAction: (placed: Placed) => { verb: string; info?: boolean; run: () => void } | null;
  upgradeHouse: () => void;
  openMail: () => void;
  openShipping: () => void;
  shipSlot: (slot: number) => void;
  openChest: (placed: Placed) => void;
  sleep: () => void;
  say: (speaker: string, text: string) => void;
  /** Fruit trees (not in co-op worlds yet). */
  orchard: OrchardSystem;
  coop: boolean;
}

const toast = (text: string) => gameEvents.emit('toast', { text });

/** Vertical origin (base row / height) of each placeable's sprite, for the placement preview. */
const GHOST_ORIGIN: Partial<Record<PlaceableKind, number>> = {
  lamp_post: 33 / 34,
  chest: 15 / 16,
  sprinkler: 15 / 16,
  iron_sprinkler: 13 / 14,
  gold_sprinkler: 13 / 14,
  silo: 45 / 46,
  well: 31 / 32,
  shed: 39 / 40,
  statue: 27 / 28,
  flower_bed: 11 / 12,
  birdbath: 17 / 18,
  gnome: 15 / 16,
  collector: 15 / 16,
  bench: 13 / 14,
  flower_pot: 17 / 18,
  scarecrow: 27 / 28,
  keg: 21 / 22,
  preserves_jar: 17 / 18,
  greenhouse: 43 / 44,
  barn: 45 / 46,
  cheese_press: 19 / 20,
  loom: 19 / 20,
  mailbox: 19 / 20,
  shipping_bin: 15 / 16,
  crab_pot: 13 / 14,
};

/**
 * Resolves what the player's action does on the tile they are facing, given
 * the selected item: chop, mine, till, water, plant, harvest, build, eat,
 * talk, shop, sleep… Also draws the target cursor and placement preview, and
 * publishes the action (and where its on-screen button should float) for the UI.
 */
export class InteractionSystem {
  private readonly cursor: Phaser.GameObjects.Graphics;
  private readonly ghost: Phaser.GameObjects.Image;
  private lastHint = '';
  private lastAnchor = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: Deps,
  ) {
    this.cursor = scene.add.graphics().setDepth(DEPTH.cursor);
    this.ghost = scene.add.image(0, 0, fenceTextureKey(false, false)).setVisible(false).setAlpha(0.6).setDepth(DEPTH.cursor - 1);
  }

  /** The tile directly in front of the player's feet. */
  target(): { tx: number; ty: number } {
    const { tx, ty } = this.deps.player.tile;
    const [dx, dy] = DIRECTION_OFFSET[this.deps.player.facingDirection];
    return { tx: tx + dx, ty: ty + dy };
  }

  use(): void {
    if (this.deps.fishing.active) {
      this.deps.fishing.reel();
      return;
    }
    if (this.deps.player.isBusy()) return;
    this.perform(this.resolve('use'));
  }

  interact(): void {
    if (this.deps.fishing.active) {
      this.deps.fishing.reel();
      return;
    }
    if (this.deps.player.isBusy()) return;
    this.perform(this.resolve('interact'));
  }

  /** Refreshes the cursor, placement ghost, hint and button anchor. `enabled` is false while a menu is open. */
  update(enabled: boolean): void {
    const action = !enabled ? null : this.deps.fishing.active ? this.fishingAction() : this.resolve('use');
    this.drawCursor(enabled, action);

    const hint = action
      ? {
          action: action.verb,
          key: action.blocked || action.info ? null : action.trigger === 'both' ? 'E' : 'Space',
          blocked: !!action.blocked,
          info: !!action.info,
        }
      : { action: null, key: null, blocked: false, info: false };
    const signature = `${hint.action}|${hint.key}|${hint.blocked}|${hint.info}`;
    if (signature !== this.lastHint) {
      this.lastHint = signature;
      gameEvents.emit('interaction:hint', hint);
    }
    this.emitAnchor(action);
  }

  /**
   * Eats the food in an inventory slot (F key, right-clicking a hotbar slot, or
   * the Eat button in the inventory), whatever the player is facing.
   */
  eatSlot(slot: number): void {
    const { state, player, fx } = this.deps;
    const stack = state.inventory.slots[slot];
    const food = stack ? ITEMS[stack.itemId] : null;
    if (!food?.energy) {
      sfx('error');
      toast(stack ? `You can't eat ${food?.name ?? 'that'}.` : 'Select some food to eat (crops, berries or eggs).');
      return;
    }
    if (state.energy >= state.maxEnergy && state.health >= state.maxHealth && !food.buff) {
      sfx('error');
      toast("You're not hungry.");
      return;
    }
    const energy = withQuality(food.energy, stack!.q);
    const name = stack!.q ? `${QUALITY_NAMES[stack!.q]} ${food.name}` : food.name;
    if (state.inventory.removeAt(slot, 1) !== 1) return;
    state.restoreEnergy(energy);
    state.heal(Math.round(energy / 2));
    fx.burst('sparkle', player.x, player.y - 18, 6);
    sfx('eat');
    toast(`Ate ${name} (+${energy} energy)`);
    if (food.buff) {
      state.addBuff(food.buff.kind, food.buff.minutes);
      const info = BUFF_INFO[food.buff.kind];
      toast(`${info.icon} ${info.name} for ${Math.round(food.buff.minutes / 60)} hours: ${info.description}.`);
    }
  }

  /** While the line is out: wait, or reel in when the "!" shows. */
  private fishingAction(): Action {
    const { fishing } = this.deps;
    if (fishing.reeling) return { verb: 'Reeling — hold to raise the bar!', trigger: 'use', info: true, run: () => undefined };
    if (fishing.biting) return { verb: 'Strike!', trigger: 'both', run: () => fishing.reel() };
    return { verb: 'Waiting for a bite… (press when you see !)', trigger: 'both', info: true, run: () => fishing.reel() };
  }

  private perform(action: Action | null): void {
    if (!action) return;
    if (action.blocked) sfx('error');
    action.run();
  }

  /**
   * Publishes where the action button should float: just above the object
   * being targeted, converted to screen (CSS) pixels.
   */
  private emitAnchor(action: Action | null): void {
    let anchor: { x: number; y: number } | null = null;
    if (action) {
      const world = this.anchorFor();
      const cam = this.scene.cameras.main;
      anchor = { x: Math.round((world.x - cam.worldView.x) * cam.zoom), y: Math.round((world.y - cam.worldView.y) * cam.zoom) };
    }
    const key = anchor ? `${anchor.x},${anchor.y}` : 'none';
    if (key === this.lastAnchor) return;
    this.lastAnchor = key;
    gameEvents.emit('interaction:anchor', anchor);
  }

  /** World point at the top of whatever is on the target tile (capped so tall trees stay close). */
  private anchorFor(): { x: number; y: number } {
    const { npcs, animals, build, resources, farming, fishing, player } = this.deps;
    // While fishing, keep the button clear of the bobber and the "!" (below the player instead).
    if (fishing.active) return { x: player.x, y: player.y + 34 };
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const cx = tx * size + size / 2;
    const tileTop = { x: cx, y: ty * size };
    const top = (sprite: Phaser.GameObjects.Components.GetBounds | undefined, baseY: number) => {
      if (!sprite) return tileTop;
      const bounds = sprite.getBounds();
      return { x: bounds.centerX, y: Math.max(bounds.top, baseY - 30) };
    };
    const npc = npcs.npcNear(cx, ty * size + size / 2);
    if (npc) return top(npc.sprite, npc.sprite.y);
    const hen = animals.chickenAt(tx, ty);
    if (hen) return top(hen.sprite, hen.sprite.y);
    const placed = build.at(tx, ty);
    if (placed?.sprite) return top(placed.sprite, placed.sprite.y);
    const tree = this.deps.orchard.at(tx, ty);
    if (tree) return top(tree.sprite, tree.sprite.y);
    const node = resources.nodeAt(tx, ty);
    if (node) return top(node.sprite, node.baseY);
    const crop = farming.plotAt(tx, ty)?.crop;
    if (crop) return top(crop.sprite, crop.sprite.y);
    return tileTop;
  }

  private resolve(mode: 'use' | 'interact'): Action | null {
    const { player, state, resources, farming, build, animals, npcs, fx, world, drops, authority } = this.deps;
    const cal = this.deps.calendar();
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const cx = tx * size + size / 2;
    const cy = ty * size + size / 2;
    const slot = state.inventory.selected;
    const stack = state.inventory.selectedStack;
    const item: ItemDef | null = stack ? ITEMS[stack.itemId] : null;
    const tool = item?.tool ?? null;
    const texture = stack && tool ? itemTextureKey(stack.itemId) : null;
    const plot = farming.plotAt(tx, ty);

    /** A tool action that costs energy; blocked when too tired. */
    const toolAction = (verb: string, style: ToolStyle, baseCost: number, effect: () => void): Action => {
      const cost = skills.toolCost(tool?.kind, baseCost);
      if (state.energy < cost) {
        return { verb: 'Too tired', trigger: 'use', blocked: true, run: () => toast("You're exhausted. Eat something or get some sleep.") };
      }
      return {
        verb,
        trigger: 'use',
        run: () => {
          if (state.spendEnergy(cost)) player.useTool(texture, style, effect);
        },
      };
    };
    const { toolCost, wateringCost } = GAME_CONFIG.energy;

    if (plot && farming.isMature(plot)) {
      return {
        verb: `Harvest ${CROPS[plot.crop!.id].name}`,
        trigger: 'both',
        run: () =>
          player.useTool(null, 'swing', () =>
            authority.request({ t: 'harvest', tx, ty }, () => {
              const p = farming.plotAt(tx, ty);
              if (p) farming.harvest(p);
            }),
          ),
      };
    }

    const npc = npcs.npcNear(cx, cy);
    if (npc) {
      const gift = mode === 'use' ? this.giftAction(npc.def.id, slot) : null;
      if (gift) return gift;
      return { verb: `Talk to ${npc.def.name}`, trigger: 'both', run: () => this.deps.talkTo(npc) };
    }

    const pet = this.deps.petAction(cx, cy);
    if (pet) return { verb: pet.verb, trigger: 'both', run: pet.run };

    const beast = this.deps.livestock.at(tx, ty);
    if (beast) return this.livestockAction(beast.id);

    const hen = animals.chickenAt(tx, ty);
    if (hen) {
      return {
        verb: 'Pet chicken',
        trigger: 'both',
        run: () => {
          animals.pet(hen);
          sfx('cluck');
        },
      };
    }

    const gate = this.deps.beachGate;
    if (Math.abs(tx - gate.tx) <= 1 && ty >= gate.ty - 1 && ty <= gate.ty + 2) {
      return { verb: 'Walk to the beach', trigger: 'both', run: this.deps.enterBeach };
    }
    const fair = this.deps.carnivalGate;
    if (Math.abs(tx - fair.tx) <= 1 && ty === fair.ty) {
      return { verb: 'Walk into the carnival', trigger: 'both', run: this.deps.enterCarnival };
    }
    const forest = this.deps.forestGate;
    if (Math.abs(tx - forest.tx) <= 1 && ty >= forest.ty - 1 && ty <= forest.ty + 2) {
      return { verb: 'Walk into the old forest', trigger: 'both', run: this.deps.enterForest };
    }

    const tree = this.deps.orchard.at(tx, ty);
    if (tree) {
      const orchard = this.deps.orchard;
      if (mode === 'use' && tool?.kind === 'axe') {
        return toolAction('Chop', 'swing', toolCost, () => {
          if (orchard.at(tree.tx, tree.ty) !== tree || !orchard.hit(tree)) return;
          // The final blow is a change to the shared world in co-op.
          authority.request({ t: 'treeChop', tx: tree.tx, ty: tree.ty }, () => {
            if (orchard.at(tree.tx, tree.ty) === tree) orchard.fell(tree);
          });
        });
      }
      const d = orchard.describe(tree);
      if (!d.info) {
        // Shaking the fruit down: in co-op the server says how much there was (someone may have beaten you to it).
        return {
          verb: d.verb,
          trigger: 'both',
          run: () =>
            player.useTool(null, 'swing', () =>
              authority.request({ t: 'treePick', tx: tree.tx, ty: tree.ty }, (granted) => {
                if (orchard.at(tree.tx, tree.ty) === tree) orchard.pick(tree, granted.count ?? tree.fruit);
              }),
            ),
        };
      }
      if (mode === 'interact' || !tool) return { verb: d.verb, trigger: 'both', info: true, run: d.run };
    }

    const landmark = this.deps.landmark(tx, ty);
    if (landmark) return { verb: landmark.verb, trigger: 'both', info: landmark.info, run: landmark.run };

    const placed = build.at(tx, ty);
    if (placed) {
      const home = placed.kind === 'cottage' || placed.kind === 'cabin' ? this.deps.homeAction(placed) : null;
      if (home) return { verb: home.verb, trigger: 'both', info: home.info, run: home.run };
      if (placed.kind === 'cottage') {
        if (mode === 'use' && stack?.itemId === 'house_upgrade') {
          if (this.deps.houseLevel() >= 1) return { verb: 'Already extended', trigger: 'use', blocked: true, run: () => toast('Your cottage is already as big as Willa can make it.') };
          return { verb: 'Extend the cottage', trigger: 'use', run: this.deps.upgradeHouse };
        }
        return { verb: 'Go inside', trigger: 'both', run: this.deps.enterCottage };
      }
      if (placed.kind === 'shipping_bin') {
        const sellable = stack && ITEMS[stack.itemId].sellPrice;
        if (mode === 'use' && sellable) {
          return { verb: `Ship ${stack.quantity}× ${stack.q ? `${QUALITY_NAMES[stack.q]} ` : ''}${ITEMS[stack.itemId].name} (${withQuality(ITEMS[stack.itemId].sellPrice ?? 0, stack.q) * stack.quantity}g tonight)`, trigger: 'use', run: () => this.deps.shipSlot(slot) };
        }
        const n = state.bin.length;
        return { verb: n ? `Shipping bin (${state.binValue}g tonight)` : 'Shipping bin', trigger: 'both', run: this.deps.openShipping };
      }
      if (placed.kind === 'mailbox') {
        const unread = this.deps.social.unread;
        return { verb: unread ? `Check mail (${unread} new)` : 'Check mail', trigger: 'both', run: this.deps.openMail };
      }
      if (!PLACEABLES[placed.kind].item) return null;
      if (isMachineKind(placed.kind) && (mode === 'interact' || tool?.kind !== 'pickaxe' || placed.machine)) {
        const machine = this.machineAction(placed, slot, mode);
        if (machine) return machine;
      }
      if (placed.kind === 'barn' && (mode === 'interact' || tool?.kind !== 'pickaxe')) return this.barnAction(placed, slot, mode);
      if (placed.kind === 'silo' && (mode === 'interact' || tool?.kind !== 'pickaxe')) return this.siloAction(placed, slot, mode);
      if (placed.kind === 'silo' && (placed.hay ?? 0) > 0) return { verb: 'The silo has hay in it', trigger: 'use', blocked: true, run: () => toast('Use up the hay before taking the silo down.') };
      if (placed.kind === 'well' && (mode === 'interact' || tool?.kind !== 'pickaxe')) {
        if (tool?.kind === 'watering_can' || mode === 'interact') {
          return {
            verb: state.water >= state.waterCapacity ? 'Well · can is full' : 'Refill watering can',
            trigger: 'both',
            run: () => {
              state.refillWater();
              fx.burst('water', cx, cy, 10);
              sfx('refill');
            },
          };
        }
      }
      if (placed.kind === 'barn' && (this.deps.livestock.countIn(placed) > 0 || (placed.hay ?? 0) > 0)) {
        return { verb: 'The barn is in use', trigger: 'use', blocked: true, run: () => toast('Move the animals and use up the hay before taking the barn down.') };
      }
      if (placed.kind === 'bench' && (mode === 'interact' || tool?.kind !== 'pickaxe')) {
        return { verb: 'Sit & rest (+15 energy, 30 min)', trigger: 'both', run: this.deps.rest };
      }
      if (isStorage(placed.kind) && (mode === 'interact' || tool?.kind !== 'pickaxe')) {
        return { verb: placed.kind === 'shed' ? 'Open shed' : 'Open chest', trigger: 'both', run: () => this.deps.openChest(placed) };
      }
      if (mode === 'interact' || tool?.kind !== 'pickaxe') return null;
      if (placed.machine) return { verb: 'Empty it first', trigger: 'use', blocked: true, run: () => toast('Wait for it to finish and collect what is inside first.') };
      if (isStorage(placed.kind) && !chestIsEmpty(placed)) {
        return { verb: 'Empty the chest first', trigger: 'use', blocked: true, run: () => toast('Empty the chest before picking it up.') };
      }
      const name = PLACEABLES[placed.kind].item ? ITEMS[PLACEABLES[placed.kind].item!].name : '';
      return {
        verb: `Pick up ${name}`,
        trigger: 'use',
        run: () =>
          player.useTool(texture, 'swing', () =>
            authority.request({ t: 'pickup', tx: placed.tx, ty: placed.ty }, () => {
              const here = build.at(placed.tx, placed.ty);
              if (!here) return;
              const back = build.remove(here);
              sfx('place', { rate: 1.3 });
              if (back && state.inventory.add(back, 1) > 0) drops.spawn(back, 1, cx, cy);
            }),
          ),
      };
    }

    const node = resources.nodeAt(tx, ty);
    if (node) {
      if (node.spec.kind === 'stall') {
        const owner = npcs.merchantForStall(node.spec.variant);
        if (!owner) return null;
        if (npcs.isPresent(owner.id, cal.minute)) {
          return { verb: `Trade with ${owner.name}`, trigger: 'both', run: () => this.deps.openShop(owner.id) };
        }
        const hours = `${formatClock(owner.hours.from)}–${formatClock(owner.hours.to)}`;
        return {
          verb: `${owner.shop?.title ?? 'Stall'} · closed (${hours})`,
          trigger: 'both',
          blocked: true,
          run: () => toast(`${owner.shop?.title ?? 'The stall'} is closed. ${owner.name} is here from ${hours}.`),
        };
      }
      if (node.spec.kind === 'mine') {
        const depth = state.mineDepth;
        return { verb: depth >= 5 ? 'Enter the mine (elevator)' : 'Enter the mine', trigger: 'both', run: this.deps.enterMine };
      }
      if (node.spec.kind === 'board') {
        const open = this.deps.boardRequests();
        return { verb: `Notice board${open ? ` (${open} request${open > 1 ? 's' : ''})` : ''}`, trigger: 'both', run: this.deps.openBoard };
      }
      if (node.hasBerries && tool?.kind !== 'axe') {
        return {
          verb: 'Pick berries',
          trigger: 'both',
          run: () =>
            player.useTool(null, 'swing', () =>
              authority.request({ t: 'berries', tx: node.spec.tx, ty: node.spec.ty }, () => {
                const n = resources.nodeAt(node.spec.tx, node.spec.ty);
                if (n) resources.pickBerries(n);
              }),
            ),
        };
      }
      if (mode === 'interact') return null;
      const def = resources.defFor(node);
      if (!def) return null;
      const boosted = tool && state.hasBuff('mining') && def.tool === 'pickaxe' ? { ...tool, power: tool.power * 2 } : tool;
      const hit = () => resources.hit(node, boosted);
      if (def.tool === 'any') {
        const silo = build.ofKind('silo').length > 0;
        return {
          verb: silo ? 'Cut grass (hay)' : 'Cut grass',
          trigger: 'use',
          run: () =>
            player.useTool(texture, 'swing', () => {
              hit();
              if (silo && Math.random() < 0.5) {
                if (state.inventory.add('hay', 1) === 0) gameEvents.emit('item:collected', { itemId: 'hay', quantity: 1 });
              }
            }),
        };
      }
      if (tool?.kind === def.tool) return toolAction(def.tool === 'axe' ? 'Chop' : 'Mine', 'swing', toolCost, hit);
      if (tool) return { verb: def.tool === 'axe' ? 'Needs an axe' : 'Needs a pickaxe', trigger: 'use', blocked: true, run: () => player.useTool(texture, 'swing', hit) };
      return null;
    }

    if (mode === 'interact') return null;
    if (!stack || !item) return this.cropInfo(plot);

    switch (tool?.kind) {
      case 'hoe':
        if (farming.canTill(tx, ty) && !build.isBlocked(tx, ty)) {
          return toolAction('Till', 'swing', toolCost, () => {
            if (!farming.canTill(tx, ty) || resources.isBlocked(tx, ty) || build.isBlocked(tx, ty)) return;
            authority.request({ t: 'till', tx, ty }, () => {
              if (!farming.canTill(tx, ty)) return;
              farming.till(tx, ty);
              this.maybeArtifact(cx, cy);
            });
          });
        }
        break;
      case 'watering_can': {
        if (terrainAt(world, tx, ty) === Terrain.Water) {
          return toolAction('Refill', 'pour', 0, () => {
            state.refillWater();
            fx.burst('water', cx, cy, 10);
            sfx('refill');
          });
        }
        if (!plot || plot.watered) break;
        if (state.water <= 0) {
          return { verb: 'Can is empty', trigger: 'use', blocked: true, run: () => toast('The watering can is empty. Refill it at a pond or river.') };
        }
        return toolAction('Water', 'pour', wateringCost, () => {
          if (state.water <= 0) return;
          authority.request({ t: 'water', tx, ty }, () => {
            const p = farming.plotAt(tx, ty);
            if (p && !p.watered && state.useWater()) {
              farming.water(p);
              if (p.crop) daily.note('water');
            }
          });
        });
      }
      case 'pickaxe':
        if (plot && !plot.crop) {
          return toolAction('Clear soil', 'swing', toolCost, () =>
            authority.request({ t: 'untill', tx, ty }, () => {
              const p = farming.plotAt(tx, ty);
              if (p) farming.untill(p);
            }),
          );
        }
        break;
      case 'fishing_rod': {
        const terrain = terrainAt(world, tx, ty);
        if (terrain !== Terrain.Water) {
          // Allow casting one tile further out from a bank.
          const [dx, dy] = DIRECTION_OFFSET[player.facingDirection];
          if (terrainAt(world, tx + dx, ty + dy) !== Terrain.Water) {
            return { verb: 'Face water to fish', trigger: 'use', info: true, run: () => toast('Stand by a pond or the river, facing the water.') };
          }
        }
        const water = terrain === Terrain.Water ? { tx, ty } : (() => {
          const [dx, dy] = DIRECTION_OFFSET[player.facingDirection];
          return { tx: tx + dx, ty: ty + dy };
        })();
        if (state.energy < 3) return { verb: 'Too tired', trigger: 'use', blocked: true, run: () => toast("You're too tired to fish.") };
        return { verb: cal.season === 'winter' ? 'Ice fishing' : 'Cast line', trigger: 'use', run: () => this.deps.fishing.cast(water.tx, water.ty, cal) };
      }
    }

    const cropId = item.plants;
    const canTillHere = !plot && farming.canTill(tx, ty) && !build.isBlocked(tx, ty) && !resources.isBlocked(tx, ty);
    if (cropId && ((plot && !plot.crop) || canTillHere) && !farming.inSeason(cropId, cal.season, tx, ty)) {
      return { verb: `${CROPS[cropId].name}s don't grow in ${cal.season}`, trigger: 'use', blocked: true, run: () => undefined };
    }
    // Seeds on open grass: dig and plant in one go (costs a hoe's worth of energy).
    if (cropId && canTillHere) {
      return toolAction(`Till & plant ${CROPS[cropId].name}`, 'swing', toolCost, () => {
        if (!farming.canTill(tx, ty) || build.isBlocked(tx, ty) || resources.isBlocked(tx, ty)) return;
        authority.request({ t: 'till', tx, ty }, () => {
          if (farming.canTill(tx, ty)) farming.till(tx, ty);
          authority.request({ t: 'plant', tx, ty, crop: cropId }, () => {
            const p = farming.plotAt(tx, ty);
            if (p && !p.crop && state.inventory.removeAt(slot, 1) === 1) farming.plant(p, cropId);
          });
        });
      });
    }
    if (cropId && plot && !plot.crop) {
      return {
        verb: `Plant ${CROPS[cropId].name}`,
        trigger: 'use',
        run: () =>
          player.useTool(null, 'swing', () =>
            authority.request({ t: 'plant', tx, ty, crop: cropId }, () => {
              const p = farming.plotAt(tx, ty);
              if (p && !p.crop && state.inventory.removeAt(slot, 1) === 1) farming.plant(p, cropId);
            }),
          ),
      };
    }
    if (stack.itemId === 'fertilizer' && plot?.crop && !farming.isMature(plot)) {
      return {
        verb: 'Fertilize',
        trigger: 'use',
        run: () =>
          player.useTool(null, 'swing', () =>
            authority.request({ t: 'fertilize', tx, ty }, () => {
              const p = farming.plotAt(tx, ty);
              if (p && state.inventory.removeAt(slot, 1) === 1) farming.fertilize(p);
            }),
          ),
      };
    }

    const placeKind = item.places;
    const sapling = fruitTreeForSapling(stack.itemId);
    if (sapling) {
      const orchard = this.deps.orchard;
      const problem = orchard.plantProblem(tx, ty);
      if (problem) return { verb: "Can't plant here", trigger: 'use', blocked: true, run: () => toast(problem) };
      return {
        verb: `Plant ${sapling.name.toLowerCase()}`,
        trigger: 'use',
        run: () =>
          player.useTool(null, 'swing', () => {
            if (orchard.plantProblem(tx, ty)) return;
            authority.request({ t: 'treePlant', tx, ty, kind: sapling.kind }, () => {
              if (orchard.at(tx, ty) || state.inventory.removeAt(slot, 1) !== 1) return;
              orchard.plant(sapling.kind, tx, ty);
              toast(`Planted ${/^[aeiou]/i.test(sapling.name) ? 'an' : 'a'} ${sapling.name.toLowerCase()}. It grows on its own and is fully grown in a season.`);
            });
          }),
      };
    }

    if (placeKind) {
      const ok = this.canPlaceAt(placeKind, tx, ty);
      if (!ok) return { verb: "Can't place here", trigger: 'use', blocked: true, placing: true, run: () => undefined };
      return {
        verb: `Place ${item.name}`,
        trigger: 'use',
        placing: true,
        run: () =>
          player.useTool(null, 'swing', () => {
            if (!this.canPlaceAt(placeKind, tx, ty) || state.inventory.count(stack.itemId) < 1) return;
            authority.request({ t: 'place', kind: placeKind, tx, ty }, () => {
              if (build.at(tx, ty) || state.inventory.removeAt(slot, 1) !== 1) return;
              build.place(placeKind, tx, ty);
              sfx('place');
            });
          }),
      };
    }

    if (stack.itemId === 'horse') {
      const r = this.deps.releaseHorse(cx, ty * size + 14);
      return { verb: r.verb, trigger: 'use', blocked: r.blocked, run: r.run };
    }

    if (item.releases === 'cow' || item.releases === 'sheep') {
      const kind = item.releases;
      const barn = this.deps.livestock.barnWithSpace(build.ofKind('barn'));
      if (!barn) {
        const any = build.ofKind('barn').length > 0;
        return { verb: any ? 'Your barns are full' : 'Build a barn first', trigger: 'use', blocked: true, run: () => toast(any ? `Each barn holds ${BARN.capacity} animals. Build another barn.` : 'Cows and sheep need a barn (craft one under Building).') };
      }
      return {
        verb: `Release ${item.name.toLowerCase()} at the barn`,
        trigger: 'use',
        run: () =>
          authority.request({ t: 'livestock', kind, barnTx: barn.tx, barnTy: barn.ty }, (g) => {
            if (state.inventory.removeAt(slot, 1) !== 1) return;
            const a = this.deps.livestock.create(kind, barn, g.id, g.name);
            sfx('cluck', { rate: kind === 'cow' ? 0.5 : 0.8 });
            toast(`Meet ${a.name}! Keep hay in the barn and visit every day.`);
          }),
      };
    }

    if (item.releases === 'chicken' || item.releases === 'duck' || item.releases === 'rabbit') {
      const kind = item.releases;
      if (!this.canPlaceAt('chest', tx, ty)) return { verb: "Can't release here", trigger: 'use', blocked: true, run: () => undefined };
      return {
        verb: `Release ${item.name.toLowerCase()}`,
        trigger: 'use',
        run: () =>
          authority.request({ t: 'chicken', x: cx, y: ty * size + 14, ...(kind !== 'chicken' ? { kind } : {}) }, () => {
            if (state.inventory.removeAt(slot, 1) === 1) {
              animals.addChicken(cx, ty * size + 14, undefined, kind);
              fx.burst('heart', cx, cy - 6, 4);
              sfx('cluck');
            }
          }),
      };
    }

    const info = this.cropInfo(plot);
    if (info) return info;

    if (item.energy) {
      if (state.energy >= state.maxEnergy) return { verb: "You're not hungry", trigger: 'use', blocked: true, run: () => undefined };
      return { verb: `Eat ${item.name} (+${item.energy} energy)`, trigger: 'use', run: () => this.eatSlot(slot) };
    }
    return null;
  }

  /** A cow or sheep: collect milk/wool if ready, otherwise pet it. */
  private livestockAction(id: number): Action {
    const { livestock, authority, state, drops } = this.deps;
    const a = livestock.get(id)!;
    const def = LIVESTOCK[a.kind];
    const cal = this.deps.calendar();
    if (a.ready) {
      return {
        verb: `${def.verb} ${a.name}`,
        trigger: 'both',
        run: () =>
          authority.request({ t: 'animalCollect', id }, () => {
            if (!livestock.collect(id)) return;
            const size = GAME_CONFIG.tileSize;
            const { tx, ty } = this.target();
            if (state.inventory.add(def.product, 1) > 0) drops.spawn(def.product, 1, tx * size + 8, ty * size + 8);
            else gameEvents.emit('item:collected', { itemId: def.product, quantity: 1 });
            sfx('harvest');
          }),
      };
    }
    if (a.pettedDay === cal.day) return { verb: livestock.describe(a), trigger: 'both', info: true, run: () => toast(`${livestock.describe(a)}. ${a.fed ? 'It ate this morning.' : 'It was hungry this morning — put hay in the barn.'}`) };
    return {
      verb: `Pet ${a.name}`,
      trigger: 'both',
      run: () =>
        authority.request({ t: 'animalPet', id }, () => {
          if (livestock.pet(id, cal.day)) sfx('cluck', { rate: a.kind === 'cow' ? 0.5 : 0.85 });
        }),
    };
  }

  /** The silo: store hay; it tops up the barns every morning. */
  private siloAction(silo: Placed, slot: number, mode: 'use' | 'interact'): Action {
    const { state, authority, build } = this.deps;
    const stack = state.inventory.slots[slot];
    const hay = silo.hay ?? 0;
    if (mode === 'use' && stack?.itemId === 'hay' && hay < SILO_CAPACITY) {
      const quantity = Math.min(stack.quantity, SILO_CAPACITY - hay);
      return {
        verb: `Store ${quantity} hay in the silo (${hay}/${SILO_CAPACITY})`,
        trigger: 'use',
        run: () =>
          authority.request({ t: 'barnFeed', tx: silo.tx, ty: silo.ty, quantity }, (g) => {
            const accepted = g.accepted ?? quantity;
            const here = build.at(silo.tx, silo.ty);
            if (!here || state.inventory.remove('hay', accepted) === false) return;
            here.hay = (here.hay ?? 0) + accepted;
            sfx('place', { rate: 0.7 });
          }),
      };
    }
    return { verb: `Silo · ${hay}/${SILO_CAPACITY} hay`, trigger: 'both', info: true, run: () => toast(`The silo holds ${hay} hay. Every morning it refills your barns. Cutting grass now gives hay too.`) };
  }

  /** The barn: fill its hay trough, or see how it's doing. */
  private barnAction(barn: Placed, slot: number, mode: 'use' | 'interact'): Action {
    const { state, authority, build, livestock } = this.deps;
    const stack = state.inventory.slots[slot];
    const hay = barn.hay ?? 0;
    const animals = livestock.countIn(barn);
    if (mode === 'use' && stack?.itemId === 'hay' && hay < BARN.hayCapacity) {
      const quantity = Math.min(stack.quantity, BARN.hayCapacity - hay);
      return {
        verb: `Put ${quantity} hay in the barn (${hay}/${BARN.hayCapacity})`,
        trigger: 'use',
        run: () =>
          authority.request({ t: 'barnFeed', tx: barn.tx, ty: barn.ty, quantity }, (g) => {
            const accepted = g.accepted ?? quantity;
            const here = build.at(barn.tx, barn.ty);
            if (!here) return;
            const removed = state.inventory.removeAt(slot, accepted);
            here.hay = (here.hay ?? 0) + removed;
            sfx('rustle');
          }),
      };
    }
    const verb = `Barn · ${animals}/${BARN.capacity} animals · hay ${hay}/${BARN.hayCapacity}`;
    return { verb, trigger: 'both', info: true, run: () => toast(`${verb}. Each animal eats one hay every morning. Hold hay and press Space to fill the trough.`) };
  }

  /** Kegs and jars: load what you're holding, check progress, or collect. */
  private machineAction(placed: Placed, slot: number, mode: 'use' | 'interact'): Action | null {
    const { state, build, authority, fx, player } = this.deps;
    if (!isMachineKind(placed.kind)) return null;
    const def = MACHINES[placed.kind];
    const cal = this.deps.calendar();
    const now = gameTime(cal.day, cal.minute);
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = placed;
    const m = placed.machine;
    if (m && now >= m.readyAt) {
      return {
        verb: `Collect ${ITEMS[m.output].name}`,
        trigger: 'both',
        run: () =>
          authority.request({ t: 'machineCollect', tx, ty }, () => {
            const here = build.at(tx, ty);
            const out = here?.machine?.output ?? m.output;
            if (here) build.setMachine(here, null, now);
            if (state.inventory.add(out, 1) > 0) this.deps.drops.spawn(out, 1, tx * size + 8, ty * size + 10);
            else gameEvents.emit('item:collected', { itemId: out, quantity: 1 });
            fx.burst('sparkle', tx * size + 8, ty * size, 6);
            sfx('harvest');
          }),
      };
    }
    if (m) {
      const left = Math.max(1, Math.ceil((m.readyAt - now) / 60));
      if (def.outputs) return { verb: `${def.name} · check back in ${left}h`, trigger: 'both', info: true, run: () => toast(`The ${def.name} is baited. Something should be in it in about ${left} hour${left > 1 ? 's' : ''}.`) };
      return { verb: `${def.name} · ${ITEMS[m.output].name} ready in ${left}h`, trigger: 'both', info: true, run: () => toast(`${def.name}: ${ITEMS[m.input].name} → ${ITEMS[m.output].name}, about ${left} hour${left > 1 ? 's' : ''} to go.`) };
    }
    const stack = state.inventory.slots[slot];
    if (mode === 'use' && stack && def.accepts.includes(stack.itemId)) {
      const itemId = stack.itemId;
      return {
        verb: `${def.verb} ${ITEMS[itemId].name} in the ${def.name}`,
        trigger: 'use',
        run: () =>
          player.useTool(null, 'swing', () =>
            authority.request({ t: 'machineLoad', tx, ty, itemId }, (g) => {
              const here = build.at(tx, ty);
              if (!here || here.machine || state.inventory.removeAt(slot, 1) !== 1) return;
              build.setMachine(here, { input: itemId, output: g.output ?? rollMachineOutput(def), readyAt: g.readyAt ?? now + def.minutes }, now);
              sfx('place');
            }),
          ),
      };
    }
    return { verb: def.hint, trigger: 'both', info: true, run: () => toast(`${def.name}: accepts ${def.accepts.map((i) => ITEMS[i].name).join(', ')}.`) };
  }

  /** Giving the held item to someone, if it's something they'd accept. */
  private giftAction(npcId: NpcId, slot: number): Action | null {
    const { state, social } = this.deps;
    const stack = state.inventory.slots[slot];
    if (!stack || !Social.giftable(stack.itemId)) return null;
    const name = NPCS[npcId].name;
    if (social.giftedToday(npcId, this.deps.calendar().day)) {
      return { verb: `${name} already got a gift today`, trigger: 'use', blocked: true, run: () => toast(`You've already given ${name} a gift today.`) };
    }
    return { verb: `Give ${ITEMS[stack.itemId].name} to ${name}`, trigger: 'use', run: () => this.deps.giveGift(npcId, slot) };
  }

  /** "Carrot · 2 days to go · needs water" for a growing crop. */
  private cropInfo(plot: ReturnType<FarmingSystem['plotAt']>): Action | null {
    if (!plot?.crop || this.deps.farming.isMature(plot)) return null;
    const crop = CROPS[plot.crop.id];
    const days = crop.matureStage - plot.crop.stage;
    const verb = `${crop.name} · ready in ${days} day${days === 1 ? '' : 's'}${plot.watered ? ' · watered' : ' · needs water'}${plot.crop.fed ? ' · fertilized' : ''}${this.deps.farming.pollinatedAt(plot.tx, plot.ty) ? ' · 🐝 pollinated' : ''}`;
    return { verb, trigger: 'use', info: true, run: () => toast(plot.watered ? `${verb}.` : `${verb}. Use the watering can (or wait for rain).`) };
  }

  /** Digging fresh soil now and then turns up something old. */
  private maybeArtifact(x: number, y: number): void {
    if (Math.random() >= 0.025) return;
    const item = Math.random() < 0.55 ? 'arrowhead' : 'old_coin';
    this.deps.drops.spawn(item, 1, x, y);
    toast(`You dug up something old: ${ITEMS[item].name}! The museum would love it.`);
  }

  private canPlaceAt(kind: Parameters<BuildSystem['canPlace']>[0], tx: number, ty: number): boolean {
    const { build, resources, farming, animals, player } = this.deps;
    const feet = player.tile;
    const solid = !PLACEABLES[kind].floor;
    return build.canPlace(
      kind,
      tx,
      ty,
      (x, y) => resources.isBlocked(x, y) || farming.isTilled(x, y) || animals.occupies(x, y) || this.deps.livestock.occupies(x, y) || (solid && x === feet.tx && y === feet.ty),
    );
  }

  private drawCursor(enabled: boolean, action: Action | null): void {
    const g = this.cursor;
    g.clear();
    this.ghost.setVisible(false);
    if (!enabled) return;
    const stack = this.deps.state.inventory.selectedStack;
    const def = stack ? ITEMS[stack.itemId] : null;
    const holdsUsable = !!def && (!!def.tool || !!def.plants || !!def.places || !!def.releases || stack?.itemId === 'fertilizer');
    if (!action && !holdsUsable) return;

    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const x = tx * size;
    const y = ty * size;

    // Placement preview.
    if (def?.places && action?.placing) {
      const kind = def.places;
      const tint = action && !action.blocked ? 0x9cff9c : 0xff8f80;
      if (PLACEABLES[kind].floor) {
        g.fillStyle(tint, 0.35).fillRect(x, y, size, size);
      } else if (kind !== 'cottage') {
        const key = kind === 'fence' ? fenceTextureKey(false, false) : placeableTextureKey(kind as SpritePlaceable);
        const originY = kind === 'fence' ? 1 : GHOST_ORIGIN[kind] ?? 15 / 16;
        const baseY = kind === 'fence' ? y + size : y + size - 2;
        this.ghost.setTexture(key).setOrigin(0.5, originY).setPosition(x + (PLACEABLES[kind].width * size) / 2, baseY).setTint(tint).setVisible(true);
      }
    }

    const pulse = 0.75 + Math.sin(this.scene.time.now / 180) * 0.2;
    const color = action?.blocked ? 0xf08a7a : 0xffffff;
    g.fillStyle(color, action ? pulse : 0.3);
    const arm = 4;
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1],
      [x + size, y, -1, 1],
      [x, y + size, 1, -1],
      [x + size, y + size, -1, -1],
    ] as const) {
      const ox = sx > 0 ? cx : cx - 1;
      const oy = sy > 0 ? cy : cy - 1;
      g.fillRect(sx > 0 ? ox : ox - arm + 1, oy, arm, 1);
      g.fillRect(ox, sy > 0 ? oy : oy - arm + 1, 1, arm);
    }
  }
}
