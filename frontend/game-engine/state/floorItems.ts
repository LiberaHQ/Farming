import type { FloorItemSave, ItemId } from '@farming/shared';

export interface FloorItem {
  itemId: ItemId;
  quantity: number;
  x: number;
  y: number;
  q?: 1 | 2;
}

/**
 * Items lying on the ground, kept per area so they are still there when you
 * walk back in (or reload). An area's DropSystem takes its items when it is
 * created and hands them back when the area closes; while an area is open its
 * live drops are read straight from it.
 */
class FloorStore {
  private seed: string | null = null;
  private readonly stored = new Map<string, FloorItem[]>();
  private readonly live = new Map<string, () => FloorItem[]>();

  /** Loading a world: replace everything with what the save holds. */
  reset(seed: string, items: FloorItemSave[]): void {
    this.seed = seed;
    this.stored.clear();
    for (const { area, itemId, quantity, x, y, q } of items) this.list(area).push({ itemId, quantity, x, y, ...(q ? { q } : {}) });
  }

  /** Co-op restarts keep what is on the ground, unless it's a different world. */
  keepFor(seed: string): void {
    if (this.seed !== seed) this.reset(seed, []);
  }

  /** An area opened: take its items and report live ones from now on. */
  open(area: string, read: () => FloorItem[]): FloorItem[] {
    const items = this.stored.get(area) ?? [];
    this.stored.delete(area);
    this.live.set(area, read);
    return items;
  }

  /** An area closed: keep what is left on its ground. */
  close(area: string, items: FloorItem[]): void {
    this.live.delete(area);
    if (items.length) this.stored.set(area, items);
    else this.stored.delete(area);
  }

  snapshot(): FloorItemSave[] {
    const out: FloorItemSave[] = [];
    const add = (area: string, items: FloorItem[]) => {
      for (const i of items) out.push({ area, itemId: i.itemId, quantity: i.quantity, x: Math.round(i.x), y: Math.round(i.y), ...(i.q ? { q: i.q } : {}) });
    };
    for (const [area, items] of this.stored) if (!this.live.has(area)) add(area, items);
    for (const [area, read] of this.live) add(area, read());
    return out.slice(0, 400);
  }

  private list(area: string): FloorItem[] {
    let l = this.stored.get(area);
    if (!l) this.stored.set(area, (l = []));
    return l;
  }
}

export const floorItems = new FloorStore();
