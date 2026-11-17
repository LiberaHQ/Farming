'use client';

import { qualityName, qualityStar } from '../quality';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';

/** Morning report: what the shipping bin sold overnight. */
export function SummaryPanel() {
  const s = useGameEvent('day:summary');
  if (!s) return null;
  return (
    <Panel
      title={`Day ${s.day} — shipped`}
      footer={
        <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('ui:close', {})}>
          Start the day
        </button>
      }
    >
      <ul className="summary-list">
        {s.items.map((i) => (
          <li key={`${i.itemId}-${i.q ?? 0}`}>
            <ItemIcon id={i.itemId} />
            <span>
              {i.quantity}× {qualityStar(i.q)}{qualityName(i.itemId, i.q)}
            </span>
            <strong>{i.gold}g</strong>
          </li>
        ))}
      </ul>
      <div className="summary-total">
        <span>Total earned</span>
        <strong>+{s.total}g</strong>
      </div>
      <p className="hud-muted">You now have {s.gold}g.</p>
    </Panel>
  );
}
