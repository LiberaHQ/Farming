'use client';

import { useEffect, useRef, useState } from 'react';
import { COOP, type ChatMessage } from '@farming/shared';
import { gameCommands, gameEvents } from '@/game-engine/events/GameEventBus';

const SHOWN = 7;
const FADE_MS = 12_000;

/** Co-op chat. Enter opens the input (the game ignores keys while you type); Esc or Enter on empty closes it. */
export function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => gameEvents.on('chat:message', (m) => setMessages((list) => [...list.slice(-49), m])), []);

  // Old messages fade from the screen (they stay visible while chat is open).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || open) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) input.current?.focus();
    gameCommands.emit('input:typing', { typing: open });
  }, [open]);

  // Never leave the game deaf to the keyboard if this unmounts mid-typing.
  useEffect(() => () => gameCommands.emit('input:typing', { typing: false }), []);

  const close = () => {
    setOpen(false);
    setText('');
  };
  const send = () => {
    const value = text.trim();
    if (value) gameCommands.emit('chat:send', { text: value });
    close();
  };

  const visible = messages.slice(-SHOWN).filter((m) => open || now - m.at < FADE_MS);

  return (
    <div className={`chat${open ? ' chat-open' : ''}`}>
      {visible.length > 0 && (
        <ul className="chat-log" aria-live="polite">
          {visible.map((m, i) => (
            <li key={`${m.at}-${i}`} className={m.system ? 'chat-system' : undefined}>
              {m.system ? (
                m.text
              ) : (
                <>
                  <strong>{m.name}:</strong> {m.text}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <input
          ref={input}
          className="chat-input"
          value={text}
          maxLength={COOP.chatMaxLength}
          placeholder="Say something… (Enter to send, Esc to close)"
          onChange={(e) => setText(e.target.value)}
          onBlur={close}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') send();
            else if (e.key === 'Escape') close();
          }}
        />
      ) : (
        <button type="button" className="chat-hint" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(true)}>
          <kbd>Enter</kbd> chat
        </button>
      )}
    </div>
  );
}
