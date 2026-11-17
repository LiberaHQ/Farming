import type * as Phaser from 'phaser';
import { drawHorseSheet, HORSE_FRAME } from './horse';
import {
  CROPS,
  CROP_IDS,
  FURNITURE_KINDS,
  ITEM_IDS,
  NPCS,
  SEASONS,
  type CharacterAppearance,
  type CropId,
  type ItemId,
  type MineRockKind,
  type FurnitureKind,
  type NpcId,
  type PlaceableKind,
  type Season,
  type WorldObjectKind,
} from '@farming/shared';
import { createRng } from '../utils/random';
import {
  drawBarn,
  drawBunting,
  drawCheesePress,
  drawGreenhouse,
  drawKeg,
  drawLantern,
  drawLoom,
  drawMailbox,
  drawShippingBin,
  drawCrabPot,
  drawPreservesJar,
  drawReadyMarker,
} from './farmBuildings';
import { drawBed, drawFurniture, drawSignpost } from './interior';
import { drawPetSheet } from './pets';
import { drawBirdbath, drawCabin, drawCollector, drawFlowerBed, drawGnome, drawMetalSprinkler, drawShed, drawSilo, drawStatue, drawWell } from './farmDecor';
import { drawBatSheet, drawCrabSheet, drawGhostSheet, drawTreasureSheet } from './mine';
import { drawLadderDown, drawLadderUp, drawMineEntrance, drawMineRock, drawSlimeSheet } from './mine';
import { drawChickenSheet, drawCowSheet, drawRabbitSheet, drawSheepSheet } from './animals';
import { CHARACTER_FRAME, drawCharacterSheet } from './character';
import { drawCropStage } from './crops';
import { drawItemIcon } from './items';
import { P } from './palette';
import type { PixelCanvas } from './PixelCanvas';
import {
  drawBush,
  drawChip,
  drawOak,
  drawPine,
  drawRock,
  drawShadow,
  drawSparkle,
  drawStall,
  drawStump,
  drawTallGrass,
  drawAlert,
  drawBench,
  drawBobber,
  drawButterflySheet,
  drawDuckSheet,
  drawFirefly,
  drawFlowerPot,
  drawLeaf,
  drawNoticeBoard,
  drawScarecrow,
  drawSprinkler,
  GRASS_FOLIAGE,
  OAK_FOLIAGE,
  PINE_FOLIAGE,
} from './sprites';
import { drawChest, drawCottage, drawFence, drawLampPost, drawLight } from './structures';
import { buildTilesetCanvas } from './tileset';

export const TEXTURES = {
  tiles: 'tiles',
  player: 'player',
  shadowSmall: 'shadow-sm',
  shadowLarge: 'shadow-lg',
  sparkle: 'sparkle',
  light: 'light',
  rabbit: 'animal-rabbit',
  chicken: 'animal-chicken',
  duck: 'animal-duck',
  ladderDown: 'mine-ladder-down',
  ready: 'machine-ready',
  cow: 'animal-cow',
  bunting: 'festival-bunting',
  bed: 'cottage-bed',
  signpost: 'signpost',
  lantern: 'festival-lantern',
  sheep: 'animal-sheep',
  ladderUp: 'mine-ladder-up',
  slime: 'mine-slime',
  bat: 'mine-bat',
  petCat: 'pet-cat',
  petDog: 'pet-dog',
  horse: 'horse-sheet',
  crab: 'mine-crab',
  ghost: 'mine-ghost',
  treasure: 'mine-treasure',
  butterfly: 'ambient-butterfly',
  firefly: 'ambient-firefly',
  leaf: 'ambient-leaf',
  bobber: 'fishing-bobber',
  alert: 'fishing-alert',
} as const;

/** Objects whose art changes with the seasons. */
const SEASONAL_KINDS = new Set<WorldObjectKind>(['oak', 'pine', 'bush', 'tallGrass']);

/** Number of art variants per object kind. Must match what is registered below. */
export { OBJECT_VARIANTS } from '@farming/shared';
import { OBJECT_VARIANTS } from '@farming/shared';

export type FxKind = 'wood' | 'stone' | 'leaf' | 'dirt' | 'water' | 'sparkle' | 'rain' | 'snow' | 'heart';

const FX_COLORS: Record<FxKind, readonly string[]> = {
  wood: [P.woodLight, P.trunk],
  stone: [P.stoneLight, P.stoneDark],
  leaf: [P.leafLight, P.leaf],
  dirt: [P.dirtLight, P.dirtDark],
  water: [P.foam, P.waterLight],
  sparkle: ['#fff6c2', P.flowerYellow],
  rain: ['#cfe6f5'],
  snow: ['#ffffff'],
  heart: [P.berryHi, P.berry],
};

export const objectTextureKey = (kind: WorldObjectKind, variant: number, season: Season = 'spring') =>
  SEASONAL_KINDS.has(kind) ? `${kind}-${variant}-${season}` : `${kind}-${variant}`;
export const fenceTextureKey = (east: boolean, west: boolean) => `place-fence-${east ? 'e' : ''}${west ? 'w' : ''}`;
export type SpritePlaceable = Exclude<PlaceableKind, 'fence' | 'wood_path' | 'stone_path'>;
export const placeableTextureKey = (kind: SpritePlaceable) => `place-${kind}`;
export const npcTextureKey = (id: NpcId) => `npc-${id}`;
export const itemTextureKey = (id: ItemId) => `item-${id}`;
export const cropTextureKey = (id: CropId, stage: number) => `crop-${id}-${stage}`;
/** Mine rocks have 3 shapes per kind. */
export const MINE_ROCK_VARIANTS = 3;
export const mineRockTextureKey = (kind: MineRockKind, v: number) => `minerock-${kind}-${v}`;
export const furnitureTextureKey = (kind: FurnitureKind) => `furniture-${kind}`;
export const fxTextureKey = (kind: FxKind) => `fx-${kind}`;

function add(scene: Phaser.Scene, key: string, art: PixelCanvas) {
  const texture = scene.textures.addCanvas(key, art.toCanvas());
  if (!texture) throw new Error(`Failed to register texture "${key}"`);
  return texture;
}

/** Generates all game art and uploads it to Phaser's texture manager. */
export function registerTextures(scene: Phaser.Scene, appearance: CharacterAppearance): void {
  if (scene.textures.exists(TEXTURES.tiles)) return;

  const tiles = scene.textures.addCanvas(TEXTURES.tiles, buildTilesetCanvas());
  if (!tiles) throw new Error('Failed to register tileset');

  // World objects. Each variant uses its own RNG stream so its shape is identical in every season.
  const variantRng = (kind: string, v: number) => createRng(`${kind}-${v}-v1`);
  const seasonal: Record<string, (v: number, season: Season) => PixelCanvas> = {
    oak: (v, season) => drawOak(variantRng('oak', v), OAK_FOLIAGE[season], season === 'spring'),
    pine: (v, season) => drawPine(variantRng('pine', v), PINE_FOLIAGE[season]),
    bush: (v, season) => drawBush(variantRng('bush', v), season === 'winter' ? 0 : v, OAK_FOLIAGE[season]),
    tallGrass: (v, season) => drawTallGrass(variantRng('grass', v), v, GRASS_FOLIAGE[season]),
  };
  const plain: Partial<Record<WorldObjectKind, (v: number) => PixelCanvas>> = {
    rock: (v) => drawRock(variantRng('rock', v), v),
    copperRock: () => drawRock(variantRng('copper', 0), 2),
    stump: () => drawStump(),
    stall: (v) => drawStall(v),
    board: () => drawNoticeBoard(),
    mine: () => drawMineEntrance(),
  };
  for (const kind of Object.keys(OBJECT_VARIANTS) as WorldObjectKind[]) {
    for (let v = 0; v < OBJECT_VARIANTS[kind]; v++) {
      const drawSeasonal = seasonal[kind];
      if (drawSeasonal) {
        for (const season of SEASONS) add(scene, objectTextureKey(kind, v, season), drawSeasonal(v, season));
      } else {
        add(scene, objectTextureKey(kind, v), plain[kind]!(v));
      }
    }
  }

  // Buildables.
  for (const east of [false, true]) for (const west of [false, true]) add(scene, fenceTextureKey(east, west), drawFence(east, west));
  add(scene, placeableTextureKey('lamp_post'), drawLampPost());
  add(scene, placeableTextureKey('chest'), drawChest());
  add(scene, placeableTextureKey('cottage'), drawCottage(createRng('cottage')));
  add(scene, placeableTextureKey('sprinkler'), drawSprinkler());
  add(scene, placeableTextureKey('iron_sprinkler'), drawMetalSprinkler('#8a9098', '#c8ccd2'));
  add(scene, placeableTextureKey('gold_sprinkler'), drawMetalSprinkler('#c8982a', '#f4d24a'));
  add(scene, placeableTextureKey('silo'), drawSilo());
  add(scene, placeableTextureKey('well'), drawWell());
  add(scene, placeableTextureKey('shed'), drawShed());
  add(scene, placeableTextureKey('statue'), drawStatue());
  add(scene, placeableTextureKey('flower_bed'), drawFlowerBed());
  add(scene, placeableTextureKey('birdbath'), drawBirdbath());
  add(scene, placeableTextureKey('gnome'), drawGnome());
  add(scene, placeableTextureKey('collector'), drawCollector());
  add(scene, placeableTextureKey('cabin'), drawCabin());
  add(scene, placeableTextureKey('bench'), drawBench());
  add(scene, placeableTextureKey('flower_pot'), drawFlowerPot());
  add(scene, placeableTextureKey('scarecrow'), drawScarecrow());
  add(scene, placeableTextureKey('keg'), drawKeg());
  add(scene, placeableTextureKey('preserves_jar'), drawPreservesJar());
  add(scene, placeableTextureKey('greenhouse'), drawGreenhouse());
  add(scene, TEXTURES.ready, drawReadyMarker());
  add(scene, placeableTextureKey('barn'), drawBarn());
  add(scene, placeableTextureKey('cheese_press'), drawCheesePress());
  add(scene, placeableTextureKey('loom'), drawLoom());
  add(scene, placeableTextureKey('mailbox'), drawMailbox());
  add(scene, placeableTextureKey('shipping_bin'), drawShippingBin());
  add(scene, placeableTextureKey('crab_pot'), drawCrabPot());
  add(scene, TEXTURES.bunting, drawBunting());
  add(scene, TEXTURES.bed, drawBed());
  add(scene, TEXTURES.signpost, drawSignpost());
  for (const kind of FURNITURE_KINDS) add(scene, furnitureTextureKey(kind), drawFurniture(kind));
  add(scene, TEXTURES.lantern, drawLantern());
  const cow = add(scene, TEXTURES.cow, drawCowSheet());
  const sheep = add(scene, TEXTURES.sheep, drawSheepSheet());
  for (let f = 0; f < 2; f++) {
    cow.add(f, 0, f * 22, 0, 22, 16);
    sheep.add(f, 0, f * 18, 0, 18, 14);
  }

  // The mine.
  for (const kind of ['stone', 'copper', 'iron', 'gold', 'gem'] as const) {
    for (let v = 0; v < MINE_ROCK_VARIANTS; v++) add(scene, mineRockTextureKey(kind, v), drawMineRock(createRng(`minerock-${kind}-${v}`), kind));
  }
  add(scene, TEXTURES.ladderDown, drawLadderDown());
  add(scene, TEXTURES.ladderUp, drawLadderUp());
  const slime = add(scene, TEXTURES.slime, drawSlimeSheet());
  for (let f = 0; f < 2; f++) slime.add(f, 0, f * 14, 0, 14, 11);
  for (const [key, kind] of [[TEXTURES.petCat, 'cat'], [TEXTURES.petDog, 'dog']] as const) {
    const sheet = add(scene, key, drawPetSheet(kind));
    for (let f = 0; f < 3; f++) sheet.add(f, 0, f * 16, 0, 16, 14);
  }
  const horse = add(scene, TEXTURES.horse, drawHorseSheet());
  for (let f = 0; f < 7; f++) horse.add(f, 0, f * HORSE_FRAME.width, 0, HORSE_FRAME.width, HORSE_FRAME.height);
  const bat = add(scene, TEXTURES.bat, drawBatSheet());
  for (let f = 0; f < 2; f++) bat.add(f, 0, f * 14, 0, 14, 10);
  const crab = add(scene, TEXTURES.crab, drawCrabSheet());
  for (let f = 0; f < 2; f++) crab.add(f, 0, f * 16, 0, 16, 12);
  const ghost = add(scene, TEXTURES.ghost, drawGhostSheet());
  for (let f = 0; f < 2; f++) ghost.add(f, 0, f * 12, 0, 12, 14);
  const treasure = add(scene, TEXTURES.treasure, drawTreasureSheet());
  for (let f = 0; f < 2; f++) treasure.add(f, 0, f * 16, 0, 16, 14);

  // Ambient life and fishing.
  const duck = add(scene, TEXTURES.duck, drawDuckSheet());
  const butterfly = add(scene, TEXTURES.butterfly, drawButterflySheet());
  for (let f = 0; f < 2; f++) {
    duck.add(f, 0, f * 12, 0, 12, 10);
    butterfly.add(f, 0, f * 7, 0, 7, 5);
  }
  add(scene, TEXTURES.firefly, drawFirefly());
  add(scene, TEXTURES.leaf, drawLeaf());
  add(scene, TEXTURES.bobber, drawBobber());
  add(scene, TEXTURES.alert, drawAlert());

  // Animals (2 frames each, facing left).
  const rabbit = add(scene, TEXTURES.rabbit, drawRabbitSheet());
  const chicken = add(scene, TEXTURES.chicken, drawChickenSheet());
  for (let f = 0; f < 2; f++) {
    rabbit.add(f, 0, f * 14, 0, 14, 12);
    chicken.add(f, 0, f * 14, 0, 14, 13);
  }

  for (const id of ITEM_IDS) add(scene, itemTextureKey(id), drawItemIcon(id));
  for (const id of CROP_IDS) {
    const { matureStage } = CROPS[id];
    for (let s = 0; s <= matureStage; s++) add(scene, cropTextureKey(id, s), drawCropStage(id, s, matureStage));
  }
  for (const kind of Object.keys(FX_COLORS) as FxKind[]) add(scene, fxTextureKey(kind), drawChip(FX_COLORS[kind]));

  add(scene, TEXTURES.shadowSmall, drawShadow(14, 5));
  add(scene, TEXTURES.shadowLarge, drawShadow(24, 8));
  add(scene, TEXTURES.sparkle, drawSparkle());
  add(scene, TEXTURES.light, drawLight(128));

  // Characters: the player and NPCs share the same generated sheet layout.
  addCharacterSheet(scene, TEXTURES.player, appearance);
  for (const id of Object.keys(NPCS) as NpcId[]) addCharacterSheet(scene, npcTextureKey(id), NPCS[id].appearance);
}

export function addCharacterSheet(scene: Phaser.Scene, key: string, appearance: CharacterAppearance): void {
  const { width: FW, height: FH, framesPerDirection: N } = CHARACTER_FRAME;
  const sheet = add(scene, key, drawCharacterSheet(appearance));
  for (let row = 0; row < 4; row++) {
    for (let f = 0; f < N; f++) sheet.add(row * N + f, 0, f * FW, row * FH, FW, FH);
  }
}

/** Redraws the player's sheet in place (character customisation); frames stay valid. */
export function repaintPlayer(scene: Phaser.Scene, appearance: CharacterAppearance): void {
  const texture = scene.textures.get(TEXTURES.player) as Phaser.Textures.CanvasTexture;
  const art = drawCharacterSheet(appearance).toCanvas();
  texture.context.clearRect(0, 0, texture.width, texture.height);
  texture.context.drawImage(art, 0, 0);
  texture.refresh();
}
