import { ITEMS, type ItemId, type Quality } from '@farming/shared';

export interface ItemStack {
  itemId: ItemId;
  quantity: number;
  /** Crops and fruit: 1 silver, 2 gold (absent = normal). Only equal qualities stack together. */
  q?: 1 | 2;
}

/** A stack's quality (0 = normal). */
export const qualityOf = (s: { q?: 1 | 2 } | null | undefined): Quality => s?.q ?? 0;
const stackOf = (itemId: ItemId, quantity: number, q: Quality): ItemStack => (q ? { itemId, quantity, q } : { itemId, quantity });

export type InventorySlot = ItemStack | null;

/**
 * Grid inventory with stacking. The first `hotbarSize` slots form the hotbar.
 * Pure model: no rendering, no Phaser. Calls `onChange` after every mutation.
 */
export class Inventory {
  readonly slots: InventorySlot[];
  private selectedIndex = 0;

  constructor(
    size: number,
    readonly hotbarSize: number,
    private readonly onChange: () => void,
  ) {
    this.slots = Array.from({ length: size }, () => null);
  }

  get selected(): number {
    return this.selectedIndex;
  }

  get selectedStack(): InventorySlot {
    return this.slots[this.selectedIndex];
  }

  select(index: number): void {
    if (index < 0 || index >= this.hotbarSize || index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.onChange();
  }

  cycle(delta: number): void {
    this.select((((this.selectedIndex + delta) % this.hotbarSize) + this.hotbarSize) % this.hotbarSize);
  }

  count(itemId: ItemId): number {
    let total = 0;
    for (const s of this.slots) if (s?.itemId === itemId) total += s.quantity;
    return total;
  }

  /** How many more of this item (at this quality) fit. */
  capacityFor(itemId: ItemId, q: Quality = 0): number {
    const max = ITEMS[itemId].maxStack;
    let capacity = 0;
    for (const s of this.slots) {
      if (!s) capacity += max;
      else if (s.itemId === itemId && qualityOf(s) === q) capacity += max - s.quantity;
    }
    return capacity;
  }

  /** Adds items, topping up existing stacks of the same quality first. Returns the quantity that did not fit. */
  add(itemId: ItemId, quantity: number, q: Quality = 0): number {
    const max = ITEMS[itemId].maxStack;
    let remaining = quantity;
    for (const s of this.slots) {
      if (remaining === 0) break;
      if (s && s.itemId === itemId && qualityOf(s) === q && s.quantity < max) {
        const take = Math.min(max - s.quantity, remaining);
        s.quantity += take;
        remaining -= take;
      }
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const take = Math.min(max, remaining);
      this.slots[i] = stackOf(itemId, take, q);
      remaining -= take;
    }
    if (remaining !== quantity) this.onChange();
    return remaining;
  }

  /** Removes items from anywhere (backpack first, plainest quality first). All-or-nothing. */
  remove(itemId: ItemId, quantity: number): boolean {
    if (this.count(itemId) < quantity) return false;
    let remaining = quantity;
    for (const q of [0, 1, 2] as const) {
      for (let i = this.slots.length - 1; i >= 0 && remaining > 0; i--) {
        const s = this.slots[i];
        if (!s || s.itemId !== itemId || qualityOf(s) !== q) continue;
        const take = Math.min(s.quantity, remaining);
        s.quantity -= take;
        remaining -= take;
        if (s.quantity === 0) this.slots[i] = null;
      }
    }
    this.onChange();
    return true;
  }

  /** Removes up to `quantity` from one slot. Returns how many were removed. */
  removeAt(index: number, quantity: number): number {
    const s = this.slots[index];
    if (!s) return 0;
    const take = Math.min(s.quantity, Math.max(0, quantity));
    s.quantity -= take;
    if (s.quantity === 0) this.slots[index] = null;
    if (take > 0) this.onChange();
    return take;
  }

  /** Replaces every slot (a shared chest updated by the server). */
  replace(slots: readonly (ItemStack | null)[]): void {
    for (let i = 0; i < this.slots.length; i++) {
      const s = slots[i];
      this.slots[i] = s && ITEMS[s.itemId] && s.quantity > 0 ? stackOf(s.itemId, s.quantity, qualityOf(s)) : null;
    }
    this.onChange();
  }

  /** Drag-and-drop semantics: merge into a matching stack, otherwise swap. */
  move(from: number, to: number): void {
    if (from === to || !this.isValid(from) || !this.isValid(to)) return;
    const a = this.slots[from];
    const b = this.slots[to];
    if (!a) return;
    const max = ITEMS[a.itemId].maxStack;
    if (b && b.itemId === a.itemId && qualityOf(a) === qualityOf(b) && max > 1 && b.quantity < max) {
      const moved = Math.min(a.quantity, max - b.quantity);
      b.quantity += moved;
      a.quantity -= moved;
      if (a.quantity === 0) this.slots[from] = null;
    } else {
      this.slots[from] = b;
      this.slots[to] = a;
    }
    this.onChange();
  }

  snapshot(): { slots: InventorySlot[]; selected: number; hotbarSize: number } {
    return {
      slots: this.slots.map((s) => (s ? { ...s } : null)),
      selected: this.selectedIndex,
      hotbarSize: this.hotbarSize,
    };
  }

  private isValid(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.slots.length;
  }
}
