import type {
  RecipeCategory,
  CarnivalGameId,
  BuffKind,
  CommunityGoalId,
  CommunityProgress,
  AppearanceChoice,
  AppearancePart,
  ChatMessage,
  ItemAmount,
  ItemId,
  WildlifeId,
  Letter,
  MemberView,
  NpcId,
  SaveData,
  Season,
  TerrainName,
  TradeOffer,
  TradeView,
  WeatherKind,
} from '@farming/shared';

/**
 * Two typed channels between the Phaser game and the React UI:
 *
 * - gameEvents   (game → UI): state snapshots and notifications.
 * - gameCommands (UI → game): player intents from menus (move a stack, craft…).
 *
 * The game stays the single source of truth; React renders what it is told and
 * asks the game to change things. Neither file imports Phaser, so React can use
 * them without pulling the engine into the server bundle.
 */

export interface InventorySlotView {
  itemId: ItemId;
  quantity: number;
  /** 1 silver, 2 gold. */
  q?: 1 | 2;
}

export type PanelId = 'inventory' | 'crafting' | 'shop' | 'chest' | 'character' | 'menu' | 'dialogue' | 'map' | 'board' | 'trade' | 'mine' | 'mail' | 'collection' | 'settings' | 'shipping' | 'summary' | 'journal' | 'pet' | 'carnival' | 'calendar';

/** The merchant you're trading with, and what's on offer. */
export interface ShopContext {
  npcId: NpcId;
  name: string;
  title: string;
  shopTitle: string;
  greeting: string;
  hearts: number;
  /** 0–0.2 discount from friendship. */
  discount: number;
  giftedToday: boolean;
  stock: Array<{ itemId: ItemId; price: number; basePrice: number }>;
  /** What they pay per item (only items they buy). */
  offers: Partial<Record<ItemId, number>>;
  barter: Array<{ give: ItemAmount[]; get: ItemAmount }>;
  /** Items they love / like as gifts. */
  loves: ItemId[];
  likes: ItemId[];
}

export interface BoardRequestView {
  index: number;
  npcName: string;
  itemId: ItemId;
  itemName: string;
  quantity: number;
  have: number;
  reward: number;
  text: string;
  done: boolean;
}

export interface FriendView {
  id: NpcId;
  name: string;
  title: string;
  hearts: number;
  progress: number;
  talkedToday: boolean;
  giftedToday: boolean;
}

export interface GameEventMap {
  'world:ready': { seed: string; widthTiles: number; heightTiles: number; objectCount: number };
  'player:tile': { tx: number; ty: number; terrain: TerrainName };
  'player:stats': {
    gold: number;
    lifetimeEarnings: number;
    water: number;
    waterCapacity: number;
    energy: number;
    maxEnergy: number;
    health: number;
    maxHealth: number;
  };
  /** The mine floor the player is on, or null above ground. */
  'mine:floor': { floor: number } | null;
  /** Where you are when not on the farm map (beach, cottage). */
  'area:label': { label: string } | null;
  /** Floors the mine's elevator can take you to. */
  'mine:elevator': { floors: number[] };
  'player:appearance': { choice: AppearanceChoice };
  'world:time': {
    day: number;
    year: number;
    season: Season;
    dayOfSeason: number;
    minute: number;
    clock: string;
    weather: WeatherKind;
    /** True while the merchant is at her stall. */
    shopOpen: boolean;
  };
  'chest:contents': { slots: (InventorySlotView | null)[] };
  dialogue: { speaker: string; text: string; hearts?: number; more?: boolean };
  'mail:list': { letters: Letter[] };
  /** Today's festival, if any (for the board and HUD). */
  'festival:today': { id: string; name: string; tagline: string; details: string; canEnterFair: boolean } | null;
  'shop:context': ShopContext;
  'board:state': { requests: BoardRequestView[]; friends: FriendView[] };
  /** Community projects: items given so far. */
  'community:state': CommunityProgress;
  'player:buffs': Array<{ kind: BuffKind; minutesLeft: number }>;
  'player:equipment': { ring?: ItemId; armor?: ItemId };
  /** Today's date, for the calendar. */
  'calendar:state': { day: number };
  'journal:state': {
    /** The guide: a checklist that points new players at each place and activity. */
    guide?: Array<{ id: string; text: string; hint: string; done: boolean }>;
    chapter: { index: number; total: number; title: string; from: string; text: string; goal: string; have: number; need: number } | null;
    arcs: Array<{ npc: NpcId; name: string; hearts: number; step: { text: string; want: { itemId: ItemId; quantity: number }; have: number; needHearts: number } | null; done: number; total: number }>;
  };
  /** Open crafting on this tab (the stove opens Cooking). */
  'crafting:open': { category: RecipeCategory; kitchen?: boolean } | null;
  /** The emote picker is open. */
  'emote:picker': boolean;
  'tutorial:tip': { index: number; total: number; text: string } | null;
  /** Which stray you're adopting (opens the naming card). */
  'pet:offer': { kind: 'cat' | 'dog' };
  /** What the carnival panel shows: a booth, a game you paid for, or the wheel's result. */
  'carnival:view':
    | { mode: 'tokens' | 'prizes' | 'treats' | 'card' }
    | { mode: 'game'; game: CarnivalGameId; session: number }
    | { mode: 'wheel'; slice: number; label: string };
  /** The carnival card: today's games played, the daily challenge, best scores and golden hour. */
  'carnival:card': {
    played: CarnivalGameId[];
    cardDone: boolean;
    challenge: { game: CarnivalGameId; target: number; tickets: number; done: boolean };
    best: Partial<Record<CarnivalGameId, number>>;
    golden: boolean;
  };
  /** What a finished game paid out (tickets include bonuses). */
  'carnival:outcome': { session: number; score: number; tickets: number; notes: string[]; best: number; newBest: boolean };
  /** The boss on this mine floor, or null. */
  'mine:boss': { name: string; hp: number; maxHp: number } | null;
  /** The shipping bin's contents (opened at the bin). */
  'ship:state': { bin: Array<{ itemId: ItemId; quantity: number; gold: number; q?: 1 | 2 }>; total: number };
  /** Morning report of what the bin sold. */
  'day:summary': { day: number; season: string; items: Array<{ itemId: ItemId; quantity: number; gold: number; q?: 1 | 2 }>; total: number; gold: number } | null;
  'collection:state': { found: ItemId[]; sightings: WildlifeId[]; skills?: { id: string; level: number; into: number; need: number; xp: number }[]; achievements: { id: string; have: number; need: number; earned: boolean }[] };
  /** World map snapshot (data URL) and the player's position on it, in map pixels. */
  /** The minimap's picture of the valley (redrawn now and then), with landmark icons. */
  'minimap:base': { url: string; width: number; height: number; scale: number; icons: { icon: string; x: number; y: number }[] };
  /** Where things are right now, in minimap pixels; null while you're in a side area. */
  'minimap:state': { player: { x: number; y: number }; facing: 'up' | 'down' | 'left' | 'right'; waypoint: { x: number; y: number } | null; dots: { x: number; y: number; kind: 'npc' | 'pet' | 'horse' | 'friend' | 'train' }[] } | null;
  /** Today's goals and your streak. */
  'daily:state': {
    day: number;
    goals: { kind: string; icon: string; text: string; hint: string; have: number; need: number; gold: number; done: boolean }[];
    streak: number;
    best: number;
    allDone: boolean;
    bonus: number;
    next: { days: number; text: string } | null;
  };
  'map:image': { url: string; width: number; height: number; player: { x: number; y: number }; home: { x: number; y: number }; places: { label: string; x: number; y: number }[]; tiles: { width: number; height: number }; waypoint: { x: number; y: number } | null; route: { x: number; y: number }[] };
  /** The map marker you're walking to, or null. */
  'waypoint:info': { tx: number; ty: number; steps: number; direction: string; reachable: boolean } | null;
  'save:info': { hasSave: boolean; savedAt: number | null; storage: string };
  'audio:settings': { master: number; music: number; sfx: number; ambience: number; muted: boolean };
  /** Screen position (CSS px) of the faced object's action button; null = hidden. */
  'interaction:anchor': { x: number; y: number } | null;
  'inventory:changed': { slots: (InventorySlotView | null)[]; selected: number; hotbarSize: number };
  'ui:panel': { panel: PanelId | null };
  'interaction:hint': { action: string | null; key: string | null; blocked: boolean; info?: boolean };
  'perf:fps': { fps: number };
  // Co-op:
  'coop:info': { code: string; seed: string; hostName: string; selfId: string; host: boolean; leader: boolean; public: boolean; sharedWallet: boolean } | null;
  'coop:members': MemberView[];
  'coop:sleep': { inBed: number; total: number } | null;
  'coop:ended': { reason: string };
  'trade:state': TradeView | null;
  // Transient notifications (not replayed to late subscribers):
  'item:collected': { itemId: ItemId; quantity: number; q?: 1 | 2 };
  toast: { text: string };
  'chat:message': ChatMessage;
  'trade:incoming': { from: string; name: string };
  /** The player asked to open this world to friends: the app hosts it with this save. */
  'coop:hostRequest': { save: SaveData; public?: boolean };
}

export interface GameCommandMap {
  'inventory:select': { index: number };
  'inventory:move': { from: number; to: number };
  craft: { recipeId: string };
  'shop:buy': { itemId: ItemId; quantity: number };
  'shop:sell': { slot: number; quantity: number };
  'shop:barter': { index: number };
  'shop:gift': { slot: number };
  'board:deliver': { index: number };
  'community:donate': { goal: CommunityGoalId; itemId: ItemId };
  'ship:add': { slot: number };
  'equip:wear': { slot: number };
  'arc:deliver': { npc: NpcId };
  'pet:adopt': { kind: 'cat' | 'dog'; name: string };
  /** Carnival: buy tokens, trade tickets for a prize, buy a treat, finish or replay a game. */
  'carnival:buy': { tokens: number };
  'carnival:redeem': { index: number };
  'carnival:treat': { itemId: 'cotton_candy' | 'candy_apple' };
  'carnival:result': { session: number; score: number };
  'carnival:again': { game: CarnivalGameId };
  'carnival:open': { mode: 'tokens' | 'prizes' | 'treats' | 'card' };
  'tutorial:skip': Record<string, never>;
  emote: { emote: string };
  'emote:toggle': Record<string, never>;
  'equip:remove': { which: 'ring' | 'armor' };
  'ship:remove': { index: number };
  /** Download the current game as a .json save file. */
  'game:export': Record<string, never>;
  /** Set a marker on the world map (tile coordinates) and show the way there. */
  'waypoint:set': { tx: number; ty: number };
  'waypoint:clear': Record<string, never>;
  'ui:open': { panel: PanelId };
  'ui:close': Record<string, never>;
  'chest:transfer': { from: 'chest' | 'inventory'; slot: number };
  'appearance:set': { part: AppearancePart; index: number };
  'game:save': Record<string, never>;
  'game:new': Record<string, never>;
  /** Save immediately without announcing (leaving the game). */
  'game:flush': Record<string, never>;
  'audio:set': { channel: 'master' | 'music' | 'sfx' | 'ambience'; value: number };
  'audio:mute': Record<string, never>;
  /** The on-screen action button was clicked. */
  'action:perform': { trigger: 'use' | 'interact' };
  /** Eat the food in an inventory slot. */
  'item:eat': { slot: number };
  /** Put an inventory stack (or one of it) on the ground; `screen` is where it was dropped (client px). */
  'item:drop': { slot: number; one?: boolean; screen?: { x: number; y: number } };
  'mail:read': { id: number };
  'mail:claim': { id: number };
  /** Next line of a conversation (click / Space). */
  'dialogue:next': Record<string, never>;
  /** Harvest Fair: enter the crop in this inventory slot. */
  'festival:enter': { slot: number };
  /** Ride the mine elevator to a floor. */
  'mine:enter': { floor: number };
  /** Open this world to friends (co-op). */
  'coop:host': { public?: boolean };
  /** Host only: room settings. */
  'coop:settings': { public?: boolean; sharedWallet?: boolean };
  'chat:send': { text: string };
  /** A text field has keyboard focus: the game stops reading keys meanwhile. */
  'input:typing': { typing: boolean };
  'trade:request': { to: string };
  'trade:respond': { from: string; accept: boolean };
  'trade:offer': TradeOffer;
  'trade:confirm': Record<string, never>;
  'trade:cancel': Record<string, never>;
}

const TRANSIENT_EVENTS = new Set<keyof GameEventMap>(['item:collected', 'toast', 'chat:message', 'trade:incoming', 'coop:hostRequest']);

type Listener<T> = (payload: T) => void;

class Channel<M extends object> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();
  private last = new Map<keyof M, unknown>();

  constructor(private readonly replay: (event: keyof M) => boolean) {}

  /** Subscribes (replaying the latest cached value, if any). Returns an unsubscribe function. */
  on<K extends keyof M>(event: K, listener: Listener<M[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    if (this.last.has(event)) listener(this.last.get(event) as M[K]);
    return () => {
      set.delete(listener as Listener<never>);
    };
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    if (this.replay(event)) this.last.set(event, payload);
    this.listeners.get(event)?.forEach((listener) => (listener as Listener<M[K]>)(payload));
  }

  /** Forget cached values (used when a game instance is destroyed). */
  reset(): void {
    this.last.clear();
  }
}

export const gameEvents = new Channel<GameEventMap>((event) => !TRANSIENT_EVENTS.has(event));
export const gameCommands = new Channel<GameCommandMap>(() => false);
