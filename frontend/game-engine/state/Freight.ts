import {
  FREIGHT_MAX_CONTRACTS,
  FREIGHT_SLOTS,
  FREIGHT_START_DAY,
  ITEMS,
  TOWNS,
  freightFullPay,
  freightPartialPay,
  freightQualityBonus,
  freshFreight,
  gameTime,
  postFreightContract,
  type FreightContract,
  type FreightSave,
  type ItemId,
  type TownId,
} from '@farming/shared';
import { createRng } from '../utils/random';
import { qualityOf, type Inventory } from './Inventory';

/** What changed since the last update, for the scene to announce (toasts, letters, gold). */
export type FreightEvent =
  | { kind: 'intro' }
  | { kind: 'posted'; count: number }
  | { kind: 'expired'; contract: FreightContract }
  | { kind: 'picked'; contract: FreightContract; minute: number }
  | { kind: 'paid'; contract: FreightContract; gold: number; minute: number };

export interface FreightClock {
  day: number;
  minute: number;
}

export interface FreightWorld {
  seed: string;
  /** Whose orders these are (each co-op player has their own). */
  player: string;
  lifetimeEarnings: number;
  /** The player has held this item, or can buy its seeds now. */
  canGet: (itemId: ItemId) => boolean;
  /** The train's departures on a day (game minutes, in order). */
  departures: (day: number) => number[];
}

/** How far back to look for a train that already went by (a long-unplayed save). */
const LOOKBACK_DAYS = 30;

/**
 * Train contracts for one player: posts orders each morning, takes goods
 * loaded at the depot, and moves full orders along by the train timetable —
 * collected by the next train, paid on the first train of a later day. It
 * follows the timetable rather than the train on screen, so nothing is lost
 * if you're indoors, in the mine or asleep when it passes.
 */
export class Freight {
  private s: FreightSave = freshFreight();

  restore(save: FreightSave | undefined): void {
    this.s = save ? structuredClone(save) : freshFreight();
  }

  toSave(): FreightSave {
    return structuredClone(this.s);
  }

  get contracts(): readonly FreightContract[] {
    return this.s.contracts;
  }

  /** Orders still taking goods. */
  get openCount(): number {
    return this.s.contracts.filter((c) => c.status === 'open').length;
  }

  /** Orders delivered in full to a town. */
  delivered(town: TownId): number {
    return this.s.done[town] ?? 0;
  }

  /** Brings the orders up to this moment. Safe to call every frame; returns what happened. */
  update(now: FreightClock, world: FreightWorld): FreightEvent[] {
    const events: FreightEvent[] = [];
    if (now.day > this.s.day) {
      // Orders whose last day has passed: part-filled ones still go out (paid at shipping prices).
      for (const c of [...this.s.contracts]) {
        if (c.status !== 'open' || c.due >= now.day) continue;
        if (c.loaded > 0) {
          c.status = 'ready';
          c.partial = true;
          c.pay = freightPartialPay(c);
          c.readyDay = now.day;
          c.readyMinute = 0;
        } else {
          this.s.contracts = this.s.contracts.filter((x) => x !== c);
          events.push({ kind: 'expired', contract: { ...c } });
        }
      }
      if (now.day >= FREIGHT_START_DAY) {
        if (!this.s.intro) {
          this.s.intro = true;
          events.push({ kind: 'intro' });
        }
        const rng = createRng(`${world.seed}:freight:${now.day}:${world.player}`);
        let posted = 0;
        while (this.openCount < FREIGHT_SLOTS && this.s.contracts.length < FREIGHT_MAX_CONTRACTS) {
          const c = postFreightContract(rng, this.s.nextId, {
            day: now.day,
            lifetimeEarnings: world.lifetimeEarnings,
            canGet: world.canGet,
            open: this.s.contracts,
            done: this.s.done,
          });
          if (!c) break;
          this.s.nextId += 1;
          this.s.contracts.push(c);
          posted += 1;
        }
        if (posted > 0) events.push({ kind: 'posted', count: posted });
      }
      this.s.day = now.day;
    }

    const nowAt = gameTime(now.day, now.minute);
    // Full (or closed) orders go out on the next train.
    for (const c of this.s.contracts) {
      if (c.status !== 'ready' || c.readyDay === undefined) continue;
      const train = this.firstTrain(c.readyDay, gameTime(c.readyDay, c.readyMinute ?? 0), now.day, nowAt, world);
      if (!train) continue;
      c.status = 'shipped';
      c.shippedDay = train.day;
      c.shippedMinute = train.minute;
      events.push({ kind: 'picked', contract: { ...c }, minute: train.minute });
    }
    // The money comes back on the first train of a later day.
    for (const c of [...this.s.contracts]) {
      if (c.status !== 'shipped' || c.shippedDay === undefined) continue;
      const train = this.firstTrain(c.shippedDay + 1, gameTime(c.shippedDay + 1, 0), now.day, nowAt, world);
      if (!train) continue;
      this.s.contracts = this.s.contracts.filter((x) => x !== c);
      if (!c.partial) this.s.done[c.town] = (this.s.done[c.town] ?? 0) + 1;
      events.push({ kind: 'paid', contract: { ...c }, gold: c.pay ?? 0, minute: train.minute });
    }
    return events;
  }

  /** The first departure at or after `from` (game time) and no later than now. */
  private firstTrain(fromDay: number, from: number, today: number, nowAt: number, world: FreightWorld): FreightClock | null {
    for (let day = Math.max(fromDay, today - LOOKBACK_DAYS); day <= today; day++) {
      for (const minute of world.departures(day)) {
        const at = gameTime(day, minute);
        if (at < from) continue;
        return at <= nowAt ? { day, minute } : null;
      }
    }
    return null;
  }

  /**
   * Loads as many of the order's goods as you carry (up to what it still
   * needs), plainest quality first. Silver and gold goods add to the pay.
   */
  load(id: number, inventory: Inventory, now: FreightClock): { ok: boolean; message: string; complete?: boolean } {
    const c = this.s.contracts.find((x) => x.id === id);
    if (!c || c.status !== 'open') return { ok: false, message: 'That order is no longer taking goods.' };
    const name = ITEMS[c.itemId].name;
    if (now.day > c.due) return { ok: false, message: `${TOWNS[c.town].name}'s order closed at the end of its last day.` };
    const byQuality = [0, 0, 0];
    for (const s of inventory.snapshot().slots) if (s && s.itemId === c.itemId) byQuality[qualityOf(s)] += s.quantity;
    const need = c.quantity - c.loaded;
    const take = Math.min(need, byQuality[0] + byQuality[1] + byQuality[2]);
    if (take <= 0) return { ok: false, message: `You don't have any ${name} with you.` };
    // The inventory gives up plain goods first, then silver, then gold: count them the same way.
    const used = [0, 0, 0];
    let left = take;
    for (const q of [0, 1, 2]) {
      used[q] = Math.min(left, byQuality[q]);
      left -= used[q];
    }
    if (!inventory.remove(c.itemId, take)) return { ok: false, message: `You don't have enough ${name}.` };
    c.loaded += take;
    c.bonus += freightQualityBonus(c.itemId, used[1], used[2]);
    if (c.loaded >= c.quantity) {
      c.status = 'ready';
      c.readyDay = now.day;
      c.readyMinute = now.minute;
      c.pay = freightFullPay(c);
      return { ok: true, complete: true, message: `${TOWNS[c.town].name}'s order is full: ${c.quantity} ${name}. It goes out on the next train.` };
    }
    return { ok: true, message: `Loaded ${take} ${name} for ${TOWNS[c.town].name}. ${c.quantity - c.loaded} more to go.` };
  }
}
