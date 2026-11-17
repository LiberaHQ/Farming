import { SAVE_VERSION, type SaveData, type WorldSummary } from '@farming/shared';

export { SAVE_VERSION };
export type { SaveData };

export interface SaveResult {
  ok: boolean;
  /** Where the save landed: the server, or only this browser. */
  where: 'cloud' | 'local' | 'none';
}

/**
 * Where saves live. The game only talks to this interface; the app decides
 * whether that's the browser (guests), or the server with a local fallback.
 */
export interface SaveStore {
  /** Shown to the player, e.g. "Saved in this browser". */
  readonly description: string;
  load(seed: string): Promise<SaveData | null>;
  /** `urgent` = the page is closing; use a request that survives unload. */
  save(data: SaveData, options?: { urgent?: boolean }): Promise<SaveResult>;
  clear(seed: string): Promise<void>;
}

/** Guests' saves (and every save from before accounts had their own space). */
const GUEST_PREFIX = 'farming-game:save:';

/** Browser storage. Used directly for guests, and as the offline copy for signed-in players. */
export class LocalSaveStore implements SaveStore {
  readonly description = 'Saved in this browser';
  private readonly prefix: string;

  /**
   * `owner` is the signed-in account's id: each account keeps its own copies in
   * this browser, apart from guest saves and other accounts on the same device.
   */
  constructor(owner?: string | null) {
    this.prefix = owner ? `farming-game:u:${owner}:save:` : GUEST_PREFIX;
  }

  private keyFor(seed: string): string {
    return `${this.prefix}${seed}`;
  }

  /** Synchronous read, used by the hybrid store and the title screen. */
  read(seed: string): SaveData | null {
    try {
      const raw = window.localStorage.getItem(this.keyFor(seed));
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      return data?.version === SAVE_VERSION && data.seed === seed ? data : null;
    } catch {
      return null;
    }
  }

  write(data: SaveData): boolean {
    try {
      window.localStorage.setItem(this.keyFor(data.seed), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  async load(seed: string): Promise<SaveData | null> {
    return this.read(seed);
  }

  async save(data: SaveData): Promise<SaveResult> {
    const ok = this.write(data);
    return { ok, where: ok ? 'local' : 'none' };
  }

  async clear(seed: string): Promise<void> {
    try {
      window.localStorage.removeItem(this.keyFor(seed));
    } catch {
      // Storage unavailable (private mode etc.): nothing to clear.
    }
  }

  /** Every world saved in this browser, newest first. */
  list(): WorldSummary[] {
    const out: WorldSummary[] = [];
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key?.startsWith(this.prefix)) continue;
        const data = this.read(key.slice(this.prefix.length));
        if (data) {
          out.push({ seed: data.seed, day: data.time.day, gold: data.player.gold, lifetimeEarnings: data.player.lifetimeEarnings, savedAt: data.savedAt });
        }
      }
    } catch {
      // ignore
    }
    return out.sort((a, b) => b.savedAt - a.savedAt);
  }
}
