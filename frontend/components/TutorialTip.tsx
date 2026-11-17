'use client';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';

/** First-day tips, one at a time, until done or skipped. */
export function TutorialTip() {
  const tip = useGameEvent('tutorial:tip');
  if (!tip) return null;
  return (
    <div className="hud-panel tutorial-tip" role="status">
      <span className="tutorial-step">
        Tip {tip.index + 1}/{tip.total}
      </span>
      <span>{tip.text}</span>
      <button type="button" className="tutorial-skip" onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('tutorial:skip', {})}>
        Skip tips
      </button>
    </div>
  );
}
