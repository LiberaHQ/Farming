/**
 * Every piece of game art, grouped for the homepage and docs. The art is the
 * same procedurally drawn pixel art the game uses, so this list stays in step
 * with the game as long as new sprites are added here too.
 */
import {
  CROPS,
  CROP_IDS,
  FURNITURE,
  FURNITURE_KINDS,
  ITEMS,
  ITEM_IDS,
  NPCS,
  OBJECT_VARIANTS,
  SEASONS,
  DEFAULT_APPEARANCE,
  type CropId,
  type FurnitureKind,
  type ItemCategory,
  type ItemId,
  type NpcId,
} from '@farming/shared';
import { drawChickenSheet, drawCowSheet, drawRabbitSheet, drawSheepSheet } from '@/game-engine/assets/animals';
import { drawCharacterSheet } from '@/game-engine/assets/character';
import { drawCropStage } from '@/game-engine/assets/crops';
import {
  drawBarn,
  drawBunting,
  drawCheesePress,
  drawCrabPot,
  drawGreenhouse,
  drawKeg,
  drawLantern,
  drawLoom,
  drawMailbox,
  drawPreservesJar,
  drawReadyMarker,
  drawShippingBin,
} from '@/game-engine/assets/farmBuildings';
import {
  drawBirdbath,
  drawCabin,
  drawCollector,
  drawFlowerBed,
  drawGnome,
  drawMetalSprinkler,
  drawShed,
  drawSilo,
  drawStatue,
  drawWell,
} from '@/game-engine/assets/farmDecor';
import { drawBed, drawFurniture, drawSignpost } from '@/game-engine/assets/interior';
import { drawItemIcon } from '@/game-engine/assets/items';
import {
  drawBatSheet,
  drawCrabSheet,
  drawGhostSheet,
  drawLadderDown,
  drawLadderUp,
  drawMineEntrance,
  drawMineRock,
  drawSlimeSheet,
  drawTreasureSheet,
} from '@/game-engine/assets/mine';
import { drawPetSheet } from '@/game-engine/assets/pets';
import type { PixelCanvas } from '@/game-engine/assets/PixelCanvas';
import {
  drawAlert,
  drawBench,
  drawBobber,
  drawBush,
  drawButterflySheet,
  drawDuckSheet,
  drawFirefly,
  drawFlowerPot,
  drawLeaf,
  drawNoticeBoard,
  drawOak,
  drawPine,
  drawRock,
  drawScarecrow,
  drawSparkle,
  drawSprinkler,
  drawStall,
  drawStump,
  drawTallGrass,
  GRASS_FOLIAGE,
  OAK_FOLIAGE,
  PINE_FOLIAGE,
} from '@/game-engine/assets/sprites';
import { drawChest, drawCottage, drawFence, drawLampPost } from '@/game-engine/assets/structures';
import { buildTilesetCanvas } from '@/game-engine/assets/tileset';
import { TILE, TILE_MARGIN, TILE_SPACING, TILESET_COLUMNS } from '@/game-engine/assets/tileIndex';
import { createRng } from '@/game-engine/utils/random';

export type ArtSource = PixelCanvas | HTMLCanvasElement;

/** A sprite: how to draw it, and (for sheets) which frames to play. */
export interface Art {
  key: string;
  name: string;
  draw: () => ArtSource;
  /** Animation frames laid out left to right, starting at (x, y). */
  frames?: { w: number; h: number; count: number; y?: number };
}

export interface ArtGroup {
  id: string;
  title: string;
  blurb: string;
  items: Art[];
  /** Pixel scale for this group. */
  scale?: number;
}

// ---------- Rendering cache ----------

const rendered = new Map<string, HTMLCanvasElement>();

/** The art as a canvas, drawn once per page. */
export function renderArt(art: Art): HTMLCanvasElement {
  let c = rendered.get(art.key);
  if (!c) {
    const src = art.draw();
    c = src instanceof HTMLCanvasElement ? src : src.toCanvas();
    rendered.set(art.key, c);
  }
  return c;
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
const rng = (seed: string) => createRng(seed);
const variantRng = (kind: string, v: number) => createRng(`${kind}-${v}-v1`);

// ---------- Characters ----------

const CHAR = { w: 16, h: 24, count: 3 } as const;

export const playerArt: Art = { key: 'char-player', name: 'You', draw: () => drawCharacterSheet(DEFAULT_APPEARANCE), frames: CHAR };

export const npcArt = (id: NpcId): Art => ({ key: `char-${id}`, name: NPCS[id].name, draw: () => drawCharacterSheet(NPCS[id].appearance), frames: CHAR });

// ---------- Animals and creatures ----------

export const ANIMAL_ART = {
  chicken: { key: 'a-chicken', name: 'Chicken', draw: drawChickenSheet, frames: { w: 14, h: 13, count: 2 } },
  duck: { key: 'a-duck', name: 'Duck', draw: drawDuckSheet, frames: { w: 12, h: 10, count: 2 } },
  rabbit: { key: 'a-rabbit', name: 'Rabbit', draw: drawRabbitSheet, frames: { w: 14, h: 12, count: 2 } },
  cow: { key: 'a-cow', name: 'Cow', draw: drawCowSheet, frames: { w: 22, h: 16, count: 2 } },
  sheep: { key: 'a-sheep', name: 'Sheep', draw: drawSheepSheet, frames: { w: 18, h: 14, count: 2 } },
  cat: { key: 'a-cat', name: 'Cat', draw: () => drawPetSheet('cat'), frames: { w: 16, h: 14, count: 3 } },
  dog: { key: 'a-dog', name: 'Dog', draw: () => drawPetSheet('dog'), frames: { w: 16, h: 14, count: 3 } },
  butterfly: { key: 'a-butterfly', name: 'Butterfly', draw: drawButterflySheet, frames: { w: 7, h: 5, count: 2 } },
  firefly: { key: 'a-firefly', name: 'Firefly', draw: drawFirefly },
} satisfies Record<string, Art>;

export const CREATURE_ART = {
  slime: { key: 'm-slime', name: 'Slime', draw: drawSlimeSheet, frames: { w: 14, h: 11, count: 2 } },
  bat: { key: 'm-bat', name: 'Cave Bat', draw: drawBatSheet, frames: { w: 14, h: 10, count: 2 } },
  crab: { key: 'm-crab', name: 'Rock Crab', draw: drawCrabSheet, frames: { w: 16, h: 12, count: 2 } },
  ghost: { key: 'm-ghost', name: 'Ghost', draw: drawGhostSheet, frames: { w: 12, h: 14, count: 2 } },
  treasure: { key: 'm-treasure', name: 'Treasure chest', draw: drawTreasureSheet, frames: { w: 16, h: 14, count: 2 } },
} satisfies Record<string, Art>;

// ---------- Tiles ----------

let tileset: HTMLCanvasElement | null = null;
const tilesetCanvas = () => (tileset ??= buildTilesetCanvas());

/** One 16×16 tile cut out of the generated tileset. */
export function tileArt(index: number, name: string): Art {
  return {
    key: `tile-${index}`,
    name,
    draw: () => {
      const src = tilesetCanvas();
      const out = document.createElement('canvas');
      out.width = 16;
      out.height = 16;
      const col = index % TILESET_COLUMNS;
      const row = Math.floor(index / TILESET_COLUMNS);
      const step = 16 + TILE_SPACING;
      out.getContext('2d')!.drawImage(src, TILE_MARGIN + col * step, TILE_MARGIN + row * step, 16, 16, 0, 0, 16, 16);
      return out;
    },
  };
}

/** A patch of meadow (grass with the odd flower tile) for backgrounds. */
export function meadowPattern(cols = 12, rows = 8, seed = 'meadow'): string {
  const r = createRng(seed);
  const out = document.createElement('canvas');
  out.width = cols * 16;
  out.height = rows * 16;
  const ctx = out.getContext('2d')!;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const roll = r.next();
      const index = roll < 0.08 ? TILE.FLOWER_START + Math.floor(r.next() * 4) : TILE.GRASS_START + Math.floor(r.next() * 8);
      ctx.drawImage(renderArt(tileArt(index, '')), x * 16, y * 16);
    }
  }
  return out.toDataURL();
}

// ---------- Groups ----------

const art = (key: string, name: string, draw: () => ArtSource, frames?: Art['frames']): Art => ({ key, name, draw, frames });

const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' } as const;

const CATEGORY_TITLES: Record<ItemCategory, string> = {
  tool: 'Tools',
  seed: 'Seeds',
  crop: 'Crops & produce',
  resource: 'Resources',
  fish: 'Fish & catches',
  food: 'Cooked food',
  consumable: 'Consumables',
  equipment: 'Equipment',
  placeable: 'Things to build',
  furniture: 'Furniture',
  animal: 'Animals',
};

export const itemArt = (id: ItemId): Art => art(`item-${id}`, ITEMS[id].name, () => drawItemIcon(id));

/** Every item, by category. */
export const ITEM_GROUPS: Array<{ category: ItemCategory; title: string; ids: ItemId[] }> = (Object.keys(CATEGORY_TITLES) as ItemCategory[])
  .map((category) => ({ category, title: CATEGORY_TITLES[category], ids: ITEM_IDS.filter((id) => ITEMS[id].category === category) }))
  .filter((g) => g.ids.length > 0);

export const cropStages = (id: CropId): Art[] =>
  Array.from({ length: CROPS[id].matureStage + 1 }, (_, s) => art(`crop-${id}-${s}`, `${CROPS[id].name} · stage ${s + 1}`, () => drawCropStage(id, s, CROPS[id].matureStage)));

export const ART_GROUPS: ArtGroup[] = [
  {
    id: 'people',
    title: 'Villagers',
    blurb: 'You, plus the six neighbours who run the market and walk the valley paths.',
    scale: 4,
    items: [playerArt, ...(Object.keys(NPCS) as NpcId[]).map(npcArt)],
  },
  {
    id: 'animals',
    title: 'Animals & pets',
    blurb: 'Coop birds and bunnies, barn livestock, a loyal pet and the wildlife that drifts by.',
    scale: 4,
    items: Object.values(ANIMAL_ART),
  },
  {
    id: 'mine',
    title: 'The mine',
    blurb: 'Thirty floors of ore, monsters and treasure beneath the hills.',
    scale: 3,
    items: [
      ...Object.values(CREATURE_ART),
      ...(['stone', 'copper', 'iron', 'gold', 'gem'] as const).map((k) => art(`mr-${k}`, `${titleCase(k)} rock`, () => drawMineRock(rng(`minerock-${k}-0`), k))),
      art('mine-entrance', 'Mine entrance', drawMineEntrance),
      art('ladder-down', 'Ladder down', drawLadderDown),
      art('ladder-up', 'Ladder up', drawLadderUp),
    ],
  },
  {
    id: 'nature',
    title: 'Nature through the seasons',
    blurb: 'Trees, bushes and grass repaint themselves every season.',
    scale: 2,
    items: [
      ...SEASONS.flatMap((s) => [
        art(`oak-${s}`, `Oak · ${SEASON_NAMES[s]}`, () => drawOak(variantRng('oak', 0), OAK_FOLIAGE[s], s === 'spring')),
        art(`pine-${s}`, `Pine · ${SEASON_NAMES[s]}`, () => drawPine(variantRng('pine', 0), PINE_FOLIAGE[s])),
        art(`bush-${s}`, `Bush · ${SEASON_NAMES[s]}`, () => drawBush(variantRng('bush', 1), s === 'winter' ? 0 : 1, OAK_FOLIAGE[s])),
        art(`grass-${s}`, `Tall grass · ${SEASON_NAMES[s]}`, () => drawTallGrass(variantRng('grass', 0), 0, GRASS_FOLIAGE[s])),
      ]),
      ...Array.from({ length: OBJECT_VARIANTS.oak - 1 }, (_, i) => art(`oak-v${i + 1}`, 'Oak', () => drawOak(variantRng('oak', i + 1), OAK_FOLIAGE.summer))),
      art('pine-v1', 'Pine', () => drawPine(variantRng('pine', 1), PINE_FOLIAGE.summer)),
      art('rock-0', 'Rock', () => drawRock(variantRng('rock', 0), 0)),
      art('rock-1', 'Boulder', () => drawRock(variantRng('rock', 1), 1)),
      art('copper-rock', 'Copper rock', () => drawRock(variantRng('copper', 0), 2)),
      art('stump', 'Stump', drawStump),
    ],
  },
  {
    id: 'crops',
    title: 'Crops, seed to harvest',
    blurb: 'Every stage of every crop you can grow.',
    scale: 3,
    items: CROP_IDS.flatMap(cropStages),
  },
  {
    id: 'buildings',
    title: 'Buildings & the village',
    blurb: 'Your cottage, farm buildings, market stalls and village fixtures.',
    scale: 2,
    items: [
      art('cottage', 'Cottage', () => drawCottage(rng('cottage'))),
      art('barn', 'Barn', drawBarn),
      art('greenhouse', 'Greenhouse', drawGreenhouse),
      art('shed', 'Shed', drawShed),
      art('silo', 'Silo', drawSilo),
      art('well', 'Well', drawWell),
      art('cabin', 'Guest cabin', drawCabin),
      ...Array.from({ length: OBJECT_VARIANTS.stall }, (_, v) => art(`stall-${v}`, 'Market stall', () => drawStall(v))),
      art('board', 'Notice board', drawNoticeBoard),
      art('mailbox', 'Mailbox', drawMailbox),
      art('shipping-bin', 'Shipping bin', drawShippingBin),
      art('signpost', 'Signpost', drawSignpost),
      art('bunting', 'Festival bunting', drawBunting),
      art('lantern', 'Festival lantern', drawLantern),
    ],
  },
  {
    id: 'farm',
    title: 'Farm machines & fixtures',
    blurb: 'Machines that turn harvests into goods, and everything that keeps a farm running.',
    scale: 3,
    items: [
      art('keg', 'Keg', drawKeg),
      art('jar', 'Preserves jar', drawPreservesJar),
      art('cheese-press', 'Cheese press', drawCheesePress),
      art('loom', 'Loom', drawLoom),
      art('crab-pot', 'Crab pot', drawCrabPot),
      art('ready', 'Ready marker', drawReadyMarker),
      art('sprinkler', 'Sprinkler', drawSprinkler),
      art('iron-sprinkler', 'Iron sprinkler', () => drawMetalSprinkler('#8a9098', '#c8ccd2')),
      art('gold-sprinkler', 'Gold sprinkler', () => drawMetalSprinkler('#c8982a', '#f4d24a')),
      art('scarecrow', 'Scarecrow', drawScarecrow),
      art('collector', 'Collector', drawCollector),
      art('chest', 'Chest', drawChest),
      art('lamp', 'Lamp post', drawLampPost),
      art('fence', 'Fence', () => drawFence(true, true)),
      art('fence-end', 'Fence post', () => drawFence(false, false)),
      art('bench', 'Bench', drawBench),
      art('flower-pot', 'Flower pot', drawFlowerPot),
    ],
  },
  {
    id: 'decor',
    title: 'Garden decor',
    blurb: 'Pretty things to dot around the farm.',
    scale: 3,
    items: [art('statue', 'Statue', drawStatue), art('flower-bed', 'Flower bed', drawFlowerBed), art('birdbath', 'Birdbath', drawBirdbath), art('gnome', 'Garden gnome', drawGnome)],
  },
  {
    id: 'home',
    title: 'Home & furniture',
    blurb: 'Furnish the cottage: a stove to cook on, an aquarium for your best catches and more.',
    scale: 3,
    items: [
      art('bed', 'Bed', drawBed),
      ...FURNITURE_KINDS.filter((k) => !FURNITURE[k].outdoor).map((k: FurnitureKind) => art(`furn-${k}`, (ITEMS as Record<string, { name: string } | undefined>)[k]?.name ?? titleCase(k), () => drawFurniture(k))),
    ],
  },
  {
    id: 'tiles',
    title: 'Ground tiles',
    blurb: 'The tiles the world is painted with.',
    scale: 3,
    items: [
      ...Array.from({ length: 8 }, (_, v) => tileArt(TILE.GRASS_START + v, 'Grass')),
      ...Array.from({ length: 4 }, (_, v) => tileArt(TILE.FLOWER_START + v, 'Flower meadow')),
      ...Array.from({ length: 8 }, (_, v) => tileArt(TILE.SNOW_START + v, 'Snow')),
      ...Array.from({ length: 16 }, (_, m) => tileArt(TILE.WATER_BASE + m, 'Water')),
      ...Array.from({ length: 16 }, (_, m) => tileArt(TILE.PATH_BASE + m, 'Path')),
      tileArt(TILE.BRIDGE_TOP, 'Bridge'),
      tileArt(TILE.BRIDGE_BOTTOM, 'Bridge'),
      tileArt(TILE.BRIDGE_SINGLE, 'Bridge'),
      tileArt(TILE.SOIL_DRY, 'Tilled soil'),
      tileArt(TILE.SOIL_WET, 'Watered soil'),
      tileArt(TILE.WOOD_PATH, 'Wood path'),
      tileArt(TILE.STONE_PATH, 'Stone path'),
    ],
  },
  {
    id: 'effects',
    title: 'Little touches',
    blurb: 'Sparkles, falling leaves and the fishing bobber.',
    scale: 4,
    items: [art('sparkle', 'Sparkle', drawSparkle), art('leaf', 'Falling leaf', drawLeaf), art('bobber', 'Bobber', drawBobber), art('alert', 'Bite!', drawAlert)],
  },
];
