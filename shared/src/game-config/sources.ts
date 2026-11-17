import { CROP_IDS, CROPS } from './crops';
import { FISH, FORAGE } from './activities';
import type { ItemId } from './items';
import { MACHINES } from './machines';
import { NPCS, NPC_IDS } from './npcs';
import { RECIPES } from './recipes';

const BASICS: Partial<Record<ItemId, string>> = {
  wood: 'chop trees',
  stone: 'break rocks',
  fiber: 'cut tall grass',
  copper_ore: 'copper rocks, or the mine',
  iron_ore: 'the mine (floor 5+)',
  gold_ore: 'the mine (floor 15+)',
  amethyst: 'the mine',
  berries: 'pick from berry bushes',
  egg: 'chickens lay them',
  duck_egg: 'ducks lay them',
  milk: 'milk a cow',
  wool: 'shear a sheep',
  hay: 'buy from Mira, or cut grass with a silo',
  seashell: 'the beach',
  coral: 'the beach',
  sea_urchin: 'rock pools on the beach at low tide',
  sea_star: 'rock pools on the beach at low tide',
  rainbow_shell: 'rock pools on the beach at low tide (rare)',
  hardwood: 'old stumps in the forest',
  slime: 'slimes in the mine',
  coconut: 'under the palms on the island',
  charcoal: 'where lightning strikes a tree in a storm',
  meteorite: 'the farm, the morning after the summer meteor shower',
  coal: 'sometimes falls off the train by the tracks',
  apple: 'an apple tree in fall (saplings from Mira)',
  cherry: 'a cherry tree in spring (saplings from Mira)',
  peach: 'a peach tree in summer (saplings from Mira)',
  golden_spike: 'very rarely falls off the train by the tracks',
  spirit_ring: "the ghost in the graveyard, once you've found all her belongings",
  pineapple_seeds: 'the parrot on the island (for coconuts)',
  taro_tuber: 'the parrot on the island (for coconuts)',
  pineapple: 'grow it in the island garden',
  taro: 'grow it in the island garden',
  pearl: 'the giant clam in the island cave',
  ruby: 'crystal rocks in the island cave',
  jade: 'crystal rocks in the island cave',
  old_coin: 'dig the soil with a hoe (rare)',
  arrowhead: 'dig the soil with a hoe (rare)',
  clay_pot: 'break rocks in the mine, floors 1–14 (rare)',
  fossil: 'break rocks in the mine, floor 15+ (rare)',
  stone_tablet: 'crystal rocks in the island cave (rare)',
  golden_idol: 'the ancient chest in the island cave',
};

/** A short hint of where to get an item, for recipes and requests ("grow it", "Rosa's bakery"). */
export function whereToGet(itemId: ItemId): string {
  if (BASICS[itemId]) return BASICS[itemId]!;
  const crop = CROP_IDS.find((c) => CROPS[c].harvestItem === itemId);
  if (crop) return `grow it (seeds from Mira)`;
  if (FISH.some((f) => f.itemId === itemId)) return (() => { const w = FISH.find((f) => f.itemId === itemId)?.water; return w === 'ocean' ? 'fish at the beach' : w === 'island' ? 'fish around the island' : 'go fishing'; })();
  if (Object.values(FORAGE).some((list) => list.includes(itemId))) return 'forage in the forest';
  for (const id of NPC_IDS) {
    const shop = NPCS[id].shop;
    if (shop?.sells.some((s) => s.itemId === itemId)) return `buy from ${NPCS[id].name}`;
  }
  const machine = Object.values(MACHINES).find((m) => m.output === itemId);
  if (machine) return `make it in a ${machine.name.toLowerCase()}`;
  const recipe = RECIPES.find((r) => r.output.itemId === itemId);
  if (recipe) return recipe.category === 'cooking' ? 'cook it' : 'craft it';
  return 'find it around the valley';
}
