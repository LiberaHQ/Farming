'use client';

import { useEffect, useState } from 'react';
import { gameEvents, type GameEventMap } from '@/game-engine/events/GameEventBus';

/** Latest payload of a game event, re-rendering when the game emits a new one. */
export function useGameEvent<K extends keyof GameEventMap>(event: K): GameEventMap[K] | null {
  const [value, setValue] = useState<GameEventMap[K] | null>(null);
  useEffect(() => gameEvents.on(event, (payload) => setValue(payload)), [event]);
  return value;
}
