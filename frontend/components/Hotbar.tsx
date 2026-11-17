'use client';

import { ITEMS } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { EnergyBar } from './EnergyBar';
import { ItemSlot } from './ItemSlot';

/** Always-visible hotbar with the contextual action hint above it. */
export function Hotbar() {
  const inventory = useGameEvent('inventory:changed');
  const stats = useGameEvent('player:stats');
  if (!inventory) return null;

  const selected = inventory.slots[inventory.selected];
  return (
    <div className="hotbar-wrap">
      <div className="hint">
        {selected ? <span className="hud-muted">{ITEMS[selected.itemId].name}</span> : null}
      </div>
      <div className="hotbar-row">
      <div className="hotbar">
        {inventory.slots.slice(0, inventory.hotbarSize).map((stack, i) => (
          <ItemSlot
            key={i}
            stack={stack}
            selected={i === inventory.selected}
            label={String((i + 1) % 10)}
            onClick={() => gameCommands.emit('inventory:select', { index: i })}
            onSecondary={stack && ITEMS[stack.itemId].energy ? () => gameCommands.emit('item:eat', { slot: i }) : undefined}
          >
            {stack?.itemId === 'watering_can' && stats && (
              <span className="water-meter">
                <span style={{ width: `${(stats.water / stats.waterCapacity) * 100}%` }} />
              </span>
            )}
          </ItemSlot>
        ))}
      </div>
      <EnergyBar />
      </div>
    </div>
  );
}
