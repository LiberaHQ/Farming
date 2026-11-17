import type { ItemId } from './items';

export type PlaceableKind =
  | 'fence'
  | 'wood_path'
  | 'stone_path'
  | 'lamp_post'
  | 'chest'
  | 'cottage'
  | 'sprinkler'
  | 'bench'
  | 'flower_pot'
  | 'scarecrow'
  | 'keg'
  | 'preserves_jar'
  | 'greenhouse'
  | 'cheese_press'
  | 'loom'
  | 'barn'
  | 'mailbox'
  | 'shipping_bin'
  | 'crab_pot'
  | 'iron_sprinkler'
  | 'gold_sprinkler'
  | 'silo'
  | 'well'
  | 'shed'
  | 'statue'
  | 'flower_bed'
  | 'birdbath'
  | 'gnome'
  | 'collector'
  | 'cabin';

export interface PlaceableDef {
  kind: PlaceableKind;
  /** Item returned when picked up (null = permanent, e.g. the cottage). */
  item: ItemId | null;
  /** Footprint in tiles. */
  width: number;
  /** Floors are drawn on the ground and are walkable. */
  floor: boolean;
  /** Radius (px) of light cast at night. */
  light?: number;
  /** Goes in water instead of on grass. */
  onWater?: boolean;
}

export const PLACEABLES: Record<PlaceableKind, PlaceableDef> = {
  fence: { kind: 'fence', item: 'fence', width: 1, floor: false },
  wood_path: { kind: 'wood_path', item: 'wood_path', width: 1, floor: true },
  stone_path: { kind: 'stone_path', item: 'stone_path', width: 1, floor: true },
  lamp_post: { kind: 'lamp_post', item: 'lamp_post', width: 1, floor: false, light: 64 },
  chest: { kind: 'chest', item: 'chest', width: 1, floor: false },
  cottage: { kind: 'cottage', item: null, width: 3, floor: false, light: 40 },
  sprinkler: { kind: 'sprinkler', item: 'sprinkler', width: 1, floor: false },
  bench: { kind: 'bench', item: 'bench', width: 1, floor: false },
  flower_pot: { kind: 'flower_pot', item: 'flower_pot', width: 1, floor: false },
  scarecrow: { kind: 'scarecrow', item: 'scarecrow', width: 1, floor: false },
  keg: { kind: 'keg', item: 'keg', width: 1, floor: false },
  preserves_jar: { kind: 'preserves_jar', item: 'preserves_jar', width: 1, floor: false },
  greenhouse: { kind: 'greenhouse', item: 'greenhouse', width: 3, floor: false },
  cheese_press: { kind: 'cheese_press', item: 'cheese_press', width: 1, floor: false },
  loom: { kind: 'loom', item: 'loom', width: 1, floor: false },
  barn: { kind: 'barn', item: 'barn', width: 3, floor: false },
  mailbox: { kind: 'mailbox', item: null, width: 1, floor: false },
  shipping_bin: { kind: 'shipping_bin', item: null, width: 1, floor: false },
  crab_pot: { kind: 'crab_pot', item: 'crab_pot', width: 1, floor: false, onWater: true },
  iron_sprinkler: { kind: 'iron_sprinkler', item: 'iron_sprinkler', width: 1, floor: false },
  gold_sprinkler: { kind: 'gold_sprinkler', item: 'gold_sprinkler', width: 1, floor: false },
  silo: { kind: 'silo', item: 'silo', width: 2, floor: false },
  well: { kind: 'well', item: 'well', width: 2, floor: false },
  shed: { kind: 'shed', item: 'shed', width: 3, floor: false, light: 24 },
  statue: { kind: 'statue', item: 'statue', width: 1, floor: false },
  flower_bed: { kind: 'flower_bed', item: 'flower_bed', width: 1, floor: false },
  birdbath: { kind: 'birdbath', item: 'birdbath', width: 1, floor: false },
  gnome: { kind: 'gnome', item: 'gnome', width: 1, floor: false },
  collector: { kind: 'collector', item: 'collector', width: 1, floor: false, light: 12 },
  cabin: { kind: 'cabin', item: null, width: 2, floor: false, light: 30 },
};

export const CHEST_SIZE = 20;

/** Placeables that hold items, and how many slots. */
export const STORAGE_SIZE: Partial<Record<PlaceableKind, number>> = { chest: CHEST_SIZE, shed: 40 };
export const isStorage = (kind: PlaceableKind): boolean => STORAGE_SIZE[kind] !== undefined;

/** Hay a silo holds. */
export const SILO_CAPACITY = 240;

/** The tiles a sprinkler waters. */
export function sprinklerTiles(kind: PlaceableKind, tx: number, ty: number): Array<[number, number]> {
  const r = kind === 'gold_sprinkler' ? 2 : kind === 'iron_sprinkler' ? 1 : kind === 'sprinkler' ? 0 : -1;
  if (r < 0) return [];
  if (r === 0) return [[tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]];
  const out: Array<[number, number]> = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx || dy) out.push([tx + dx, ty + dy]);
  return out;
}

/** What a coop animal leaves each morning (roll in 0..1). */
export function coopProduce(kind: 'chicken' | 'duck' | 'rabbit' | undefined, roll: number): ItemId | null {
  if (!kind || kind === 'chicken') return 'egg';
  if (kind === 'duck') return roll < 0.8 ? 'duck_egg' : null;
  return roll < 0.12 ? 'rabbit_foot' : roll < 0.7 ? 'wool' : null;
}
