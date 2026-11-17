import * as Phaser from 'phaser';
import { createGameConfig } from './config';
import type { AppearanceChoice } from '@farming/shared';
import { gameCommands, gameEvents } from './events/GameEventBus';
import type { SaveData, SaveStore } from './state/save';
import type { CoopSession } from './net/CoopSession';

/** What React gets back: a handle, not the engine. */
export interface GameHandle {
  destroy(): void;
}

export interface CreateGameOptions {
  seed: string;
  /** Where the game saves (browser for guests; cloud + browser for signed-in players). */
  store?: SaveStore;
  /** Save to resume, already loaded by the app. Null/undefined = new game. */
  initialSave?: SaveData | null;
  /** Character look for brand-new worlds (from the player's profile). */
  defaultAppearance?: AppearanceChoice;
  /** Co-op: a joined room. The world comes from the server instead of a save. */
  coop?: CoopSession | null;
}

export type { CoopSession } from './net/CoopSession';

export type { SaveData, SaveResult, SaveStore } from './state/save';
export { LocalSaveStore } from './state/save';

/**
 * Engine entry point. Must only be imported in the browser (it is loaded via
 * dynamic import from a client component, because Phaser touches `window`).
 */
export function createGame(parent: HTMLElement, options: CreateGameOptions): GameHandle {
  const game = new Phaser.Game(createGameConfig(parent, options));
  if (process.env.NODE_ENV === 'development') {
    // Dev-only handle for debugging in the browser console and automated playtests.
    (window as unknown as { __game?: Phaser.Game }).__game = game;
  }
  return {
    destroy: () => {
      gameCommands.emit('game:flush', {});
      game.destroy(true);
      gameEvents.reset();
    },
  };
}
