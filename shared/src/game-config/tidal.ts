import type { ItemId } from './items';
import { TIME_CONFIG } from './time';
import { tideLevel } from './wildlife';

/*
 * Tidal farming: tide beds in the strip of beach the sea covers twice a day.
 * They can only be planted, tended and harvested while the tide is out, and
 * each bed grows one stage for every day you tend it at low tide.
 */

export type TideCropId = 'oyster' | 'seaweed';

export interface TideCropDef {
  id: TideCropId;
  name: string;
  seedItem: ItemId;
  harvestItem: ItemId;
  /** Stage it can be harvested at. Planting is stage 1; each day's tending adds one. */
  matureStage: number;
  yield: readonly [min: number, max: number];
  /** Grows back from this stage after a harvest (seaweed); otherwise the bed is cleared. */
  regrowStage?: number;
  /** Chance of a pearl with each harvest. */
  pearlChance?: number;
  /** What tending it looks like ("Turn the oyster cage"). */
  tendVerb: string;
  harvestVerb: string;
}

export const TIDE_CROPS: Record<TideCropId, TideCropDef> = {
  oyster: {
    id: 'oyster',
    name: 'Oysters',
    seedItem: 'oyster_spat',
    harvestItem: 'oyster',
    matureStage: 5,
    yield: [2, 3],
    pearlChance: 0.1,
    tendVerb: 'Turn the oyster cage',
    harvestVerb: 'Harvest oysters',
  },
  seaweed: {
    id: 'seaweed',
    name: 'Seaweed',
    seedItem: 'seaweed_spores',
    harvestItem: 'seaweed',
    matureStage: 3,
    yield: [4, 6],
    regrowStage: 1,
    tendVerb: 'Tend the seaweed line',
    harvestVerb: 'Cut the seaweed',
  },
};

export const TIDE_CROP_IDS = Object.keys(TIDE_CROPS) as TideCropId[];

export function isTideCropId(v: unknown): v is TideCropId {
  return typeof v === 'string' && v in TIDE_CROPS;
}

export function tideCropForSeed(itemId: ItemId): TideCropDef | undefined {
  return TIDE_CROP_IDS.map((id) => TIDE_CROPS[id]).find((c) => c.seedItem === itemId);
}

/** Beach rows (tiles) with a tide bed: clear of the pier, the rock pools and the rocks. */
export const TIDE_BED_ROWS: readonly number[] = [1, 4, 7, 11, 14, 17];
export const TIDE_BEDS = TIDE_BED_ROWS.length;
/** How far out the tide must be (0 high … 1 low) before the beds are uncovered. */
export const TIDE_BED_EXPOSED = 0.7;
/** Energy each tending costs. */
export const TIDE_TEND_ENERGY = 2;

export interface TideBedSave {
  crop: TideCropId;
  /** 1 when planted; +1 for each day it's tended. */
  stage: number;
  /** The last day it was planted, tended or harvested (once a day). */
  tended: number;
}

export interface TidalSave {
  beds: Array<TideBedSave | null>;
}

export function freshTidal(): TidalSave {
  return { beds: Array.from({ length: TIDE_BEDS }, () => null) };
}

/** Are the beds out of the water at this game minute? */
export function tideBedsExposed(minute: number): boolean {
  return tideLevel(minute) >= TIDE_BED_EXPOSED;
}

/** The stretches of a day (game minutes, 6am–2am) when the beds are uncovered: one morning, one evening. */
export function lowTideWindows(): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  let start: number | null = null;
  for (let m = TIME_CONFIG.dayStartMinute; m <= TIME_CONFIG.dayEndMinute; m++) {
    const open = tideBedsExposed(m);
    if (open && start === null) start = m;
    if (!open && start !== null) {
      out.push({ from: start, to: m - 1 });
      start = null;
    }
  }
  if (start !== null) out.push({ from: start, to: TIME_CONFIG.dayEndMinute });
  return out;
}

/** The next time the beds are uncovered after `minute` today, or null if not again today. */
export function nextLowTide(minute: number): { from: number; to: number } | null {
  return lowTideWindows().find((w) => w.from > minute) ?? null;
}

export const bedReady = (bed: TideBedSave): boolean => bed.stage >= TIDE_CROPS[bed.crop].matureStage;

/** Planting counts as the first day's tending. */
export function plantBed(crop: TideCropId, day: number): TideBedSave {
  return { crop, stage: 1, tended: day };
}

/** Tends a bed (once a day, until it's ready). Null if there's nothing to do today. */
export function tendBed(bed: TideBedSave, day: number): TideBedSave | null {
  if (bed.tended >= day || bedReady(bed)) return null;
  return { ...bed, stage: bed.stage + 1, tended: day };
}

/** After a harvest: seaweed grows back from its regrow stage, oysters leave the bed empty. */
export function afterHarvest(bed: TideBedSave, day: number): TideBedSave | null {
  const regrow = TIDE_CROPS[bed.crop].regrowStage;
  return regrow === undefined ? null : { crop: bed.crop, stage: regrow, tended: day };
}

/** Days of tending a bed still needs before it's ready. */
export function tendsLeft(bed: TideBedSave): number {
  return Math.max(0, TIDE_CROPS[bed.crop].matureStage - bed.stage);
}
