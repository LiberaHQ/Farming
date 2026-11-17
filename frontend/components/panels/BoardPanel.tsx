'use client';

import { useEffect, useState } from 'react';
import { COMMUNITY_GOALS, ITEMS, communityDone } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Hearts } from '../Hearts';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** The village notice board: today's delivery requests, and how well you know everyone. */
export function BoardPanel() {
  const board = useGameEvent('board:state');
  const festival = useGameEvent('festival:today');
  const inventory = useGameEvent('inventory:changed');
  const community = useGameEvent('community:state');
  const [tab, setTab] = useState<'requests' | 'villagers' | 'community' | 'festival'>(festival ? 'festival' : 'requests');
  // On a festival day, open on the festival tab once its info arrives.
  const festivalId = festival?.id ?? null;
  useEffect(() => {
    if (festivalId) setTab('festival');
  }, [festivalId]);
  if (!board) return null;
  return (
    <Panel title="Village Notice Board" footer={<span className="hud-muted">New requests every morning. Talk to villagers daily and bring gifts to make friends.</span>}>
      <nav className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'requests'} className={`tab${tab === 'requests' ? ' active' : ''}`} onClick={() => setTab('requests')}>
          Requests
        </button>
        <button type="button" role="tab" aria-selected={tab === 'villagers'} className={`tab${tab === 'villagers' ? ' active' : ''}`} onClick={() => setTab('villagers')}>
          Villagers
        </button>
        <button type="button" role="tab" aria-selected={tab === 'community'} className={`tab${tab === 'community' ? ' active' : ''}`} onClick={() => setTab('community')}>
          Community
        </button>
        {festival && (
          <button type="button" role="tab" aria-selected={tab === 'festival'} className={`tab${tab === 'festival' ? ' active' : ''}`} onClick={() => setTab('festival')}>
            🎉 {festival.name}
          </button>
        )}
      </nav>

      {tab === 'festival' && festival && (
        <div className="festival">
          <p className="festival-tagline">{festival.tagline}</p>
          <p>{festival.details}</p>
          {festival.id === 'harvest_fair' &&
            (festival.canEnterFair ? (
              <ul className="shop-list">
                {(inventory?.slots ?? [])
                  .map((s, slot) => ({ s, slot }))
                  .filter(({ s }) => s && ITEMS[s.itemId].category === 'crop')
                  .map(({ s, slot }) => (
                    <li key={slot}>
                      <ItemIcon id={s!.itemId} />
                      <span className="shop-name">
                        {ITEMS[s!.itemId].name} <span className="hud-muted">· judged at {(ITEMS[s!.itemId].sellPrice ?? 0) * 3}g</span>
                      </span>
                      <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('festival:enter', { slot })}>
                        Enter
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="hud-muted">You've entered this year. Thanks for taking part!</p>
            ))}
        </div>
      )}

      {tab === 'requests' && (
        <ul className="board-list">
          {board.requests.length === 0 && <li className="hud-muted">No requests today.</li>}
          {board.requests.map((r) => (
            <li key={r.index} className={`board-note${r.done ? ' done' : ''}`}>
              <div className="board-note-text">
                <p>“{r.text}”</p>
                <span className="hud-muted">— {r.npcName}</span>
              </div>
              <div className="board-note-want">
                <ItemIcon id={r.itemId} />
                <span className={r.have >= r.quantity ? 'have' : 'lack'}>
                  {Math.min(r.have, r.quantity)}/{r.quantity} {r.itemName}
                </span>
                <span className="board-reward">+{r.reward}g ♥</span>
              </div>
              <button type="button" className="btn" disabled={r.done || r.have < r.quantity} onClick={() => gameCommands.emit('board:deliver', { index: r.index })}>
                {r.done ? 'Done ✓' : 'Deliver'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'community' && (
        <ul className="board-list community-list">
          {COMMUNITY_GOALS.map((g) => {
            const given = community?.[g.id] ?? {};
            const done = communityDone(community ?? {}, g.id);
            const total = g.needs.reduce((n, x) => n + x.quantity, 0);
            const sofar = g.needs.reduce((n, x) => n + Math.min(x.quantity, given[x.itemId] ?? 0), 0);
            return (
              <li key={g.id} className={`board-note community-goal${done ? ' done' : ''}`}>
                <div className="board-note-text">
                  <p>
                    <strong>{g.title}</strong> {done && '✓'}
                  </p>
                  <p className="hud-muted">
                    “{g.description}” — {g.from}
                  </p>
                  <div className="community-bar" aria-label={`${sofar} of ${total}`}>
                    <span style={{ width: `${(sofar / total) * 100}%` }} />
                  </div>
                  <span className="board-reward">
                    Reward for everyone: {g.gold}g + {ITEMS[g.gift.itemId].name}
                  </span>
                </div>
                <div className="community-needs">
                  {g.needs.map((n) => {
                    const got = Math.min(n.quantity, given[n.itemId] ?? 0);
                    const have = (inventory?.slots ?? []).reduce((sum, s) => (s?.itemId === n.itemId ? sum + s.quantity : sum), 0);
                    const full = got >= n.quantity;
                    return (
                      <div key={n.itemId} className="community-need">
                        <ItemIcon id={n.itemId} />
                        <span className={full ? 'have' : ''}>
                          {got}/{n.quantity} {ITEMS[n.itemId].name}
                        </span>
                        <button type="button" className="btn" disabled={full || have === 0} onClick={() => gameCommands.emit('community:donate', { goal: g.id, itemId: n.itemId })}>
                          {full ? '✓' : have > 0 ? `Give ${Math.min(have, n.quantity - got)}` : 'Give'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'villagers' && (
        <ul className="friend-list">
          {board.friends.map((f) => (
            <li key={f.id}>
              <div>
                <strong>{f.name}</strong> <span className="hud-muted">· {f.title}</span>
              </div>
              <Hearts count={f.hearts} compact />
              <span className="friend-today hud-muted">
                {f.talkedToday ? '✓ talked' : '· not talked'} {f.giftedToday ? '✓ gift' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
