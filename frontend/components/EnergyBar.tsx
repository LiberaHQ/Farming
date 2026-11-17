'use client';

import { useGameEvent } from '@/hooks/useGameEvent';

/** Vertical stamina bar beside the hotbar, plus a health bar in the mine (or when hurt). */
export function EnergyBar() {
  const stats = useGameEvent('player:stats');
  const mine = useGameEvent('mine:floor');
  if (!stats) return null;
  const pct = Math.round((stats.energy / stats.maxEnergy) * 100);
  const level = pct > 50 ? 'high' : pct > 20 ? 'mid' : 'low';
  const hp = Math.round((stats.health / stats.maxHealth) * 100);
  const showHealth = !!mine || stats.health < stats.maxHealth;
  return (
    <div className="bars">
      {showHealth && (
        <div className="energy" title={`Health ${Math.round(stats.health)}/${stats.maxHealth}`}>
          <div className="energy-track">
            <div className={`energy-fill health-fill${hp <= 25 ? ' health-low' : ''}`} style={{ height: `${hp}%` }} />
          </div>
          <span>♥</span>
        </div>
      )}
      <div className="energy" title={`Energy ${stats.energy}/${stats.maxEnergy}`}>
        <div className="energy-track">
          <div className={`energy-fill energy-${level}`} style={{ height: `${pct}%` }} />
        </div>
        <span>E</span>
      </div>
    </div>
  );
}
