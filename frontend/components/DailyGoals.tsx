'use client';

import { useEffect, useState } from 'react';
import { useGameEvent } from '@/hooks/useGameEvent';

const KEY = 'farming-game:daily-open';

/** Today's three goals, under the clock and gold. Click the header to fold it away. */
export function DailyGoals() {
  const state = useGameEvent('daily:state');
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(KEY) !== '0');
    } catch {
      // Storage unavailable: start open.
    }
  }, []);
  if (!state || !state.goals.length) return null;
  const toggle = () => {
    setOpen(!open);
    try {
      window.localStorage.setItem(KEY, open ? '0' : '1');
    } catch {
      // Ignore.
    }
  };
  const done = state.goals.filter((g) => g.done).length;
  return (
    <div className={`hud-panel daily${state.allDone ? ' daily-complete' : ''}`}>
      <button type="button" className="daily-header" onMouseDown={(e) => e.preventDefault()} onClick={toggle} title={open ? 'Hide today’s goals' : 'Show today’s goals'}>
        <span>📋 Today {done}/{state.goals.length}</span>
        {state.streak > 0 && (
          <span className="daily-streak" title={`Best streak: ${state.best} days`}>
            🔥 {state.streak}
          </span>
        )}
        <span className="daily-caret">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <ul className="daily-list">
            {state.goals.map((g) => (
              <li key={g.kind} className={g.done ? 'daily-done' : ''} title={g.hint}>
                <span className="daily-icon">{g.done ? '✅' : g.icon}</span>
                <span className="daily-text">
                  {g.text}
                  {!g.done && (
                    <span className="daily-bar">
                      <span style={{ width: `${Math.round((g.have / g.need) * 100)}%` }} />
                    </span>
                  )}
                </span>
                <span className="daily-reward">{g.done ? `${g.have}/${g.need}` : `${g.have}/${g.need} · ${g.gold}g`}</span>
              </li>
            ))}
          </ul>
          <div className="daily-foot hud-muted">
            {state.allDone
              ? `All done! See you tomorrow.${state.next ? ` ${state.next.days - state.streak} more day${state.next.days - state.streak === 1 ? '' : 's'} to: ${state.next.text}.` : ''}`
              : `Finish all three: +${state.bonus}g${state.next ? ` · ${state.next.days}-day streak: ${state.next.text}` : ''}`}
          </div>
        </>
      )}
    </div>
  );
}
