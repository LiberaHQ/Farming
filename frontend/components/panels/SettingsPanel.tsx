'use client';

import { useEffect, useState } from 'react';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { BIND_ACTIONS, DAY_LENGTHS, keyLabel, RESERVED_KEYS, SECONDARY_KEYS, settings, UI_SCALES, type BindAction, type DayLength, type TouchMode } from '@/game-engine/settings';
import { useGameEvent } from '@/hooks/useGameEvent';
import { useSettings } from '@/hooks/useSettings';
import { Panel } from './Panel';

/** Key bindings, interface size, day length, touch and gamepad. */
export function SettingsPanel() {
  const s = useSettings();
  const coop = useGameEvent('coop:info');
  const [listening, setListening] = useState<BindAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pad, setPad] = useState<string | null>(null);

  // Capture the next key press for rebinding (before the game sees it).
  useEffect(() => {
    if (!listening) return;
    gameCommands.emit('input:typing', { typing: true });
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.keyCode === 27) {
        setListening(null);
        return;
      }
      if (RESERVED_KEYS.has(e.keyCode)) {
        setMessage(`${keyLabel(e.keyCode)} is reserved (Esc, Enter, \` and the number keys).`);
        return;
      }
      settings.bind(listening, e.keyCode);
      setMessage(null);
      setListening(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      gameCommands.emit('input:typing', { typing: false });
    };
  }, [listening]);

  useEffect(() => {
    const check = () => {
      const p = [...(navigator.getGamepads?.() ?? [])].find((g) => g?.connected);
      setPad(p ? p.id.replace(/\s*\(.*\)\s*/g, ' ').trim() : null);
    };
    check();
    window.addEventListener('gamepadconnected', check);
    window.addEventListener('gamepaddisconnected', check);
    return () => {
      window.removeEventListener('gamepadconnected', check);
      window.removeEventListener('gamepaddisconnected', check);
    };
  }, []);

  return (
    <Panel title="Settings" footer={<span className="hud-muted">Settings are kept in this browser.</span>}>
      <h3 className="panel-subtitle">Interface size</h3>
      <div className="settings-row">
        {UI_SCALES.map((scale) => (
          <button key={scale} type="button" className={`btn${s.uiScale === scale ? ' btn-primary' : ''}`} onClick={() => settings.set({ uiScale: scale })}>
            {Math.round(scale * 100)}%
          </button>
        ))}
      </div>

      <h3 className="panel-subtitle">Day length</h3>
      <div className="settings-row">
        {(Object.keys(DAY_LENGTHS) as DayLength[]).map((d) => (
          <button key={d} type="button" className={`btn${s.dayLength === d ? ' btn-primary' : ''}`} onClick={() => settings.set({ dayLength: d })}>
            {DAY_LENGTHS[d].label}
          </button>
        ))}
      </div>
      {coop && <p className="hud-muted">In co-op the host's server keeps the clock at normal speed.</p>}

      <h3 className="panel-subtitle">Touch controls</h3>
      <div className="settings-row">
        {(
          [
            ['auto', 'Automatic'],
            ['on', 'Always show'],
            ['off', 'Hide'],
          ] as [TouchMode, string][]
        ).map(([mode, label]) => (
          <button key={mode} type="button" className={`btn${s.touch === mode ? ' btn-primary' : ''}`} onClick={() => settings.set({ touch: mode })}>
            {label}
          </button>
        ))}
      </div>

      <h3 className="panel-subtitle">Minimap</h3>
      <div className="settings-row">
        {(
          [
            [true, 'Show'],
            [false, 'Hide'],
          ] as [boolean, string][]
        ).map(([on, label]) => (
          <button key={label} type="button" className={`btn${s.minimap === on ? ' btn-primary' : ''}`} onClick={() => settings.set({ minimap: on })}>
            {label}
          </button>
        ))}
      </div>

      <h3 className="panel-subtitle">Gamepad</h3>
      <p className="hud-muted">
        {pad ? `Connected: ${pad}.` : 'No gamepad found — plug one in and press a button.'} Stick/D-pad move · A use · X interact · Y backpack · B/Start menu · LB/RB hotbar · LT eat · RT run · View map
      </p>

      <h3 className="panel-subtitle">Keys</h3>
      {message && <p className="settings-message">{message}</p>}
      <ul className="keybind-list">
        {BIND_ACTIONS.map(({ id, label }) => (
          <li key={id}>
            <span>{label}</span>
            <button type="button" className={`btn keybind${listening === id ? ' listening' : ''}`} onClick={() => setListening(listening === id ? null : id)}>
              {listening === id ? 'Press a key…' : keyLabel(s.keys[id])}
            </button>
            <span className="hud-muted">{SECONDARY_KEYS[id] !== undefined ? `or ${keyLabel(SECONDARY_KEYS[id]!)}` : ''}</span>
          </li>
        ))}
      </ul>
      <div className="settings-row">
        <button type="button" className="btn" onClick={() => settings.resetKeys()}>
          Reset keys
        </button>
        <button type="button" className="btn" onClick={() => gameCommands.emit('ui:open', { panel: 'menu' })}>
          Back
        </button>
      </div>
    </Panel>
  );
}
