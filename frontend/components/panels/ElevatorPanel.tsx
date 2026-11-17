'use client';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Panel } from './Panel';

/** The mine elevator: jump to any 5th floor you've already reached. */
export function ElevatorPanel() {
  const elevator = useGameEvent('mine:elevator');
  if (!elevator) return null;
  return (
    <Panel title="Mine elevator" footer={<span className="hud-muted">Reach a new 5th floor to add a stop. Slimes get tougher the deeper you go — bring food and a sword.</span>}>
      <div className="elevator">
        {elevator.floors.map((floor) => (
          <button key={floor} type="button" className="btn elevator-floor" onClick={() => gameCommands.emit('mine:enter', { floor })}>
            {floor === 1 ? 'Floor 1 (top)' : `Floor ${floor}`}
          </button>
        ))}
      </div>
    </Panel>
  );
}
