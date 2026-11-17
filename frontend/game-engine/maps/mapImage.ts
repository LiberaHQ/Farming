import { Terrain, type PlaceableKind, type Season, type WorldObjectKind } from '@farming/shared';
import { PixelCanvas } from '../assets/PixelCanvas';
import { GRASS_VARIANTS } from '../assets/tileIndex';
import type { WorldData } from './WorldData';

/** Pixels per tile on the world map. */
export const MAP_SCALE = 4;

export interface MapMarkers {
  season: Season;
  objects: Array<{ kind: WorldObjectKind; tx: number; ty: number }>;
  placed: Array<{ kind: PlaceableKind; tx: number; ty: number }>;
  plots: Array<{ tx: number; ty: number; crop: boolean; ready: boolean }>;
  people: Array<{ x: number; y: number }>;
  chickens: Array<{ x: number; y: number }>;
  /** Fruit trees you planted. */
  orchard?: Array<{ tx: number; ty: number; fruit: number }>;
  /** The railway's row. */
  rail?: number | null;
  /** The graveyard's fenced area (tiles). */
  graveyard?: { x0: number; y0: number; x1: number; y1: number } | null;
}

const GRASS: Record<Season, [string, string]> = {
  spring: ['#5f9e3e', '#558f38'],
  summer: ['#5a9a3a', '#4f8a33'],
  fall: ['#8a9a3e', '#7c8a36'],
  winter: ['#dfe7ec', '#cfd9e0'],
};

const OBJECT_COLORS: Partial<Record<WorldObjectKind, string>> = {
  oak: '#2d6a33',
  pine: '#1f5a3c',
  rock: '#9aa0a6',
  copperRock: '#c9783a',
  bush: '#4a9a42',
  stump: '#7c512c',
};

/**
 * Renders a top-down overview of the whole world: terrain, forests, rocks,
 * the player's farm and buildings, and people. Pure drawing; returns a canvas.
 */
export function drawWorldMap(world: WorldData, markers: MapMarkers): HTMLCanvasElement {
  const S = MAP_SCALE;
  const p = new PixelCanvas(world.width * S, world.height * S);
  const [grass, grassShade] = GRASS[markers.season];

  for (let ty = 0; ty < world.height; ty++) {
    for (let tx = 0; tx < world.width; tx++) {
      const i = ty * world.width + tx;
      const t = world.terrain[i];
      let color = grass;
      if (t === Terrain.Water) color = '#3a83b5';
      else if (t === Terrain.Path) color = '#bf9058';
      else if (t === Terrain.Bridge) color = '#a8703d';
      else if ((tx + ty) % 2 === 0) color = grassShade;
      p.rect(tx * S, ty * S, S, S, color);
      // Flower meadows as tiny specks.
      if (t === Terrain.Grass && world.groundVariant[i] >= GRASS_VARIANTS && markers.season !== 'winter') p.set(tx * S + 1, ty * S + 1, '#f4d24a');
    }
  }

  if (markers.rail !== null && markers.rail !== undefined) {
    const y = markers.rail * S + Math.floor(S / 2) - 1;
    for (let x = 0; x < world.width * S; x++) {
      p.set(x, y, '#3a3a44');
      p.set(x, y + 1, x % 3 === 0 ? '#6a4428' : '#3a3a44');
    }
  }
  if (markers.graveyard) {
    const g = markers.graveyard;
    p.rect(g.x0 * S, g.y0 * S, (g.x1 - g.x0 + 1) * S, (g.y1 - g.y0 + 1) * S, '#6e7a5a');
    for (let x = g.x0 * S; x < (g.x1 + 1) * S; x++) {
      p.set(x, g.y0 * S, '#3a3a44');
      p.set(x, (g.y1 + 1) * S - 1, '#3a3a44');
    }
    for (let y = g.y0 * S; y < (g.y1 + 1) * S; y++) {
      p.set(g.x0 * S, y, '#3a3a44');
      p.set((g.x1 + 1) * S - 1, y, '#3a3a44');
    }
  }

  for (const t of markers.orchard ?? []) {
    p.rect(t.tx * S, t.ty * S, S, S, '#2f7a3a');
    p.rect(t.tx * S + 1, t.ty * S + 1, S - 2, S - 2, '#4aa848');
    if (t.fruit > 0) p.set(t.tx * S + 1, t.ty * S + 1, '#e8402a');
  }

  for (const plot of markers.plots) {
    p.rect(plot.tx * S, plot.ty * S, S, S, '#6b4628');
    if (plot.crop) p.rect(plot.tx * S + 1, plot.ty * S + 1, 2, 2, plot.ready ? '#f4d24a' : '#7cc456');
  }

  for (const o of markers.objects) {
    const color = OBJECT_COLORS[o.kind];
    if (!color) continue;
    const x = o.tx * S;
    const y = o.ty * S;
    if (o.kind === 'oak' || o.kind === 'pine') {
      // Canopies are bigger than one tile.
      p.rect(x - 1, y - 2, S + 2, S + 2, color);
      p.rect(x, y - 2, 2, 1, o.kind === 'oak' ? '#5aac46' : '#46996a');
    } else {
      p.rect(x + 1, y + 1, 2, 2, color);
    }
  }

  for (const b of markers.placed) {
    const x = b.tx * S;
    const y = b.ty * S;
    switch (b.kind) {
      case 'cottage':
        p.rect(x, y - S, S * 3, S * 2, '#a3483a');
        p.rect(x + S, y, S, S, '#6f4626');
        break;
      case 'wood_path':
        p.rect(x, y, S, S, '#c9905a');
        break;
      case 'stone_path':
        p.rect(x, y, S, S, '#bcc2c7');
        break;
      case 'fence':
        p.rect(x, y + 1, S, 2, '#8a5a32');
        break;
      case 'lamp_post':
        p.rect(x + 1, y + 1, 2, 2, '#ffe9a8');
        break;
      case 'chest':
        p.rect(x + 1, y + 1, 2, 2, '#c9905a');
        break;
      case 'sprinkler':
        p.rect(x + 1, y + 1, 2, 2, '#8fd3f0');
        break;
      case 'bench':
      case 'scarecrow':
        p.rect(x + 1, y + 1, 2, 2, '#b57a44');
        break;
      case 'flower_pot':
        p.rect(x + 1, y + 1, 2, 2, '#f08bb4');
        break;
    }
  }

  // The market stalls and notice board (world objects).
  for (const o of markers.objects) {
    if (o.kind === 'stall') {
      p.rect(o.tx * S, o.ty * S - S, S * 2, S, '#d2553f');
      p.rect(o.tx * S, o.ty * S, S * 2, S, '#a8703d');
    } else if (o.kind === 'mine') {
      p.rect(o.tx * S - 1, o.ty * S - S, S * 2 + 2, S + 2, '#6a7179');
      p.rect(o.tx * S + 2, o.ty * S - 1, S * 2 - 4, S + 1, '#1a1412');
    } else if (o.kind === 'board') {
      p.rect(o.tx * S + 1, o.ty * S - 2, S - 2, S, '#e9d29a');
      p.rect(o.tx * S + 1, o.ty * S + S - 2, 1, 2, '#6b4628');
      p.rect(o.tx * S + S - 2, o.ty * S + S - 2, 1, 2, '#6b4628');
    }
  }

  for (const c of markers.chickens) p.rect(Math.round(c.x / 16 * S) - 1, Math.round(c.y / 16 * S) - 1, 2, 2, '#ffffff');
  for (const n of markers.people) {
    const x = Math.round((n.x / 16) * S);
    const y = Math.round((n.y / 16) * S);
    p.rect(x - 1, y - 2, 3, 3, '#5a6f9e');
  }

  return p.toCanvas();
}
