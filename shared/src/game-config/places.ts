import type { ItemAmount } from './recipes';
import type { ItemId } from './items';
import type { NpcId } from './npcs';

// ---------- The island ----------

/** What it takes to patch up the old rowing boat at the beach. */
export const BOAT_REPAIR: readonly ItemAmount[] = [
  { itemId: 'wood', quantity: 40 },
  { itemId: 'hardwood', quantity: 8 },
  { itemId: 'fiber', quantity: 20 },
];

/** Crops that only grow in the island garden: no watering, any season. */
export interface IslandCropDef {
  id: 'pineapple' | 'taro';
  name: string;
  seed: ItemId;
  harvest: ItemId;
  /** Days from planting to ripe. */
  days: number;
  yield: readonly [number, number];
}

export const ISLAND_CROPS: Record<IslandCropDef['id'], IslandCropDef> = {
  pineapple: { id: 'pineapple', name: 'Pineapple', seed: 'pineapple_seeds', harvest: 'pineapple', days: 6, yield: [1, 1] },
  taro: { id: 'taro', name: 'Taro', seed: 'taro_tuber', harvest: 'taro', days: 3, yield: [1, 3] },
};

export const ISLAND_CROP_IDS = Object.keys(ISLAND_CROPS) as IslandCropDef['id'][];

export const islandCropForSeed = (seed: ItemId): IslandCropDef | undefined => Object.values(ISLAND_CROPS).find((c) => c.seed === seed);

/** Garden plots on the island. */
export const ISLAND_PLOTS = 8;

/** The parrot's trades: coconuts for island seeds. */
export const PARROT_TRADES: ReadonlyArray<{ give: ItemAmount; get: ItemAmount }> = [
  { give: { itemId: 'coconut', quantity: 3 }, get: { itemId: 'pineapple_seeds', quantity: 1 } },
  { give: { itemId: 'coconut', quantity: 2 }, get: { itemId: 'taro_tuber', quantity: 3 } },
];

/** The ancient chest in the island cave (opened once). */
export const CAVE_TREASURE: readonly ItemAmount[] = [
  { itemId: 'golden_idol', quantity: 1 },
  { itemId: 'ruby', quantity: 2 },
  { itemId: 'pearl', quantity: 1 },
];
export const CAVE_TREASURE_GOLD = 1000;

// ---------- The museum ----------

export type MuseumSetId = 'fish' | 'minerals' | 'artifacts' | 'shore';

export interface MuseumSet {
  id: MuseumSetId;
  name: string;
  /** One line under the name. */
  blurb: string;
  items: readonly ItemId[];
  reward: { gold: number; item?: ItemAmount };
}

export const MUSEUM_SETS: Record<MuseumSetId, MuseumSet> = {
  fish: {
    id: 'fish',
    name: 'Waters of the Valley',
    blurb: 'Every fish from the river, the sea and the island.',
    items: ['sunfish', 'trout', 'catfish', 'golden_carp', 'tuna', 'pufferfish', 'crab', 'shrimp', 'parrotfish', 'lionfish', 'swordfish', 'icefish', 'glacierfish'],
    reward: { gold: 1500, item: { itemId: 'aquarium', quantity: 1 } },
  },
  minerals: {
    id: 'minerals',
    name: 'Stones & Gems',
    blurb: 'Ore from the mine and gems from the island cave.',
    items: ['stone', 'copper_ore', 'iron_ore', 'gold_ore', 'amethyst', 'jade', 'ruby', 'meteorite', 'charcoal'],
    reward: { gold: 1000, item: { itemId: 'gold_sprinkler', quantity: 2 } },
  },
  artifacts: {
    id: 'artifacts',
    name: 'Lost Things',
    blurb: 'Dug from the soil, the rock and the island cave.',
    items: ['old_coin', 'arrowhead', 'clay_pot', 'fossil', 'stone_tablet', 'golden_idol'],
    reward: { gold: 3000, item: { itemId: 'statue', quantity: 1 } },
  },
  shore: {
    id: 'shore',
    name: 'Treasures of the Shore',
    blurb: 'Shells and sea finds from the beach and beyond.',
    items: ['seashell', 'coral', 'sea_urchin', 'sea_star', 'rainbow_shell', 'pearl'],
    reward: { gold: 800, item: { itemId: 'rainbow_shell', quantity: 2 } },
  },
};

export const MUSEUM_SET_IDS = Object.keys(MUSEUM_SETS) as MuseumSetId[];
export const MUSEUM_ITEMS: readonly ItemId[] = MUSEUM_SET_IDS.flatMap((id) => MUSEUM_SETS[id].items);
/** Bonus for filling every display. */
export const MUSEUM_COMPLETE_GOLD = 5000;

export const museumSetOf = (itemId: ItemId): MuseumSet | undefined => Object.values(MUSEUM_SETS).find((s) => s.items.includes(itemId));

// ---------- Villagers' homes ----------

/** Hearts needed before a villager lets you in, and before they offer a daily treat at home. */
export const HOME_VISIT_HEARTS = 2;
export const HOME_TREAT_HEARTS = 4;
/** Villagers sleep from this minute (doors locked) until 6am. */
export const HOME_BEDTIME = 22 * 60;

/** What each villager says at home, and the treat they press on you (4+ hearts, once a day). */
export const HOME_LIFE: Record<NpcId, { lines: readonly string[]; treat: ItemAmount; treatText: string; style: string }> = {
  mira: {
    style: 'seed jars on every shelf and a window full of seedlings',
    lines: [
      'Welcome in! Mind the seedlings — they get jealous of visitors.',
      'Every jar on that shelf is a different seed. I label them in my grandmother’s handwriting.',
      'I talk to my plants. They grow better. Don’t laugh.',
    ],
    treat: { itemId: 'strawberry_seeds', quantity: 3 },
    treatText: 'Mira presses a twist of seeds into your hand. "From my own garden."',
  },
  rosa: {
    style: 'a big brick oven, flour on everything, and the smell of cinnamon',
    lines: [
      'Come in, come in! Sit anywhere that isn’t covered in flour.',
      'The oven never quite cools down. Neither do I.',
      'I test every recipe on myself first. It’s a sacrifice.',
    ],
    treat: { itemId: 'bread', quantity: 2 },
    treatText: 'Rosa wraps two warm loaves in a cloth for you.',
  },
  bram: {
    style: 'an anvil by the hearth and tools hung neatly on the wall',
    lines: [
      'Hmph. Wipe your boots. …Welcome.',
      'That anvil was my father’s. I sleep better with it near.',
      'Every tool on that wall has a name. No, I won’t tell you them.',
    ],
    treat: { itemId: 'iron_ore', quantity: 3 },
    treatText: 'Bram hands you some ore without a word. You think he’s smiling.',
  },
  finn: {
    style: 'nets hanging from the beams and a fish tank bubbling in the corner',
    lines: [
      'Ahoy! Careful, the floor creaks like a deck.',
      'That’s Gill in the tank. He’s the best listener in the valley.',
      'I mend nets in the evenings. Calms the mind.',
    ],
    treat: { itemId: 'bait', quantity: 10 },
    treatText: 'Finn tosses you a tin of bait. "Good luck out there."',
  },
  willa: {
    style: 'a workbench under the window, curls of wood shavings and half-built chairs',
    lines: [
      'Watch the shavings, they get everywhere. I like it that way.',
      'Every chair in here is a prototype. Pick one, they all wobble differently.',
      'I made the whole house myself. Well — the furniture. And the door. And the roof.',
    ],
    treat: { itemId: 'wood', quantity: 15 },
    treatText: 'Willa hands you a bundle of good timber. "Offcuts. Too nice to burn."',
  },
  tobin: {
    style: 'a rocking chair by the fire, old farming photos and a ticking clock',
    lines: [
      'Ah, company! Sit, sit. The kettle’s always on.',
      'That photo? Your grandfather and me, the summer the river flooded.',
      'The clock’s been five minutes slow for forty years. I like it that way.',
    ],
    treat: { itemId: 'veggie_soup', quantity: 1 },
    treatText: 'Tobin ladles you a bowl of soup. "Eat, you’re working too hard."',
  },
};
