import { query } from '../database/db';

export interface FriendRow {
  id: string;
  username: string;
  display_name: string | null;
}

/** Everyone you added, plus everyone who added you. */
export async function listFriends(userId: string): Promise<FriendRow[]> {
  const { rows } = await query<FriendRow>(
    `SELECT DISTINCT u.id::text AS id, u.username, p.display_name
       FROM friends f
       JOIN users u ON u.id = CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE f.user_id = $1 OR f.friend_id = $1
      ORDER BY u.username`,
    [userId],
  );
  return rows;
}

export async function addFriend(userId: string, friendId: string): Promise<void> {
  await query('INSERT INTO friends (user_id, friend_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, friendId]);
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await query('DELETE FROM friends WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)', [userId, friendId]);
}
