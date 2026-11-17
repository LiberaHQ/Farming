import type { RequestHandler } from 'express';
import { HttpError } from '../api/errors';
import { deleteWorld, findInventory, findWorldSave, listWorlds } from '../models/worldModel';
import { parseSeed, storeWorld } from '../services/worldService';

export const listWorldsHandler: RequestHandler = async (req, res) => {
  res.json({ worlds: await listWorlds(req.user!.id) });
};

export const getWorldHandler: RequestHandler<{ seed: string }> = async (req, res) => {
  // A world with no save yet is a normal case (new game), not an error.
  res.json({ save: await findWorldSave(req.user!.id, parseSeed(req.params.seed)) });
};

export const putWorldHandler: RequestHandler<{ seed: string }> = async (req, res) => {
  res.json(await storeWorld(req.user!.id, parseSeed(req.params.seed), req.body));
};

export const deleteWorldHandler: RequestHandler<{ seed: string }> = async (req, res) => {
  const deleted = await deleteWorld(req.user!.id, parseSeed(req.params.seed));
  if (!deleted) throw new HttpError(404, 'No save for this world.');
  res.json({ ok: true });
};

export const getInventoryHandler: RequestHandler<{ seed: string }> = async (req, res) => {
  const rows = await findInventory(req.user!.id, parseSeed(req.params.seed));
  res.json({
    items: rows.map((r) => ({ container: r.container, slot: r.slot, itemId: r.item_id, quantity: r.quantity })),
  });
};
