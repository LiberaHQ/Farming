'use client';

import { useEffect, useState } from 'react';
import { ITEMS } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** The seed exchange: pack heirloom seeds into a code for a friend, or open one they sent. */
function SeedExchange() {
  const seeds = useGameEvent('seeds:state');
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  // Typing a code must not move the farmer around.
  useEffect(() => () => gameCommands.emit('input:typing', { typing: false }), []);
  const packed = seeds?.parcel?.code;
  useEffect(() => setCopied(false), [packed]);
  if (!seeds) return null;
  const copy = () => {
    if (!seeds.parcel) return;
    navigator.clipboard?.writeText(seeds.parcel.code).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <div className="seed-exchange">
      <p className="hud-muted">
        Your valley grows <strong>{seeds.native.map((n) => n.name).join(' and ')}</strong> — other valleys grow other heirlooms. Varieties you've grown: {seeds.grown}/{seeds.total}.
      </p>

      <h3>Send seeds</h3>
      {seeds.holding.length === 0 ? (
        <p className="hud-muted">Carry some heirloom seeds (they have a gold star) to pack a parcel.</p>
      ) : (
        <ul className="shop-list">
          {seeds.holding.map((h) => (
            <li key={h.itemId}>
              <ItemIcon id={h.itemId} />
              <span className="shop-name">
                {h.name} <span className="hud-muted">· you have {h.have}</span>
              </span>
              {seeds.sizes.map((n) => (
                <button key={n} type="button" className="btn" disabled={h.have < n} onClick={() => gameCommands.emit('seeds:pack', { itemId: h.itemId, quantity: n })}>
                  Pack {n}
                </button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {seeds.parcel && (
        <div className="seed-code">
          <span className="hud-muted">
            Parcel of {seeds.parcel.quantity} {seeds.parcel.name} — give this code to a friend:
          </span>
          <div className="seed-code-row">
            <code>{seeds.parcel.code}</code>
            <button type="button" className="btn" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <h3>Open a parcel</h3>
      <form
        className="seed-code-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!code.trim()) return;
          gameCommands.emit('seeds:redeem', { code: code.trim() });
          setCode('');
        }}
      >
        <input
          className="seed-input"
          value={code}
          maxLength={40}
          placeholder="HV-XXXXXXX-XXXXXXX-XXXXXXX"
          aria-label="Seed parcel code"
          onChange={(e) => setCode(e.target.value)}
          onFocus={() => gameCommands.emit('input:typing', { typing: true })}
          onBlur={() => gameCommands.emit('input:typing', { typing: false })}
        />
        <button type="submit" className="btn btn-primary" disabled={!code.trim()}>
          Open
        </button>
      </form>
      <p className="hud-muted">Each parcel opens once per valley. In co-op you can also just trade seeds with each other.</p>
    </div>
  );
}

/** The mailbox: letters from villagers (some with gifts) and festival notices, and the heirloom seed exchange. */
export function MailPanel() {
  const mail = useGameEvent('mail:list');
  const [openId, setOpenId] = useState<number | null>(null);
  const [tab, setTab] = useState<'letters' | 'seeds'>('letters');
  if (!mail) return null;
  const letters = mail.letters;
  const open = letters.find((l) => l.id === openId) ?? null;

  return (
    <Panel title="Mailbox">
      <nav className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'letters'} className={`tab${tab === 'letters' ? ' active' : ''}`} onClick={() => setTab('letters')}>
          Letters
        </button>
        <button type="button" role="tab" aria-selected={tab === 'seeds'} className={`tab${tab === 'seeds' ? ' active' : ''}`} onClick={() => setTab('seeds')}>
          🌱 Seed exchange
        </button>
      </nav>
      {tab === 'seeds' && <SeedExchange />}
      {tab === 'letters' && (
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
      )}
    </Panel>
  );
}
