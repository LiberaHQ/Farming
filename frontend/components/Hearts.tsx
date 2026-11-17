'use client';

import { FRIENDSHIP } from '@farming/shared';

/** A row of friendship hearts (filled up to `count`). */
export function Hearts({ count, max = FRIENDSHIP.maxHearts, compact = false }: { count: number; max?: number; compact?: boolean }) {
  return (
    <span className={`hearts${compact ? ' hearts-compact' : ''}`} aria-label={`${count} of ${max} hearts`} title={`${count} / ${max} hearts`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < count ? 'on' : ''}>
          ♥
        </i>
      ))}
    </span>
  );
}
