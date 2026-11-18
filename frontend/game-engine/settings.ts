import { DAY_LENGTHS, isDayLength, type DayLength } from '@farming/shared';

/**
 * Player settings that live in this browser: key bindings, UI scale, day
 * length and touch controls. Both the game (Phaser) and the UI (React) read
 * them; changes are broadcast to every listener.
 */

export type BindAction = 'up' | 'down' | 'left' | 'right' | 'run' | 'use' | 'interact' | 'inventory' | 'crafting' | 'map' | 'eat' | 'collection' | 'journal' | 'emote' | 'petStay' | 'horse' | 'calendar' | 'minimap';

export const BIND_ACTIONS: readonly { id: BindAction; label: string }[] = [
  { id: 'up', label: 'Move up' },
  { id: 'down', label: 'Move down' },
  { id: 'left', label: 'Move left' },
  { id: 'right', label: 'Move right' },
  { id: 'run', label: 'Run (hold)' },
  { id: 'use', label: 'Use item' },
  { id: 'interact', label: 'Interact' },
  { id: 'eat', label: 'Eat' },
  { id: 'inventory', label: 'Backpack' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'map', label: 'Map' },
  { id: 'collection', label: 'Collection' },
  { id: 'journal', label: 'Journal' },
  { id: 'emote', label: 'Emotes' },
  { id: 'petStay', label: 'Pet: stay / follow' },
  { id: 'horse', label: 'Horse: call / ride / get off' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'minimap', label: 'Minimap: show / hide' },
];

/** Primary keys (browser keyCodes). Each action also keeps a fixed secondary key where it has one. */
export const DEFAULT_KEYS: Record<BindAction, number> = {
  up: 87, // W
  down: 83, // S
  left: 65, // A
  right: 68, // D
  run: 16, // Shift
  use: 32, // Space
  interact: 69, // E
  eat: 70, // F
  inventory: 73, // I
  crafting: 67, // C
  map: 77, // M
  collection: 75, // K
  journal: 81, // Q
  emote: 84, // T
  petStay: 80, // P
  horse: 72, // H
  calendar: 76, // L
  minimap: 78, // N
};

/** Always-on alternatives: arrows, J for use, Tab for the backpack. */
export const SECONDARY_KEYS: Partial<Record<BindAction, number>> = { up: 38, down: 40, left: 37, right: 39, use: 74, inventory: 9 };

/** Keys that can't be rebound: Esc (menu), the number row (hotbar), Enter (chat), backtick (debug). */
export const RESERVED_KEYS = new Set([27, 13, 192, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57]);

export { DAY_LENGTHS, type DayLength };

export type TouchMode = 'auto' | 'on' | 'off';

export interface Settings {
  keys: Record<BindAction, number>;
  uiScale: number;
  dayLength: DayLength;
  touch: TouchMode;
  /** The small map in the corner. */
  minimap: boolean;
}

export const UI_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5] as const;

const STORAGE_KEY = 'farming-game:settings';

const defaults = (): Settings => ({ keys: { ...DEFAULT_KEYS }, uiScale: 1, dayLength: 'normal', touch: 'auto', minimap: true });

function load(): Settings {
  const base = defaults();
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    const keys = { ...base.keys };
    for (const { id } of BIND_ACTIONS) {
      const code = s.keys?.[id];
      if (typeof code === 'number' && code > 0 && code < 256 && !RESERVED_KEYS.has(code)) keys[id] = code;
    }
    return {
      keys,
      uiScale: typeof s.uiScale === 'number' && s.uiScale >= 0.7 && s.uiScale <= 1.6 ? s.uiScale : 1,
      dayLength: isDayLength(s.dayLength) ? s.dayLength : 'normal',
      touch: s.touch === 'on' || s.touch === 'off' ? s.touch : 'auto',
      minimap: s.minimap !== false,
    };
  } catch {
    return base;
  }
}

type Listener = (s: Settings) => void;

class SettingsStore {
  private current: Settings | null = null;
  private readonly listeners = new Set<Listener>();

  get(): Settings {
    return (this.current ??= load());
  }

  set(patch: Partial<Settings>): void {
    this.current = { ...this.get(), ...patch };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Storage unavailable: settings last for this visit only.
    }
    for (const l of this.listeners) l(this.current);
  }

  /** Rebind an action's primary key. A key already used by another action swaps over to it. */
  bind(action: BindAction, code: number): boolean {
    if (RESERVED_KEYS.has(code)) return false;
    const keys = { ...this.get().keys };
    const clash = BIND_ACTIONS.find((a) => a.id !== action && keys[a.id] === code);
    if (clash) keys[clash.id] = keys[action];
    keys[action] = code;
    this.set({ keys });
    return true;
  }

  resetKeys(): void {
    this.set({ keys: { ...DEFAULT_KEYS } });
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const settings = new SettingsStore();

const NAMED: Record<number, string> = {
  8: 'Backspace',
  9: 'Tab',
  16: 'Shift',
  17: 'Ctrl',
  18: 'Alt',
  20: 'Caps',
  32: 'Space',
  33: 'PgUp',
  34: 'PgDn',
  35: 'End',
  36: 'Home',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  45: 'Ins',
  46: 'Del',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

/** A short label for a keyCode, e.g. "Space", "E", "↑". */
export function keyLabel(code: number): string {
  if (NAMED[code]) return NAMED[code];
  if ((code >= 65 && code <= 90) || (code >= 48 && code <= 57)) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return `Num${code - 96}`;
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `Key ${code}`;
}

/** The primary key label for an action, from the current settings. */
export const actionKey = (action: BindAction): string => keyLabel(settings.get().keys[action]);
