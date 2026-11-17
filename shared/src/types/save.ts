import type { CropId } from '../game-config/crops';
import type { BuffKind, ItemId } from '../game-config/items';
import type { PlaceableKind } from '../game-config/placeables';
import type { MachineState } from '../game-config/machines';
import type { LivestockSave } from '../game-config/livestock';
import type { CommunityProgress } from '../game-config/community';
import type { FruitTreeKind } from '../game-config/orchard';
import type { DailySave } from '../game-config/daily';
import type { FreightSave } from '../game-config/freight';

import type { Letter } from '../game-config/village';
import type { InteriorSave } from '../game-config/interior';
import type { AppearanceChoice } from '../game-config';
import type { WeatherKind } from '../game-config/time';
import type { Direction } from './player';
import type { WorldObjectSpec } from './world';

export interface CabinSave {
  ownerId: string;
  name: string;
  tx: number;
  ty: number;
}

export interface CollectionSave {
  found: ItemId[];
  achievements: string[];
  /** Rare creatures spotted (WildlifeId). */
  sightings?: string[];
}

/**
 * The complete, engine-free snapshot of one game world. Produced by the game,
 * stored in the browser and/or on the server, and validated server-side.
 */
export const SAVE_VERSION = 1;

export interface ItemStackData {
  itemId: ItemId;
  quantity: number;
  /** Quality of crops and fruit: 1 silver, 2 gold (absent = normal). */
  q?: 1 | 2;
}

export type SlotData = ItemStackData | null;

export interface PlayerSave {
  gold: number;
  lifetimeEarnings: number;
  energy: number;
  water: number;
  appearance: AppearanceChoice;
  inventory: { slots: SlotData[]; selected: number };
  /** Added with the mine; optional so older saves still load. */
  health?: number;
  /** Deepest mine floor reached (unlocks the elevator every 5 floors). */
  mineDepth?: number;
  /** Items waiting in the shipping bin (sold overnight). */
  bin?: SlotData[];
  /** Active food bonuses, until a game time (day*1440+minute). */
  buffs?: Array<{ kind: BuffKind; until: number }>;
  /** Worn ring and armour. */
  equipment?: { ring?: ItemId; armor?: ItemId };
}

export interface NodeSave {
  spec: WorldObjectSpec;
  hasBerries: boolean;
  berryDueDay: number | null;
  regrowsInto: WorldObjectSpec | null;
}

export interface ResourceSave {
  nodes: NodeSave[];
  pending: Array<{ spec: WorldObjectSpec; dueDay: number }>;
}

export interface PlotSave {
  tx: number;
  ty: number;
  watered: boolean;
  crop: { id: CropId; stage: number; /** Fertilized: better odds of silver/gold. */ fed?: boolean } | null;
}

export interface PlacedSave {
  kind: PlaceableKind;
  tx: number;
  ty: number;
  items?: SlotData[];
  /** Kegs and jars: what's inside and when it's ready. */
  machine?: MachineState;
  /** Barns: hay in the trough. */
  hay?: number;
}

export interface ChickenSave {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  /** Coop animal kind (default chicken). */
  kind?: 'chicken' | 'duck' | 'rabbit';
}

/** Friendship with each villager (points), and when you last talked to / gifted them. */
export interface SocialSave {
  points: Record<string, number>;
  talkedDay: Record<string, number>;
  giftedDay: Record<string, number>;
  /** Heart scenes seen, per villager (heart levels). */
  events?: Record<string, number[]>;
  mail?: Letter[];
  /** Festival progress on a given day (Harvest Fair entry). */
  festival?: { day: number; entered: boolean; eggs?: boolean };
  /** Beach shells picked today. */
  beach?: { day: number; taken: number[] };
  /** Main story chapter you're on (index into STORY). */
  story?: number;
  /** Villager requests finished, per villager. */
  arcs?: Record<string, number>;
  /** First-day tips: next tip index, or -1 when done or skipped. */
  tutorial?: number;
  /** Forest forage and hardwood taken today. */
  forest?: { day: number; taken: number[] };
  /** Your pet (it follows you on the farm). */
  pet?: { kind: 'cat' | 'dog'; name: string; pettedDay: number; love: number; foundDay?: number; dugDay?: number; dugCount?: number };
  /** A second pet, of the other kind (a cat and a dog). */
  pet2?: { kind: 'cat' | 'dog'; name: string; pettedDay: number; love: number; foundDay?: number; dugDay?: number; dugCount?: number };
  /** Pet offered but not yet chosen (shows the adoption card). */
  petOffered?: boolean;
  /** Romance: who you're dating, who you married, and the wedding day once engaged. */
  dating?: string;
  spouse?: string;
  weddingDay?: number;
  /** The day you last spun the carnival's free Wheel of Fortune. */
  carnivalSpin?: number;
  /** Carnival progress: today's card, challenge, fortune and tip, and your best score per game. */
  carnival?: CarnivalSave;
  /** The island: the boat, the cave, the garden and today's finds. */
  island?: IslandSave;
  /** Items given to the museum, and sets whose reward has been paid. */
  museum?: { items: string[]; sets: string[] };
  /** Day each villager last gave you a treat at their home. */
  homeTreat?: Record<string, number>;
  /** XP in each skill (farming, fishing, mining, foraging). */
  skills?: Record<string, number>;
  /** Pets told to stay, and where they're waiting (pixels). */
  petStay?: { cat?: { x: number; y: number }; dog?: { x: number; y: number } };
  /** Guide checklist steps you've done that can't be read from the rest of the save. */
  milestones?: string[];
  /** Day the rainbow's luck was last given, and the day meteorites last fell. */
  rainbowDay?: number;
  meteorDay?: number;
  /** Elsie the ghost: how many belongings returned (3 = she has moved on), and whether she has asked for the next. */
  ghost?: { stage: number; asked: boolean };
  /** Train passes you've seen up close (for the guide). */
  trainsSeen?: number;
  /** Today's goals and your streak. */
  daily?: DailySave;
  /** Your horse: its name and where you left it (pixels). */
  horse?: { name: string; x: number; y: number };
  /** Train contracts at the freight depot: open orders, orders on their way, and deliveries per town. */
  freight?: FreightSave;
}

export interface IslandSave {
  /** The rowing boat has been repaired. */
  boat: boolean;
  /** The cracked boulder in front of the cave has been broken. */
  cave: boolean;
  /** The cave's ancient chest has been opened. */
  chest: boolean;
  /** Coconuts, rocks, the clam and the like taken today. */
  day: number;
  taken: number[];
  /** Garden plots: what's growing and the day it was planted. */
  plots: Array<{ crop: string; day: number } | null>;
}

export interface CarnivalSave {
  day: number;
  /** Games played today (for the carnival card). */
  played: string[];
  card: boolean;
  challenge: boolean;
  fortune: boolean;
  tip: boolean;
  best: Record<string, number>;
}

/** Notice-board requests completed today. */
export interface QuestSave {
  day: number;
  done: number[];
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  seed: string;
  /** Client timestamp (ms). Newer saves win when the same world is saved from two places. */
  savedAt: number;
  time: { day: number; minute: number };
  weather: WeatherKind;
  player: PlayerSave & { x: number; y: number; facing: Direction };
  resources: ResourceSave;
  farm: PlotSave[];
  placed: PlacedSave[];
  chickens: ChickenSave[];
  /** Added with the village update; optional so older saves still load. */
  social?: SocialSave;
  quests?: QuestSave;
  /** Cows and sheep (added with barns). */
  livestock?: LivestockSave[];
  /** Co-op cabins: one per guest who has played on this farm. */
  cabins?: CabinSave[];
  /** Items this player has ever held, and achievements earned. */
  collection?: CollectionSave;
  /** Community projects: items given so far (shared in co-op). */
  community?: CommunityProgress;
  /** Inside your cottage: its size and your furniture. Per player in co-op. */
  interior?: InteriorSave;
  /** Items lying on the ground (dropped by the player, or left when the bag was full), by area. */
  floor?: FloorItemSave[];
  /** Fruit trees you planted. */
  orchard?: FruitTreeSave[];
}

export interface FruitTreeSave {
  kind: FruitTreeKind;
  tx: number;
  ty: number;
  /** Day it was planted. */
  planted: number;
  /** Fruit on it now (0–3). */
  fruit: number;
}

/** One item stack lying on the ground. `area` is the scene key ("World", "Forest", "Home"…). */
export interface FloorItemSave {
  area: string;
  itemId: ItemId;
  quantity: number;
  q?: 1 | 2;
  x: number;
  y: number;
}

/** Summary of a saved world, for menus. */
export interface WorldSummary {
  seed: string;
  day: number;
  gold: number;
  lifetimeEarnings: number;
  savedAt: number;
}
