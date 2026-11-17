import type { ItemId } from './items';
import type { PlaceableKind } from './placeables';

/** Machines turn one item into a better one over time (game minutes). */
export interface MachineDef {
  kind: MachineKind;
  name: string;
  accepts: readonly ItemId[];
  /** What comes out. */
  output: ItemId;
  /** Random outcome instead (the server rolls it in co-op). */
  outputs?: ReadonlyArray<{ itemId: ItemId; weight: number }>;
  minutes: number;
  /** Words for the UI: "Put Strawberry in the Keg", "insert fruit". */
  verb: string;
  hint: string;
}

export type MachineKind = 'keg' | 'preserves_jar' | 'cheese_press' | 'loom' | 'crab_pot';

export const MACHINES: Record<MachineKind, MachineDef> = {
  keg: {
    kind: 'keg',
    name: 'Keg',
    accepts: ['strawberry', 'blueberry', 'tomato', 'berries'],
    output: 'juice',
    minutes: 20 * 60,
    verb: 'Put',
    hint: 'Keg · add fruit',
  },
  preserves_jar: {
    kind: 'preserves_jar',
    name: 'Preserves Jar',
    accepts: ['turnip', 'carrot', 'potato', 'eggplant', 'corn', 'snow_yam', 'wheat'],
    output: 'pickles',
    minutes: 10 * 60,
    verb: 'Put',
    hint: 'Preserves jar · add vegetables',
  },
  cheese_press: { kind: 'cheese_press', name: 'Cheese Press', accepts: ['milk'], output: 'cheese', minutes: 4 * 60, verb: 'Put', hint: 'Cheese press · add milk' },
  loom: { kind: 'loom', name: 'Loom', accepts: ['wool'], output: 'cloth', minutes: 6 * 60, verb: 'Put', hint: 'Loom · add wool' },
  crab_pot: {
    kind: 'crab_pot',
    name: 'Crab Pot',
    accepts: ['bait'],
    output: 'crab',
    outputs: [
      { itemId: 'crab', weight: 35 },
      { itemId: 'shrimp', weight: 40 },
      { itemId: 'seaweed', weight: 10 },
      { itemId: 'driftwood', weight: 8 },
      { itemId: 'old_boot', weight: 7 },
    ],
    minutes: 12 * 60,
    verb: 'Bait',
    hint: 'Crab pot · add bait',
  },
};

/** Picks a machine's output (random for crab pots). */
export function rollMachineOutput(def: MachineDef, roll: number = Math.random()): ItemId {
  if (!def.outputs?.length) return def.output;
  let left = roll * def.outputs.reduce((n, o) => n + o.weight, 0);
  for (const o of def.outputs) {
    left -= o.weight;
    if (left <= 0) return o.itemId;
  }
  return def.outputs[def.outputs.length - 1].itemId;
}

export const isMachineKind = (kind: PlaceableKind): kind is MachineKind => kind in MACHINES;

/** Absolute game time in minutes, for "ready at" comparisons across days. */
export const gameTime = (day: number, minute: number) => day * 24 * 60 + minute;

/** A machine at work, as saved. */
export interface MachineState {
  input: ItemId;
  output: ItemId;
  /** gameTime() when it's done. */
  readyAt: number;
}

/** The patch a greenhouse shelters: 5 wide, 5 deep, directly in front (south) of it. */
export function greenhouseArea(g: { tx: number; ty: number }): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: g.tx - 1, y0: g.ty + 1, x1: g.tx + 3, y1: g.ty + 5 };
}

export function underGlass(placed: ReadonlyArray<{ kind: PlaceableKind; tx: number; ty: number }>, tx: number, ty: number): boolean {
  return placed.some((p) => {
    if (p.kind !== 'greenhouse') return false;
    const a = greenhouseArea(p);
    return tx >= a.x0 && tx <= a.x1 && ty >= a.y0 && ty <= a.y1;
  });
}
