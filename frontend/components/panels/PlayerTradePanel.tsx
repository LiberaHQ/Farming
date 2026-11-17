'use client';

import { COOP, ITEMS, type ItemAmount, type ItemId, type TradeOffer } from '@farming/shared';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];

function OfferList({ offer, empty }: { offer: TradeOffer; empty: string }) {
  if (offer.items.length === 0 && offer.gold === 0) return <p className="hud-muted">{empty}</p>;
  return (
    <ul className="p2p-offer">
      {offer.items.map((it) => (
        <li key={it.itemId}>
          <ItemIcon id={it.itemId} size={16} /> {it.quantity}× {ITEMS[it.itemId].name}
        </li>
      ))}
      {offer.gold > 0 && (
        <li>
          <span className="coin" /> {offer.gold}g
        </li>
      )}
    </ul>
  );
}

/**
 * Trading with another player. Each side builds an offer and confirms; any
 * change un-confirms both. When both confirm, the server swaps the offers.
 */
export function PlayerTradePanel({ inventory, gold }: { inventory: InventoryView; gold: number }) {
  const trade = useGameEvent('trade:state');
  if (!trade) return null;
  const busy = trade.phase === 'committing';

  // What you could still add: your items, totalled per kind, minus what's already offered.
  const owned = new Map<ItemId, number>();
  for (const s of inventory.slots) if (s) owned.set(s.itemId, (owned.get(s.itemId) ?? 0) + s.quantity);
  const offered = new Map(trade.mine.items.map((i) => [i.itemId, i.quantity]));

  const send = (items: ItemAmount[], g = trade.mine.gold) => gameCommands.emit('trade:offer', { items: items.filter((i) => i.quantity > 0), gold: g });
  const setQty = (itemId: ItemId, quantity: number) => {
    const others = trade.mine.items.filter((i) => i.itemId !== itemId);
    send(quantity > 0 ? [...others, { itemId, quantity }] : others);
  };
  const full = trade.mine.items.length >= COOP.tradeMaxStacks;

  return (
    <Panel
      title={`Trading with ${trade.partner.name}`}
      onClose={() => gameCommands.emit('trade:cancel', {})}
      footer={
        <div className="p2p-footer">
          <span className="hud-muted">
            {busy
              ? 'Swapping…'
              : trade.myConfirmed && !trade.theirConfirmed
                ? `Waiting for ${trade.partner.name} to accept…`
                : trade.theirConfirmed && !trade.myConfirmed
                  ? `${trade.partner.name} accepted. Accept to trade.`
                  : 'Both players must accept. Changing an offer un-accepts both.'}
          </span>
          <button type="button" className="btn" disabled={busy} onClick={() => gameCommands.emit('trade:cancel', {})}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || trade.myConfirmed} onClick={() => gameCommands.emit('trade:confirm', {})}>
            {trade.myConfirmed ? 'Accepted ✓' : 'Accept trade'}
          </button>
        </div>
      }
    >
      <div className="p2p">
        <section>
          <h3>
            You give {trade.myConfirmed && <span className="have">✓</span>}
          </h3>
          <OfferList offer={trade.mine} empty="Nothing yet — add items below." />
          <label className="p2p-gold">
            Gold
            <input
              type="number"
              min={0}
              max={gold}
              value={trade.mine.gold}
              disabled={busy}
              onFocus={() => gameCommands.emit('input:typing', { typing: true })}
              onBlur={() => gameCommands.emit('input:typing', { typing: false })}
              onChange={(e) => send(trade.mine.items, Math.max(0, Math.min(gold, Math.floor(Number(e.target.value) || 0))))}
            />
            <span className="hud-muted">of {gold}g</span>
          </label>
        </section>
        <section>
          <h3>
            {trade.partner.name} gives {trade.theirConfirmed && <span className="have">✓</span>}
          </h3>
          <OfferList offer={trade.theirs} empty="Nothing yet." />
        </section>
      </div>

      <h3 className="panel-subtitle">Your backpack</h3>
      <ul className="shop-list p2p-backpack">
        {[...owned].map(([itemId, have]) => {
          const inOffer = offered.get(itemId) ?? 0;
          const canAdd = !busy && inOffer < have && (inOffer > 0 || !full);
          return (
            <li key={itemId}>
              <ItemIcon id={itemId} />
              <span className="shop-name">
                {ITEMS[itemId].name} <span className="hud-muted">×{have}{inOffer ? ` · offering ${inOffer}` : ''}</span>
              </span>
              <button type="button" className="btn" disabled={!canAdd} onClick={() => setQty(itemId, inOffer + 1)}>
                +1
              </button>
              <button type="button" className="btn" disabled={!canAdd} onClick={() => setQty(itemId, have)}>
                All
              </button>
              <button type="button" className="btn" disabled={busy || inOffer === 0} onClick={() => setQty(itemId, 0)}>
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
