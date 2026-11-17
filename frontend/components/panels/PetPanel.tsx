'use client';

import { useEffect, useState } from 'react';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Panel } from './Panel';

/** Naming the stray you adopt. */
export function PetPanel() {
  const offer = useGameEvent('pet:offer');
  const [name, setName] = useState('');
  useEffect(() => () => gameCommands.emit('input:typing', { typing: false }), []);
  if (!offer) return null;
  const kind = offer.kind;
  const adopt = () => gameCommands.emit('pet:adopt', { kind, name });
  return (
    <Panel title={`Adopt the ${kind}`} footer={<span className="hud-muted">Your pet follows you around the farm, naps by the door at night, and loves a daily pat.</span>}>
      <form
        className="pet-form"
        onSubmit={(e) => {
          e.preventDefault();
          adopt();
        }}
      >
        <p>{kind === 'cat' ? 'The cat blinks at you slowly. That means yes.' : 'The dog thumps its tail on the ground.'} What will you call them?</p>
        <input
          className="input"
          autoFocus
          maxLength={16}
          placeholder={kind === 'cat' ? 'Whiskers' : 'Biscuit'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => gameCommands.emit('input:typing', { typing: true })}
          onBlur={() => gameCommands.emit('input:typing', { typing: false })}
        />
        <div className="settings-row">
          <button type="submit" className="btn btn-primary">
            Adopt
          </button>
          <button type="button" className="btn" onClick={() => gameCommands.emit('ui:close', {})}>
            Not yet
          </button>
        </div>
      </form>
    </Panel>
  );
}
