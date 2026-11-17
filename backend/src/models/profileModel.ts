import type { Queryable } from '../database/db';
import type { AppearanceChoice } from '@farming/shared';
import { query } from '../database/db';

export interface ProfileRow {
  user_id: string;
  display_name: string;
  appearance: AppearanceChoice;
  updated_at: Date;
}

export async function insertProfile(client: Queryable, userId: string, displayName: string): Promise<void> {
  await client.query('INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)', [userId, displayName]);
}

export async function findProfile(userId: string): Promise<ProfileRow | null> {
  const { rows } = await query<ProfileRow>('SELECT * FROM profiles WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

export async function updateProfile(userId: string, changes: { displayName?: string; appearance?: AppearanceChoice }): Promise<ProfileRow> {
  const { rows } = await query<ProfileRow>(
    `UPDATE profiles SET
       display_name = COALESCE($2, display_name),
       appearance   = COALESCE($3, appearance),
       updated_at   = now()
     WHERE user_id = $1 RETURNING *`,
    [userId, changes.displayName ?? null, changes.appearance ? JSON.stringify(changes.appearance) : null],
  );
  return rows[0];
}
