import { CROPS, HEIRLOOMS, HEIRLOOM_IDS, type HeirloomId } from './crops';
import type { ItemId } from './items';
import { createRng, hashSeed } from '../world/random';

/*
 * Heirloom seeds: every world grows two heirloom varieties of its own. Their
 * seeds come by post on day 2, harvests sometimes give a seed back, and you
 * can pack seeds into a parcel — a short code — for a friend's world, where
 * those plants never grow otherwise.
 */

/** Native varieties per world. */
export const HEIRLOOMS_PER_WORLD = 2;
/** Seeds of each native variety the Seed Library sends on day 2. */
export const HEIRLOOM_STARTER_SEEDS = 5;
/** The day the starter seeds arrive. */
export const HEIRLOOM_START_DAY = 2;
/** Chance an heirloom harvest gives one seed back. */
export const HEIRLOOM_SEED_CHANCE = 0.35;
/** Seed parcels hold this many seeds. */
export const SEED_PARCEL_SIZES = [5, 10] as const;
/** Parcels a world remembers having opened (so each code works once). */
export const MAX_REDEEMED_PARCELS = 100;

/** The two heirloom varieties a world grows natively (fixed by its seed). */
export function nativeHeirlooms(seed: string): HeirloomId[] {
  const rng = createRng(`${seed}:heirlooms`);
  const pool = [...HEIRLOOM_IDS];
  const out: HeirloomId[] = [];
  while (out.length < HEIRLOOMS_PER_WORLD && pool.length) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

/** The heirloom variety a seed item grows, if it's an heirloom seed. */
export function heirloomOfSeed(itemId: ItemId): HeirloomId | null {
  const id = HEIRLOOM_IDS.find((h) => CROPS[h].seedItem === itemId);
  return id ?? null;
}

export interface HeirloomSave {
  /** The Seed Library's starter seeds have been sent. */
  intro?: boolean;
  /** Parcels packed so far (each parcel's number, so every code is different). */
  sent: number;
  /** Parcels opened in this world ("sender:number"), newest last. */
  redeemed: string[];
}

export function freshHeirloom(): HeirloomSave {
  return { sent: 0, redeemed: [] };
}

// ---------- Seed parcel codes ----------

export interface SeedParcel {
  heirloom: HeirloomId;
  quantity: number;
  /** Which parcel this is for its sender. */
  nonce: number;
  /** A hash of the sending world's seed. */
  from: number;
}

/** Crockford base 32: no I, L, O or U, so codes read cleanly aloud and by hand. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_VERSION = 1;
const PAYLOAD_BYTES = 11;

const checksum = (bytes: number[]) => hashSeed(`harvest-valley-seed-parcel:${bytes.join(',')}`) & 0xffff;

function toBase32(bytes: number[]): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function fromBase32(text: string, byteCount: number): number[] | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  return out.length >= byteCount ? out.slice(0, byteCount) : null;
}

/** Scrambles the payload (all but its version byte) with the checksum, so codes look random rather than mostly zeros. */
function mask(payload: number[], sum: number): number[] {
  const rng = createRng(`parcel-mask:${sum}`);
  return payload.map((b, i) => (i === 0 ? b : (b ^ rng.int(0, 255)) & 255));
}

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const readU32 = (b: number[], at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

/** A parcel as a code like "HV-7K2PQ-…". */
export function encodeSeedParcel(p: SeedParcel): string {
  const index = HEIRLOOM_IDS.indexOf(p.heirloom);
  if (index < 0 || p.quantity < 1 || p.quantity > 99) throw new Error('Not a valid seed parcel');
  const bytes = [CODE_VERSION, index, p.quantity, ...u32(p.nonce >>> 0), ...u32(p.from >>> 0)];
  const sum = checksum(bytes);
  const body = toBase32([...mask(bytes, sum), (sum >>> 8) & 255, sum & 255]);
  return `HV-${body.match(/.{1,7}/g)!.join('-')}`;
}

/** Reads a parcel code (forgiving about case, spaces, dashes and look-alike letters); null if it isn't one. */
export function decodeSeedParcel(code: string): SeedParcel | null {
  const clean = code
    .toUpperCase()
    .replace(/^\s*HV/, '')
    .replace(/[\s-]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  const bytes = fromBase32(clean, PAYLOAD_BYTES + 2);
  if (!bytes) return null;
  const sum = (bytes[PAYLOAD_BYTES] << 8) | bytes[PAYLOAD_BYTES + 1];
  const payload = mask(bytes.slice(0, PAYLOAD_BYTES), sum);
  if (payload[0] !== CODE_VERSION || sum !== checksum(payload)) return null;
  const heirloom = HEIRLOOM_IDS[payload[1]];
  const quantity = payload[2];
  if (!heirloom || quantity < 1 || quantity > 99) return null;
  return { heirloom, quantity, nonce: readU32(payload, 3), from: readU32(payload, 7) };
}

/** What a world remembers about an opened parcel. */
export const parcelKey = (p: Pick<SeedParcel, 'from' | 'nonce'>) => `${p.from}:${p.nonce}`;

/** The id of a world in parcel codes. */
export const worldTag = (seed: string) => hashSeed(`world:${seed}`) >>> 0;

/** Display name for a variety, with its everyday cousin ("Ghost Pumpkin — a pumpkin"). */
export function heirloomLabel(id: HeirloomId): string {
  return `${HEIRLOOMS[id].name} (${CROPS[HEIRLOOMS[id].base].name.toLowerCase()})`;
}
