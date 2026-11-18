'use client';

import { useEffect, useState } from 'react';
import { gameCommands, gameEvents } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ChatBox } from './ChatBox';

/**
 * Co-op overlay: the invite code and who's here (with a Trade button each),
 * how many are in bed, incoming trade requests, chat, and what happens when
 * the session ends.
 */
export function CoopHud() {
  const info = useGameEvent('coop:info');
  const members = useGameEvent('coop:members') ?? [];
  const sleep = useGameEvent('coop:sleep');
  const reconnecting = useGameEvent('coop:reconnecting');
  const ended = useGameEvent('coop:ended');
  const [invites, setInvites] = useState<Array<{ from: string; name: string }>>([]);
  const [copied, setCopied] = useState(false);

  useEffect(
    () =>
      gameEvents.on('trade:incoming', (p) => {
        setInvites((list) => [...list.filter((i) => i.from !== p.from), p]);
        // Requests expire on the server after 30 seconds.
        setTimeout(() => setInvites((list) => list.filter((i) => i.from !== p.from)), 30_000);
      }),
    [],
  );

  if (!info) return null;

  const respond = (from: string, accept: boolean) => {
    gameCommands.emit('trade:respond', { from, accept });
    setInvites((list) => list.filter((i) => i.from !== from));
  };
  const copy = () => {
    void navigator.clipboard?.writeText(info.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <div className="hud-panel coop-roster">
        {info.valley ? (
          <div className="coop-code">
            <span className="hud-muted">🌍 Open World</span> <strong>{info.valley}</strong>
            <button type="button" className="btn btn-small btn-primary" onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('tournament:open', {})}>
              🏆 Tournaments
            </button>
          </div>
        ) : (
          <div className="coop-code">
            <span className="hud-muted">Co-op code</span> <strong>{info.code}</strong>
            <button type="button" className="btn btn-small" onMouseDown={(e) => e.preventDefault()} onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
        <ul className="coop-members">
          {members.map((m) => (
            <li key={m.id}>
              <span className="coop-name">
                {m.host && <span title="Host">★ </span>}
                {m.name}
                {m.id === info.selfId && <span className="hud-muted"> (you)</span>}
                {m.inBed && <span title="In bed"> 💤</span>}
              </span>
              {m.id !== info.selfId && (
                <button type="button" className="btn btn-small" title={`Show the way to ${m.name}`} aria-label={`Find ${m.name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('coop:find', { id: m.id })}>
                  📍
                </button>
              )}
              {m.id !== info.selfId && (
                <button type="button" className="btn btn-small" onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('trade:request', { to: m.id })}>
                  Trade
                </button>
              )}
            </li>
          ))}
        </ul>
        {sleep && (
          <div className="hud-muted coop-sleep">
            In bed: {sleep.inBed}/{sleep.total} — the day ends when everyone is.
          </div>
        )}
      </div>

      {invites.length > 0 && (
        <div className="trade-invites">
          {invites.map((i) => (
            <div key={i.from} className="hud-panel trade-invite" role="alertdialog">
              <span>
                <strong>{i.name}</strong> wants to trade.
              </span>
              <button type="button" className="btn btn-primary" onClick={() => respond(i.from, true)}>
                Accept
              </button>
              <button type="button" className="btn" onClick={() => respond(i.from, false)}>
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      <ChatBox />

      {reconnecting && !ended && (
        <div className="coop-reconnecting" role="status">
          📡 Connection lost — reconnecting ({reconnecting.attempt}/{reconnecting.of})…
        </div>
      )}

      {ended && (
        <div className="coop-ended" role="alertdialog">
          <div className="panel">
            <header className="panel-header">
              <h2>Co-op session ended</h2>
            </header>
            <div className="panel-body">
              <p>{ended.reason}</p>
              <p className="hud-muted">Your progress in this world was saved.</p>
              <a className="btn btn-primary" href="/start">
                Back to title
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
