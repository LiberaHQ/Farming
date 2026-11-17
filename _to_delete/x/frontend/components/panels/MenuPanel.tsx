'use client';

import Link from 'next/link';
import { useState } from 'react';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { useSettings } from '@/hooks/useSettings';
import { actionKey, type BindAction } from '@/game-engine/settings';
import { Panel } from './Panel';

/** Pause menu: save, customise, controls, new game. */
export function MenuPanel() {
  const save = useGameEvent('save:info');
  const audio = useGameEvent('audio:settings');
  const coop = useGameEvent('coop:info');
  const [confirmNew, setConfirmNew] = useState(false);
  useSettings();
  const k = (a: BindAction) => actionKey(a);
  const savedAt = save?.savedAt ? new Date(save.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <Panel
      title="Paused"
      footer={
        <span className="hud-muted">
          {save?.storage}. {savedAt ? `Last saved at ${savedAt}. ` : ''}The game also saves every morning.
        </span>
      }
    >
      <div className="menu">
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:close', {})}>
          Resume
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('game:save', {})}>
          Save now
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:open', { panel: 'character' })}>
          Customise character
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:open', { panel: 'journal' })}>
          Journal (story & requests)
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:open', { panel: 'collection' })}>
          Collection & achievements
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:open', { panel: 'settings' })}>
          Settings (keys, size, day length)
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('game:export', {})}>
          Export save file
        </button>
        <Link className="btn" href="/start">
          {coop ? 'Leave & quit to title' : 'Save & quit to title'}
        </Link>
        {coop ? (
          <div className="menu-coop">
            Friends join with code <strong>{coop.code}</strong> (Title screen → Join a friend).
            {coop.leader ? (
              <div className="settings-row coop-settings">
                <button type="button" className={`btn${coop.public ? ' btn-primary' : ''}`} onClick={() => gameCommands.emit('coop:settings', { public: !coop.public })}>
                  {coop.public ? '🌐 Listed publicly' : '🔒 Private (code only)'}
                </button>
                <button type="button" className={`btn${coop.sharedWallet ? ' btn-primary' : ''}`} onClick={() => gameCommands.emit('coop:settings', { sharedWallet: !coop.sharedWallet })}>
                  {coop.sharedWallet ? '💰 Shared wallet: on' : '💰 Shared wallet: off'}
                </button>
              </div>
            ) : (
              <div className="hud-muted">
                {coop.public ? 'This game is listed publicly.' : 'Private game.'} {coop.sharedWallet ? 'Everyone shares one purse.' : ''}
              </div>
            )}
          </div>
        ) : (
          <div className="settings-row">
            <button type="button" className="btn btn-primary" onClick={() => gameCommands.emit('coop:host', {})}>
              Invite friends (co-op)
            </button>
            <button type="button" className="btn" onClick={() => gameCommands.emit('coop:host', { public: true })}>
              Open to everyone
            </button>
          </div>
        )}
        {coop ? null : confirmNew ? (
          <div className="menu-confirm">
            <span>Start over? This deletes your save for this world.</span>
            <button type="button" className="btn btn-danger" onClick={() => gameCommands.emit('game:new', {})}>
              Yes, new game
            </button>
            <button type="button" className="btn" onClick={() => setConfirmNew(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmNew(true)}>
            New game…
          </button>
        )}
      </div>
      {audio && (
        <>
          <h3 className="panel-subtitle">Sound</h3>
          <div className="sound-settings">
            {(
              [
                ['master', 'Master'],
                ['music', 'Music'],
                ['sfx', 'Effects'],
                ['ambience', 'Ambience'],
              ] as const
            ).map(([channel, label]) => (
              <label key={channel} className="sound-row">
                <span>{label}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(audio[channel] * 100)}
                  disabled={audio.muted}
                  onChange={(e) => gameCommands.emit('audio:set', { channel, value: Number(e.target.value) / 100 })}
                />
                <span className="hud-muted">{Math.round(audio[channel] * 100)}%</span>
              </label>
            ))}
            <label className="sound-row">
              <span>Mute</span>
              <input type="checkbox" checked={audio.muted} onChange={() => gameCommands.emit('audio:mute', {})} />
              <span className="hud-muted">
                or <kbd>Shift</kbd>+<kbd>M</kbd>
              </span>
            </label>
          </div>
        </>
      )}
      <h3 className="panel-subtitle">Controls</h3>
      <ul className="controls-list">
        <li><kbd>{k('up')}{k('left')}{k('down')}{k('right')}</kbd>/<kbd>Arrows</kbd> move, <kbd>{k('run')}</kbd> run</li>
        <li><kbd>{k('use')}</kbd>/click use the selected item on the tile you face</li>
        <li><kbd>{k('interact')}</kbd> interact: talk, shop, harvest, open chests, go inside</li>
        <li><kbd>1–0</kbd>/mouse wheel select hotbar slot</li>
        <li><kbd>{k('inventory')}</kbd> inventory · <kbd>{k('crafting')}</kbd> crafting · <kbd>{k('collection')}</kbd> collection · <kbd>Esc</kbd> this menu</li>
        <li>Eat: select food and press <kbd>{k('eat')}</kbd> (or right-click it in the hotbar)</li>
        <li><kbd>{k('map')}</kbd> world map · <kbd>Shift</kbd>+<kbd>M</kbd> mute</li>
        <li>Gamepads and touch screens work too — see Settings</li>
      </ul>
    </Panel>
  );
}
