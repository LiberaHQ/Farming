import type { ItemId } from './items';

/** Barn animals: cows and sheep. Chickens are simpler and live on their own. */
export type LivestockKind = 'cow' | 'sheep';

export interface LivestockDef {
  kind: LivestockKind;
  name: string;
  /** The item you buy and release. */
  item: ItemId;
  product: ItemId;
  /** "Milk", "Shear". */
  verb: string;
}

export const LIVESTOCK: Record<LivestockKind, LivestockDef> = {
  cow: { kind: 'cow', name: 'Cow', item: 'cow', product: 'milk', verb: 'Milk' },
  sheep: { kind: 'sheep', name: 'Sheep', item: 'sheep', product: 'wool', verb: 'Shear' },
};

export const BARN = {
  /** Animals per barn. */
  capacity: 4,
  /** Hay the barn's trough holds. */
  hayCapacity: 40,
  /** Happiness (0–100) changes each morning and when petted. */
  fed: 8,
  hungry: -20,
  petted: 6,
  /** A fed animal with at least this much happiness has its product ready each morning. */
  produceAt: 20,
} as const;

/** A barn animal, as saved (shared in co-op). */
export interface LivestockSave {
  id: number;
  kind: LivestockKind;
  name: string;
  /** Where it wanders around (the barn's door). */
  homeX: number;
  homeY: number;
  happiness: number;
  /** Product waiting to be collected. */
  ready: boolean;
  /** Day it was last petted (one pet a day counts). */
  pettedDay: number;
  /** Whether it ate this morning. */
  fed: boolean;
}

const NAMES = ['Daisy', 'Clover', 'Bluebell', 'Maple', 'Pepper', 'Biscuit', 'Hazel', 'Juniper', 'Poppy', 'Willow', 'Barley', 'Nutmeg'];
export const livestockName = (id: number) => NAMES[id % NAMES.length];

/**
 * The barn's morning: each animal eats one hay from its barn if there is any,
 * gets happier or sadder, and has its milk or wool ready if it ate and is
 * content enough. Pure, so the game (alone) and the co-op server share it.
 */
export function livestockMorning(animals: LivestockSave[], barns: Array<{ tx: number; ty: number; hay: number }>, homeOf: (a: LivestockSave) => { tx: number; ty: number } | null): void {
  for (const a of animals) {
    const home = homeOf(a);
    const barn = home ? barns.find((b) => b.tx === home.tx && b.ty === home.ty) : undefined;
    a.fed = !!barn && barn.hay > 0;
    if (barn && a.fed) barn.hay -= 1;
    a.happiness = Math.max(0, Math.min(100, a.happiness + (a.fed ? BARN.fed : BARN.hungry)));
    if (a.fed && a.happiness >= BARN.produceAt) a.ready = true;
  }
}

/** Morning: silos top up every barn's hay, as far as the silos' stock goes. Mutates `hay` on both. */
export function siloRefill(placed: ReadonlyArray<{ kind: string; hay?: number }>): number {
  const silos = placed.filter((p) => p.kind === 'silo');
  let moved = 0;
  for (const barn of placed) {
    if (barn.kind !== 'barn') continue;
    let need = BARN.hayCapacity - (barn.hay ?? 0);
    for (const silo of silos) {
      if (need <= 0) break;
      const take = Math.min(need, silo.hay ?? 0);
      if (take <= 0) continue;
      silo.hay = (silo.hay ?? 0) - take;
      barn.hay = (barn.hay ?? 0) + take;
      need -= take;
      moved += take;
    }
  }
  return moved;
}
