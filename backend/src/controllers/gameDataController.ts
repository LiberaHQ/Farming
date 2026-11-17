import type { RequestHandler } from 'express';
import { CROPS, GAME_CONFIG, ITEMS, NPCS, PLACEABLES, RECIPES, RESOURCES, SAVE_VERSION, TIME_CONFIG, WEATHER_CHANCES } from '@farming/shared';

/**
 * The game's rules as served by the backend. The client ships the same
 * definitions from `shared/`; this endpoint lets tools, the website and
 * future clients read them, and is the server's own source of truth.
 */
const payload = {
  saveVersion: SAVE_VERSION,
  config: GAME_CONFIG,
  time: TIME_CONFIG,
  weather: WEATHER_CHANCES,
  items: ITEMS,
  crops: CROPS,
  recipes: RECIPES,
  resources: RESOURCES,
  placeables: PLACEABLES,
  npcs: Object.fromEntries(Object.values(NPCS).map((n) => [n.id, { id: n.id, name: n.name, role: n.role, hours: n.hours }])),
};

export const gameDataHandler: RequestHandler = (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(payload);
};
