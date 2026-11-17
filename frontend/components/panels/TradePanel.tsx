'use client';

import { useState } from 'react';
import { ITEMS, withQuality } from '@farming/shared';
import { qualityName, qualityStar } from '../quality';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Hearts } from '../Hearts';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];
type Tab = 'buy' | 'sell' | 'barter' | 'gift';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
  { id: 'barter', label: 'Trade' },
  { id: 'gift', label: 'Gift' },
];

function countOf(inventory: InventoryView, itemId: string): number {
  return inventory.slots.reduce((sum, s) => (s?.itemId === itemId ? sum + s.quantity : sum), 0);
}

/**
 * A merchant's stall: buy their goods (cheaper as you become friends), sell
 * them what they want, swap items, or give a gift. The game validates
 * every action; this only shows what's possible.
 */
export function TradePanel({ inventory, gold, lifetimeEarnings }: { inventory: InventoryView; gold: number; lifetimeEarnings: number }) {
  const shop = useGameEvent('shop:context');
  const [tab, setTab] = useState<Tab>('buy');
  if (!shop) return null;

  const sellable = inventory.slots
    .map((stack, slot) => ({ stack, slot }))
    .filter(({ stack }) => stack && shop.offers[stack.itemId] !== undefined);
  const giftable = inventory.slots
    .map((stack, slot) => ({ stack, slot }))
    .filter(({ stack }) => stack && !ITEMS[stack.itemId].tool && !ITEMS[stack.itemId].places && !ITEMS[stack.itemId].releases);
  const nextUnlock = shop.npcId === 'mira'
    ? Object.values(ITEMS)
        .filter((d) => d.unlockAtEarnings !== undefined && lifetimeEarnings < d.unlockAtEarnings)
        .sort((a, b) => a.unlockAtEarnings! - b.unlockAtEarnings!)[0]
    : undefined;

  return (
    <Panel
      title={shop.shopTitle}
      footer={
        <span>
          Your gold: <strong>{gold}g</strong>
          {shop.discount > 0 && <span className="trade-discount"> · Friend discount −{Math.round(shop.discount * 100)}%</span>}
          {nextUnlock && (
            <span className="hud-muted">
              {' '}
              · Sell {nextUnlock.unlockAtEarnings! - lifetimeEarnings}g more to unlock {nextUnlock.name}
            </span>
          )}
        </span>
      }
    >
      <div className="trade-header">
        <div>
          <strong>{shop.name}</strong> <span className="hud-muted">· {shop.title}</span>
          <div>
            <Hearts count={shop.hearts} compact />
          </div>
        </div>
        <p className="trade-greeting">“{shop.greeting}”</p>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'buy' && (
        <ul className="shop-list">
          {shop.stock.length === 0 && <li className="hud-muted">Nothing in stock right now — come back next season!</li>}
          {shop.stock.map(({ itemId, price, basePrice }) => (
            <li key={itemId}>
              <ItemIcon id={itemId} />
              <span className="shop-name">
                {ITEMS[itemId].name}
                <span className="hud-muted"> {price}g</span>
                {price < basePrice && <s className="hud-muted"> {basePrice}g</s>}
              </span>
              <button type="button" className="btn" disabled={gold < price} onClick={() => gameCommands.emit('shop:buy', { itemId, quantity: 1 })}>
                ×1
              </button>
              <button
                type="button"
                className="btn"
                disabled={gold < price * 5 || ITEMS[itemId].maxStack < 5}
                onClick={() => gameCommands.emit('shop:buy', { itemId, quantity: 5 })}
              >
                ×5
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'sell' && (
        <ul className="shop-list">
          {sellable.length === 0 && <li className="hud-muted">{shop.name} isn&apos;t interested in anything you&apos;re carrying.</li>}
          {sellable.map(({ stack, slot }) => {
            const price = withQuality(shop.offers[stack!.itemId]!, stack!.q);
            return (
              <li key={slot}>
                <ItemIcon id={stack!.itemId} />
                <span className="shop-name">
                  {qualityStar(stack!.q)}{qualityName(stack!.itemId, stack!.q)} <span className="hud-muted">×{stack!.quantity} · {price}g each</span>
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

      {tab === 'barter' && (
        <ul className="shop-list">
          {shop.barter.length === 0 && <li className="hud-muted">No trades today.</li>}
          {shop.barter.map((deal, index) => {
            const ok = deal.give.every((g) => countOf(inventory, g.itemId) >= g.quantity);
            return (
              <li key={index} className="barter">
                <span className="barter-give">
                  {deal.give.map((g) => {
                    const have = countOf(inventory, g.itemId);
                    return (
                      <span key={g.itemId} className={have >= g.quantity ? 'have' : 'lack'} title={ITEMS[g.itemId].name}>
                        <ItemIcon id={g.itemId} size={16} /> {have}/{g.quantity}
                      </span>
                    );
                  })}
                </span>
                <span className="barter-arrow">→</span>
                <span className="shop-name">
                  <ItemIcon id={deal.get.itemId} size={16} /> {deal.get.quantity}× {ITEMS[deal.get.itemId].name}
                </span>
                <button type="button" className="btn" disabled={!ok} onClick={() => gameCommands.emit('shop:barter', { index })}>
                  Trade
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'gift' && (
        <>
          <p className="hud-muted trade-gift-note">
            {shop.giftedToday
              ? `You've already given ${shop.name} a gift today. Come back tomorrow!`
              : `One gift a day. ${shop.name} loves ${shop.loves.map((i) => ITEMS[i].name).join(' and ')}.`}
          </p>
          <ul className="shop-list">
            {giftable.length === 0 && <li className="hud-muted">Nothing to give. Crops, fish and food make great gifts.</li>}
            {giftable.map(({ stack, slot }) => {
              const id = stack!.itemId;
              const mood = shop.loves.includes(id) ? 'Loves this' : shop.likes.includes(id) ? 'Likes this' : null;
              return (
                <li key={slot}>
                  <ItemIcon id={id} />
                  <span className="shop-name">
                    {ITEMS[id].name} <span className="hud-muted">×{stack!.quantity}</span>
                    {mood && <span className="trade-mood"> ♥ {mood}</span>}
                  </span>
                  <button type="button" className="btn" disabled={shop.giftedToday} onClick={() => gameCommands.emit('shop:gift', { slot })}>
                    Give
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
