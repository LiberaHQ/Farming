'use client';

import { useEffect, useRef, useState } from 'react';
import { ITEMS, type ItemId } from '@farming/shared';
import { gameEvents } from '@/game-engine/events/GameEventBus';
import { ItemIcon } from './ItemIcon';
import { qualityName, qualityStar } from './quality';

interface Toast {
  id: number;
  text: string;
  itemId?: ItemId;
  q?: 1 | 2;
  quantity?: number;
  expires: number;
}

const LIFETIME_MS = 2600;

/** Pickup feed ("+3 Wood") and short messages. Repeated pickups merge. */
export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const offCollected = gameEvents.on('item:collected', ({ itemId, quantity, q }) => {
      setToasts((list) => {
        const now = Date.now();
        const name = `${qualityStar(q)}${qualityName(itemId, q)}`;
        const existing = list.find((t) => t.itemId === itemId && (t.q ?? 0) === (q ?? 0));
        if (existing) {
          const total = (existing.quantity ?? 0) + quantity;
          return list.map((t) => (t === existing ? { ...t, quantity: total, text: `+${total} ${name}`, expires: now + LIFETIME_MS } : t));
        }
        return [...list, { id: nextId.current++, itemId, q, quantity, text: `+${quantity} ${name}`, expires: now + LIFETIME_MS }].slice(-5);
      });
    });
    const offToast = gameEvents.on('toast', ({ text }) => {
      setToasts((list) => [...list.filter((t) => t.text !== text), { id: nextId.current++, text, expires: Date.now() + LIFETIME_MS }].slice(-5));
    });
    const timer = window.setInterval(() => {
      setToasts((list) => {
        const now = Date.now();
        return list.some((t) => t.expires <= now) ? list.filter((t) => t.expires > now) : list;
      });
    }, 250);
    return () => {
      offCollected();
      offToast();
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.itemId && <ItemIcon id={t.itemId} size={16} />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
