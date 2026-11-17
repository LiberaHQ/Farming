import {
  MINE,
  APPEARANCE_OPTIONS,
  DEFAULT_APPEARANCE_CHOICE,
  GAME_CONFIG,
  ITEM_IDS,
  ITEMS,
  STARTER_KIT,
  isItemId,
  type AppearanceChoice,
  type AppearancePart,
  type PlayerSave,
  BIN_SIZE,
  BUFF_INFO,
  type BuffKind,
  type ItemId,
  isQuality,
  withQuality,
} from '@farming/shared';
import type { ItemStack } from './Inventory';
import { gameEvents } from '../events/GameEventBus';
import { Inventory, qualityOf } from './Inventory';

export type { PlayerSave } from '@farming/shared';

/**
 * Everything the player owns. Kept separate from the Player entity (which is
 * about rendering and movement) so it can be saved, loaded and later synced
 * with the backend without touching Phaser objects.
 */
export class PlayerState {
  readonly inventory: Inventory;
  readonly waterCapacity: number = GAME_CONFIG.farming.wateringCanCapacity;
  readonly maxEnergy: number = GAME_CONFIG.energy.max;
  private goldAmount: number = GAME_CONFIG.economy.startingGold;
  private earnings = 0;
  private waterAmount: number = GAME_CONFIG.farming.wateringCanCapacity;
  private energyAmount: number = GAME_CONFIG.energy.max;
  readonly maxHealth: number = MINE.maxHealth;
  private healthAmount: number = MINE.maxHealth;
  private depth = 0;
  private look: AppearanceChoice = { ...DEFAULT_APPEARANCE_CHOICE };
  /** The shipping bin: sold overnight. */
  private binSlots: ItemStack[] = [];
  private buffList: Array<{ kind: BuffKind; until: number }> = [];
  private worn: { ring?: ItemId; armor?: ItemId } = {};
  /** Current game time (day*1440+minute), kept by the world scene; used for buffs. */
  private clock = 0;

  constructor() {
    const { size, hotbarSize } = GAME_CONFIG.inventory;
    this.inventory = new Inventory(size, hotbarSize, () => gameEvents.emit('inventory:changed', this.inventory.snapshot()));
    for (const { itemId, quantity } of STARTER_KIT) this.inventory.add(itemId, quantity);
  }

  // ---------- Shipping bin ----------

  get bin(): readonly ItemStack[] {
    return this.binSlots;
  }

  /** Value of everything in the bin at tonight's prices. */
  get binValue(): number {
    return this.binSlots.reduce((sum, s) => sum + withQuality(ITEMS[s.itemId].sellPrice ?? 0, s.q) * s.quantity, 0);
  }

  /** Moves a backpack stack into the bin. Returns how many went in. */
  ship(slot: number): number {
    const stack = this.inventory.slots[slot];
    if (!stack || !ITEMS[stack.itemId].sellPrice) return 0;
    const q = qualityOf(stack);
    const existing = this.binSlots.find((s) => s.itemId === stack.itemId && qualityOf(s) === q);
    if (!existing && this.binSlots.length >= BIN_SIZE) return 0;
    const itemId = stack.itemId;
    const moved = this.inventory.removeAt(slot, stack.quantity);
    if (existing) existing.quantity += moved;
    else this.binSlots.push(q ? { itemId, quantity: moved, q } : { itemId, quantity: moved });
    return moved;
  }

  /** Takes a stack back out of the bin. */
  unship(index: number): boolean {
    const s = this.binSlots[index];
    if (!s) return false;
    const left = this.inventory.add(s.itemId, s.quantity, qualityOf(s));
    if (left === s.quantity) return false;
    if (left > 0) s.quantity = left;
    else this.binSlots.splice(index, 1);
    return true;
  }

  /** Overnight: sells the bin. */
  sellBin(): { items: Array<{ itemId: ItemStack['itemId']; quantity: number; gold: number; q?: 1 | 2 }>; total: number } {
    const items = this.binSlots.map((s) => ({ itemId: s.itemId, quantity: s.quantity, gold: withQuality(ITEMS[s.itemId].sellPrice ?? 0, s.q) * s.quantity, ...(s.q ? { q: s.q } : {}) }));
    const total = items.reduce((n, i) => n + i.gold, 0);
    this.binSlots = [];
    if (total > 0) this.earn(total);
    return { items, total };
  }

  // ---------- Equipment ----------

  get equipment(): { ring?: ItemId; armor?: ItemId } {
    return { ...this.worn };
  }

  /** Extra weapon damage from what you wear. */
  get attackBonus(): number {
    return (this.worn.ring ? ITEMS[this.worn.ring].equip?.attack ?? 0 : 0) + (this.worn.armor ? ITEMS[this.worn.armor].equip?.attack ?? 0 : 0);
  }

  /** Fraction of damage blocked (0..0.75). */
  get defense(): number {
    const d = (this.worn.ring ? ITEMS[this.worn.ring].equip?.defense ?? 0 : 0) + (this.worn.armor ? ITEMS[this.worn.armor].equip?.defense ?? 0 : 0);
    return Math.min(0.75, d);
  }

  /** Puts on a ring or armour from the backpack (swapping out what was worn). */
  wear(slot: number): ItemId | null {
    const stack = this.inventory.slots[slot];
    const eq = stack ? ITEMS[stack.itemId].equip : undefined;
    if (!stack || !eq) return null;
    const itemId = stack.itemId;
    if (this.inventory.removeAt(slot, 1) !== 1) return null;
    const old = this.worn[eq.slot];
    this.worn = { ...this.worn, [eq.slot]: itemId };
    if (old && this.inventory.add(old, 1) > 0) {
      // No room: put the new one back and keep wearing the old.
      this.worn = { ...this.worn, [eq.slot]: old };
      this.inventory.add(itemId, 1);
      return null;
    }
    this.emitEquipment();
    return itemId;
  }

  takeOff(which: 'ring' | 'armor'): boolean {
    const id = this.worn[which];
    if (!id || this.inventory.add(id, 1) > 0) return false;
    const next = { ...this.worn };
    delete next[which];
    this.worn = next;
    this.emitEquipment();
    return true;
  }

  emitEquipment(): void {
    gameEvents.emit('player:equipment', { ...this.worn });
  }

  // ---------- Buffs ----------

  setClock(now: number): void {
    this.clock = now;
    const before = this.buffList.length;
    this.buffList = this.buffList.filter((b) => b.until > now);
    if (this.buffList.length !== before) this.emitBuffs();
  }

  hasBuff(kind: BuffKind): boolean {
    if (kind === 'luck' && this.worn.ring && ITEMS[this.worn.ring].equip?.luck) return true;
    return this.buffList.some((b) => b.kind === kind && b.until > this.clock);
  }

  addBuff(kind: BuffKind, minutes: number): void {
    this.buffList = [...this.buffList.filter((b) => b.kind !== kind), { kind, until: this.clock + minutes }];
    this.emitBuffs();
  }

  clearBuffs(): void {
    this.buffList = [];
    this.emitBuffs();
  }

  emitBuffs(): void {
    gameEvents.emit('player:buffs', this.buffList.map((b) => ({ kind: b.kind, minutesLeft: Math.max(0, b.until - this.clock) })));
  }

  get gold(): number {
    return this.goldAmount;
  }

  get lifetimeEarnings(): number {
    return this.earnings;
  }

  get water(): number {
    return this.waterAmount;
  }

  get energy(): number {
    return this.energyAmount;
  }

  get appearance(): AppearanceChoice {
    return { ...this.look };
  }

  /** Income from selling. Also tracks lifetime earnings, which unlock new shop stock. */
  earn(amount: number): void {
    const before = this.earnings;
    this.goldAmount += amount;
    this.earnings += amount;
    this.emitStats();
    for (const id of ITEM_IDS) {
      const unlock = ITEMS[id].unlockAtEarnings;
      if (unlock !== undefined && before < unlock && this.earnings >= unlock) {
        gameEvents.emit('toast', { text: `New at the stall: ${ITEMS[id].name}` });
      }
    }
  }

  /** Shared wallet: the purse total, set by the server. */
  setGold(gold: number): void {
    this.goldAmount = Math.max(0, Math.round(gold));
    this.emitStats();
  }

  /** Gold from another player (a trade): not counted as sales. */
  receiveGold(amount: number): void {
    if (amount <= 0) return;
    this.goldAmount += amount;
    this.emitStats();
  }

  /** Returns false (and changes nothing) if the player cannot afford it. */
  spendGold(amount: number): boolean {
    if (amount > this.goldAmount) return false;
    this.goldAmount -= amount;
    this.emitStats();
    return true;
  }

  useWater(): boolean {
    if (this.waterAmount <= 0) return false;
    this.waterAmount -= 1;
    this.emitStats();
    return true;
  }

  refillWater(): void {
    this.waterAmount = this.waterCapacity;
    this.emitStats();
  }

  /** Returns false (and spends nothing) if there isn't enough energy. */
  spendEnergy(cost: number): boolean {
    if (cost > this.energyAmount) return false;
    this.energyAmount -= cost;
    this.emitStats();
    return true;
  }

  restoreEnergy(amount: number): void {
    this.energyAmount = Math.min(this.maxEnergy, this.energyAmount + amount);
    this.emitStats();
  }

  get health(): number {
    return this.healthAmount;
  }

  /** Deepest mine floor reached. */
  get mineDepth(): number {
    return this.depth;
  }

  reachFloor(floor: number): boolean {
    if (floor <= this.depth) return false;
    this.depth = floor;
    return true;
  }

  /** Returns the health left. */
  hurt(amount: number): number {
    this.healthAmount = Math.max(0, this.healthAmount - amount);
    this.emitStats();
    return this.healthAmount;
  }

  heal(amount: number): void {
    this.healthAmount = Math.min(this.maxHealth, this.healthAmount + amount);
    this.emitStats();
  }

  setEnergyFraction(fraction: number): void {
    this.energyAmount = Math.round(this.maxEnergy * fraction);
    this.emitStats();
  }

  setAppearancePart(part: AppearancePart, index: number): boolean {
    if (!(part in APPEARANCE_OPTIONS) || !Number.isInteger(index)) return false;
    if (index < 0 || index >= APPEARANCE_OPTIONS[part].length) return false;
    this.look = { ...this.look, [part]: index };
    gameEvents.emit('player:appearance', { choice: this.appearance });
    return true;
  }

  emitAll(): void {
    gameEvents.emit('inventory:changed', this.inventory.snapshot());
    gameEvents.emit('player:appearance', { choice: this.appearance });
    this.emitStats();
    this.emitBuffs();
    this.emitEquipment();
  }

  serialize(): PlayerSave {
    const snap = this.inventory.snapshot();
    return {
      gold: this.goldAmount,
      lifetimeEarnings: this.earnings,
      energy: this.energyAmount,
      water: this.waterAmount,
      appearance: this.appearance,
      inventory: { slots: snap.slots, selected: snap.selected },
      health: this.healthAmount,
      mineDepth: this.depth,
      bin: this.binSlots.map((s) => ({ ...s })),
      buffs: this.buffList.map((b) => ({ ...b })),
      equipment: { ...this.worn },
    };
  }

  /** Restores from a save, ignoring anything malformed. */
  restore(save: PlayerSave): void {
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
    this.goldAmount = Math.max(0, num(save.gold, this.goldAmount));
    this.earnings = Math.max(0, num(save.lifetimeEarnings, 0));
    this.energyAmount = Math.max(0, Math.min(this.maxEnergy, num(save.energy, this.maxEnergy)));
    this.waterAmount = Math.max(0, Math.min(this.waterCapacity, num(save.water, this.waterCapacity)));
    this.healthAmount = Math.max(1, Math.min(this.maxHealth, num(save.health, this.maxHealth)));
    this.depth = Math.max(0, Math.min(MINE.floors, Math.floor(num(save.mineDepth, 0))));
    for (const part of Object.keys(APPEARANCE_OPTIONS) as AppearancePart[]) {
      this.setAppearancePart(part, num(save.appearance?.[part], 0));
    }
    const slots = Array.isArray(save.inventory?.slots) ? save.inventory.slots : [];
    for (let i = 0; i < this.inventory.slots.length; i++) {
      const s = slots[i];
      this.inventory.slots[i] =
        s && isItemId(s.itemId) && Number.isInteger(s.quantity) && s.quantity > 0
          ? { itemId: s.itemId, quantity: Math.min(s.quantity, ITEMS[s.itemId].maxStack), ...(isQuality(s.q) ? { q: s.q } : {}) }
          : null;
    }
    this.inventory.select(num(save.inventory?.selected, 0));
    this.binSlots = (save.bin ?? []).filter((s): s is ItemStack => !!s && isItemId(s.itemId) && s.quantity > 0).map((s) => ({ ...s }));
    this.buffList = (save.buffs ?? []).filter((b) => b.kind in BUFF_INFO).map((b) => ({ ...b }));
    this.worn = {};
    if (save.equipment?.ring && ITEMS[save.equipment.ring]?.equip?.slot === 'ring') this.worn.ring = save.equipment.ring;
    if (save.equipment?.armor && ITEMS[save.equipment.armor]?.equip?.slot === 'armor') this.worn.armor = save.equipment.armor;
  }

  private emitStats(): void {
    gameEvents.emit('player:stats', {
      gold: this.goldAmount,
      lifetimeEarnings: this.earnings,
      water: this.waterAmount,
      waterCapacity: this.waterCapacity,
      energy: this.energyAmount,
      maxEnergy: this.maxEnergy,
      health: this.healthAmount,
      maxHealth: this.maxHealth,
    });
  }
}
