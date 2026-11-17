import { TIME_CONFIG, dayOfSeason, seasonOfDay, yearOfDay, type Season } from '@farming/shared';

export interface TimeHooks {
  /** Every 10 in-game minutes. */
  onTick: () => void;
  /** The clock reached 02:00 — the player collapses. */
  onPassOut: () => void;
}

/**
 * The in-game clock. A day runs from 06:00 to 02:00 (minutes past midnight
 * can exceed 24h). Time only advances while `running` is true, so menus and
 * dialogue pause the world.
 */
export class TimeSystem {
  day = 1;
  minute: number = TIME_CONFIG.dayStartMinute;
  running = true;
  private carry = 0;

  /** Clock speed (the day-length setting; always 1 in co-op, where the server keeps time). */
  speed = 1;

  constructor(private readonly hooks: TimeHooks) {}

  get season(): Season {
    return seasonOfDay(this.day);
  }

  get dayOfSeason(): number {
    return dayOfSeason(this.day);
  }

  get year(): number {
    return yearOfDay(this.day);
  }

  update(deltaMs: number): void {
    if (!this.running) return;
    this.carry += deltaMs * this.speed;
    while (this.carry >= TIME_CONFIG.msPerGameMinute) {
      this.carry -= TIME_CONFIG.msPerGameMinute;
      this.minute += 1;
      if (this.minute % 10 === 0) this.hooks.onTick();
      if (this.minute >= TIME_CONFIG.dayEndMinute) {
        this.carry = 0;
        this.running = false;
        this.hooks.onPassOut();
        return;
      }
    }
  }

  startNewDay(): void {
    this.day += 1;
    this.minute = TIME_CONFIG.dayStartMinute;
    this.carry = 0;
  }

  set(day: number, minute: number): void {
    this.day = Math.max(1, Math.floor(day));
    this.minute = Math.max(TIME_CONFIG.dayStartMinute, Math.min(TIME_CONFIG.dayEndMinute - 10, Math.floor(minute)));
    this.carry = 0;
  }
}
