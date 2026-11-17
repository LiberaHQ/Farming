import type { CropId } from '@farming/shared';
import { cropArt } from './items';
import { P } from './palette';
import { PixelCanvas } from './PixelCanvas';
import { drawRipePlant, PRODUCE } from './produce';

/** 16x16 crop sprites, one per growth stage, standing on row 14. */

function seeds(p: PixelCanvas): void {
  for (const [x, y] of [
    [5, 12],
    [8, 13],
    [10, 11],
  ] as const) {
    p.set(x, y, P.dirtLight);
    p.set(x + 1, y, P.trunkDark);
  }
}

function leaves(p: PixelCanvas, growth: number, wide: boolean): void {
  const height = wide ? 2 + Math.round(growth * 4) : 2 + Math.round(growth * 7);
  const maxSpread = wide ? 2 + Math.round(growth * 4) : 1 + Math.round(growth * 3);
  for (let i = 0; i < height; i++) {
    p.set(7, 14 - i, P.leafDark);
    p.set(8, 14 - i, P.leaf);
  }
  for (let i = 1; i < height; i += 2) {
    const y = 14 - i;
    const spread = Math.max(1, Math.round(maxSpread * (1 - (i / height) * 0.5)));
    for (let k = 1; k <= spread; k++) {
      p.set(7 - k, y + (k > spread / 2 ? 0 : 1) - (k === spread ? 1 : 0), P.leafLight);
      p.set(8 + k, y - (k === spread ? 1 : 0), P.leaf);
    }
  }
}

function mature(p: PixelCanvas, crop: CropId): void {
  if (crop === 'turnip') {
    leaves(p, 0.8, false);
    for (let y = 10; y <= 14; y++) {
      for (let x = 4; x <= 11; x++) {
        const nx = (x - 7.5) / 4;
        const ny = (y - 14) / 4.5;
        if (nx * nx + ny * ny > 1) continue;
        p.set(x, y, y < 12 ? (x < 6 ? cropArt.TURNIP.purpleLight : cropArt.TURNIP.purple) : cropArt.TURNIP.white);
      }
    }
  } else if (crop === 'carrot') {
    leaves(p, 1, false);
    for (let x = 6; x <= 9; x++) {
      p.set(x, 12, cropArt.ORANGE.light);
      p.set(x, 13, cropArt.ORANGE.base);
      p.set(x, 14, cropArt.ORANGE.dark);
    }
  } else if (crop === 'pumpkin') {
    leaves(p, 0.6, true);
    cropArt.pumpkin(p, 7.5, 10.5, 6.5, 4);
  } else {
    drawRipePlant(p, crop, (growth, wide) => leaves(p, growth, wide));
  }
}

export function drawCropStage(crop: CropId, stage: number, matureStage: number): PixelCanvas {
  const p = new PixelCanvas(16, 16);
  if (stage === 0) {
    seeds(p);
    return p;
  }
  if (stage >= matureStage) mature(p, crop);
  else {
    leaves(p, stage / matureStage, crop === 'pumpkin' || PRODUCE[crop]?.plant === 'bush');
    // A small green pumpkin appears on the last stage before ripening.
    if (crop === 'pumpkin' && stage === matureStage - 1) {
      p.rect(9, 11, 4, 3, P.leafLight);
      p.rect(9, 13, 4, 1, P.leafDark);
    }
  }
  p.outline(P.outline);
  return p;
}
