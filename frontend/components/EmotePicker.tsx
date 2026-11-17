'use client';

import { EMOTES } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { actionKey } from '@/game-engine/settings';
import { useGameEvent } from '@/hooks/useGameEvent';

/** A row of emotes (T, or the smiley button); co-op partners see them too. */
export function EmotePicker() {
  const open = useGameEvent('emote:picker');
  return (
    <>
      <button
        type="button"
        className="hud-panel emote-toggle"
        title={`Emotes (${actionKey('emote')})`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => gameCommands.emit('emote:toggle', {})}
      >
        😊
      </button>
      {open && (
        <div className="hud-panel emote-picker" role="menu">
          {EMOTES.map((e) => (
            <button key={e} type="button" className="emote-btn" onMouseDown={(ev) => ev.preventDefault()} onClick={() => gameCommands.emit('emote', { emote: e })}>
              {e}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
