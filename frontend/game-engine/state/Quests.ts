import { ITEMS, NPCS, REQUEST_FRIENDSHIP, REQUESTS, REQUESTS_PER_DAY, type QuestSave, type RequestDef, type Season } from '@farming/shared';
import { createRng } from '../utils/random';
import type { PlayerState } from './PlayerState';
import type { Social } from './Social';
import type { TxResult } from './economy';

export interface RequestView extends RequestDef {
  index: number;
  npcName: string;
  itemName: string;
  have: number;
  done: boolean;
}

/**
 * The village notice board: a few deliveries posted each morning, chosen
 * deterministically from the world seed and the day, so every player of the
 * same world sees the same requests.
 */
export class Quests {
  private day = -1;
  private done: number[] = [];
  private today: RequestDef[] = [];

  constructor(private readonly seed: string) {}

  /** Refreshes the posted requests for a day (keeps progress if it is the same day). */
  setDay(day: number, season: Season): void {
    if (day === this.day && this.today.length) return;
    if (day !== this.day) this.done = [];
    this.day = day;
    const pool = REQUESTS.filter((r) => !r.seasons || r.seasons.includes(season));
    const rng = createRng(`${this.seed}:board:${day}`);
    const picked: RequestDef[] = [];
    const used = new Set<string>();
    for (let tries = 0; picked.length < REQUESTS_PER_DAY && tries < 40 && pool.length; tries++) {
      const r = rng.pick(pool);
      // At most one request per villager per day.
      if (used.has(r.npc)) continue;
      used.add(r.npc);
      picked.push(r);
    }
    this.today = picked;
  }

  view(state: PlayerState): RequestView[] {
    return this.today.map((r, index) => ({
      ...r,
      index,
      npcName: NPCS[r.npc].name,
      itemName: ITEMS[r.itemId].name,
      have: state.inventory.count(r.itemId),
      done: this.done.includes(index),
    }));
  }

  /** Count of requests still open today. */
  openCount(): number {
    return this.today.length - this.done.length;
  }

  deliver(index: unknown, state: PlayerState, social: Social): TxResult {
    const i = typeof index === 'number' && Number.isInteger(index) ? index : -1;
    const req = this.today[i];
    if (!req) return { ok: false, message: 'That request is gone.' };
    if (this.done.includes(i)) return { ok: false, message: 'Already delivered.' };
    if (state.inventory.count(req.itemId) < req.quantity) {
      return { ok: false, message: `You need ${req.quantity}× ${ITEMS[req.itemId].name}.` };
    }
    state.inventory.remove(req.itemId, req.quantity);
    state.earn(req.reward);
    social.add(req.npc, REQUEST_FRIENDSHIP);
    this.done.push(i);
    return { ok: true, message: `${NPCS[req.npc].name} thanks you! +${req.reward}g` };
  }

  serialize(): QuestSave {
    return { day: this.day, done: [...this.done] };
  }

  restore(save: QuestSave | undefined, day: number, season: Season): void {
    this.day = -1;
    this.today = [];
    this.setDay(day, season);
    if (save && save.day === day) this.done = save.done.filter((d) => d < this.today.length);
  }
}
