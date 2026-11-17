'use client';

import { useState } from 'react';
import { ITEMS } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Hearts } from '../Hearts';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** The main story and the villagers' personal requests. */
export function JournalPanel() {
  const j = useGameEvent('journal:state');
  const [tab, setTab] = useState<'guide' | 'story' | 'villagers'>('guide');
  if (!j) return null;
  const c = j.chapter;
  return (
    <Panel title="Journal" footer={<span className="hud-muted">Chapter rewards arrive in your mailbox. Villager requests unlock as you become friends.</span>}>
      <nav className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'guide'} className={`tab${tab === 'guide' ? ' active' : ''}`} onClick={() => setTab('guide')}>
          Guide {j.guide ? `${j.guide.filter((g) => g.done).length}/${j.guide.length}` : ''}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'story'} className={`tab${tab === 'story' ? ' active' : ''}`} onClick={() => setTab('story')}>
          Story
        </button>
        <button type="button" role="tab" aria-selected={tab === 'villagers'} className={`tab${tab === 'villagers' ? ' active' : ''}`} onClick={() => setTab('villagers')}>
          Villager requests
        </button>
      </nav>
      {tab === 'guide' && j.guide && (
        <ul className="achievement-list guide-list">
          {[...j.guide.filter((g) => !g.done), ...j.guide.filter((g) => g.done)].map((g) => (
            <li key={g.id} className={g.done ? 'earned' : ''}>
              <span className="achievement-icon" aria-hidden>
                {g.done ? '✅' : '⬜'}
              </span>
              <div>
                <strong>{g.text}</strong>
                {!g.done && <div className="hud-muted">{g.hint}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {tab === 'story' &&
        (c ? (
          <div className="journal-chapter">
            <span className="hud-muted">
              Chapter {c.index + 1} of {c.total}
            </span>
            <h3>{c.title}</h3>
            <p>
              “{c.text}” <span className="hud-muted">— {c.from}</span>
            </p>
            <div className="journal-goal">
              <strong>Goal:</strong> {c.goal}
              <div className="community-bar" aria-label={`${c.have} of ${c.need}`}>
                <span style={{ width: `${(Math.min(c.have, c.need) / c.need) * 100}%` }} />
              </div>
              <span className="hud-muted">
                {Math.min(c.have, c.need).toLocaleString()} / {c.need.toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="journal-chapter">
            <h3>The valley is alive again ✨</h3>
            <p>You've finished the story. Thank you for playing — the farm is yours to enjoy.</p>
          </div>
        ))}
      {tab === 'villagers' && (
        <ul className="board-list">
          {j.arcs.map((a) => (
            <li key={a.npc} className={`board-note${a.step ? '' : ' done'}`}>
              <div className="board-note-text">
                <p>
                  <strong>{a.name}</strong> <span className="hud-muted">· {a.done}/{a.total} done</span>
                </p>
                {a.step ? (
                  a.hearts >= a.step.needHearts ? (
                    <p>“{a.step.text}”</p>
                  ) : (
                    <p className="hud-muted">Reach {a.step.needHearts} hearts to hear what {a.name} needs.</p>
                  )
                ) : (
                  <p className="hud-muted">All of {a.name}&apos;s requests are done. ♥</p>
                )}
                <Hearts count={a.hearts} compact />
              </div>
              {a.step && a.hearts >= a.step.needHearts && (
                <div className="board-note-want">
                  <ItemIcon id={a.step.want.itemId} />
                  <span className={a.step.have >= a.step.want.quantity ? 'have' : 'lack'}>
                    {Math.min(a.step.have, a.step.want.quantity)}/{a.step.want.quantity} {ITEMS[a.step.want.itemId].name}
                  </span>
                </div>
              )}
              {a.step && a.hearts >= a.step.needHearts && (
                <button type="button" className="btn" disabled={a.step.have < a.step.want.quantity} onClick={() => gameCommands.emit('arc:deliver', { npc: a.npc })}>
                  Give
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
