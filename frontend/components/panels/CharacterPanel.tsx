'use client';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { CharacterPicker } from '../CharacterPicker';
import { Panel } from './Panel';

/** In-game customisation; changes apply to the player sprite immediately. */
export function CharacterPanel() {
  const look = useGameEvent('player:appearance');
  if (!look) return null;
  return (
    <Panel title="Character">
      <CharacterPicker choice={look.choice} onPick={(part, index) => gameCommands.emit('appearance:set', { part, index })} />
    </Panel>
  );
}
