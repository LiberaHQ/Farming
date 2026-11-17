import type { ItemId } from './items';
import type { Season } from './time';

/** The crops every valley grows. */
export type BaseCropId = 'turnip' | 'carrot' | 'pumpkin' | 'strawberry' | 'potato' | 'tomato' | 'corn' | 'wheat' | 'blueberry' | 'eggplant' | 'snow_yam';

/** Heirloom varieties: each world grows two of them natively; the rest come from friends. */
export type HeirloomId =
  | 'moonlight_turnip'
  | 'ember_carrot'
  | 'ghost_pumpkin'
  | 'blush_strawberry'
  | 'violet_potato'
  | 'black_tomato'
  | 'glass_corn'
  | 'red_wheat'
  | 'pink_blueberry'
  | 'graffiti_eggplant'
  | 'golden_yam';

export type CropId = BaseCropId | HeirloomId;

export interface CropDef {
  id: CropId;
  name: string;
  seedItem: ItemId;
  harvestItem: ItemId;
  /** Stage 0 is freshly planted; the crop is harvestable at this stage. */
  matureStage: number;
  /** Inclusive range of items harvested. */
  yield: readonly [min: number, max: number];
  /** Seasons the crop grows in. Out of season it can't be planted, and withers when the season changes. */
  seasons: readonly Season[];
  /** Plants that keep producing: after a harvest they go back to this stage instead of being removed. */
  regrowStage?: number;
  /** Heirloom varieties: the everyday crop they're a cousin of (same seasons and growth). */
  heirloomOf?: BaseCropId;
}

export interface HeirloomDef {
  id: HeirloomId;
  name: string;
  base: BaseCropId;
  blurb: string;
  /** How its fruit is coloured: hue (degrees), saturation multiplier, lightness shift. */
  look: { hue: number; sat: number; light: number };
}

export const HEIRLOOMS: Record<HeirloomId, HeirloomDef> = {
  moonlight_turnip: { id: 'moonlight_turnip', name: 'Moonlight Turnip', base: 'turnip', blurb: 'A silvery-blue turnip with a sweet bite.', look: { hue: 215, sat: 0.7, light: 0.1 } },
  ember_carrot: { id: 'ember_carrot', name: 'Ember Carrot', base: 'carrot', blurb: 'Deep red right through, and peppery.', look: { hue: 2, sat: 1.15, light: -0.04 } },
  ghost_pumpkin: { id: 'ghost_pumpkin', name: 'Ghost Pumpkin', base: 'pumpkin', blurb: 'A pale, chalk-white pumpkin. Lovely in a pie.', look: { hue: 40, sat: 0.18, light: 0.24 } },
  blush_strawberry: { id: 'blush_strawberry', name: 'Blush Strawberry', base: 'strawberry', blurb: 'Pale pink and tasting faintly of pineapple.', look: { hue: 345, sat: 0.55, light: 0.18 } },
  violet_potato: { id: 'violet_potato', name: 'Violet Potato', base: 'potato', blurb: 'Purple skin, purple flesh, very buttery.', look: { hue: 278, sat: 0.9, light: -0.06 } },
  black_tomato: { id: 'black_tomato', name: 'Black Tomato', base: 'tomato', blurb: 'A smoky, dark tomato with a rich flavour.', look: { hue: 345, sat: 0.55, light: -0.2 } },
  glass_corn: { id: 'glass_corn', name: 'Glass Gem Corn', base: 'corn', blurb: 'Kernels like polished beads of blue and teal.', look: { hue: 185, sat: 1, light: -0.02 } },
  red_wheat: { id: 'red_wheat', name: 'Red Wheat', base: 'wheat', blurb: 'An old rust-red wheat that bakes a dark loaf.', look: { hue: 14, sat: 1.1, light: -0.08 } },
  pink_blueberry: { id: 'pink_blueberry', name: 'Pink Lemonade Blueberry', base: 'blueberry', blurb: 'A blueberry that ripens bright pink.', look: { hue: 330, sat: 1, light: 0.06 } },
  graffiti_eggplant: { id: 'graffiti_eggplant', name: 'Graffiti Eggplant', base: 'eggplant', blurb: 'Streaked lilac and white.', look: { hue: 300, sat: 0.6, light: 0.18 } },
  golden_yam: { id: 'golden_yam', name: 'Golden Yam', base: 'snow_yam', blurb: 'Gold-skinned and honey-sweet, even in the snow.', look: { hue: 45, sat: 1.1, light: 0.04 } },
};

export const HEIRLOOM_IDS = Object.keys(HEIRLOOMS) as HeirloomId[];

const BASE_CROPS: Record<BaseCropId, CropDef> = {
  turnip: { id: 'turnip', name: 'Turnip', seedItem: 'turnip_seeds', harvestItem: 'turnip', matureStage: 3, yield: [1, 2], seasons: ['spring', 'fall'] },
  carrot: { id: 'carrot', name: 'Carrot', seedItem: 'carrot_seeds', harvestItem: 'carrot', matureStage: 4, yield: [1, 2], seasons: ['spring', 'summer', 'fall'] },
  pumpkin: { id: 'pumpkin', name: 'Pumpkin', seedItem: 'pumpkin_seeds', harvestItem: 'pumpkin', matureStage: 5, yield: [1, 1], seasons: ['summer', 'fall'] },
  strawberry: { id: 'strawberry', name: 'Strawberry', seedItem: 'strawberry_seeds', harvestItem: 'strawberry', matureStage: 4, yield: [1, 2], seasons: ['spring'], regrowStage: 2 },
  potato: { id: 'potato', name: 'Potato', seedItem: 'potato_seeds', harvestItem: 'potato', matureStage: 4, yield: [1, 3], seasons: ['spring'] },
  tomato: { id: 'tomato', name: 'Tomato', seedItem: 'tomato_seeds', harvestItem: 'tomato', matureStage: 5, yield: [1, 2], seasons: ['summer'], regrowStage: 3 },
  corn: { id: 'corn', name: 'Corn', seedItem: 'corn_seeds', harvestItem: 'corn', matureStage: 6, yield: [1, 1], seasons: ['summer', 'fall'], regrowStage: 4 },
  wheat: { id: 'wheat', name: 'Wheat', seedItem: 'wheat_seeds', harvestItem: 'wheat', matureStage: 3, yield: [1, 2], seasons: ['summer', 'fall'] },
  blueberry: { id: 'blueberry', name: 'Blueberry', seedItem: 'blueberry_seeds', harvestItem: 'blueberry', matureStage: 5, yield: [2, 3], seasons: ['summer'], regrowStage: 3 },
  eggplant: { id: 'eggplant', name: 'Eggplant', seedItem: 'eggplant_seeds', harvestItem: 'eggplant', matureStage: 4, yield: [1, 1], seasons: ['fall'], regrowStage: 2 },
  snow_yam: { id: 'snow_yam', name: 'Snow Yam', seedItem: 'snow_yam_seeds', harvestItem: 'snow_yam', matureStage: 4, yield: [1, 2], seasons: ['winter'] },
};

export const BASE_CROP_IDS = Object.keys(BASE_CROPS) as BaseCropId[];

/** Every crop: the everyday ones, then the heirlooms (which grow exactly like their everyday cousin). */
export const CROPS: Record<CropId, CropDef> = {
  ...BASE_CROPS,
  ...(Object.fromEntries(
    HEIRLOOM_IDS.map((id) => {
      const h = HEIRLOOMS[id];
      return [id, { ...BASE_CROPS[h.base], id, name: h.name, seedItem: `${id}_seeds` as ItemId, harvestItem: id as ItemId, heirloomOf: h.base }];
    }),
  ) as Record<HeirloomId, CropDef>),
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

export function isHeirloom(id: CropId): id is HeirloomId {
  return id in HEIRLOOMS;
}
