import type { CoopPlayerState } from '@farming/shared';
import { query } from '../database/db';

/** A guest's own progress in a host's world, or null on their first visit. */
export async function findMemberState(ownerId: string, seed: string, userId: string): Promise<CoopPlayerState | null> {
  const { rows } = await query<{ state: CoopPlayerState }>(
    'SELECT state FROM coop_members WHERE owner_id = $1 AND seed = $2 AND user_id = $3',
    [ownerId, seed, userId],
  );
  return rows[0]?.state ?? null;
}

export async function saveMemberState(ownerId: string, seed: string, userId: string, state: CoopPlayerState): Promise<void> {
  await query(
    `INSERT INTO coop_members (owner_id, seed, user_id, state) VALUES ($1, $2, $3, $4)
     ON CONFLICT (owner_id, seed, user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [ownerId, seed, userId, JSON.stringify(state)],
  );
}
