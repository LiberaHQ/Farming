'use client';

import type { ReactNode } from 'react';
import { gameCommands } from '@/game-engine/events/GameEventBus';

/** Modal frame. Clicking the backdrop or ✕ asks the game to close the panel. */
export function Panel({ title, children, footer, onClose }: { title: string; children: ReactNode; footer?: ReactNode; onClose?: () => void }) {
  const close = onClose ?? (() => gameCommands.emit('ui:close', {}));
  return (
    <div className="panel-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="panel" role="dialog" aria-label={title}>
        <header className="panel-header">
          <h2>{title}</h2>
          <button type="button" className="panel-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="panel-body">{children}</div>
        {footer && <footer className="panel-footer">{footer}</footer>}
      </section>
    </div>
  );
}
