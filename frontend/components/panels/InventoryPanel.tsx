'use client';

import { useEffect, useState } from 'react';
import { ITEMS, withQuality } from '@farming/shared';
import { qualityName, qualityPrice } from '../quality';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { ItemSlot, SLOT_DRAG_TYPE } from '../ItemSlot';
import { Panel } from './Panel';

type InventoryView = GameEventMap['inventory:changed'];

/** 30-slot grid; the top row is the hotbar. Drag a stack, or click two slots, to move it. */
export function InventoryPanel({ inventory }: { inventory: InventoryView }) {
  const [held, setHeld] = useState<number | null>(null);
  const worn = useGameEvent('player:equipment');
  const [hovered, setHovered] = useState<number | null>(null);
  const [lastFocused, setLastFocused] = useState<number | null>(null);

  const move = (from: number, to: number) => gameCommands.emit('inventory:move', { from, to });

  // Drag a stack out of the window onto the game to put it on the ground (hold Shift to drop just one).
  useEffect(() => {
    const outside = (e: DragEvent) => e.dataTransfer?.types.includes(SLOT_DRAG_TYPE) && !(e.target instanceof Element && e.target.closest('.panel'));
    const onOver = (e: DragEvent) => {
      if (!outside(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const onDrop = (e: DragEvent) => {
      if (!outside(e)) return;
      e.preventDefault();
      const slot = Number(e.dataTransfer?.getData(SLOT_DRAG_TYPE));
      if (!Number.isInteger(slot)) return;
      gameCommands.emit('item:drop', { slot, one: e.shiftKey, screen: { x: e.clientX, y: e.clientY } });
      setHeld(null);
    };
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const onSlotClick = (index: number) => {
    if (held === null) {
      if (inventory.slots[index]) setHeld(index);
    } else {
      if (held !== index) move(held, index);
      setHeld(null);
    }
  };

  const focus = hovered ?? held ?? lastFocused;
  const focusStack = focus !== null ? inventory.slots[focus] : null;
  const def = focusStack ? ITEMS[focusStack.itemId] : null;
  const dropFocused = (one: boolean) => {
    if (focus === null) return;
    gameCommands.emit('item:drop', { slot: focus, one });
    setHeld(null);
  };

  return (
    <Panel
      title="Inventory"
      footer={
        def ? (
          <div>
            <strong>{qualityName(focusStack!.itemId, focusStack!.q)}</strong> <span className="hud-muted">— {def.description}</span>
            {def.sellPrice !== undefined && <span className="hud-muted"> · sells for {qualityPrice(focusStack!.itemId, focusStack!.q)}g</span>}
            {def.energy && focus !== null && (
              <button type="button" className="btn btn-primary eat-button" onClick={() => gameCommands.emit('item:eat', { slot: focus })}>
                Eat (+{withQuality(def.energy, focusStack!.q)} energy)
              </button>
            )}
            {def.equip && focus !== null && (
              <button type="button" className="btn btn-primary eat-button" onClick={() => gameCommands.emit('equip:wear', { slot: focus })}>
                Wear
              </button>
            )}
            {focus !== null && (
              <button type="button" className="btn eat-button" title="Put this stack on the ground (Shift-click drops one). You can also drag it out of the window." onClick={(e) => dropFocused(e.shiftKey)}>
                Drop
              </button>
            )}
          </div>
        ) : (
          <span className="hud-muted">Drag items between slots, or click one slot and then another. Drag a stack out of the window to drop it on the ground (Shift drops one). The top row is your hotbar.</span>
        )
      }
    >
      <div className="equipment-row">
        {(['ring', 'armor'] as const).map((which) => {
          const id = worn?.[which];
          return (
            <div key={which} className="equipment-slot" title={id ? ITEMS[id].description : `No ${which === 'ring' ? 'ring' : 'armour'} worn`}>
              <span className="hud-muted">{which === 'ring' ? 'Ring' : 'Armour'}</span>
              {id ? <ItemIcon id={id} /> : <span className="equipment-empty" />}
              {id && (
                <button type="button" className="btn" onClick={() => gameCommands.emit('equip:remove', { which })}>
                  Take off
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="inventory-grid" style={{ gridTemplateColumns: `repeat(${inventory.hotbarSize}, auto)` }}>
        {inventory.slots.map((stack, i) => (
          <ItemSlot
            key={i}
            stack={stack}
            selected={i === inventory.selected}
            held={i === held}
            label={i < inventory.hotbarSize ? String((i + 1) % 10) : undefined}
            onClick={() => onSlotClick(i)}
            draggableIndex={i}
            onDropIndex={(from) => {
              move(from, i);
              setHeld(null);
            }}
            onHover={(h) => {
              setHovered(h ? i : null);
              if (h && stack) setLastFocused(i);
            }}
            onSecondary={stack && ITEMS[stack.itemId].energy ? () => gameCommands.emit('item:eat', { slot: i }) : stack && ITEMS[stack.itemId].equip ? () => gameCommands.emit('equip:wear', { slot: i }) : undefined}
          />
        ))}
      </div>
    </Panel>
  );
}
