import type { SaveData } from '@farming/shared';
import { LocalSaveStore, type SaveResult, type SaveStore } from '@/game-engine/state/save';
import { api, ApiError } from './api';

/**
 * Signed-in players: every save is written to this browser immediately and
 * uploaded to the server. Loading picks whichever copy is newer, and pushes a
 * newer local copy (e.g. made while offline) back up to the server.
 */
export class CloudSaveStore implements SaveStore {
  readonly description: string;
  private readonly local: LocalSaveStore;

  constructor(username: string, userId: string) {
    this.description = `Saved to ${username}'s account`;
    this.local = new LocalSaveStore(userId);
  }

  async load(seed: string): Promise<SaveData | null> {
    const local = this.local.read(seed);
    let cloud: SaveData | null = null;
    try {
      cloud = await api.loadWorld(seed);
    } catch {
      return local; // offline: play from the browser copy
    }
    if (local && (!cloud || local.savedAt > cloud.savedAt)) {
      void api.saveWorld(local).catch(() => undefined);
      return local;
    }
    if (cloud) this.local.write(cloud);
    return cloud;
  }

  async save(data: SaveData, options?: { urgent?: boolean }): Promise<SaveResult> {
    const storedLocally = this.local.write(data);
    try {
      // keepalive requests are capped at 64KB; larger urgent saves stay local and sync on next load.
      const body = options?.urgent ? JSON.stringify(data) : '';
      if (options?.urgent && body.length > 60_000) return { ok: storedLocally, where: storedLocally ? 'local' : 'none' };
      await api.saveWorld(data, !!options?.urgent);
      return { ok: true, where: 'cloud' };
    } catch (err) {
      // 409: the server already has a newer save (another device); keep ours locally only.
      if (err instanceof ApiError && err.status === 409) return { ok: storedLocally, where: 'local' };
      return { ok: storedLocally, where: storedLocally ? 'local' : 'none' };
    }
  }

  async clear(seed: string): Promise<void> {
    await this.local.clear(seed);
    await api.deleteWorld(seed).catch(() => undefined);
  }
}
