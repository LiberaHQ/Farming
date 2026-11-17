import type { ItemId } from './items';
import type { NpcId } from './npcs';
import type { ItemAmount } from './recipes';

/** What story objectives are judged on: one player's progress. */
export interface StoryContext {
  found: ReadonlySet<ItemId>;
  /** Villagers you've talked to at least once. */
  met: number;
  mineDepth: number;
  lifetimeEarnings: number;
  buildings: Readonly<Record<string, number>>;
  communityDone: number;
  communityTotal: number;
  hearts: number[];
}

export interface StoryChapter {
  title: string;
  from: string;
  /** What they ask, as shown in the journal. */
  text: string;
  goal: string;
  progress: (c: StoryContext) => [number, number];
  reward: { gold?: number; item?: ItemAmount };
}

const CROPS: ItemId[] = ['turnip', 'carrot', 'pumpkin', 'strawberry', 'potato', 'tomato', 'corn', 'wheat', 'blueberry', 'eggplant', 'snow_yam'];

/**
 * The main story: the valley was quiet for years. Help it come back to life,
 * one chapter at a time. Each chapter's reward arrives by mail with the next.
 */
export const STORY: readonly StoryChapter[] = [
  {
    title: 'A new start',
    from: 'Mira',
    text: "Your grandfather's fields have been quiet a long time. Let's see something grow there again!",
    goal: 'Harvest your first crop',
    progress: (c) => [CROPS.some((id) => c.found.has(id)) ? 1 : 0, 1],
    reward: { gold: 100, item: { itemId: 'strawberry_seeds', quantity: 5 } },
  },
  {
    title: 'Neighbours',
    from: 'Mira',
    text: 'Everyone in the market has been asking about the new farmer. Go and say hello.',
    goal: 'Talk to all five merchants',
    progress: (c) => [Math.min(5, c.met), 5],
    reward: { gold: 150, item: { itemId: 'bread', quantity: 3 } },
  },
  {
    title: 'The old mine',
    from: 'Bram',
    text: "Nobody's been down the old mine in years. If you're brave, bring back word of floor five.",
    goal: 'Reach floor 5 of the mine',
    progress: (c) => [Math.min(5, c.mineDepth), 5],
    reward: { gold: 300, item: { itemId: 'sword', quantity: 1 } },
  },
  {
    title: 'Making a living',
    from: 'Mira',
    text: 'A farm needs income. Fill that shipping bin by your cottage — it sells overnight.',
    goal: 'Earn 2,000g in total',
    progress: (c) => [Math.min(2000, c.lifetimeEarnings), 2000],
    reward: { gold: 200, item: { itemId: 'sprinkler', quantity: 2 } },
  },
  {
    title: 'A barn for the valley',
    from: 'Willa',
    text: "The valley hasn't heard a cow in ages. Build a barn and I'll throw in some hay.",
    goal: 'Build a barn',
    progress: (c) => [Math.min(1, c.buildings.barn ?? 0), 1],
    reward: { gold: 300, item: { itemId: 'hay', quantity: 20 } },
  },
  {
    title: 'Mending the market',
    from: 'Willa',
    text: 'The notice board lists community projects. Help finish two and the market will feel alive again.',
    goal: 'Finish 2 community projects',
    progress: (c) => [Math.min(2, c.communityDone), 2],
    reward: { gold: 1000, item: { itemId: 'lamp_post', quantity: 3 } },
  },
  {
    title: 'The slime king',
    from: 'Bram',
    text: 'Something big lives on floor ten. Clear it out and the deep mine opens up.',
    goal: 'Defeat King Slime (reach floor 11)',
    progress: (c) => [Math.min(11, c.mineDepth), 11],
    reward: { gold: 800, item: { itemId: 'power_ring', quantity: 1 } },
  },
  {
    title: 'Heart of the valley',
    from: 'Rosa',
    text: "A valley is its people. Become good friends with a few of us — we'd like that.",
    goal: 'Reach 6 hearts with 3 villagers',
    progress: (c) => [Math.min(3, c.hearts.filter((h) => h >= 6).length), 3],
    reward: { gold: 1000, item: { itemId: 'golden_egg', quantity: 1 } },
  },
  {
    title: 'Legend of the valley',
    from: 'Tobin',
    text: 'They say whoever reaches the bottom of the mine and finishes every project will be remembered forever.',
    goal: 'Reach floor 30 and finish every community project',
    progress: (c) => [(c.mineDepth >= 30 ? 1 : 0) + (c.communityDone >= c.communityTotal ? 1 : 0), 2],
    reward: { gold: 5000, item: { itemId: 'lucky_ring', quantity: 1 } },
  },
];

/** Personal requests villagers make as you become friends (one at a time). */
export interface ArcStep {
  hearts: number;
  text: string;
  want: ItemAmount;
  reward: { gold?: number; item?: ItemAmount };
  thanks: string;
}

export const ARCS: Partial<Record<NpcId, readonly ArcStep[]>> = {
  mira: [
    { hearts: 3, text: "I'm trying a new corn soup for the stall. Could you spare some corn?", want: { itemId: 'corn', quantity: 5 }, reward: { item: { itemId: 'blueberry_seeds', quantity: 10 } }, thanks: 'Perfect! Take some blueberry seeds — they keep producing all summer.' },
    { hearts: 5, text: 'Juice sells like mad in summer. Bring me three bottles?', want: { itemId: 'juice', quantity: 3 }, reward: { gold: 500 }, thanks: "You're a natural. Here's your cut." },
    { hearts: 7, text: "My mother kept a golden egg on her mantel. I'd love one of my own.", want: { itemId: 'golden_egg', quantity: 1 }, reward: { item: { itemId: 'house_plant', quantity: 1 } }, thanks: "It's beautiful. This plant was hers — I want you to have it." },
  ],
  rosa: [
    { hearts: 3, text: 'My flour sacks are empty. Ten wheat would save my week.', want: { itemId: 'wheat', quantity: 10 }, reward: { item: { itemId: 'bread', quantity: 5 } }, thanks: 'Fresh loaves, on the house!' },
    { hearts: 5, text: 'I want to try a cheese tart. Three cheeses?', want: { itemId: 'cheese', quantity: 3 }, reward: { gold: 600 }, thanks: 'Mmm. The tart is a hit. Here, for the cheese.' },
    { hearts: 7, text: 'Bake-off season. Could you make me a pumpkin pie to study?', want: { itemId: 'pumpkin_pie', quantity: 1 }, reward: { item: { itemId: 'table', quantity: 1 } }, thanks: 'Better than mine! Have my old kitchen table — I bought a new one.' },
  ],
  bram: [
    { hearts: 3, text: 'Iron is scarce. Bring me ten iron ore and I owe you one.', want: { itemId: 'iron_ore', quantity: 10 }, reward: { gold: 400 }, thanks: 'Good, heavy ore. Pleasure doing business.' },
    { hearts: 5, text: "I'm forging a wedding ring for a client. Five gold ore?", want: { itemId: 'gold_ore', quantity: 5 }, reward: { gold: 900 }, thanks: "They'll be thrilled. Here's your share." },
    { hearts: 7, text: 'Amethysts focus a forge flame. Three of them, if you find them.', want: { itemId: 'amethyst', quantity: 3 }, reward: { item: { itemId: 'guard_ring', quantity: 1 } }, thanks: 'I made you this with the first spark. It will keep you safe down there.' },
  ],
  finn: [
    { hearts: 3, text: "Haven't seen a tuna in years. Could you catch me two?", want: { itemId: 'tuna', quantity: 2 }, reward: { item: { itemId: 'crab_pot', quantity: 2 } }, thanks: 'Beauties! Take these crab pots — set them in any water.' },
    { hearts: 5, text: "A pufferfish for my aquarium. Careful, they're prickly.", want: { itemId: 'pufferfish', quantity: 1 }, reward: { gold: 700 }, thanks: 'Ha! Look at him puff. Thank you!' },
    { hearts: 7, text: 'The golden carp is a legend. If you ever catch one…', want: { itemId: 'golden_carp', quantity: 1 }, reward: { item: { itemId: 'lucky_ring', quantity: 1 } }, thanks: "I can't believe it. My grandmother's lucky ring — it's yours now." },
  ],
  willa: [
    { hearts: 3, text: "I've got a big order of benches. A hundred wood would do it.", want: { itemId: 'wood', quantity: 100 }, reward: { gold: 350 }, thanks: 'Lovely grain. Thanks, friend.' },
    { hearts: 5, text: 'Cloth for upholstery — three bolts?', want: { itemId: 'cloth', quantity: 3 }, reward: { item: { itemId: 'rug', quantity: 1 } }, thanks: 'I wove the scraps into this rug for you.' },
    { hearts: 7, text: 'Driftwood makes the prettiest frames. Ten pieces?', want: { itemId: 'driftwood', quantity: 10 }, reward: { item: { itemId: 'painting', quantity: 1 } }, thanks: "Here's the first frame I made — with a painting of the valley." },
  ],
};

/** First-day tips, shown one at a time until done or skipped. */
export const TUTORIAL = [
  { id: 'move', text: 'Walk around with WASD or the arrow keys (hold Shift to run).' },
  { id: 'plant', text: 'Select the turnip seeds (hotbar) and press Space facing the tilled soil next to your cottage.' },
  { id: 'water', text: 'Select the watering can and press Space on the seeds to water them. Refill it at any pond.' },
  { id: 'wood', text: 'Chop a tree with the axe for wood (Space while facing it).' },
  { id: 'bag', text: 'Open your backpack with I to see everything you carry.' },
  { id: 'mail', text: 'Check your mailbox next to the cottage (E) — the villagers have written.' },
  { id: 'talk', text: 'Walk west to the market and talk to a villager (E).' },
  { id: 'journal', text: 'Open your journal with Q to follow the story and villager requests.' },
  { id: 'sleep', text: "When you're tired, go into your cottage and get into bed (E) to start a new day." },
] as const;

export type TutorialStep = (typeof TUTORIAL)[number]['id'];
