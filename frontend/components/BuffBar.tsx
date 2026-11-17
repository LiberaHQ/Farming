'use client';

import { BUFF_INFO } from '@farming/shared';
import { useGameEvent } from '@/hooks/useGameEvent';

/** Active food bonuses with time left, above the energy bar. */
export function BuffBar() {
  const buffs = useGameEvent('player:buffs');
  if (!buffs?.length) return null;
  return (
    <div className="buff-bar">
      {buffs.map((b) => {
        const info = BUFF_INFO[b.kind];
        const h = Math.floor(b.minutesLeft / 60);
        const m = b.minutesLeft % 60;
        return (
          <div key={b.kind} className="hud-panel buff" title={`${info.name}: ${info.description}`}>
            <span className="buff-icon">{info.icon}</span>
            <span>{h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`}</span>
          </div>
        );
      })}
    </div>
  );
}
