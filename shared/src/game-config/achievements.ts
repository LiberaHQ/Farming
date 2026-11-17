import { CROP_IDS, CROPS } from './crops';
import { ITEM_IDS, ITEMS, type ItemId } from './items';

/** What achievements are judged on: one player's progress. */
export interface AchievementContext {
  /** Every item this player has ever held. */
  found: ReadonlySet<ItemId>;
  lifetimeEarnings: number;
  mineDepth: number;
  /** Hearts with each villager. */
  hearts: number[];
  communityDone: number;
  communityTotal: number;
  furniture: number;
  houseLevel: number;
  livestock: number;
  day: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: ItemId;
  /** [have, need]: unlocked once have ≥ need. */
  progress(ctx: AchievementContext): [number, number];
}

const count = (ctx: AchievementContext, ids: readonly ItemId[]) => ids.filter((id) => ctx.found.has(id)).length;
const CROP_ITEMS = CROP_IDS.map((c) => CROPS[c].harvestItem as ItemId);
const FISH = ITEM_IDS.filter((id) => ITEMS[id].category === 'fish');
const ARTISAN: ItemId[] = ['juice', 'pickles', 'cheese', 'cloth'];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_harvest', name: 'First Harvest', description: 'Harvest your first crop.', icon: 'turnip', progress: (c) => [Math.min(1, count(c, CROP_ITEMS)), 1] },
  { id: 'green_thumb', name: 'Green Thumb', description: 'Grow every kind of crop.', icon: 'pumpkin', progress: (c) => [count(c, CROP_ITEMS), CROP_ITEMS.length] },
  { id: 'angler', name: 'Angler', description: 'Catch 4 kinds of fish.', icon: 'trout', progress: (c) => [Math.min(4, count(c, FISH)), 4] },
  { id: 'master_angler', name: 'Master Angler', description: 'Catch every fish, river and sea.', icon: 'golden_carp', progress: (c) => [count(c, FISH), FISH.length] },
  { id: 'spelunker', name: 'Spelunker', description: 'Reach floor 10 of the mine.', icon: 'iron_ore', progress: (c) => [Math.min(10, c.mineDepth), 10] },
  { id: 'deepest', name: 'Rock Bottom', description: 'Reach the bottom of the mine (floor 30).', icon: 'amethyst', progress: (c) => [Math.min(30, c.mineDepth), 30] },
  { id: 'artisan', name: 'Artisan', description: 'Make juice, pickles, cheese and cloth.', icon: 'cheese', progress: (c) => [count(c, ARTISAN), ARTISAN.length] },
  { id: 'rancher', name: 'Rancher', description: 'Raise 3 barn animals.', icon: 'milk', progress: (c) => [Math.min(3, c.livestock), 3] },
  { id: 'friendly', name: 'Good Neighbour', description: 'Reach 4 hearts with 3 villagers.', icon: 'berries', progress: (c) => [Math.min(3, c.hearts.filter((h) => h >= 4).length), 3] },
  { id: 'best_friends', name: 'Best Friends', description: 'Reach 8 hearts with a villager.', icon: 'golden_egg', progress: (c) => [Math.min(8, Math.max(0, ...c.hearts)), 8] },
  { id: 'homemaker', name: 'Homemaker', description: 'Furnish your cottage with 6 pieces.', icon: 'house_plant', progress: (c) => [Math.min(6, c.furniture), 6] },
  { id: 'extension', name: 'Room to Grow', description: 'Extend your cottage.', icon: 'house_upgrade', progress: (c) => [c.houseLevel, 1] },
  { id: 'community', name: 'Community Spirit', description: 'Finish a community project.', icon: 'wood', progress: (c) => [Math.min(1, c.communityDone), 1] },
  { id: 'pillar', name: 'Pillar of the Valley', description: 'Finish every community project.', icon: 'ribbon', progress: (c) => [c.communityDone, c.communityTotal] },
  { id: 'earner', name: 'Making a Living', description: 'Earn 5,000g in total.', icon: 'egg', progress: (c) => [Math.min(5000, c.lifetimeEarnings), 5000] },
  { id: 'tycoon', name: 'Tycoon', description: 'Earn 50,000g in total.', icon: 'gold_ore', progress: (c) => [Math.min(50000, c.lifetimeEarnings), 50000] },
  { id: 'collector', name: 'Collector', description: 'Find 60 different items.', icon: 'chest', progress: (c) => [Math.min(60, c.found.size), 60] },
  { id: 'year_one', name: 'A Year in the Valley', description: 'Live through a whole year (40 days).', icon: 'snow_yam', progress: (c) => [Math.min(40, c.day), 40] },
];

export const ACHIEVEMENT_IDS = ACHIEVEMENTS.map((a) => a.id);
