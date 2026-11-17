import { ITEMS, type ItemId } from './items';

/** Furniture for the cottage interior. */
export type FurnitureKind = 'rug' | 'table' | 'chair' | 'bookshelf' | 'house_plant' | 'floor_lamp' | 'painting' | 'stove' | 'fireplace' | 'display_table' | 'wall_shelf' | 'aquarium'
  // Farm decor that also works indoors.
  | 'flower_pot' | 'flower_bed' | 'statue' | 'gnome' | 'birdbath' | 'bench' | 'lamp_post'
  // Carnival prizes.
  | 'balloons' | 'plush_bear' | 'carnival_trophy';

export interface FurnitureDef {
  kind: FurnitureKind;
  /** Footprint in tiles. */
  width: number;
  height: number;
  /** Rugs lie on the floor (walkable, drawn under everything); paintings hang on the wall. */
  layer: 'floor' | 'object' | 'wall';
  /** Casts light at night. */
  light?: boolean;
  /** How many items it can show off (display tables, shelves, the aquarium). */
  display?: number;
  /** Only fish go in it. */
  fishOnly?: boolean;
  /** A farm placeable (its item `places` it outdoors) that can also go inside. */
  outdoor?: boolean;
}

export const FURNITURE: Record<FurnitureKind, FurnitureDef> = {
  rug: { kind: 'rug', width: 3, height: 2, layer: 'floor' },
  table: { kind: 'table', width: 2, height: 1, layer: 'object', display: 2 },
  chair: { kind: 'chair', width: 1, height: 1, layer: 'object' },
  bookshelf: { kind: 'bookshelf', width: 2, height: 1, layer: 'object' },
  house_plant: { kind: 'house_plant', width: 1, height: 1, layer: 'object' },
  floor_lamp: { kind: 'floor_lamp', width: 1, height: 1, layer: 'object', light: true },
  painting: { kind: 'painting', width: 2, height: 1, layer: 'wall' },
  stove: { kind: 'stove', width: 2, height: 1, layer: 'object', light: true },
  fireplace: { kind: 'fireplace', width: 2, height: 1, layer: 'object', light: true },
  display_table: { kind: 'display_table', width: 1, height: 1, layer: 'object', display: 1 },
  wall_shelf: { kind: 'wall_shelf', width: 2, height: 1, layer: 'wall', display: 2 },
  aquarium: { kind: 'aquarium', width: 2, height: 1, layer: 'object', display: 3, fishOnly: true },
  flower_pot: { kind: 'flower_pot', width: 1, height: 1, layer: 'object', outdoor: true },
  flower_bed: { kind: 'flower_bed', width: 1, height: 1, layer: 'object', outdoor: true },
  statue: { kind: 'statue', width: 1, height: 1, layer: 'object', outdoor: true },
  gnome: { kind: 'gnome', width: 1, height: 1, layer: 'object', outdoor: true },
  birdbath: { kind: 'birdbath', width: 1, height: 1, layer: 'object', outdoor: true },
  bench: { kind: 'bench', width: 1, height: 1, layer: 'object', outdoor: true, display: 2 },
  lamp_post: { kind: 'lamp_post', width: 1, height: 1, layer: 'object', outdoor: true, light: true },
  balloons: { kind: 'balloons', width: 1, height: 1, layer: 'object' },
  plush_bear: { kind: 'plush_bear', width: 1, height: 1, layer: 'object' },
  carnival_trophy: { kind: 'carnival_trophy', width: 1, height: 1, layer: 'object' },
};

/** Small things that can also sit on a table or shelf instead of the floor. */
export const TABLETOP_DECOR: ReadonlySet<FurnitureKind> = new Set(['flower_pot', 'gnome', 'house_plant', 'plush_bear', 'carnival_trophy']);

/** The furniture an item puts down indoors, if any (furniture, or decor that works inside too). */
export function furnitureOf(itemId: ItemId): FurnitureKind | null {
  const def = ITEMS[itemId];
  if (def.furniture) return def.furniture;
  const kind = def.places as FurnitureKind | undefined;
  return kind && FURNITURE[kind]?.outdoor ? kind : null;
}

/** Furniture every cottage starts with (placed once, movable like anything else). */
export const STARTER_FURNITURE: Array<{ kind: FurnitureKind; tx: number; ty: number; items?: ItemId[] }> = [
  { kind: 'stove', tx: 8, ty: 2 },
  { kind: 'fireplace', tx: 4, ty: 2 },
  { kind: 'rug', tx: 4, ty: 4 },
  { kind: 'table', tx: 7, ty: 5 },
  { kind: 'chair', tx: 9, ty: 5 },
  { kind: 'display_table', tx: 1, ty: 5, items: ['amethyst'] },
  { kind: 'wall_shelf', tx: 1, ty: 1, items: ['bread', 'berry_jam'] },
];

export const FURNITURE_KINDS = Object.keys(FURNITURE) as FurnitureKind[];

/** Room size in tiles (including the walls) for each cottage level. */
export const COTTAGE_ROOMS = [
  { width: 11, height: 8 },
  { width: 16, height: 10 },
] as const;

export interface InteriorSave {
  level: number;
  furniture: Array<{ kind: FurnitureKind; tx: number; ty: number; items?: ItemId[] }>;
  /** The starter furniture has been put in. */
  furnished?: boolean;
}
