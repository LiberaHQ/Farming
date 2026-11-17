'use client';

import { useEffect, useState } from 'react';
import { settings, type Settings } from '@/game-engine/settings';

/** The player's settings, re-rendering when they change. */
export function useSettings(): Settings {
  const [value, setValue] = useState<Settings>(() => settings.get());
  useEffect(() => {
    setValue(settings.get());
    return settings.on(setValue);
  }, []);
  return value;
}

/** Whether this device is mainly touch (no fine pointer). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setCoarse(mq.matches);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return coarse;
}
