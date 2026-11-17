'use client';

import { useEffect, useState } from 'react';
import { gameCommands, type MarketView } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

type SpiritId = MarketView['spirit'];

/** The ghost night market in the graveyard: three spirits, three ways to trade. */
export function NightMarketPanel() {
  const market = useGameEvent('market:state');
  const [tab, setTab] = useState<SpiritId>(market?.spirit ?? 'wick');
  // Open on the stall of whichever spirit you spoke to.
  const opened = market?.spirit;
  useEffect(() => {
    if (opened) setTab(opened);
  }, [opened]);
  if (!market) return null;
  const spirit = market.spirits.find((s) => s.id === tab) ?? market.spirits[0];
  return (
    <Panel title="🌙 Night Market" footer={<span className="hud-muted">The spirits keep their stalls from 10pm until the night ends. You have {market.gold.toLocaleString()}g.</span>}>
      <nav className="tabs" role="tablist">
        {market.spirits.map((s) => (
          <button key={s.id} type="button" role="tab" aria-selected={tab === s.id} className={`tab${tab === s.id ? ' active' : ''}`} onClick={() => setTab(s.id)}>
            {s.emoji} {s.name}
          </button>
        ))}
      </nav>
      <p className="market-greeting">
        <strong>
          {spirit.name}, {spirit.title.toLowerCase()}:
        </strong>{' '}
        “{spirit.greeting}”
      </p>

      {tab === 'wick' && (
        <ul className="shop-list">
          {market.wick.map((w) => (
            <li key={w.itemId} className={w.have > 0 ? '' : 'market-none'}>
              <ItemIcon id={w.itemId} />
              <span className="shop-name">
                {w.itemName} <span className="hud-muted">· {w.price.toLocaleString()}g each · you have {w.have}</span>
              </span>
              <button type="button" className="btn" disabled={w.have <= 0} onClick={() => gameCommands.emit('market:sell', { itemId: w.itemId, all: false })}>
                Sell 1
              </button>
              <button type="button" className="btn btn-primary" disabled={w.have <= 1} onClick={() => gameCommands.emit('market:sell', { itemId: w.itemId, all: true })}>
                Sell all
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'moth' && (
        <ul className="shop-list">
          {market.moth.map((t) => (
            <li key={t.index}>
              <ItemIcon id={t.get.itemId} />
              <span className="shop-name">
                {t.get.quantity > 1 ? `${t.get.quantity} ` : ''}
                {t.get.itemName}
                <span className="market-give">
                  for{' '}
                  {t.give.map((g, i) => (
                    <span key={g.itemId} className={g.have >= g.quantity ? 'have' : 'lack'}>
                      {i > 0 ? ' + ' : ''}
                      {g.quantity} {g.itemName} ({g.have})
                    </span>
                  ))}
                </span>
              </span>
              <button type="button" className="btn btn-primary" disabled={!t.can} onClick={() => gameCommands.emit('market:barter', { index: t.index })}>
                Swap
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'ferryman' && (
        <ul className="shop-list">
          {market.ferry.map((o) => (
            <li key={o.index} className={o.bought ? 'market-none' : ''}>
              <ItemIcon id={o.itemId} />
              <span className="shop-name">
                {o.itemName} <span className="hud-muted">· {o.price.toLocaleString()}g toll</span>
              </span>
              <button type="button" className="btn btn-primary" disabled={o.bought || market.gold < o.price} onClick={() => gameCommands.emit('market:buy', { index: o.index })}>
                {o.bought ? 'Crossed ✓' : 'Buy'}
              </button>
            </li>
          ))}
          <li className="hud-muted">One of each tonight. The boat brings different goods every night.</li>
        </ul>
      )}
    </Panel>
  );
}
