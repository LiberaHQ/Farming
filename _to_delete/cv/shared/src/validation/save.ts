import { isStorage, PLACEABLES, SILO_CAPACITY, STORAGE_SIZE, type PlaceableKind } from '../game-config/placeables';
import { CROPS, type CropId } from '../game-config/crops';
import { GAME_CONFIG } from '../game-config';
import { MINE } from '../game-config/activities';
import { isMachineKind } from '../game-config/machines';
import { BARN } from '../game-config/livestock';
import { MAX_LETTERS, type Letter } from '../game-config/village';
import { COTTAGE_ROOMS, FURNITURE, FURNITURE_KINDS, type FurnitureKind } from '../game-config/interior';
import { BUFF_INFO, ITEMS, isItemId, type BuffKind, type ItemId } from '../game-config/items';
import { ACHIEVEMENT_IDS } from '../game-config/achievements';
import { communityGoal, isCommunityGoalId, type CommunityProgress } from '../game-config/community';
import { TIME_CONFIG, type WeatherKind } from '../game-config/time';
import { WORLD_HEIGHT_TILES, WORLD_WIDTH_TILES } from '../constants/world';
import { NPC_IDS } from '../game-config/npcs';
import { SAVE_VERSION, type QuestSave, type SaveData, type SlotData, type SocialSave } from '../types/save';
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
  return { itemId: v.itemId, quantity: int(v.quantity, 1, ITEMS[v.itemId].maxStack, `${field}.quantity`) };
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
    ...(isObj(v.pet) && (v.pet.kind === 'cat' || v.pet.kind === 'dog')
      ? {
          pet: {
            kind: v.pet.kind,
            name: typeof v.pet.name === 'string' && v.pet.name.trim() ? v.pet.name.trim().slice(0, 16) : 'Buddy',
            pettedDay: int(v.pet.pettedDay ?? 0, 0, 200_000, 'pet.pettedDay'),
            love: int(v.pet.love ?? 0, 0, 1000, 'pet.love'),
            ...(v.pet.foundDay === undefined ? {} : { foundDay: int(v.pet.foundDay, 0, 200_000, 'pet.foundDay') }),
          },
        }
      : {}),
    ...(v.petOffered === true ? { petOffered: true } : {}),
    ...((NPC_IDS as unknown[]).includes(v.dating) ? { dating: v.dating as string } : {}),
    ...((NPC_IDS as unknown[]).includes(v.spouse) ? { spouse: v.spouse as string } : {}),
    ...(v.weddingDay === undefined ? {} : { weddingDay: int(v.weddingDay, 0, 200_000, 'social.weddingDay') }),
    ...(v.carnivalSpin === undefined ? {} : { carnivalSpin: int(v.carnivalSpin, 0, 200_000, 'social.carnivalSpin') }),
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
        appearance: {
          skin: int(appearance.skin, 0, 20, 'appearance.skin'),
          hair: int(appearance.hair, 0, 20, 'appearance.hair'),
          shirt: int(appearance.shirt, 0, 20, 'appearance.shirt'),
          pants: int(appearance.pants, 0, 20, 'appearance.pants'),
        },
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
      data.collection = { found: [...new Set(found)], achievements: [...new Set(achievements)] };
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
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, error: err.message };
    throw err;
  }
}
