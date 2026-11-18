import type { AppearanceChoice } from '../game-config';
import type { CropId } from '../game-config/crops';
import type { ItemId } from '../game-config/items';
import type { LivestockKind, LivestockSave } from '../game-config/livestock';
import type { InteriorSave } from '../game-config/interior';
import type { CommunityGoalId, CommunityProgress } from '../game-config/community';
import type { PlaceableKind } from '../game-config/placeables';
import type { ItemAmount } from '../game-config/recipes';
import type { DayLength, WeatherKind } from '../game-config/time';
import type { Direction } from '../types/player';
import type { CabinSave, ChickenSave, CollectionSave, FruitTreeSave, PlacedSave, PlotSave, QuestSave, ResourceSave, SaveData, SlotData, SocialSave } from '../types/save';
import type { FruitTreeKind } from '../game-config/orchard';
import type { MineDashKit, MineDashScore, MineDashSummary, MineDashVariant, TournamentTier } from '../game-config/tournaments';

/**
 * The co-op wire protocol (Socket.IO). The server holds the shared world —
 * soil and crops, trees and rocks, buildings and chests, chickens, the clock
 * and the weather — and applies every change to it. Each player's own things
 * (backpack, gold, energy, friendships) travel as `CoopPlayerState`.
 */

/** Emotes players can show (an emoji bubble over their head). */
export const EMOTES = ['👋', '❤️', '😂', '😮', '😢', '😠', '👍', '🎉'] as const;

export const COOP = {
  maxPlayers: 4,
  /** Position updates per second, each way. */
  positionRate: 10,
  chatMaxLength: 200,
  tradeMaxStacks: 6,
  codeLength: 6,
} as const;

/** Items lying in the shared world that anyone can pick up (eggs laid by chickens). */
export interface WorldDrop {
  id: number;
  itemId: ItemId;
  quantity: number;
  x: number;
  y: number;
}

/** Everything the players share: a save without the player-specific parts. */
export interface SharedWorldState {
  seed: string;
  time: { day: number; minute: number };
  weather: WeatherKind;
  resources: ResourceSave;
  farm: PlotSave[];
  placed: PlacedSave[];
  chickens: ChickenSave[];
  drops: WorldDrop[];
  livestock?: LivestockSave[];
  community?: CommunityProgress;
  cabins?: CabinSave[];
  /** Fruit trees (shared in co-op, like crops). */
  orchard?: FruitTreeSave[];
  /** Open World: each resident's plot of land. */
  claims?: ClaimSave[];
}

/** An Open World resident's plot: only they can farm and build on it. */
export interface ClaimSave {
  ownerId: string;
  name: string;
  tx: number;
  ty: number;
  w: number;
  h: number;
  /** When its owner was last in the valley (ms). */
  seen: number;
}

/** One player's own progress in a shared world. */
export interface CoopPlayerState {
  player: SaveData['player'];
  social?: SocialSave;
  quests?: QuestSave;
  interior?: InteriorSave;
  collection?: CollectionSave;
  /** The last server gold change this report already includes (see 'wallet:gold'). */
  walletSeq?: number;
}

export interface MemberView {
  id: string;
  name: string;
  host: boolean;
  appearance: AppearanceChoice;
  x: number;
  y: number;
  facing: Direction;
  inBed: boolean;
}

export interface RoomInfo {
  code: string;
  seed: string;
  hostName: string;
}

/** What a married player's spouse did on the shared farm this morning. */
export type SpouseHelp = 'water' | 'hay' | 'breakfast';

/** Room settings the host (or whoever is hosting now) can change. */
export interface RoomSettings {
  /** Listed in the public game browser. */
  public: boolean;
  /** Everyone shares one purse of gold. */
  sharedWallet: boolean;
  /** How long a day lasts; the server's clock runs at this speed for everyone. */
  dayLength: DayLength;
}

/** A public game anyone can join, as listed in the browser. */
export interface LobbyView {
  code: string;
  seed: string;
  hostName: string;
  players: number;
  max: number;
  day: number;
}

export interface CoopJoin {
  room: RoomInfo;
  selfId: string;
  shared: SharedWorldState;
  /** Your progress in this world from last time, or null on your first visit. */
  me: CoopPlayerState | null;
  members: MemberView[];
  settings?: RoomSettings & { leaderId: string };
  /** In the Open World: which valley you're in. */
  valley?: { id: string; name: string };
}

/** A tournament as the board shows it. */
export interface TournamentView {
  id: string;
  tier: TournamentTier;
  variant: MineDashVariant;
  name: string;
  fee: number;
  startsAt: number;
  endsAt: number;
  status: 'open' | 'settled' | 'cancelled';
  entrants: number;
  pool: number;
  myEntries: number;
  myBest: number | null;
  /** Champion tier: may you enter? */
  eligible: boolean;
  top: Array<{ name: string; score: number }>;
}

/** A Mine Dash run the server has started (the seed is the tournament's, revealed now). */
export interface DashStart {
  runId: string;
  seed: string;
  variant: MineDashVariant;
  kit: MineDashKit;
  /** Practice runs don't count and cost nothing. */
  practice: boolean;
  tournamentId: string | null;
}

/** Changes to the shared world a player asks for. The server checks each one against its own state. */
export type WorldOp =
  | { t: 'till'; tx: number; ty: number }
  | { t: 'untill'; tx: number; ty: number }
  | { t: 'plant'; tx: number; ty: number; crop: CropId }
  | { t: 'water'; tx: number; ty: number }
  | { t: 'fertilize'; tx: number; ty: number }
  | { t: 'harvest'; tx: number; ty: number }
  /** The requester landed the final blow on a tree, rock, bush… */
  | { t: 'node'; tx: number; ty: number }
  | { t: 'berries'; tx: number; ty: number }
  | { t: 'place'; kind: PlaceableKind; tx: number; ty: number }
  | { t: 'pickup'; tx: number; ty: number }
  | { t: 'chestPut'; tx: number; ty: number; itemId: ItemId; quantity: number }
  | { t: 'chestTake'; tx: number; ty: number; slot: number; max: number }
  | { t: 'chicken'; x: number; y: number; kind?: 'chicken' | 'duck' | 'rabbit' }
  | { t: 'drop'; id: number }
  /** Put an item in a keg or jar. The server fills in when it'll be ready (`readyAt`). */
  | { t: 'machineLoad'; tx: number; ty: number; itemId: ItemId; readyAt?: number; output?: ItemId }
  | { t: 'machineCollect'; tx: number; ty: number }
  /** Release a cow or sheep at a barn (the server assigns its id and name). */
  | { t: 'livestock'; kind: LivestockKind; barnTx: number; barnTy: number; id?: number; name?: string }
  | { t: 'animalPet'; id: number }
  | { t: 'animalCollect'; id: number }
  | { t: 'barnFeed'; tx: number; ty: number; quantity: number }
  /** Give items to a community project (the server clamps `quantity` to what's still needed). */
  | { t: 'donate'; goal: CommunityGoalId; itemId: ItemId; quantity: number }
  /** Fruit trees: plant a sapling, shake the fruit down (the server says how many), or land the final axe blow. */
  | { t: 'treePlant'; tx: number; ty: number; kind: FruitTreeKind }
  | { t: 'treePick'; tx: number; ty: number }
  | { t: 'treeChop'; tx: number; ty: number };

export type OpAck =
  | {
      ok: true;
      /** Items handed to the requester (picked-up building, chest items, eggs, machine output). */
      grant?: ItemAmount;
      /** chestPut: how many fitted. */
      accepted?: number;
      /** machineLoad: when it'll be ready (game time). */
      readyAt?: number;
      /** machineLoad: what will come out (crab pots roll it). */
      output?: ItemId;
      /** treePick: how much fruit came down. */
      count?: number;
      /** livestock: the new animal's id and name. */
      id?: number;
      name?: string;
    }
  | { ok: false; reason: string };

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface TradeOffer {
  items: ItemAmount[];
  gold: number;
}

/** A player-to-player trade, from one side's point of view. */
export interface TradeView {
  id: string;
  partner: { id: string; name: string };
  mine: TradeOffer;
  theirs: TradeOffer;
  myConfirmed: boolean;
  theirConfirmed: boolean;
  /** 'committing' while items change hands. */
  phase: 'open' | 'committing';
}

export interface ChatMessage {
  from: string | null;
  name: string;
  text: string;
  at: number;
  /** Join/leave/trade notices from the server. */
  system?: boolean;
}

/** [id, x, y, facing, moving (0/1)] */
export type PositionTuple = [string, number, number, Direction, number];

export interface ClientToServerEvents {
  'room:host': (payload: { save: SaveData; public?: boolean; dayLength?: DayLength }, ack: (r: Result<CoopJoin>) => void) => void;
  /** Host only: change room settings. */
  'room:settings': (p: Partial<RoomSettings>) => void;
  'room:join': (payload: { code: string }, ack: (r: Result<CoopJoin>) => void) => void;
  /** Join (or come back to) the Open World: the server picks your valley. */
  'openworld:join': (payload: Record<string, never>, ack: (r: Result<CoopJoin>) => void) => void;
  'tournament:list': (payload: Record<string, never>, ack: (r: Result<{ tournaments: TournamentView[]; ranking: Array<{ name: string; points: number }> }>) => void) => void;
  'tournament:enter': (payload: { id: string }, ack: (r: Result<{ entries: number; gold: number }>) => void) => void;
  'dash:start': (payload: { tournamentId: string | null; kit: MineDashKit }, ack: (r: Result<DashStart>) => void) => void;
  'dash:finish': (payload: { runId: string; summary: MineDashSummary }, ack: (r: Result<{ score: MineDashScore; best: number | null }>) => void) => void;
  'room:leave': () => void;
  'player:move': (p: { x: number; y: number; f: Direction; m: number }) => void;
  'player:anim': (p: { kind: 'swing' | 'pour'; item: ItemId | null }) => void;
  'player:emote': (p: { emote: string }) => void;
  'player:state': (state: CoopPlayerState) => void;
  'world:op': (op: WorldOp, ack: (r: OpAck) => void) => void;
  'sleep:set': (p: { inBed: boolean }) => void;
  'chat:send': (p: { text: string }) => void;
  'trade:request': (p: { to: string }) => void;
  'trade:respond': (p: { from: string; accept: boolean }) => void;
  'trade:offer': (offer: TradeOffer) => void;
  'trade:confirm': () => void;
  'trade:cancel': () => void;
  /** Reply to trade:commit — whether this side could hand over its offer. */
  'trade:ack': (p: { id: string; ok: boolean }) => void;
}

export interface ServerToClientEvents {
  'room:members': (members: MemberView[]) => void;
  'room:positions': (positions: PositionTuple[]) => void;
  'room:closed': (p: { reason: string }) => void;
  'world:op': (p: { op: WorldOp; by: string }) => void;
  'world:chest': (p: { tx: number; ty: number; items: SlotData[] }) => void;
  'world:time': (p: { day: number; minute: number; weather: WeatherKind }) => void;
  /** A new day began: rebuild from this state. `passedOut` = players who weren't in bed. */
  /** `collected`: goods the auto-collectors stored overnight. */
  'world:newday': (p: { shared: SharedWorldState; passedOut: string[]; collected?: number; spouseHelp?: SpouseHelp | null }) => void;
  'player:anim': (p: { id: string; kind: 'swing' | 'pour'; item: ItemId | null }) => void;
  'player:emote': (p: { id: string; emote: string }) => void;
  /** Your reported position was rejected (moved too far); snap back here. */
  'player:correct': (p: { x: number; y: number }) => void;
  'chat:message': (m: ChatMessage) => void;
  'trade:incoming': (p: { from: string; name: string }) => void;
  'trade:state': (t: TradeView | null) => void;
  /** Hand over your side: remove these from your backpack, then reply with trade:ack. */
  'trade:commit': (p: { id: string; give: TradeOffer }) => void;
  'trade:deliver': (p: { id: string; receive: TradeOffer }) => void;
  /** The trade fell through after you handed over: take your side back. */
  'trade:refund': (p: { id: string; refund: TradeOffer }) => void;
  'sleep:status': (p: { inBed: number; total: number }) => void;
  notice: (p: { text: string }) => void;
  'room:settings': (p: RoomSettings & { leaderId: string }) => void;
  /** Shared wallet: the purse everyone spends from. */
  'wallet:gold': (p: { gold: number; seq?: number }) => void;
  /** Open World: claims changed (someone new moved in). */
  'world:claims': (p: { claims: ClaimSave[] }) => void;
  /** A tournament you entered has finished. */
  'tournament:result': (p: { id: string; name: string; rank: number | null; entrants: number; prize: number; refund: number }) => void;
  /** Cabins changed (a new guest got one). */
  'world:cabins': (p: { cabins: CabinSave[] }) => void;
}

/** Splits a full save into the shared world and one player's part. */
export function splitSave(save: SaveData, drops: WorldDrop[] = []): { shared: SharedWorldState; player: CoopPlayerState } {
  return {
    shared: {
      seed: save.seed,
      time: { ...save.time },
      weather: save.weather,
      resources: save.resources,
      farm: save.farm,
      placed: save.placed,
      chickens: save.chickens,
      drops,
      ...(save.livestock ? { livestock: save.livestock } : {}),
      ...(save.community ? { community: save.community } : {}),
      ...(save.cabins ? { cabins: save.cabins } : {}),
      ...(save.orchard ? { orchard: save.orchard } : {}),
    },
    player: { player: save.player, social: save.social, quests: save.quests, interior: save.interior, collection: save.collection },
  };
}

/** Puts a shared world and one player's part back together as a save. */
export function joinSave(shared: SharedWorldState, me: CoopPlayerState, version: SaveData['version'], savedAt: number): SaveData {
  const save: SaveData = {
    version,
    seed: shared.seed,
    savedAt,
    time: { ...shared.time },
    weather: shared.weather,
    player: me.player,
    resources: shared.resources,
    farm: shared.farm,
    placed: shared.placed,
    chickens: shared.chickens,
  };
  if (shared.livestock) save.livestock = shared.livestock;
  if (shared.community) save.community = shared.community;
  if (shared.cabins) save.cabins = shared.cabins;
  if (shared.orchard) save.orchard = shared.orchard;
  if (me.social) save.social = me.social;
  if (me.quests) save.quests = me.quests;
  if (me.interior) save.interior = me.interior;
  if (me.collection) save.collection = me.collection;
  return save;
}
