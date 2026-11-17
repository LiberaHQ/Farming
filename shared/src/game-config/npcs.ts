import type { CharacterAppearance } from '../types/player';
import type { ItemId } from './items';
import type { ItemAmount } from './recipes';
import type { Season, WeatherKind } from './time';

export type NpcId = 'mira' | 'tobin' | 'rosa' | 'bram' | 'finn' | 'willa';

export interface ShopListing {
  itemId: ItemId;
  price: number;
}

/** A stall's stock, what it buys, and fixed swaps. */
export interface ShopDef {
  /** Which stall art this merchant uses. */
  stallVariant: number;
  title: string;
  /** Items for sale (Mira's seed stock also follows season/unlock rules). */
  sells: ShopListing[];
  /** Items this merchant buys, at these prices. `'any'` = anything with a sell price, at its base price. */
  buys: ShopListing[] | 'any';
  /** Swap offers: give these, receive that. */
  barter: Array<{ give: ItemAmount[]; get: ItemAmount }>;
}

export interface NpcDef {
  id: NpcId;
  name: string;
  role: 'merchant' | 'villager';
  /** One line shown under the name. */
  title: string;
  appearance: CharacterAppearance;
  /** Minutes of day the NPC is out and about (at their stall, for merchants). */
  hours: { from: number; to: number };
  shop?: ShopDef;
  gifts: { loved: ItemId[]; liked: ItemId[] };
  lines: {
    general: readonly string[];
    weather?: Partial<Record<WeatherKind, readonly string[]>>;
    season?: Partial<Record<Season, readonly string[]>>;
    /** Said once the player has at least 4 hearts with them. */
    friend?: readonly string[];
  };
  /** Short remarks shown in speech bubbles while they go about their day. */
  chatter: readonly string[];
}

const look = (skin: string, skinShade: string, hair: string, hairLight: string, shirt: string, shirtDark: string, pants: string, pantsDark: string): CharacterAppearance => ({
  skin,
  skinShade,
  hair,
  hairLight,
  shirt,
  shirtDark,
  pants,
  pantsDark,
  shoes: '#2b1f1a',
});

export const NPCS: Record<NpcId, NpcDef> = {
  mira: {
    id: 'mira',
    name: 'Mira',
    role: 'merchant',
    title: 'Seeds & general goods',
    appearance: look('#c98e68', '#a8704f', '#2d2433', '#4a3b52', '#3f8c6e', '#2c6a52', '#6b4a3a', '#4e3529'),
    hours: { from: 8 * 60, to: 18 * 60 },
    shop: {
      stallVariant: 0,
      title: "Mira's Stall",
      sells: [
        { itemId: 'duck', price: 600 },
        { itemId: 'rabbit', price: 900 },
        { itemId: 'bouquet', price: 200 },
        { itemId: 'turnip_seeds', price: 10 },
        { itemId: 'carrot_seeds', price: 20 },
        { itemId: 'pumpkin_seeds', price: 45 },
        { itemId: 'strawberry_seeds', price: 40 },
        { itemId: 'potato_seeds', price: 25 },
        { itemId: 'tomato_seeds', price: 35 },
        { itemId: 'corn_seeds', price: 45 },
        { itemId: 'wheat_seeds', price: 8 },
        { itemId: 'blueberry_seeds', price: 50 },
        { itemId: 'eggplant_seeds', price: 30 },
        { itemId: 'snow_yam_seeds', price: 40 },
        { itemId: 'chicken', price: 120 },
        { itemId: 'cherry_sapling', price: 500 },
        { itemId: 'peach_sapling', price: 750 },
        { itemId: 'apple_sapling', price: 600 },
        { itemId: 'hay', price: 8 },
        { itemId: 'sheep', price: 450 },
        { itemId: 'cow', price: 600 },
        { itemId: 'horse', price: 2500 },
      ],
      buys: 'any',
      barter: [{ give: [{ itemId: 'fiber', quantity: 10 }], get: { itemId: 'turnip_seeds', quantity: 3 } }],
    },
    gifts: { loved: ['moon_bloom', 'pumpkin', 'pumpkin_pie'], liked: ['carrot', 'turnip', 'berry_jam'] },
    lines: {
      general: [
        'Fresh seeds, fair prices. Take a look!',
        'Bring me your harvest — I pay well for good produce.',
        'Pumpkins fetch the best price, if you have the patience.',
        'A watered field is a happy field.',
      ],
      weather: {
        rain: ['Rain saves you a trip to the river, at least.'],
        snow: ['Nothing grows in this cold. Good season to gather wood.'],
      },
      season: {
        spring: ['Spring is turnip season. Plant early!'],
        summer: ['Carrots and pumpkins love the summer sun.'],
        fall: ['Last chance for crops before the frost.'],
      },
      friend: ["You're my best customer, you know. I set aside the good seeds for you."],
    },
    chatter: ['Seeds! Fresh seeds!', 'Lovely day for planting.', 'Hmm, inventory time…'],
  },
  rosa: {
    id: 'rosa',
    name: 'Rosa',
    role: 'merchant',
    title: 'Baker',
    appearance: look('#f2c39c', '#d99d78', '#b8492e', '#d86c4c', '#e8e2d4', '#bdb5a3', '#8a5aa8', '#6a4084'),
    hours: { from: 7 * 60, to: 16 * 60 },
    shop: {
      stallVariant: 1,
      title: "Rosa's Bakery",
      sells: [
        { itemId: 'bread', price: 30 },
        { itemId: 'berry_jam', price: 90 },
        { itemId: 'pumpkin_pie', price: 380 },
      ],
      buys: [
        { itemId: 'egg', price: 40 },
        { itemId: 'berries', price: 11 },
        { itemId: 'pumpkin', price: 175 },
        { itemId: 'carrot', price: 50 },
        { itemId: 'turnip', price: 28 },
      ],
      barter: [
        { give: [{ itemId: 'egg', quantity: 2 }], get: { itemId: 'bread', quantity: 3 } },
        { give: [{ itemId: 'berries', quantity: 6 }], get: { itemId: 'berry_jam', quantity: 1 } },
        { give: [{ itemId: 'painted_egg', quantity: 8 }], get: { itemId: 'golden_egg', quantity: 1 } },
      ],
    },
    gifts: { loved: ['moon_bloom', 'pumpkin', 'egg'], liked: ['berries', 'berry_jam', 'carrot'] },
    lines: {
      general: [
        'Bread just out of the oven — smell that!',
        'Eggs make everything better. Do you keep chickens?',
        'Berry jam is my grandmother\'s recipe.',
        'If you bring me pumpkins, I\'ll pay more than Mira. Don\'t tell her.',
      ],
      weather: { rain: ['Rainy days are baking days.'], snow: ['Warm bread on a snowy morning — nothing better.'] },
      season: { fall: ['Pumpkin pie season! My favourite.'] },
      friend: ['Here, I always save the crustiest loaf for you.'],
    },
    chatter: ['Mmm, cinnamon…', 'Fresh bread!', 'Oven\'s nice and hot.'],
  },
  bram: {
    id: 'bram',
    name: 'Bram',
    role: 'merchant',
    title: 'Blacksmith',
    appearance: look('#8d5a3c', '#70442c', '#2d2433', '#4a3b52', '#3d3d46', '#2a2a31', '#5e5243', '#463d31'),
    hours: { from: 9 * 60, to: 17 * 60 },
    shop: {
      stallVariant: 2,
      title: "Bram's Forge",
      sells: [
        { itemId: 'copper_axe', price: 260 },
        { itemId: 'copper_pickaxe', price: 260 },
        { itemId: 'leather_armor', price: 600 },
        { itemId: 'iron_armor', price: 2500 },
        { itemId: 'sword', price: 120 },
        { itemId: 'sprinkler', price: 180 },
        { itemId: 'lamp_post', price: 90 },
      ],
      buys: [
        { itemId: 'stone', price: 4 },
        { itemId: 'copper_ore', price: 10 },
        { itemId: 'iron_ore', price: 18 },
        { itemId: 'gold_ore', price: 36 },
        { itemId: 'amethyst', price: 70 },
        { itemId: 'slime', price: 6 },
      ],
      barter: [
        { give: [{ itemId: 'copper_ore', quantity: 8 }], get: { itemId: 'sprinkler', quantity: 1 } },
        { give: [{ itemId: 'stone', quantity: 20 }], get: { itemId: 'lamp_post', quantity: 1 } },
      ],
    },
    gifts: { loved: ['moon_bloom', 'copper_ore', 'golden_carp', 'gold_ore', 'golden_spike'], liked: ['stone', 'grilled_fish', 'bread', 'iron_ore', 'coal'] },
    lines: {
      general: [
        'Copper sings when you strike it right.',
        'Bring me ore, I\'ll make it worth your while.',
        'A good tool is half the work.',
        'Sprinklers save your back. Trust me.',
      ],
      weather: { rain: ['Forge keeps me dry. You should try it.'], snow: ['Cold hands, hot iron.'] },
      friend: ["You've got a smith's patience. I'll give you a fair price, always."],
    },
    chatter: ['*clang*', 'Needs more heat…', 'Fine steel, this.'],
  },
  finn: {
    id: 'finn',
    name: 'Finn',
    role: 'merchant',
    title: 'Fisherman',
    appearance: look('#e0ab83', '#c28a63', '#d9a441', '#f0c96a', '#5a6f9e', '#435580', '#6b7a3a', '#4f5a2a'),
    hours: { from: 6 * 60, to: 15 * 60 },
    shop: {
      stallVariant: 3,
      title: "Finn's Fish Stand",
      sells: [
        { itemId: 'fishing_rod', price: 80 },
        { itemId: 'bait', price: 5 },
        { itemId: 'crab_pot', price: 250 },
        { itemId: 'grilled_fish', price: 90 },
        { itemId: 'oyster_spat', price: 60 },
        { itemId: 'seaweed_spores', price: 25 },
      ],
      buys: [
        { itemId: 'sunfish', price: 24 },
        { itemId: 'trout', price: 55 },
        { itemId: 'catfish', price: 85 },
        { itemId: 'golden_carp', price: 360 },
        { itemId: 'oyster', price: 95 },
      ],
      barter: [{ give: [{ itemId: 'sunfish', quantity: 3 }], get: { itemId: 'grilled_fish', quantity: 2 } }],
    },
    gifts: { loved: ['moon_bloom', 'golden_carp', 'catfish'], liked: ['trout', 'grilled_fish', 'bread'] },
    lines: {
      general: [
        'Cast, wait, and when you see the "!" — reel!',
        'Trout like the cool seasons. Catfish come out at night.',
        'Rain\'s the best fishing weather, believe it or not.',
        'There\'s a golden carp in these waters. I\'ve seen it. Once.',
        'Those tide beds on the beach only show when the tide\'s out — about seven to eleven, morning and evening.',
      ],
      weather: { rain: ['Ha! Rain! The catfish will be biting.'] },
      season: { winter: ['Fish are slow in winter, but they still bite.'] },
      friend: ['Tell you a secret: the carp likes the river bend at dawn.'],
    },
    chatter: ['Nice ripple there…', 'Fish on!', 'Smells like rain.'],
  },
  willa: {
    id: 'willa',
    name: 'Willa',
    role: 'merchant',
    title: 'Carpenter',
    appearance: look('#f0c8a8', '#d2a283', '#6e3f22', '#925a32', '#6b7a3a', '#4f5a2a', '#3f5c8c', '#2e466c'),
    hours: { from: 9 * 60, to: 18 * 60 },
    shop: {
      stallVariant: 4,
      title: "Willa's Workshop",
      sells: [
        { itemId: 'pendant', price: 5000 },
        { itemId: 'fence', price: 12 },
        { itemId: 'rug', price: 120 },
        { itemId: 'table', price: 160 },
        { itemId: 'chair', price: 80 },
        { itemId: 'bookshelf', price: 220 },
        { itemId: 'house_plant', price: 60 },
        { itemId: 'floor_lamp', price: 140 },
        { itemId: 'painting', price: 260 },
        { itemId: 'house_upgrade', price: 2500 },
        { itemId: 'wood_path', price: 6 },
        { itemId: 'chest', price: 120 },
        { itemId: 'bench', price: 70 },
        { itemId: 'flower_pot', price: 45 },
        { itemId: 'scarecrow', price: 60 },
      ],
      buys: [
        { itemId: 'wood', price: 4 },
        { itemId: 'fiber', price: 2 },
      ],
      barter: [
        { give: [{ itemId: 'wood', quantity: 15 }], get: { itemId: 'chest', quantity: 1 } },
        { give: [{ itemId: 'wood', quantity: 8 }, { itemId: 'fiber', quantity: 4 }], get: { itemId: 'scarecrow', quantity: 1 } },
      ],
    },
    gifts: { loved: ['moon_bloom', 'wood', 'pumpkin_pie'], liked: ['fiber', 'omelette', 'veggie_soup'] },
    lines: {
      general: [
        'Wood\'s honest. Treat it right and it lasts forever.',
        'A bench by the pond — now that\'s a farm.',
        'Scarecrows don\'t do much, but they\'re good company.',
        'Bring me timber and I\'ll build you something nice.',
      ],
      season: { spring: ['Spring\'s for building fences.'], fall: ['Stack your firewood before winter!'] },
      friend: ['I carved you something… well, not yet. Soon!'],
    },
    chatter: ['Measure twice…', 'Smells like pine.', '*hammering*'],
  },
  tobin: {
    id: 'tobin',
    name: 'Tobin',
    role: 'villager',
    title: 'Retired farmer',
    appearance: look('#f0c8a8', '#d2a283', '#c9c2b5', '#e6e1d8', '#5a6f9e', '#435580', '#5e5243', '#463d31'),
    hours: { from: 9 * 60, to: 19 * 60 },
    gifts: { loved: ['moon_bloom', 'veggie_soup', 'turnip'], liked: ['bread', 'berries', 'carrot'] },
    lines: {
      general: [
        'Morning! I walk this path every day. Keeps the knees working.',
        'The river was wilder when I was young.',
        'Chop a tree and another grows back. The forest is generous.',
        'Copper hides in the rocks with orange streaks.',
        'Mira will sell you chickens once she trusts your coin.',
        'Check the notice board — folks always need a hand.',
      ],
      weather: {
        rain: ['Good rain for the crops. Bad rain for my hat.'],
        snow: ['Careful on the bridge, it gets icy.'],
      },
      season: {
        fall: ['Fall colours are my favourite part of the year.'],
        winter: ['Winter is for resting. And for chopping firewood.'],
      },
      friend: ['You remind me of myself at your age. Keep at it.'],
    },
    chatter: ['Lovely day.', 'Hm hm hmm~', 'Ah, my knees…', 'Morning!'],
  },
};

export const NPC_IDS = Object.keys(NPCS) as NpcId[];

/** Friendship: points per heart, max hearts, and what raises them. */
export const FRIENDSHIP = {
  pointsPerHeart: 50,
  maxHearts: 10,
  talk: 10,
  giftLoved: 80,
  giftLiked: 40,
  giftNeutral: 15,
  /** Shop discount per 2 hearts (capped). */
  discountPerTwoHearts: 0.05,
  maxDiscount: 0.2,
} as const;

export function heartsFor(points: number): number {
  return Math.min(FRIENDSHIP.maxHearts, Math.floor(Math.max(0, points) / FRIENDSHIP.pointsPerHeart));
}

export function discountFor(points: number): number {
  return Math.min(FRIENDSHIP.maxDiscount, Math.floor(heartsFor(points) / 2) * FRIENDSHIP.discountPerTwoHearts);
}

/** Price after a friendship discount (buying) — always at least 1g. */
export const discounted = (price: number, points: number) => Math.max(1, Math.round(price * (1 - discountFor(points))));
