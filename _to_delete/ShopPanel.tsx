'use client';

import { ITEM_IDS, ITEMS, type Season } from '@farming/shared';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { isInStock } from '@/game-engine/state/economy';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];

interface ShopProps {
  inventory: InventoryView;
  gold: number;
  lifetimeEarnings: number;
  season: Season;
}

/** Mira's stall: buy what's in stock this season, sell anything with a price. */
export function ShopPanel({ inventory, gold, lifetimeEarnings, season }: ShopProps) {
  const forSale = ITEM_IDS.filter((id) => isInStock(id, lifetimeEarnings, season));
  const nextUnlock = ITEM_IDS.map((id) => ITEMS[id])
    .filter((d) => d.unlockAtEarnings !== undefined && lifetimeEarnings < d.unlockAtEarnings)
    .sort((a, b) => a.unlockAtEarnings! - b.unlockAtEarnings!)[0];
  const sellable = inventory.slots
    .map((stack, slot) => ({ stack, slot }))
    .filter(({ stack }) => stack && ITEMS[stack.itemId].sellPrice !== undefined);

  return (
    <Panel
      title="Mira's Stall"
      footer={
        <span>
          Your gold: <strong>{gold}g</strong>
          {nextUnlock && (
            <span className="hud-muted">
              {' '}
              · Sell {nextUnlock.unlockAtEarnings! - lifetimeEarnings}g more to unlock {nextUnlock.name}
            </span>
          )}
        </span>
      }
    >
      <div className="shop">
        <section>
          <h3>Buy</h3>
          {forSale.length === 0 ? (
            <p className="hud-muted">Nothing grows in {season}. Come back in spring!</p>
          ) : (
            <ul className="shop-list">
              {forSale.map((id) => {
                const price = ITEMS[id].buyPrice ?? 0;
                return (
                  <li key={id}>
                    <ItemIcon id={id} />
                    <span className="shop-name">
                      {ITEMS[id].name}
                      <span className="hud-muted"> {price}g</span>
                    </span>
                    <button type="button" className="btn" disabled={gold < price} onClick={() => gameCommands.emit('shop:buy', { itemId: id, quantity: 1 })}>
                      ×1
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={gold < price * 5 || ITEMS[id].maxStack < 5}
                      onClick={() => gameCommands.emit('shop:buy', { itemId: id, quantity: 5 })}
                    >
                      ×5
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section>
          <h3>Sell</h3>
          {sellable.length === 0 ? (
            <p className="hud-muted">Nothing to sell yet. Harvest crops or gather resources.</p>
          ) : (
            <ul className="shop-list">
              {sellable.map(({ stack, slot }) => {
                const def = ITEMS[stack!.itemId];
                return (
                  <li key={slot}>
                    <ItemIcon id={stack!.itemId} />
                    <span className="shop-name">
                      {def.name} <span className="hud-muted">×{stack!.quantity} · {def.sellPrice}g each</span>
                    </span>
                    <button type="button" className="btn" onClick={() => gameCommands.emit('shop:sell', { slot, quantity: 1 })}>
                      Sell 1
                    </button>
                    <button type="button" className="btn" onClick={() => gameCommands.emit('shop:sell', { slot, quantity: stack!.quantity })}>
                      All
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Panel>
  );
}
