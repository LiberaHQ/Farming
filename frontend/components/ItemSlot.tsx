'use client';

import type { DragEvent, ReactNode } from 'react';
import { ITEMS, withQuality } from '@farming/shared';
import { qualityName } from './quality';
import type { InventorySlotView } from '@/game-engine/events/GameEventBus';
import { ItemIcon } from './ItemIcon';

/** Drag data type for an inventory slot. */
export const SLOT_DRAG_TYPE = 'application/x-valley-slot';

interface ItemSlotProps {
  stack: InventorySlotView | null;
  selected?: boolean;
  held?: boolean;
  label?: string;
  onClick?: () => void;
  draggableIndex?: number;
  onDropIndex?: (from: number) => void;
  onHover?: (hovering: boolean) => void;
  /** Right-click (e.g. eat food). */
  onSecondary?: () => void;
  children?: ReactNode;
}

/** One inventory cell: icon, stack count, optional hotbar key label, drag & drop. */
export function ItemSlot({ stack, selected, held, label, onClick, draggableIndex, onDropIndex, onHover, onSecondary, children }: ItemSlotProps) {
  const dnd = draggableIndex !== undefined && onDropIndex;
  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', String(draggableIndex));
    // Lets the page know an inventory slot is being dragged (dropping it outside the window puts it on the ground).
    e.dataTransfer.setData(SLOT_DRAG_TYPE, String(draggableIndex));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isInteger(from)) onDropIndex?.(from);
  };
  const def = stack ? ITEMS[stack.itemId] : null;
  const energy = def?.energy ? withQuality(def.energy, stack?.q) : 0;
  const title = def ? `${qualityName(stack!.itemId, stack!.q)}\n${def.description}${energy ? `\nRight-click or F to eat (+${energy} energy)` : ''}` : undefined;

  return (
    <button
      type="button"
      className={`slot${selected ? ' slot-selected' : ''}${held ? ' slot-held' : ''}`}
      onClick={onClick}
      onContextMenu={
        onSecondary
          ? (e) => {
              e.preventDefault();
              onSecondary();
            }
          : undefined
      }
      title={title}
      draggable={!!(dnd && stack)}
      onDragStart={dnd ? onDragStart : undefined}
      onDragOver={dnd ? (e) => e.preventDefault() : undefined}
      onDrop={dnd ? onDrop : undefined}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {label && <span className="slot-label">{label}</span>}
      {stack && <ItemIcon id={stack.itemId} />}
      {stack && stack.quantity > 1 && <span className="slot-count">{stack.quantity}</span>}
      {stack?.q && <span className={`slot-quality slot-quality-${stack.q}`} aria-label={stack.q === 2 ? 'Gold quality' : 'Silver quality'} />}
      {children}
    </button>
  );
}
