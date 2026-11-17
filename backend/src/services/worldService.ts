import { validateSave, type SaveData } from '@farming/shared';
import { transaction } from '../database/db';
import { HttpError } from '../api/errors';
import { lockWorld, replaceInventory, upsertWorld, type InventoryRow } from '../models/worldModel';

const SEED = /^[\w\- ]{1,64}$/;

export function parseSeed(raw: string): string {
  const seed = decodeURIComponent(raw);
  if (!SEED.test(seed)) throw new HttpError(400, 'Invalid world name.');
  return seed;
}

/** Flattens the backpack and every chest into inventory rows. */
function inventoryRows(save: SaveData): InventoryRow[] {
  const rows: InventoryRow[] = [];
  save.player.inventory.slots.forEach((s, slot) => {
    if (s) rows.push({ container: 'player', slot, item_id: s.itemId, quantity: s.quantity });
  });
  for (const p of save.placed) {
    p.items?.forEach((s, slot) => {
      if (s) rows.push({ container: `chest:${p.tx},${p.ty}`, slot, item_id: s.itemId, quantity: s.quantity });
    });
  }
  return rows;
}

/**
 * Validates and stores a save. Saves older than the stored one are rejected
 * (409) so a stale tab can't overwrite newer progress from another device.
 */
export async function storeWorld(userId: string, seed: string, body: unknown): Promise<{ savedAt: number }> {
  const result = validateSave(body, seed);
  if (!result.ok) throw new HttpError(400, `Invalid save: ${result.error}`);
  const save = result.data;
  await transaction(async (client) => {
    const existing = await lockWorld(client, userId, seed);
    if (existing && existing.saved_at.getTime() > save.savedAt) {
      throw new HttpError(409, 'A newer save of this world already exists.');
    }
    const worldId = await upsertWorld(client, userId, save);
    await replaceInventory(client, worldId, inventoryRows(save));
  });
  return { savedAt: save.savedAt };
}
