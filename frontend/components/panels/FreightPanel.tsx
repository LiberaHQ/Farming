'use client';

import { useState } from 'react';
import { gameCommands, type FreightOrderView } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** "today", "1 day left", "3 days left". */
function timeLeft(daysLeft: number): string {
  if (daysLeft <= 0) return 'last day today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

function Order({ o }: { o: FreightOrderView }) {
  const need = o.quantity - o.loaded;
  const canLoad = Math.min(need, o.have);
  const pay = o.pay ?? o.reward;
  return (
    <li className={`board-note freight-order${o.status !== 'open' ? ' done' : ''}`}>
      <div className="board-note-text">
        <p>
          <strong>
            {o.emoji} {o.townName}
          </strong>{' '}
          wants {o.quantity} {o.itemName}
        </p>
        <div className="community-bar" aria-label={`${o.loaded} of ${o.quantity} loaded`}>
          <span style={{ width: `${(o.loaded / o.quantity) * 100}%` }} />
        </div>
        {o.status === 'open' ? (
          <span className="hud-muted">
            By {o.due} · {timeLeft(o.daysLeft)} · loaded {o.loaded}/{o.quantity}
          </span>
        ) : (
          <span className="hud-muted">{o.note}</span>
        )}
      </div>
      <div className="board-note-want">
        <ItemIcon id={o.itemId} />
        {o.status === 'open' && <span className={o.have >= need ? 'have' : 'lack'}>{o.have} with you</span>}
        <span className="board-reward" title={o.partial ? 'Missed its date: paid at shipping prices' : undefined}>
          {o.partial ? '' : '+'}
          {pay.toLocaleString()}g
        </span>
      </div>
      {o.status === 'open' ? (
        <button type="button" className="btn" disabled={canLoad <= 0} onClick={() => gameCommands.emit('freight:load', { id: o.id })}>
          {canLoad > 0 ? `Load ${canLoad}` : 'Load'}
        </button>
      ) : (
        <span className="freight-status">{o.status === 'ready' ? '📦 Waiting' : '🚂 On its way'}</span>
      )}
    </li>
  );
}

/** The freight depot by the railway: orders from the towns down the line. */
export function FreightPanel() {
  const state = useGameEvent('freight:state');
  const [tab, setTab] = useState<'orders' | 'towns'>('orders');
  if (!state) return null;
  const open = state.orders.filter((o) => o.status === 'open');
  const moving = state.orders.filter((o) => o.status !== 'open');
  return (
    <Panel
      title="Freight Depot"
      footer={
        <span className="hud-muted">
          Loaded goods can't be taken back. The next train takes a full order; payment returns on the first train of a later day. If an order misses its date, what you
          loaded still goes, at shipping prices.
        </span>
      }
    >
      <p className="freight-trains">
        🚂 {state.trains.length > 0 ? <>Trains still to come today: {state.trains.join(' · ')}</> : 'No more trains today. The first one leaves in the morning.'}
      </p>
      <nav className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'orders'} className={`tab${tab === 'orders' ? ' active' : ''}`} onClick={() => setTab('orders')}>
          Orders
        </button>
        <button type="button" role="tab" aria-selected={tab === 'towns'} className={`tab${tab === 'towns' ? ' active' : ''}`} onClick={() => setTab('towns')}>
          Towns
        </button>
      </nav>

      {tab === 'orders' && (
        <ul className="board-list">
          {state.orders.length === 0 && <li className="hud-muted">No orders yet. The towns down the line post new ones in the morning.</li>}
          {open.map((o) => (
            <Order key={o.id} o={o} />
          ))}
          {moving.map((o) => (
            <Order key={o.id} o={o} />
          ))}
        </ul>
      )}

      {tab === 'towns' && (
        <ul className="board-list">
          {state.towns.map((t) => (
            <li key={t.name} className="board-note freight-town">
              <div className="board-note-text">
                <p>
                  <strong>
                    {t.emoji} {t.name}
                  </strong>
                </p>
                <span className="hud-muted">{t.blurb}</span>
              </div>
              <div className="board-note-want">
                <span>
                  {t.delivered} deliver{t.delivered === 1 ? 'y' : 'ies'}
                </span>
                <span className="board-reward">{t.bonus > 0 ? `+${t.bonus}% pay` : ''}</span>
              </div>
            </li>
          ))}
          <li className="hud-muted">Every order you deliver in full makes a town pay 2% more, up to +20%.</li>
        </ul>
      )}
    </Panel>
  );
}
