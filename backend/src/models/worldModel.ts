import type { Queryable } from '../database/db';
import type { SaveData, WorldSummary } from '@farming/shared';
import { query } from '../database/db';

interface WorldListRow {
  seed: string;
  day: number;
  gold: number;
  lifetime_earnings: number;
  saved_at: Date;
}

export interface InventoryRow {
  container: string;
  slot: number;
  item_id: string;
  quantity: number;
}

export async function listWorlds(userId: string): Promise<WorldSummary[]> {
  const { rows } = await query<WorldListRow>(
    'SELECT seed, day, gold, lifetime_earnings, saved_at FROM worlds WHERE user_id = $1 ORDER BY saved_at DESC',
    [userId],
  );
  return rows.map((r) => ({ seed: r.seed, day: r.day, gold: r.gold, lifetimeEarnings: r.lifetime_earnings, savedAt: r.saved_at.getTime() }));
}

export async function findWorldSave(userId: string, seed: string): Promise<SaveData | null> {
  const { rows } = await query<{ save: SaveData }>('SELECT save FROM worlds WHERE user_id = $1 AND seed = $2', [userId, seed]);
  return rows[0]?.save ?? null;
}

export async function lockWorld(client: Queryable, userId: string, seed: string): Promise<{ id: string; saved_at: Date } | null> {
  const { rows } = await client.query<{ id: string; saved_at: Date }>(
    'SELECT id, saved_at FROM worlds WHERE user_id = $1 AND seed = $2 FOR UPDATE',
    [userId, seed],
  );
  return rows[0] ? { id: String(rows[0].id), saved_at: rows[0].saved_at } : null;
}

export async function upsertWorld(client: Queryable, userId: string, save: SaveData): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO worlds (user_id, seed, save, day, gold, lifetime_earnings, saved_at)
     VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))
     ON CONFLICT (user_id, seed) DO UPDATE SET
       save = EXCLUDED.save, day = EXCLUDED.day, gold = EXCLUDED.gold,
       lifetime_earnings = EXCLUDED.lifetime_earnings, saved_at = EXCLUDED.saved_at, updated_at = now()
     RETURNING id`,
    [userId, save.seed, JSON.stringify(save), save.time.day, save.player.gold, save.player.lifetimeEarnings, save.savedAt],
  );
  return String(rows[0].id);
}

/** Replaces a world's normalised inventory rows. */
export async function replaceInventory(client: Queryable, worldId: string, rows: InventoryRow[]): Promise<void> {
  await client.query('DELETE FROM inventory_items WHERE world_id = $1', [worldId]);
  if (rows.length === 0) return;
  const values: unknown[] = [];
  const tuples = rows.map((r, i) => {
    values.push(worldId, r.container, r.slot, r.item_id, r.quantity);
    const o = i * 5;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`;
  });
  await client.query(`INSERT INTO inventory_items (world_id, container, slot, item_id, quantity) VALUES ${tuples.join(', ')}`, values);
}

export async function findInventory(userId: string, seed: string): Promise<InventoryRow[]> {
  const { rows } = await query<InventoryRow>(
    `SELECT i.container, i.slot, i.item_id, i.quantity FROM inventory_items i
     JOIN worlds w ON w.id = i.world_id
     WHERE w.user_id = $1 AND w.seed = $2 ORDER BY i.container, i.slot`,
    [userId, seed],
  );
  return rows;
}

export async function deleteWorld(userId: string, seed: string): Promise<boolean> {
  const { rowCount } = await query('DELETE FROM worlds WHERE user_id = $1 AND seed = $2', [userId, seed]);
  return (rowCount ?? 0) > 0;
}
