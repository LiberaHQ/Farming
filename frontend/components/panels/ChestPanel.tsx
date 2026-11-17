'use client';

import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemSlot } from '../ItemSlot';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];

/** Click a stack to move it between the chest and your backpack. */
export function ChestPanel({ inventory }: { inventory: InventoryView }) {
  const chest = useGameEvent('chest:contents');
  if (!chest) return null;
  return (
    <Panel title="Chest" footer={<span className="hud-muted">Click a stack to move it between the chest and your inventory.</span>}>
      <h3 className="panel-subtitle">Chest</h3>
      <div className="inventory-grid plain-grid" style={{ gridTemplateColumns: 'repeat(10, auto)' }}>
        {chest.slots.map((stack, i) => (
          <ItemSlot key={i} stack={stack} onClick={() => gameCommands.emit('chest:transfer', { from: 'chest', slot: i })} />
        ))}
      </div>
      <h3 className="panel-subtitle">Inventory</h3>
      <div className="inventory-grid plain-grid" style={{ gridTemplateColumns: `repeat(${inventory.hotbarSize}, auto)` }}>
        {inventory.slots.map((stack, i) => (
          <ItemSlot key={i} stack={stack} onClick={() => gameCommands.emit('chest:transfer', { from: 'inventory', slot: i })} />
        ))}
      </div>
    </Panel>
  );
}
