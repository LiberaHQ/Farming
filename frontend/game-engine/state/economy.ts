import { CROPS, discounted, findRecipe, ITEMS, isItemId, NPCS, QUALITY_NAMES, withQuality, type FestivalId, type ItemId, type NpcId, type Season } from '@farming/shared';
import type { PlayerState } from './PlayerState';

/**
 * Crafting and trading rules. Every function validates its input (it may come
 * from the UI, and later from the network) and either applies the whole
 * transaction or nothing. Returns a message for the player.
 */
export type TxResult = { ok: true; message: string } | { ok: false; message: string };

export function craft(state: PlayerState, recipeId: string): TxResult {
  const recipe = findRecipe(recipeId);
  if (!recipe) return { ok: false, message: 'Unknown recipe.' };
  const inv = state.inventory;
  const missing = recipe.inputs.find((input) => inv.count(input.itemId) < input.quantity);
  if (missing) return { ok: false, message: `Not enough ${ITEMS[missing.itemId].name}.` };
  if (inv.capacityFor(recipe.output.itemId) < recipe.output.quantity && !freesSpaceFor(state, recipe.inputs)) {
    return { ok: false, message: 'Not enough room in your inventory.' };
  }
  for (const input of recipe.inputs) inv.remove(input.itemId, input.quantity);
  const leftover = inv.add(recipe.output.itemId, recipe.output.quantity);
  if (leftover > 0) {
    // Roll back so items are never lost.
    for (const input of recipe.inputs) inv.add(input.itemId, input.quantity);
    inv.remove(recipe.output.itemId, recipe.output.quantity - leftover);
    return { ok: false, message: 'Not enough room in your inventory.' };
  }
  const name = ITEMS[recipe.output.itemId].name;
  return { ok: true, message: `Crafted ${recipe.output.quantity > 1 ? `${recipe.output.quantity}× ` : ''}${name}` };
}

/** True if consuming these inputs empties at least one slot. */
function freesSpaceFor(state: PlayerState, inputs: readonly { itemId: ItemId; quantity: number }[]): boolean {
  return inputs.some((input) => state.inventory.count(input.itemId) === input.quantity);
}

// ---------- Village merchants ----------

export interface StockEntry {
  itemId: ItemId;
  /** Price after the friendship discount. */
  price: number;
  basePrice: number;
}

/** What a merchant offers right now (seeds follow the season; some stock unlocks with earnings). */
export function stockFor(npcId: NpcId, lifetimeEarnings: number, season: Season, friendshipPoints: number): StockEntry[] {
  const shop = NPCS[npcId].shop;
  if (!shop) return [];
  return shop.sells
    .filter(({ itemId }) => {
      const def = ITEMS[itemId];
      if (def.unlockAtEarnings !== undefined && lifetimeEarnings < def.unlockAtEarnings) return false;
      if (def.plants && !CROPS[def.plants].seasons.includes(season)) return false;
      return true;
    })
    .map(({ itemId, price }) => ({ itemId, basePrice: price, price: discounted(price, friendshipPoints) }));
}

/** What a merchant pays for an item (undefined = they don't buy it). */
export function offerFor(npcId: NpcId, itemId: ItemId, festival: FestivalId | null = null): number | undefined {
  const shop = NPCS[npcId].shop;
  if (!shop) return undefined;
  const base = shop.buys === 'any' ? ITEMS[itemId].sellPrice : shop.buys.find((b) => b.itemId === itemId)?.price;
  // Fishing Derby: Finn pays double for fish.
  if (base !== undefined && festival === 'fishing_derby' && npcId === 'finn' && ITEMS[itemId].category === 'fish') return base * 2;
  return base;
}

export function buyFrom(state: PlayerState, npcId: NpcId, itemId: unknown, quantity: unknown, season: Season, points: number): TxResult {
  if (!isItemId(itemId)) return { ok: false, message: 'That item is not for sale.' };
  const entry = stockFor(npcId, state.lifetimeEarnings, season, points).find((e) => e.itemId === itemId);
  if (!entry) return { ok: false, message: 'That item is not for sale.' };
  const qty = typeof quantity === 'number' && Number.isInteger(quantity) ? quantity : 0;
  if (qty < 1 || qty > 99) return { ok: false, message: 'Invalid quantity.' };
  if (state.inventory.capacityFor(itemId) < qty) return { ok: false, message: 'Not enough room in your inventory.' };
  if (!state.spendGold(entry.price * qty)) return { ok: false, message: 'Not enough gold.' };
  state.inventory.add(itemId, qty);
  return { ok: true, message: `Bought ${qty}× ${ITEMS[itemId].name}` };
}

export function sellTo(state: PlayerState, npcId: NpcId, slot: unknown, quantity: unknown, festival: FestivalId | null = null): TxResult {
  const inv = state.inventory;
  const index = typeof slot === 'number' && Number.isInteger(slot) ? slot : -1;
  const stack = index >= 0 && index < inv.slots.length ? inv.slots[index] : null;
  if (!stack) return { ok: false, message: 'Nothing to sell.' };
  const base = offerFor(npcId, stack.itemId, festival);
  if (base === undefined) return { ok: false, message: `${NPCS[npcId].name} doesn't buy that.` };
  const price = withQuality(base, stack.q);
  const qty = typeof quantity === 'number' && Number.isInteger(quantity) ? quantity : 0;
  if (qty < 1) return { ok: false, message: 'Invalid quantity.' };
  const name = `${stack.q ? `${QUALITY_NAMES[stack.q]} ` : ''}${ITEMS[stack.itemId].name}`;
  const sold = inv.removeAt(index, qty);
  state.earn(sold * price);
  return { ok: true, message: `Sold ${sold}× ${name} for ${sold * price}g` };
}

export function barterWith(state: PlayerState, npcId: NpcId, offer: unknown): TxResult {
  const deals = NPCS[npcId].shop?.barter ?? [];
  const i = typeof offer === 'number' && Number.isInteger(offer) ? offer : -1;
  const deal = deals[i];
  if (!deal) return { ok: false, message: 'No such trade.' };
  const inv = state.inventory;
  const missing = deal.give.find((g) => inv.count(g.itemId) < g.quantity);
  if (missing) return { ok: false, message: `You need ${missing.quantity}× ${ITEMS[missing.itemId].name}.` };
  if (inv.capacityFor(deal.get.itemId) < deal.get.quantity && !freesSpaceFor(state, deal.give)) {
    return { ok: false, message: 'Not enough room in your inventory.' };
  }
  for (const g of deal.give) inv.remove(g.itemId, g.quantity);
  const leftover = inv.add(deal.get.itemId, deal.get.quantity);
  if (leftover > 0) {
    for (const g of deal.give) inv.add(g.itemId, g.quantity);
    inv.remove(deal.get.itemId, deal.get.quantity - leftover);
    return { ok: false, message: 'Not enough room in your inventory.' };
  }
  return { ok: true, message: `Traded for ${deal.get.quantity}× ${ITEMS[deal.get.itemId].name}` };
}
