import { isStorage, PLACEABLES, SILO_CAPACITY, STORAGE_SIZE, type PlaceableKind } from '../game-config/placeables';
import { CROPS, type CropId } from '../game-config/crops';
import { GAME_CONFIG, normalizeAppearance } from '../game-config';
import { MINE } from '../game-config/activities';
import { isMachineKind } from '../game-config/machines';
import { BARN } from '../game-config/livestock';
import { MAX_LETTERS, type Letter } from '../game-config/village';
import { COTTAGE_ROOMS, FURNITURE, FURNITURE_KINDS, type FurnitureKind } from '../game-config/interior';
import { BUFF_INFO, ITEMS, isItemId, type BuffKind, type ItemId } from '../game-config/items';
import { ACHIEVEMENT_IDS } from '../game-config/achievements';
import { isWildlifeId } from '../game-config/wildlife';
import { communityGoal, isCommunityGoalId, type CommunityProgress } from '../game-config/community';
import { TIME_CONFIG, type WeatherKind } from '../game-config/time';
import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../constants/world';
import { NPC_IDS } from '../game-config/npcs';
import { MAX_SKILL_LEVEL, SKILL_IDS, SKILL_XP } from '../game-config/skills';
import { ISLAND_CROP_IDS, ISLAND_PLOTS, MUSEUM_ITEMS, MUSEUM_SET_IDS } from '../game-config/places';
import { SAVE_VERSION, type CarnivalSave, type IslandSave, type QuestSave, type SaveData, type SlotData, type SocialSave } from '../types/save';
import { CARNIVAL_GAME_IDS } from '../game-config/carnival';
import { FRUIT_TREE_MAX_FRUIT, isFruitTreeKind, isQuality } from '../game-config/orchard';
import { DAILY_KINDS, type DailyKind, type DailySave } from '../game-config/daily';
import { MAX_REDEEMED_PARCELS, type HeirloomSave } from '../game-config/heirloom';
import { FERRY_OFFERS_PER_NIGHT, type NightMarketSave } from '../game-config/nightMarket';
import { TIDE_BEDS, TIDE_CROPS, isTideCropId, type TidalSave } from '../game-config/tidal';
import { FREIGHT_MAX_CONTRACTS, FREIGHT_STATUSES, TOWN_IDS, freightUnitPrice, isTownId, type FreightContract, type FreightSave, type FreightStatus } from '../game-config/freight';
import type { WorldObjectKind, WorldObjectSpec } from '../types/world';

/**
 * Server-side sanity check for a save uploaded by a client. It is not
 * anti-cheat for a single-player game; it guarantees the stored data is
 * well-formed, within the game's rules and limits, and safe to load.
 */
export type SaveValidation = { ok: true; data: SaveData } | { ok: false; error: string };

const OBJECT_KINDS: WorldObjectKind[] = ['oak', 'pine', 'rock', 'copperRock', 'bush', 'stump', 'tallGrass', 'stall', 'board', 'mine'];
const WEATHER: WeatherKind[] = ['sunny', 'cloudy', 'rain', 'snow'];
const DIRECTIONS = ['down', 'left', 'right', 'up'] as const;
const MAX_GOLD = 1_000_000_000;
const MAX_NODES = 6_000;
/** Item stacks that can lie on the ground across all areas. */
const MAX_FLOOR_ITEMS = 400;

class Invalid extends Error {}

const fail = (msg: string): never => {
  throw new Invalid(msg);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number, field: string): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fail(`${field} must be an integer in [${min}, ${max}]`);
const num = (v: unknown, min: number, max: number, field: string): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fail(`${field} must be a number in [${min}, ${max}]`);
const arr = (v: unknown, max: number, field: string): unknown[] =>
  Array.isArray(v) && v.length <= max ? v : fail(`${field} must be an array of at most ${max} entries`);
const tileX = (v: unknown, field: string) => int(v, 0, WORLD_WIDTH_TILES - 1, field);
const tileY = (v: unknown, field: string) => int(v, 0, WORLD_HEIGHT_TILES - 1, field);

/** Stacks the shipping bin holds. */
export const BIN_SIZE = 36;

function slot(v: unknown, field: string): SlotData {
  if (v === null || v === undefined) return null;
  if (!isObj(v) || !isItemId(v.itemId)) return fail(`${field}: unknown item`);
  return { itemId: v.itemId, quantity: int(v.quantity, 1, ITEMS[v.itemId].maxStack, `${field}.quantity`), ...(isQuality(v.q) ? { q: v.q } : {}) };
}

function spec(v: unknown, field: string): WorldObjectSpec {
  if (!isObj(v) || !OBJECT_KINDS.includes(v.kind as WorldObjectKind)) return fail(`${field}: unknown object kind`);
  return { kind: v.kind as WorldObjectKind, tx: tileX(v.tx, `${field}.tx`), ty: tileY(v.ty, `${field}.ty`), variant: int(v.variant, 0, 7, `${field}.variant`) };
}

function npcNumbers(v: unknown, min: number, max: number, field: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (v === undefined || v === null) return out;
  if (!isObj(v)) return fail(`${field} must be an object`);
  for (const [k, n] of Object.entries(v)) {
    if (!(NPC_IDS as string[]).includes(k)) continue; // ignore unknown villagers
    out[k] = int(n, min, max, `${field}.${k}`);
  }
  return out;
}

function carnivalSave(v: Record<string, unknown>): CarnivalSave {
  const games = CARNIVAL_GAME_IDS as string[];
  const best: Record<string, number> = {};
  if (isObj(v.best)) for (const [k, n] of Object.entries(v.best)) if (games.includes(k)) best[k] = int(n, 0, 1000, `carnival.best.${k}`);
  return {
    day: int(v.day ?? 0, 0, 200_000, 'carnival.day'),
    played: Array.isArray(v.played) ? v.played.filter((g): g is string => typeof g === 'string' && games.includes(g)).slice(0, games.length) : [],
    card: v.card === true,
    challenge: v.challenge === true,
    fortune: v.fortune === true,
    tip: v.tip === true,
    best,
  };
}

function islandSave(v: Record<string, unknown>): IslandSave {
  const plots = Array.isArray(v.plots) ? v.plots.slice(0, ISLAND_PLOTS) : [];
  return {
    boat: v.boat === true,
    cave: v.cave === true,
    chest: v.chest === true,
    day: int(v.day ?? 0, 0, 200_000, 'island.day'),
    taken: Array.isArray(v.taken) ? v.taken.slice(0, 60).map((n) => int(n, 0, 500, 'island.taken')) : [],
    plots: Array.from({ length: ISLAND_PLOTS }, (_, i) => {
      const p = plots[i];
      if (!isObj(p) || !(ISLAND_CROP_IDS as unknown[]).includes(p.crop)) return null;
      return { crop: p.crop as string, day: int(p.day, 0, 200_000, 'island.plots.day') };
    }),
  };
}

function museumSave(v: Record<string, unknown>): { items: string[]; sets: string[] } {
  const strings = (list: unknown, allowed: readonly string[]) => (Array.isArray(list) ? [...new Set(list.filter((x): x is string => typeof x === 'string' && allowed.includes(x)))] : []);
  return { items: strings(v.items, MUSEUM_ITEMS), sets: strings(v.sets, MUSEUM_SET_IDS) };
}

function petSave(p: Record<string, unknown>, label: string): NonNullable<SocialSave['pet']> {
  return {
    kind: p.kind as 'cat' | 'dog',
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 16) : 'Buddy',
    pettedDay: int(p.pettedDay ?? 0, 0, 200_000, `${label}.pettedDay`),
    love: int(p.love ?? 0, 0, 1000, `${label}.love`),
    ...(p.foundDay === undefined ? {} : { foundDay: int(p.foundDay, 0, 200_000, `${label}.foundDay`) }),
    ...(p.dugDay === undefined ? {} : { dugDay: int(p.dugDay, 0, 200_000, `${label}.dugDay`) }),
    ...(p.dugCount === undefined ? {} : { dugCount: int(p.dugCount, 0, 10, `${label}.dugCount`) }),
  };
}

function daily(v: Record<string, unknown>): DailySave {
  const goals = arr(v.goals ?? [], 3, 'social.daily.goals').map((g, i) => {
    const o = isObj(g) ? g : fail(`social.daily.goals[${i}]`);
    if (!(DAILY_KINDS as readonly unknown[]).includes(o.kind)) return fail(`social.daily.goals[${i}].kind`);
    const need = int(o.need, 1, 100_000, `social.daily.goals[${i}].need`);
    return { kind: o.kind as DailyKind, need, have: int(o.have, 0, need, `social.daily.goals[${i}].have`), gold: int(o.gold, 0, 10_000, `social.daily.goals[${i}].gold`), done: o.done === true };
  });
  const talked = Array.isArray(v.talked) ? v.talked.filter((t): t is string => typeof t === 'string' && (NPC_IDS as string[]).includes(t)).slice(0, NPC_IDS.length) : [];
  const streak = int(v.streak ?? 0, 0, 100_000, 'social.daily.streak');
  return {
    day: int(v.day, 0, 200_000, 'social.daily.day'),
    goals,
    talked: [...new Set(talked)],
    streak,
    best: Math.max(streak, int(v.best ?? 0, 0, 100_000, 'social.daily.best')),
    lastFullDay: int(v.lastFullDay ?? 0, 0, 200_000, 'social.daily.lastFullDay'),
  };
}

function freight(v: Record<string, unknown>): FreightSave {
  const contracts = arr(v.contracts ?? [], FREIGHT_MAX_CONTRACTS, 'social.freight.contracts').map((raw, i): FreightContract => {
    const c = isObj(raw) ? raw : fail(`social.freight.contracts[${i}]`);
    const f = `social.freight.contracts[${i}]`;
    if (!isTownId(c.town)) return fail(`${f}.town`);
    if (!isItemId(c.itemId) || freightUnitPrice(c.itemId) <= 0) return fail(`${f}.itemId`);
    if (!(FREIGHT_STATUSES as readonly unknown[]).includes(c.status)) return fail(`${f}.status`);
    const quantity = int(c.quantity, 1, 999, `${f}.quantity`);
    const opt = (key: string, min: number, max: number) => (c[key] === undefined ? {} : { [key]: int(c[key], min, max, `${f}.${key}`) });
    return {
      id: int(c.id, 1, 1e9, `${f}.id`),
      town: c.town,
      itemId: c.itemId,
      quantity,
      posted: int(c.posted, 0, 200_000, `${f}.posted`),
      due: int(c.due, 0, 200_000, `${f}.due`),
      reward: int(c.reward, 0, 10_000_000, `${f}.reward`),
      loaded: int(c.loaded, 0, quantity, `${f}.loaded`),
      bonus: int(c.bonus, 0, 10_000_000, `${f}.bonus`),
      status: c.status as FreightStatus,
      ...opt('readyDay', 0, 200_000),
      ...opt('readyMinute', 0, 24 * 60 + TIME_CONFIG.dayEndMinute),
      ...opt('shippedDay', 0, 200_000),
      ...opt('shippedMinute', 0, 24 * 60),
      ...opt('pay', 0, 10_000_000),
      ...(c.partial === true ? { partial: true } : {}),
    };
  });
  const done: FreightSave['done'] = {};
  if (isObj(v.done)) for (const t of TOWN_IDS) if (v.done[t] !== undefined) done[t] = int(v.done[t], 0, 1_000_000, `social.freight.done.${t}`);
  const ids = new Set<number>();
  return {
    day: int(v.day ?? 0, 0, 200_000, 'social.freight.day'),
    nextId: int(v.nextId ?? 1, 1, 1e9, 'social.freight.nextId'),
    contracts: contracts.filter((c) => !ids.has(c.id) && ids.add(c.id)),
    done,
    ...(v.intro === true ? { intro: true } : {}),
  };
}

function tidal(v: Record<string, unknown>): TidalSave {
  const beds = Array.isArray(v.beds) ? v.beds.slice(0, TIDE_BEDS) : [];
  return {
    beds: Array.from({ length: TIDE_BEDS }, (_, i) => {
      const b = beds[i];
      if (!isObj(b) || !isTideCropId(b.crop)) return null;
      return {
        crop: b.crop,
        stage: int(b.stage, 1, TIDE_CROPS[b.crop].matureStage, `social.tidal.beds[${i}].stage`),
        tended: int(b.tended, 0, 200_000, `social.tidal.beds[${i}].tended`),
      };
    }),
  };
}

function nightMarket(v: Record<string, unknown>): NightMarketSave {
  const bought = Array.isArray(v.bought) ? v.bought.slice(0, FERRY_OFFERS_PER_NIGHT).map((n) => int(n, 0, FERRY_OFFERS_PER_NIGHT - 1, 'social.nightMarket.bought')) : [];
  return {
    ...(v.intro === true ? { intro: true } : {}),
    day: int(v.day ?? 0, 0, 200_000, 'social.nightMarket.day'),
    bought: [...new Set(bought)],
  };
}

function heirloom(v: Record<string, unknown>): HeirloomSave {
  const redeemed = Array.isArray(v.redeemed) ? v.redeemed.filter((k): k is string => typeof k === 'string' && /^\d{1,10}:\d{1,10}$/.test(k)) : [];
  return {
    ...(v.intro === true ? { intro: true } : {}),
    sent: int(v.sent ?? 0, 0, 1e9, 'social.heirloom.sent'),
    redeemed: [...new Set(redeemed)].slice(-MAX_REDEEMED_PARCELS),
  };
}

function social(v: unknown): SocialSave | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v)) return fail('social must be an object');
  return {
    points: npcNumbers(v.points, 0, 10_000, 'social.points'),
    talkedDay: npcNumbers(v.talkedDay, 0, 200_000, 'social.talkedDay'),
    giftedDay: npcNumbers(v.giftedDay, 0, 200_000, 'social.giftedDay'),
    ...(isObj(v.events) ? { events: heartEvents(v.events) } : {}),
    ...(Array.isArray(v.mail) ? { mail: letters(v.mail) } : {}),
    ...(isObj(v.forest) && Array.isArray(v.forest.taken) ? { forest: { day: int(v.forest.day, 0, 200_000, 'forest.day'), taken: v.forest.taken.slice(0, 40).map((n) => int(n, 0, 200, 'forest.taken')) } } : {}),
    ...(isObj(v.pet) && (v.pet.kind === 'cat' || v.pet.kind === 'dog') ? { pet: petSave(v.pet, 'pet') } : {}),
    ...(isObj(v.pet2) && (v.pet2.kind === 'cat' || v.pet2.kind === 'dog') && isObj(v.pet) && v.pet2.kind !== v.pet.kind ? { pet2: petSave(v.pet2, 'pet2') } : {}),
    ...(v.petOffered === true ? { petOffered: true } : {}),
    ...((NPC_IDS as unknown[]).includes(v.dating) ? { dating: v.dating as string } : {}),
    ...((NPC_IDS as unknown[]).includes(v.spouse) ? { spouse: v.spouse as string } : {}),
    ...(v.weddingDay === undefined ? {} : { weddingDay: int(v.weddingDay, 0, 200_000, 'social.weddingDay') }),
    ...(v.carnivalSpin === undefined ? {} : { carnivalSpin: int(v.carnivalSpin, 0, 200_000, 'social.carnivalSpin') }),
    ...(isObj(v.carnival) ? { carnival: carnivalSave(v.carnival) } : {}),
    ...(isObj(v.island) ? { island: islandSave(v.island) } : {}),
    ...(isObj(v.museum) ? { museum: museumSave(v.museum) } : {}),
    ...(isObj(v.skills)
      ? { skills: Object.fromEntries(SKILL_IDS.filter((id) => (v.skills as Record<string, unknown>)[id] !== undefined).map((id) => [id, int((v.skills as Record<string, unknown>)[id], 0, SKILL_XP[MAX_SKILL_LEVEL] * 4, `skills.${id}`)])) }
      : {}),
    ...(isObj(v.petStay)
      ? {
          petStay: Object.fromEntries(
            (['cat', 'dog'] as const)
              .filter((k) => isObj((v.petStay as Record<string, unknown>)[k]))
              .map((k) => {
                const at = (v.petStay as Record<string, Record<string, unknown>>)[k];
                return [k, { x: int(Math.round(Number(at.x) || 0), 0, 100_000, 'petStay.x'), y: int(Math.round(Number(at.y) || 0), 0, 100_000, 'petStay.y') }];
              }),
          ),
        }
      : {}),
    ...(Array.isArray(v.milestones) ? { milestones: [...new Set(v.milestones.filter((m): m is string => typeof m === 'string' && /^[a-z0-9_]{1,32}$/.test(m)))].slice(0, 64) } : {}),
    ...(v.rainbowDay === undefined ? {} : { rainbowDay: int(v.rainbowDay, 0, 200_000, 'social.rainbowDay') }),
    ...(v.meteorDay === undefined ? {} : { meteorDay: int(v.meteorDay, 0, 200_000, 'social.meteorDay') }),
    ...(isObj(v.ghost) ? { ghost: { stage: int(v.ghost.stage, 0, 3, 'social.ghost.stage'), asked: v.ghost.asked === true } } : {}),
    ...(v.trainsSeen === undefined ? {} : { trainsSeen: int(v.trainsSeen, 0, 1_000_000, 'social.trainsSeen') }),
    ...(isObj(v.daily) ? { daily: daily(v.daily) } : {}),
    ...(isObj(v.freight) ? { freight: freight(v.freight) } : {}),
    ...(isObj(v.tidal) ? { tidal: tidal(v.tidal) } : {}),
    ...(isObj(v.nightMarket) ? { nightMarket: nightMarket(v.nightMarket) } : {}),
    ...(isObj(v.heirloom) ? { heirloom: heirloom(v.heirloom) } : {}),
    ...(isObj(v.horse) && typeof v.horse.name === 'string'
      ? { horse: { name: v.horse.name.trim().slice(0, 16) || 'Clover', x: int(Math.round(Number(v.horse.x) || 0), 0, 100_000, 'horse.x'), y: int(Math.round(Number(v.horse.y) || 0), 0, 100_000, 'horse.y') } }
      : {}),
    ...(isObj(v.homeTreat) ? { homeTreat: npcNumbers(v.homeTreat, 0, 200_000, 'social.homeTreat') } : {}),
    ...(v.story === undefined ? {} : { story: int(v.story, 0, 100, 'social.story') }),
    ...(isObj(v.arcs) ? { arcs: npcNumbers(v.arcs, 0, 10, 'social.arcs') } : {}),
    ...(v.tutorial === undefined ? {} : { tutorial: int(v.tutorial, -1, 100, 'social.tutorial') }),
    ...(isObj(v.beach) && Array.isArray(v.beach.taken) ? { beach: { day: int(v.beach.day, 0, 200_000, 'beach.day'), taken: v.beach.taken.slice(0, 20).map((n) => int(n, 0, 50, 'beach.taken')) } } : {}),
    ...(isObj(v.festival) ? { festival: { day: int(v.festival.day, 0, 200_000, 'festival.day'), entered: v.festival.entered === true, eggs: v.festival.eggs === true } } : {}),
  };
}

function heartEvents(v: Record<string, unknown>): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, list] of Object.entries(v)) {
    if (!(NPC_IDS as string[]).includes(id) || !Array.isArray(list)) continue;
    out[id] = list.slice(0, 10).map((n) => int(n, 0, 20, 'social.events'));
  }
  return out;
}

function letters(list: unknown[]): Letter[] {
  return list.slice(0, MAX_LETTERS).map((raw, i) => {
    const l = isObj(raw) ? raw : fail(`mail[${i}]`);
    const text = (t: unknown, max: number) => (typeof t === 'string' ? t.slice(0, max) : '');
    const att = isObj(l.attachment) && isItemId(l.attachment.itemId) ? { itemId: l.attachment.itemId, quantity: int(l.attachment.quantity, 1, 999, 'mail.attachment') } : undefined;
    return {
      id: int(l.id, 0, 1e9, 'mail.id'),
      day: int(l.day, 0, 200_000, 'mail.day'),
      from: text(l.from, 40),
      subject: text(l.subject, 80),
      body: text(l.body, 1000),
      ...(att ? { attachment: att } : {}),
      read: l.read === true,
      claimed: l.claimed === true,
    };
  });
}

function quests(v: unknown): QuestSave | undefined {
  if (v === undefined || v === null) return undefined;
  if (!isObj(v)) return fail('quests must be an object');
  return { day: int(v.day, 0, 200_000, 'quests.day'), done: arr(v.done, 10, 'quests.done').map((d) => int(d, 0, 9, 'quests.done[]')) };
}

export function validateSave(input: unknown, expectedSeed?: string): SaveValidation {
  try {
    if (!isObj(input)) fail('Save must be an object');
    const s = input as Record<string, unknown>;
    if (s.version !== SAVE_VERSION) fail(`Unsupported save version (expected ${SAVE_VERSION})`);
    if (typeof s.seed !== 'string' || s.seed.length < 1 || s.seed.length > 64) fail('seed must be 1–64 characters');
    if (expectedSeed !== undefined && s.seed !== expectedSeed) fail('seed does not match the world');

    const time = isObj(s.time) ? s.time : fail('time missing');
    const p = isObj(s.player) ? s.player : fail('player missing');
    const inv = isObj(p.inventory) ? p.inventory : fail('player.inventory missing');
    const appearance = isObj(p.appearance) ? p.appearance : fail('player.appearance missing');
    const res = isObj(s.resources) ? s.resources : fail('resources missing');

    const data: SaveData = {
      version: SAVE_VERSION,
      seed: s.seed as string,
      savedAt: int(s.savedAt, 0, Number.MAX_SAFE_INTEGER, 'savedAt'),
      time: {
        day: int(time.day, 1, 100_000, 'time.day'),
        minute: int(time.minute, TIME_CONFIG.dayStartMinute, TIME_CONFIG.dayEndMinute, 'time.minute'),
      },
      weather: WEATHER.includes(s.weather as WeatherKind) ? (s.weather as WeatherKind) : fail('unknown weather'),
      player: {
        x: num(p.x, 0, WORLD_WIDTH_TILES * GAME_CONFIG.tileSize, 'player.x'),
        y: num(p.y, 0, WORLD_HEIGHT_TILES * GAME_CONFIG.tileSize, 'player.y'),
        facing: DIRECTIONS.includes(p.facing as (typeof DIRECTIONS)[number]) ? (p.facing as (typeof DIRECTIONS)[number]) : 'down',
        gold: int(p.gold, 0, MAX_GOLD, 'player.gold'),
        lifetimeEarnings: int(p.lifetimeEarnings, 0, MAX_GOLD, 'player.lifetimeEarnings'),
        energy: num(p.energy, 0, GAME_CONFIG.energy.max, 'player.energy'),
        water: int(p.water, 0, GAME_CONFIG.farming.wateringCanCapacity, 'player.water'),
        ...(p.health === undefined ? {} : { health: num(p.health, 0, MINE.maxHealth, 'player.health') }),
        ...(p.mineDepth === undefined ? {} : { mineDepth: int(p.mineDepth, 0, MINE.floors, 'player.mineDepth') }),
        ...(isObj(p.equipment)
          ? {
              equipment: {
                ...(isItemId(p.equipment.ring) && ITEMS[p.equipment.ring].equip?.slot === 'ring' ? { ring: p.equipment.ring } : {}),
                ...(isItemId(p.equipment.armor) && ITEMS[p.equipment.armor].equip?.slot === 'armor' ? { armor: p.equipment.armor } : {}),
              },
            }
          : {}),
        ...(Array.isArray(p.bin) ? { bin: p.bin.slice(0, BIN_SIZE).map((v, i) => slot(v, `player.bin[${i}]`)) } : {}),
        ...(Array.isArray(p.buffs)
          ? {
              buffs: p.buffs
                .filter((b): b is { kind: BuffKind; until: number } => isObj(b) && typeof b.kind === 'string' && b.kind in BUFF_INFO && typeof b.until === 'number')
                .slice(0, 8)
                .map((b) => ({ kind: b.kind, until: int(b.until, 0, 1e9, 'buff.until') })),
            }
          : {}),
        // Every part, within its options; a missing (older save) or unknown value is option 0 — never worth refusing a save over.
        appearance: normalizeAppearance(appearance),
        inventory: {
          slots: arr(inv.slots, GAME_CONFIG.inventory.size, 'inventory.slots').map((v, i) => slot(v, `inventory[${i}]`)),
          selected: int(inv.selected, 0, GAME_CONFIG.inventory.hotbarSize - 1, 'inventory.selected'),
        },
      },
      resources: {
        nodes: arr(res.nodes, MAX_NODES, 'resources.nodes').map((v, i) => {
          const n = isObj(v) ? v : fail(`resources.nodes[${i}]`);
          return {
            spec: spec(n.spec, `nodes[${i}].spec`),
            hasBerries: n.hasBerries === true,
            berryDueDay: n.berryDueDay === null || n.berryDueDay === undefined ? null : int(n.berryDueDay, 0, 200_000, 'berryDueDay'),
            regrowsInto: n.regrowsInto ? spec(n.regrowsInto, `nodes[${i}].regrowsInto`) : null,
          };
        }),
        pending: arr(res.pending, MAX_NODES, 'resources.pending').map((v, i) => {
          const r = isObj(v) ? v : fail(`resources.pending[${i}]`);
          return { spec: spec(r.spec, `pending[${i}].spec`), dueDay: int(r.dueDay, 0, 200_000, 'dueDay') };
        }),
      },
      farm: arr(s.farm, WORLD_WIDTH_TILES * WORLD_HEIGHT_TILES, 'farm').map((v, i) => {
        const f = isObj(v) ? v : fail(`farm[${i}]`);
        const crop = f.crop === null || f.crop === undefined ? null : isObj(f.crop) ? f.crop : fail(`farm[${i}].crop`);
        return {
          tx: tileX(f.tx, `farm[${i}].tx`),
          ty: tileY(f.ty, `farm[${i}].ty`),
          watered: f.watered === true,
          crop: crop
            ? {
                id: (crop.id as string) in CROPS ? (crop.id as CropId) : fail(`farm[${i}]: unknown crop`),
                stage: int(crop.stage, 0, CROPS[crop.id as CropId].matureStage, `farm[${i}].stage`),
                ...(crop.fed === true ? { fed: true } : {}),
              }
            : null,
        };
      }),
      placed: arr(s.placed, 5_000, 'placed').map((v, i) => {
        const b = isObj(v) ? v : fail(`placed[${i}]`);
        const kind = (b.kind as string) in PLACEABLES ? (b.kind as PlaceableKind) : fail(`placed[${i}]: unknown kind`);
        return {
          kind,
          tx: tileX(b.tx, `placed[${i}].tx`),
          ty: tileY(b.ty, `placed[${i}].ty`),
          ...(isStorage(kind) ? { items: arr(b.items ?? [], STORAGE_SIZE[kind]!, `placed[${i}].items`).map((it, j) => slot(it, `chest[${i}][${j}]`)) } : {}),
          ...(isMachineKind(kind) && isObj(b.machine) && isItemId(b.machine.input) && isItemId(b.machine.output)
            ? { machine: { input: b.machine.input, output: b.machine.output, readyAt: int(b.machine.readyAt, 0, 1e9, `placed[${i}].machine.readyAt`) } }
            : {}),
          ...((kind === 'barn' || kind === 'silo') && b.hay !== undefined ? { hay: int(b.hay, 0, kind === 'silo' ? SILO_CAPACITY : BARN.hayCapacity, `placed[${i}].hay`) } : {}),
        };
      }),
      chickens: arr(s.chickens, 200, 'chickens').map((v, i) => {
        const c = isObj(v) ? v : fail(`chickens[${i}]`);
        const maxX = WORLD_WIDTH_TILES * GAME_CONFIG.tileSize;
        const maxY = WORLD_HEIGHT_TILES * GAME_CONFIG.tileSize;
        return {
          x: num(c.x, 0, maxX, 'chicken.x'),
          y: num(c.y, 0, maxY, 'chicken.y'),
          homeX: num(c.homeX, 0, maxX, 'chicken.homeX'),
          homeY: num(c.homeY, 0, maxY, 'chicken.homeY'),
          ...(c.kind === 'duck' || c.kind === 'rabbit' ? { kind: c.kind } : {}),
        };
      }),
    };
    if (s.livestock !== undefined && s.livestock !== null) {
      const maxX = WORLD_WIDTH_TILES * GAME_CONFIG.tileSize;
      const maxY = WORLD_HEIGHT_TILES * GAME_CONFIG.tileSize;
      data.livestock = arr(s.livestock, 200, 'livestock').map((v, i) => {
        const a = isObj(v) ? v : fail(`livestock[${i}]`);
        const kind = a.kind === 'cow' || a.kind === 'sheep' ? a.kind : fail(`livestock[${i}].kind`);
        return {
          id: int(a.id, 0, 1e9, 'livestock.id'),
          kind,
          name: typeof a.name === 'string' ? a.name.slice(0, 20) : 'Daisy',
          homeX: num(a.homeX, 0, maxX, 'livestock.homeX'),
          homeY: num(a.homeY, 0, maxY, 'livestock.homeY'),
          happiness: num(a.happiness, 0, 100, 'livestock.happiness'),
          ready: a.ready === true,
          pettedDay: int(a.pettedDay ?? 0, 0, 200_000, 'livestock.pettedDay'),
          fed: a.fed === true,
        };
      });
    }
    if (Array.isArray(s.cabins)) {
      data.cabins = s.cabins.slice(0, 8).filter(isObj).map((c, i) => ({
        ownerId: typeof c.ownerId === 'string' ? c.ownerId.slice(0, 40) : fail(`cabins[${i}].ownerId`),
        name: typeof c.name === 'string' ? c.name.slice(0, 40) : 'Friend',
        tx: int(c.tx, 0, WORLD_WIDTH_TILES, `cabins[${i}].tx`),
        ty: int(c.ty, 0, WORLD_HEIGHT_TILES, `cabins[${i}].ty`),
      }));
    }
    if (isObj(s.collection)) {
      const found = Array.isArray(s.collection.found) ? s.collection.found.filter(isItemId) : [];
      const achievements = Array.isArray(s.collection.achievements) ? s.collection.achievements.filter((a): a is string => typeof a === 'string' && ACHIEVEMENT_IDS.includes(a)) : [];
      const sightings = Array.isArray(s.collection.sightings) ? s.collection.sightings.filter(isWildlifeId) : [];
      data.collection = { found: [...new Set(found)], achievements: [...new Set(achievements)], ...(sightings.length ? { sightings: [...new Set(sightings)] } : {}) };
    }
    if (isObj(s.community)) {
      const community: CommunityProgress = {};
      for (const [goalId, given] of Object.entries(s.community)) {
        if (!isCommunityGoalId(goalId) || !isObj(given)) continue;
        const goal: Partial<Record<ItemId, number>> = {};
        for (const [itemId, q] of Object.entries(given)) {
          const need = communityGoal(goalId)?.needs.find((n) => n.itemId === itemId)?.quantity;
          if (need !== undefined) goal[itemId as ItemId] = int(q, 0, need, `community.${goalId}.${itemId}`);
        }
        community[goalId] = goal;
      }
      data.community = community;
    }
    if (isObj(s.interior)) {
      const level = int(s.interior.level ?? 0, 0, COTTAGE_ROOMS.length - 1, 'interior.level');
      const room = COTTAGE_ROOMS[level];
      data.interior = {
        level,
        furniture: arr(s.interior.furniture ?? [], 100, 'interior.furniture').map((v, i) => {
          const f = isObj(v) ? v : fail(`interior.furniture[${i}]`);
          const kind = (FURNITURE_KINDS as string[]).includes(f.kind as string) ? (f.kind as FurnitureKind) : fail(`interior.furniture[${i}].kind`);
          const max = FURNITURE[kind].display ?? 0;
          const items = Array.isArray(f.items) ? f.items.filter(isItemId).slice(0, max) : [];
          return { kind, tx: int(f.tx, 0, room.width, 'furniture.tx'), ty: int(f.ty, 0, room.height, 'furniture.ty'), ...(items.length ? { items } : {}) };
        }),
        ...(s.interior.furnished === true ? { furnished: true } : {}),
      };
    }
    const socialData = social(s.social);
    const questData = quests(s.quests);
    if (socialData) data.social = socialData;
    if (questData) data.quests = questData;
    if (s.floor !== undefined) {
      data.floor = arr(s.floor, MAX_FLOOR_ITEMS, 'floor').map((v, i) => {
        const f = isObj(v) ? v : fail(`floor[${i}]`);
        if (typeof f.area !== 'string' || !/^[A-Za-z]{1,24}$/.test(f.area)) return fail(`floor[${i}].area`);
        if (!isItemId(f.itemId)) return fail(`floor[${i}]: unknown item`);
        return {
          area: f.area,
          itemId: f.itemId,
          quantity: int(f.quantity, 1, ITEMS[f.itemId].maxStack, `floor[${i}].quantity`),
          x: num(f.x, 0, 20_000, `floor[${i}].x`),
          y: num(f.y, 0, 20_000, `floor[${i}].y`),
          ...(isQuality(f.q) ? { q: f.q } : {}),
        };
      });
    }
    if (s.orchard !== undefined) {
      const seen = new Set<string>();
      data.orchard = arr(s.orchard, 200, 'orchard').flatMap((v, i) => {
        const t = isObj(v) ? v : fail(`orchard[${i}]`);
        if (!isFruitTreeKind(t.kind)) return fail(`orchard[${i}].kind`);
        const tx = tileX(t.tx, `orchard[${i}].tx`);
        const ty = tileY(t.ty, `orchard[${i}].ty`);
        if (seen.has(`${tx},${ty}`)) return [];
        seen.add(`${tx},${ty}`);
        return [{ kind: t.kind, tx, ty, planted: int(t.planted, 0, 200_000, `orchard[${i}].planted`), fruit: int(t.fruit, 0, FRUIT_TREE_MAX_FRUIT, `orchard[${i}].fruit`) }];
      });
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}
