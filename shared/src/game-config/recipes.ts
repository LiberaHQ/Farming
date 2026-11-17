import type { ItemId } from './items';

export interface ItemAmount {
  itemId: ItemId;
  quantity: number;
}

export type RecipeCategory = 'tools' | 'farm' | 'building' | 'cooking';

export interface RecipeDef {
  id: string;
  category: RecipeCategory;
  output: ItemAmount;
  inputs: readonly ItemAmount[];
}

export const RECIPES: readonly RecipeDef[] = [
  {
    id: 'copper_axe',
    category: 'tools',
    output: { itemId: 'copper_axe', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 10 },
      { itemId: 'copper_ore', quantity: 5 },
    ],
  },
  {
    id: 'copper_pickaxe',
    category: 'tools',
    output: { itemId: 'copper_pickaxe', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 6 },
      { itemId: 'copper_ore', quantity: 8 },
    ],
  },
  {
    id: 'iron_axe',
    category: 'tools',
    output: { itemId: 'iron_axe', quantity: 1 },
    inputs: [
      { itemId: 'copper_axe', quantity: 1 },
      { itemId: 'iron_ore', quantity: 6 },
      { itemId: 'wood', quantity: 5 },
    ],
  },
  {
    id: 'iron_pickaxe',
    category: 'tools',
    output: { itemId: 'iron_pickaxe', quantity: 1 },
    inputs: [
      { itemId: 'copper_pickaxe', quantity: 1 },
      { itemId: 'iron_ore', quantity: 8 },
      { itemId: 'wood', quantity: 5 },
    ],
  },
  {
    id: 'gold_axe',
    category: 'tools',
    output: { itemId: 'gold_axe', quantity: 1 },
    inputs: [
      { itemId: 'iron_axe', quantity: 1 },
      { itemId: 'gold_ore', quantity: 6 },
    ],
  },
  {
    id: 'gold_pickaxe',
    category: 'tools',
    output: { itemId: 'gold_pickaxe', quantity: 1 },
    inputs: [
      { itemId: 'iron_pickaxe', quantity: 1 },
      { itemId: 'gold_ore', quantity: 8 },
    ],
  },
  {
    id: 'iron_sword',
    category: 'tools',
    output: { itemId: 'iron_sword', quantity: 1 },
    inputs: [
      { itemId: 'sword', quantity: 1 },
      { itemId: 'iron_ore', quantity: 8 },
      { itemId: 'slime', quantity: 5 },
    ],
  },
  {
    id: 'keg',
    category: 'farm',
    output: { itemId: 'keg', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 30 },
      { itemId: 'copper_ore', quantity: 4 },
    ],
  },
  {
    id: 'preserves_jar',
    category: 'farm',
    output: { itemId: 'preserves_jar', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 20 },
      { itemId: 'stone', quantity: 20 },
      { itemId: 'fiber', quantity: 5 },
    ],
  },
  {
    id: 'greenhouse',
    category: 'building',
    output: { itemId: 'greenhouse', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 80 },
      { itemId: 'stone', quantity: 60 },
      { itemId: 'iron_ore', quantity: 10 },
    ],
  },
  {
    id: 'barn',
    category: 'building',
    output: { itemId: 'barn', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 150 },
      { itemId: 'stone', quantity: 50 },
      { itemId: 'fiber', quantity: 20 },
    ],
  },
  {
    id: 'hay',
    category: 'farm',
    output: { itemId: 'hay', quantity: 3 },
    inputs: [
      { itemId: 'wheat', quantity: 1 },
      { itemId: 'fiber', quantity: 2 },
    ],
  },
  {
    id: 'cheese_press',
    category: 'farm',
    output: { itemId: 'cheese_press', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 40 },
      { itemId: 'stone', quantity: 20 },
      { itemId: 'iron_ore', quantity: 2 },
    ],
  },
  {
    id: 'loom',
    category: 'farm',
    output: { itemId: 'loom', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 50 },
      { itemId: 'fiber', quantity: 30 },
      { itemId: 'iron_ore', quantity: 2 },
    ],
  },
  {
    id: 'fertilizer',
    category: 'farm',
    output: { itemId: 'fertilizer', quantity: 2 },
    inputs: [
      { itemId: 'fiber', quantity: 5 },
      { itemId: 'stone', quantity: 1 },
    ],
  },
  {
    id: 'carrot_seeds',
    category: 'farm',
    output: { itemId: 'carrot_seeds', quantity: 3 },
    inputs: [
      { itemId: 'turnip', quantity: 1 },
      { itemId: 'fiber', quantity: 2 },
    ],
  },
  {
    id: 'pumpkin_seeds',
    category: 'farm',
    output: { itemId: 'pumpkin_seeds', quantity: 2 },
    inputs: [
      { itemId: 'carrot', quantity: 2 },
      { itemId: 'fiber', quantity: 4 },
    ],
  },
  { id: 'fence', category: 'building', output: { itemId: 'fence', quantity: 4 }, inputs: [{ itemId: 'wood', quantity: 2 }] },
  { id: 'wood_path', category: 'building', output: { itemId: 'wood_path', quantity: 5 }, inputs: [{ itemId: 'wood', quantity: 1 }] },
  { id: 'stone_path', category: 'building', output: { itemId: 'stone_path', quantity: 5 }, inputs: [{ itemId: 'stone', quantity: 1 }] },
  {
    id: 'lamp_post',
    category: 'building',
    output: { itemId: 'lamp_post', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 4 },
      { itemId: 'copper_ore', quantity: 2 },
    ],
  },
  {
    id: 'chest',
    category: 'building',
    output: { itemId: 'chest', quantity: 1 },
    inputs: [
      { itemId: 'wood', quantity: 12 },
      { itemId: 'stone', quantity: 2 },
    ],
  },
  {
    id: 'sprinkler',
    category: 'farm',
    output: { itemId: 'sprinkler', quantity: 1 },
    inputs: [
      { itemId: 'copper_ore', quantity: 4 },
      { itemId: 'stone', quantity: 5 },
    ],
  },
  { id: 'veggie_soup', category: 'cooking', output: { itemId: 'veggie_soup', quantity: 1 }, inputs: [{ itemId: 'turnip', quantity: 1 }, { itemId: 'carrot', quantity: 1 }] },
  { id: 'berry_jam', category: 'cooking', output: { itemId: 'berry_jam', quantity: 1 }, inputs: [{ itemId: 'berries', quantity: 4 }] },
  { id: 'grilled_fish', category: 'cooking', output: { itemId: 'grilled_fish', quantity: 1 }, inputs: [{ itemId: 'sunfish', quantity: 1 }, { itemId: 'wood', quantity: 1 }] },
  { id: 'iron_sprinkler', category: 'farm', output: { itemId: 'iron_sprinkler', quantity: 1 }, inputs: [{ itemId: 'iron_ore', quantity: 4 }, { itemId: 'copper_ore', quantity: 2 }] },
  { id: 'gold_sprinkler', category: 'farm', output: { itemId: 'gold_sprinkler', quantity: 1 }, inputs: [{ itemId: 'gold_ore', quantity: 4 }, { itemId: 'iron_ore', quantity: 2 }] },
  { id: 'collector', category: 'farm', output: { itemId: 'collector', quantity: 1 }, inputs: [{ itemId: 'iron_ore', quantity: 3 }, { itemId: 'hardwood', quantity: 5 }] },
  { id: 'silo', category: 'building', output: { itemId: 'silo', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 80 }, { itemId: 'copper_ore', quantity: 5 }, { itemId: 'hardwood', quantity: 5 }] },
  { id: 'well', category: 'building', output: { itemId: 'well', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 60 }, { itemId: 'wood', quantity: 20 }] },
  { id: 'shed', category: 'building', output: { itemId: 'shed', quantity: 1 }, inputs: [{ itemId: 'wood', quantity: 120 }, { itemId: 'hardwood', quantity: 10 }, { itemId: 'stone', quantity: 40 }] },
  { id: 'stove', category: 'building', output: { itemId: 'stove', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 30 }, { itemId: 'copper_ore', quantity: 5 }] },
  { id: 'fireplace', category: 'building', output: { itemId: 'fireplace', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 50 }] },
  { id: 'display_table', category: 'building', output: { itemId: 'display_table', quantity: 1 }, inputs: [{ itemId: 'wood', quantity: 10 }, { itemId: 'stone', quantity: 5 }] },
  { id: 'wall_shelf', category: 'building', output: { itemId: 'wall_shelf', quantity: 1 }, inputs: [{ itemId: 'wood', quantity: 8 }] },
  { id: 'aquarium', category: 'building', output: { itemId: 'aquarium', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 20 }, { itemId: 'seashell', quantity: 3 }, { itemId: 'wood', quantity: 10 }] },
  { id: 'statue', category: 'building', output: { itemId: 'statue', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 40 }] },
  { id: 'flower_bed', category: 'building', output: { itemId: 'flower_bed', quantity: 1 }, inputs: [{ itemId: 'wood', quantity: 5 }, { itemId: 'fiber', quantity: 5 }] },
  { id: 'birdbath', category: 'building', output: { itemId: 'birdbath', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 25 }] },
  { id: 'gnome', category: 'building', output: { itemId: 'gnome', quantity: 1 }, inputs: [{ itemId: 'stone', quantity: 10 }, { itemId: 'slime', quantity: 3 }] },
  { id: 'crab_pot', category: 'farm', output: { itemId: 'crab_pot', quantity: 1 }, inputs: [{ itemId: 'wood', quantity: 20 }, { itemId: 'copper_ore', quantity: 3 }] },
  { id: 'bait', category: 'farm', output: { itemId: 'bait', quantity: 5 }, inputs: [{ itemId: 'fiber', quantity: 2 }] },
  { id: 'miners_stew', category: 'cooking', output: { itemId: 'miners_stew', quantity: 1 }, inputs: [{ itemId: 'potato', quantity: 2 }, { itemId: 'tomato', quantity: 1 }] },
  { id: 'corn_chowder', category: 'cooking', output: { itemId: 'corn_chowder', quantity: 1 }, inputs: [{ itemId: 'corn', quantity: 2 }, { itemId: 'milk', quantity: 1 }] },
  { id: 'blueberry_tart', category: 'cooking', output: { itemId: 'blueberry_tart', quantity: 1 }, inputs: [{ itemId: 'blueberry', quantity: 3 }, { itemId: 'wheat', quantity: 2 }] },
  { id: 'omelette', category: 'cooking', output: { itemId: 'omelette', quantity: 1 }, inputs: [{ itemId: 'egg', quantity: 2 }] },
  {
    id: 'pumpkin_pie',
    category: 'cooking',
    output: { itemId: 'pumpkin_pie', quantity: 1 },
    inputs: [
      { itemId: 'pumpkin', quantity: 1 },
      { itemId: 'egg', quantity: 1 },
      { itemId: 'bread', quantity: 1 },
    ],
  },
];

export const RECIPE_CATEGORIES: Array<{ id: RecipeCategory; label: string }> = [
  { id: 'tools', label: 'Tools' },
  { id: 'farm', label: 'Farming' },
  { id: 'building', label: 'Building' },
  { id: 'cooking', label: 'Cooking' },
];

export function findRecipe(id: string): RecipeDef | undefined {
  return RECIPES.find((r) => r.id === id);
}
