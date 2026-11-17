'use client';

import { actionKey } from '@/game-engine/settings';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Hearts } from './Hearts';

/** A speech box at the bottom of the screen. Space, E, Esc or a click closes it. */
export function DialogueBox() {
  const line = useGameEvent('dialogue');
  if (!line) return null;
  return (
    <div className="dialogue" role="dialog" aria-label={line.speaker} onClick={() => gameCommands.emit('dialogue:next', {})}>
      <div className="dialogue-speaker">
        {line.speaker}
        {line.hearts !== undefined && <Hearts count={line.hearts} compact />}
      </div>
      <p>{line.text}</p>
      <div className="dialogue-more">
        <kbd>{actionKey('use')}</kbd> {line.more ? 'next' : 'continue'}
      </div>
    </div>
  );
}
