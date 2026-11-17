'use client';

import { useEffect, useRef } from 'react';
import { gameCommands, gameEvents } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { useSettings } from '@/hooks/useSettings';
import { actionKey } from '@/game-engine/settings';

const EDGE = 70;

/**
 * A button that floats above whatever the player is facing, labelled with what
 * will happen ("Chop", "Harvest Turnip", "Talk to Mira"…). Click it, or press
 * the key shown on it.
 *
 * The label changes rarely (React state); the position changes every frame,
 * so it is written straight to the element's style instead of re-rendering.
 */
export function ActionButton() {
  const hint = useGameEvent('interaction:hint');
  useSettings(); // re-render with new key labels
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(
    () =>
      gameEvents.on('interaction:anchor', (anchor) => {
        const el = ref.current;
        if (!el) return;
        if (!anchor) {
          el.dataset.hidden = 'true';
          return;
        }
        const x = Math.max(EDGE, Math.min(window.innerWidth - EDGE, anchor.x));
        const y = Math.max(48, anchor.y - 6);
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        el.dataset.hidden = 'false';
      }),
    [],
  );

  const show = !!hint?.action;
  const trigger = hint?.key === 'E' ? 'interact' : 'use';

  return (
    <button
      ref={ref}
      type="button"
      className={`action-button${hint?.blocked ? ' action-blocked' : ''}${hint?.info ? ' action-info' : ''}`}
      data-hidden="true"
      style={{ visibility: show ? undefined : 'hidden' }}
      // Keep keyboard focus on the game so Space doesn't also "click" this button.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => gameCommands.emit('action:perform', { trigger })}
      aria-label={hint?.action ?? undefined}
    >
      <span className="action-bob">
        {hint?.key && <kbd>{actionKey(trigger)}</kbd>}
        {hint?.action}
      </span>
    </button>
  );
}
