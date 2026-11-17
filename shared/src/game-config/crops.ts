import type { ItemId } from './items';
import type { Season } from './time';

export type CropId = 'turnip' | 'carrot' | 'pumpkin' | 'strawberry' | 'potato' | 'tomato' | 'corn' | 'wheat' | 'blueberry' | 'eggplant' | 'snow_yam';

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
}

export const CROPS: Record<CropId, CropDef> = {
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

export const CROP_IDS = Object.keys(CROPS) as CropId[];
