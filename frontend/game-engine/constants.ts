export const SCENES = {
  Boot: 'Boot',
  World: 'World',
  Mine: 'Mine',
  Beach: 'Beach',
  Forest: 'Forest',
  Carnival: 'Carnival',
  Interior: 'Interior',
  Home: 'Home',
  Museum: 'Museum',
  Island: 'Island',
  IslandCave: 'IslandCave',
} as const;

/**
 * Render layers. Everything that stands on the ground (player, trees, rocks)
 * is depth-sorted by the y of its base: depth = Y_SORT_BASE + baseY.
 */
export const DEPTH = {
  ground: 0,
  waterGlint: 2,
  shadow: 5,
  floor: 0.5,
  soil: 1,
  ySortBase: 10,
  weather: 840_000,
  lighting: 850_000,
  cursor: 899_000,
  fx: 900_000,
  debug: 1_000_000,
} as const;
