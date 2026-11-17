import type { RequestHandler } from 'express';
import { HttpError } from '../api/errors';
import { addFriend, listFriends, removeFriend } from '../models/friendModel';
import { findUserByUsername } from '../models/userModel';
import { presenceOf, publicLobbies } from '../realtime';

/** Your friends, and the game each one is in right now (if any). */
export const listFriendsHandler: RequestHandler = async (req, res) => {
  const rows = await listFriends(req.user!.id);
  res.json({
    friends: rows.map((r) => ({ username: r.username, displayName: r.display_name ?? r.username, playing: presenceOf(r.id) })),
  });
};

export const addFriendHandler: RequestHandler = async (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
  if (!username) throw new HttpError(400, 'Enter a username.');
  const friend = await findUserByUsername(username);
  if (!friend) throw new HttpError(404, `No player called "${username}".`);
  if (String(friend.id) === String(req.user!.id)) throw new HttpError(400, "That's you!");
  await addFriend(req.user!.id, String(friend.id));
  res.json({ ok: true });
};

export const removeFriendHandler: RequestHandler = async (req, res) => {
  const friend = await findUserByUsername(String(req.params.username ?? '').toLowerCase());
  if (friend) await removeFriend(req.user!.id, String(friend.id));
  res.json({ ok: true });
};

/** Public co-op games anyone can join. */
export const lobbiesHandler: RequestHandler = (_req, res) => {
  res.json({ lobbies: publicLobbies() });
};
