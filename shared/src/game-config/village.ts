import type { ItemAmount } from './recipes';
import type { NpcId } from './npcs';
import type { Season } from './time';
import { dayOfSeason, seasonOfDay } from './time';

// ---------- Festivals ----------

export type FestivalId = 'egg_festival' | 'fishing_derby' | 'harvest_fair' | 'winter_lights';

export interface FestivalDef {
  id: FestivalId;
  name: string;
  season: Season;
  /** Day of the season. */
  day: number;
  /** One line for the notice board and the morning toast. */
  tagline: string;
  /** What to do. */
  details: string;
}

export const FESTIVALS: Record<FestivalId, FestivalDef> = {
  egg_festival: {
    id: 'egg_festival',
    name: 'Egg Festival',
    season: 'spring',
    day: 8,
    tagline: 'Painted eggs are hidden around the market!',
    details: 'Find painted eggs hidden around the market. Rosa swaps 8 of them for a Golden Egg.',
  },
  fishing_derby: {
    id: 'fishing_derby',
    name: 'Fishing Derby',
    season: 'summer',
    day: 8,
    tagline: 'Finn pays double for every fish today!',
    details: 'Catch what you can — Finn pays double for fish all day.',
  },
  harvest_fair: {
    id: 'harvest_fair',
    name: 'Harvest Fair',
    season: 'fall',
    day: 8,
    tagline: 'Enter your best crop at the notice board!',
    details: 'Enter one crop at the notice board. The judges pay three times its value and award a ribbon.',
  },
  winter_lights: {
    id: 'winter_lights',
    name: 'Festival of Winter Lights',
    season: 'winter',
    day: 8,
    tagline: 'Lanterns at the market — gifts mean twice as much today.',
    details: 'Lanterns light the market tonight, and every gift earns double friendship.',
  },
};

/** The festival on a given day, if any. */
export function festivalOn(day: number): FestivalDef | null {
  const season = seasonOfDay(day);
  const dos = dayOfSeason(day);
  return Object.values(FESTIVALS).find((f) => f.season === season && f.day === dos) ?? null;
}

/** Painted eggs hidden for the Egg Festival. */
export const EGG_HUNT = { count: 10, trade: 8 } as const;

// ---------- Heart events ----------

export interface HeartEvent {
  hearts: number;
  lines: readonly string[];
  /** Sent by mail afterwards. */
  gift?: ItemAmount;
}

export const HEART_EVENTS: Record<NpcId, readonly HeartEvent[]> = {
  mira: [
    { hearts: 2, lines: ['Can I tell you something? I almost closed this stall last spring.', 'Then you showed up and started farming. Business has never been better!'], gift: { itemId: 'carrot_seeds', quantity: 5 } },
    { hearts: 4, lines: ['My grandmother started this stall with one sack of turnip seeds.', 'I keep her old seed tin under the counter. For luck.', "I'd like you to have some of what I saved. Plant them well."], gift: { itemId: 'pumpkin_seeds', quantity: 5 } },
    { hearts: 6, lines: ["You know what? You're not a customer anymore.", "You're a friend. The best one this market has."], gift: { itemId: 'golden_carp', quantity: 1 } },
    { hearts: 8, lines: ['I close the stall early sometimes, just to watch the sunset over your fields.', "Don't laugh. It's the best view in the valley."], gift: { itemId: 'strawberry_seeds', quantity: 10 } },
    { hearts: 10, lines: ['I used to think this market was all I needed.', 'Now I count the days by when you come by. …There. I said it.'], gift: { itemId: 'blueberry_tart', quantity: 2 } },
  ],
  rosa: [
    { hearts: 2, lines: ['I burned three loaves this morning.', "Don't tell anyone. Here — the good ones are for you."], gift: { itemId: 'bread', quantity: 3 } },
    { hearts: 4, lines: ['Every pie I bake has a little secret ingredient.', '…It’s cinnamon. Everyone knows. But I like that you listened.'], gift: { itemId: 'pumpkin_pie', quantity: 1 } },
    { hearts: 6, lines: ["When I was little I wanted to bake for the whole valley.", "Now I do. And you're my favourite taster."], gift: { itemId: 'berry_jam', quantity: 3 } },
    { hearts: 8, lines: ["I made a little loaf shaped like your cottage. It's silly.", 'Eat it before it goes stale. Or keep it. Either way, it’s yours.'], gift: { itemId: 'bread', quantity: 5 } },
    { hearts: 10, lines: ['Some mornings I bake two of everything without thinking.', "One for the stall… and one for you. I think that means something."], gift: { itemId: 'pumpkin_pie', quantity: 2 } },
  ],
  bram: [
    { hearts: 2, lines: ['Hmph. You swing a pickaxe like you mean it.', 'Take this ore. Better in your hands than gathering dust.'], gift: { itemId: 'copper_ore', quantity: 10 } },
    { hearts: 4, lines: ['My father forged the bridge rails over the river.', "Forty years and they haven't rusted. That's what good work looks like."], gift: { itemId: 'iron_ore', quantity: 6 } },
    { hearts: 6, lines: ["I don't say this often.", "You've earned a smith's respect. Come to me if anything ever needs mending."], gift: { itemId: 'gold_ore', quantity: 4 } },
    { hearts: 8, lines: ['I made a ring once. Never gave it to anyone.', "Funny thing to tell you. Forget I said it. …Don't forget I said it."], gift: { itemId: 'amethyst', quantity: 2 } },
    { hearts: 10, lines: ['The forge is warmer when you visit.', "I'm not good with words. Iron, I understand. You… I'd like to."], gift: { itemId: 'iron_armor', quantity: 1 } },
  ],
  finn: [
    { hearts: 2, lines: ['Shh — the trout are rising.', '…There. Gone. You have to be patient with the river.'], gift: { itemId: 'grilled_fish', quantity: 2 } },
    { hearts: 4, lines: ['I once saw a golden carp as long as my arm.', "Nobody believes me. You do, though, don't you?"], gift: { itemId: 'trout', quantity: 3 } },
    { hearts: 6, lines: ["Here's a secret: catfish bite best in the rain at night.", "Don't tell the other anglers. Not that there are any."], gift: { itemId: 'catfish', quantity: 3 } },
    { hearts: 8, lines: ['Want to watch the tide come in? I know a spot on the pier.', 'Best seat in the valley. Only two people know about it now.'], gift: { itemId: 'tuna', quantity: 2 } },
    { hearts: 10, lines: ["Fish are easy. People aren't.", "But with you it's like a calm morning on the water. I don't want it to end."], gift: { itemId: 'crab_pot', quantity: 2 } },
  ],
  willa: [
    { hearts: 2, lines: ['Wood remembers how it grew. You can see it in the grain.', 'Here, some offcuts. Too nice to burn.'], gift: { itemId: 'wood', quantity: 25 } },
    { hearts: 4, lines: ['I built half the benches in this valley.', 'Sit on one sometime and think of me. Or don’t. They’re comfy either way.'], gift: { itemId: 'bench', quantity: 1 } },
    { hearts: 6, lines: ["I've been making something for you.", 'A chest, with your initials carved in. Every farm needs one more chest.'], gift: { itemId: 'chest', quantity: 2 } },
    { hearts: 8, lines: ["I carved your name into the beam of my workshop. Next to mine.", "It's just wood. …It's not just wood."], gift: { itemId: 'table', quantity: 1 } },
    { hearts: 10, lines: ['Every house I build, I imagine who will live in it.', 'Lately I imagine us. Is that strange?'], gift: { itemId: 'bookshelf', quantity: 1 } },
  ],
  tobin: [
    { hearts: 2, lines: ['When I was your age this whole meadow was wheat.', 'Nice to see it farmed again.'], gift: { itemId: 'wheat_seeds', quantity: 10 } },
    { hearts: 4, lines: ['My knees tell me when rain is coming.', 'Tomorrow? Maybe. Ask me again in the morning.'], gift: { itemId: 'veggie_soup', quantity: 1 } },
    { hearts: 6, lines: ["You've made an old man very happy, you know.", 'This valley needed someone like you.'], gift: { itemId: 'amethyst', quantity: 2 } },
    { hearts: 8, lines: ['I knew your grandfather well. You have his stubborn streak.', 'He left something with me, for when you were ready.'], gift: { itemId: 'gold_ore', quantity: 5 } },
    { hearts: 10, lines: ["You're family now, you know. As good as.", "Whatever happens, this old man's door is always open."], gift: { itemId: 'golden_egg', quantity: 1 } },
  ],
};

// ---------- Mail ----------

export interface Letter {
  id: number;
  day: number;
  from: string;
  subject: string;
  body: string;
  attachment?: ItemAmount;
  read: boolean;
  claimed: boolean;
}

export const MAX_LETTERS = 30;

/** Little things friends (4+ hearts) sometimes send. */
export const FRIEND_GIFTS: Record<NpcId, ItemAmount> = {
  mira: { itemId: 'turnip_seeds', quantity: 5 },
  rosa: { itemId: 'bread', quantity: 2 },
  bram: { itemId: 'copper_ore', quantity: 5 },
  finn: { itemId: 'grilled_fish', quantity: 1 },
  willa: { itemId: 'wood', quantity: 15 },
  tobin: { itemId: 'berries', quantity: 6 },
};
/** Chance per friend per morning. */
export const FRIEND_GIFT_CHANCE = 0.12;

// ---------- Romance ----------

/** Give a bouquet at this many hearts to start dating; a pendant at the max to propose. */
export const ROMANCE = {
  bouquetHearts: 8,
  pendantHearts: 10,
  /** Days from the proposal to the wedding. */
  weddingDelay: 3,
} as const;

/** What your spouse says at home. */
export const SPOUSE_LINES: readonly string[] = [
  "Morning! I made coffee. Well, I tried.",
  'I love this little house. Our little house.',
  "Don't work too hard today. Or do — I'll have dinner ready.",
  'I watered a few things on my way in. Hope that helps!',
  'Sometimes I just stand at the window and watch the crops grow. Is that weird?',
  'You look tired. Come here.',
];
