import { SAVE_VERSION } from '../types/save';

/**
 * Upgrading old saves.
 *
 * A player's save may be any age: one left in a browser, a file they exported
 * months ago, or a world sitting in the cloud. Every one of them has to keep
 * loading as the game changes, so a save is walked up one version at a time
 * until it matches `SAVE_VERSION` and can be validated.
 */

/**
 * Turns a save of version N into a save of version N + 1. It is handed a deep
 * copy, so it may mutate and return it; the version number is set for it.
 */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * Keyed by the version each step upgrades *from*: `MIGRATIONS[1]` turns a
 * version-1 save into a version-2 save.
 *
 * Add one entry for every `SAVE_VERSION` bump, and never change or remove an
 * entry once it has shipped — a save walks the whole chain from wherever it
 * started, so an old step is still load-bearing years later.
 *
 * Adding an optional field needs no migration: leave it optional on the type
 * and the save loads as it is. A migration is for the breaking changes —
 * renaming or removing a field, changing its units, or restructuring it.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Example, for when SAVE_VERSION becomes 2:
  // 1: (s) => {
  //   const player = s.player as Record<string, unknown> | undefined;
  //   if (player && typeof player.stamina === 'number') {
  //     player.energy = player.stamina;
  //     delete player.stamina;
  //   }
  //   return s;
  // },
};

export type MigrationResult =
  | { ok: true; data: Record<string, unknown>; from: number; migrated: boolean }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Saves are plain JSON, so either route gives an independent copy. */
function clone(save: Record<string, unknown>): Record<string, unknown> {
  if (typeof structuredClone === 'function') return structuredClone(save);
  return JSON.parse(JSON.stringify(save)) as Record<string, unknown>;
}

/**
 * Brings a save up to `target`, applying each migration in turn.
 *
 * A save already at the target is passed through untouched and uncopied — the
 * common case, and the one the co-op server runs on every join. Anything older
 * is copied first, so a failed upgrade never leaves the caller's object
 * half-migrated. `migrations` and `target` are injectable for testing.
 */
export function applyMigrations(
  input: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  target: number = SAVE_VERSION,
): MigrationResult {
  if (!isObj(input)) return { ok: false, error: 'Save must be an object' };

  const from = input.version;
  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    return { ok: false, error: 'Save is missing a version number' };
  }
  if (from > target) {
    return {
      ok: false,
      error: `This save was made by a newer version of the game (save version ${from}; this game reads up to ${target}). Update the game to load it.`,
    };
  }
  if (from === target) return { ok: true, data: input, from, migrated: false };

  let save = clone(input);
  for (let v = from; v < target; v++) {
    const step = migrations[v];
    if (!step) {
      return { ok: false, error: `Can't upgrade this save: no way to read version ${v} (the game is on version ${target}).` };
    }
    let next: unknown;
    try {
      next = step(save);
    } catch (err) {
      return { ok: false, error: `Could not upgrade this save from version ${v}: ${(err as Error).message}` };
    }
    if (!isObj(next)) return { ok: false, error: `Could not upgrade this save from version ${v}: the upgrade produced nothing usable.` };
    save = next;
    // Set it here so a migration can't stall the walk by forgetting to.
    save.version = v + 1;
  }
  return { ok: true, data: save, from, migrated: true };
}
