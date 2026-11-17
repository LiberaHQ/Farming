'use client';

import { useState } from 'react';
import { ITEMS } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** The mailbox: letters from villagers (some with gifts) and festival notices. */
export function MailPanel() {
  const mail = useGameEvent('mail:list');
  const [openId, setOpenId] = useState<number | null>(null);
  if (!mail) return null;
  const letters = mail.letters;
  const open = letters.find((l) => l.id === openId) ?? null;

  return (
    <Panel title="Mailbox">
      <div className="mail">
        <ul className="mail-list">
          {letters.length === 0 && <li className="hud-muted">No letters yet.</li>}
          {letters.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className={`mail-item${l.read ? '' : ' unread'}${openId === l.id ? ' active' : ''}`}
                onClick={() => {
                  setOpenId(l.id);
                  if (!l.read) gameCommands.emit('mail:read', { id: l.id });
                }}
              >
                <span className="mail-from">{l.from}</span>
                <span className="mail-subject">
                  {l.attachment && !l.claimed && '🎁 '}
                  {l.subject}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <article className="letter">
          {open ? (
            <>
              <h3>{open.subject}</h3>
              <p className="hud-muted">From {open.from} · day {open.day}</p>
              <p className="letter-body">{open.body}</p>
              {open.attachment && (
                <div className="letter-gift">
                  <ItemIcon id={open.attachment.itemId} />
                  <span>
                    {open.attachment.quantity}× {ITEMS[open.attachment.itemId].name}
                  </span>
                  <button type="button" className="btn btn-primary" disabled={open.claimed} onClick={() => gameCommands.emit('mail:claim', { id: open.id })}>
                    {open.claimed ? 'Taken' : 'Take'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="hud-muted">Choose a letter.</p>
          )}
        </article>
      </div>
    </Panel>
  );
}
