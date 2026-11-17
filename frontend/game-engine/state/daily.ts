import {
  DAILY_FULL_BONUS,
  DAILY_TEXT,
  FORAGE_ITEMS,
  ITEMS,
  MINE,
  STREAK_REWARDS,
  streakBonus,
  type DailyGoalSave,
  type DailyKind,
  type DailySave,
  type ItemId,
} from '@farming/shared';
import { sfx } from '../audio/sfx';
import { gameEvents } from '../events/GameEventBus';
import { createRng } from '../utils/random';

/** What the morning roll needs to know to pick sensible goals. */
export interface DailyContext {
  seed: string;
  day: number;
  season: string;
  raining: boolean;
  /** Crops growing on the farm right now. */
  crops: number;
  /** Ripe-soon crops (mature within a day or two). */
  hasRod: boolean;
  mineDepth: number;
}

export interface DailyHost {
  giveGold(amount: number): void;
  /** Adds items; anything that doesn't fit lands at your feet. */
  giveItem(itemId: ItemId, quantity: number): void;
  lucky(): void;
}

interface Option {
  kind: DailyKind;
  weight: number;
  need: number;
  gold: number;
}

const empty = (): DailySave => ({ day: 0, goals: [], talked: [], streak: 0, best: 0, lastFullDay: 0 });

/**
 * Today's three goals (one per player, shared by every scene). Systems call
 * `note` as you do things; finishing a goal pays out, and finishing all three
 * pays a bonus and keeps your streak going.
 */
class DailyGoals {
  private s: DailySave = empty();
  private host: DailyHost | null = null;

  attach(host: DailyHost): void {
    this.host = host;
  }

  load(save: DailySave | undefined): void {
    this.s = save ? structuredClone(save) : empty();
    this.emit();
  }

  toSave(): DailySave {
    return structuredClone(this.s);
  }

  /** The streak as it stands today: it breaks if yesterday wasn't finished. */
  streakOn(day: number): number {
    return this.s.lastFullDay >= day - 1 ? this.s.streak : 0;
  }

  get best(): number {
    return this.s.best;
  }

  get allDone(): boolean {
    return this.s.goals.length > 0 && this.s.goals.every((g) => g.done);
  }

  /**
   * Each morning (and on loading a save from an earlier day): three new goals.
   * Returns a line for the morning toast, or null if nothing changed.
   */
  roll(ctx: DailyContext): string | null {
    if (this.s.day === ctx.day && this.s.goals.length) {
      this.emit();
      return null;
    }
    const brokeStreak = this.s.streak > 0 && this.s.lastFullDay < ctx.day - 1;
    if (brokeStreak) this.s.streak = 0;
    const rng = createRng(`${ctx.seed}:daily:${ctx.day}`);
    const options = this.options(ctx, rng.next);
    const goals: DailyGoalSave[] = [];
    while (goals.length < 3 && options.length) {
      const total = options.reduce((n, o) => n + o.weight, 0);
      let r = rng.next() * total;
      const i = Math.max(0, options.findIndex((o) => (r -= o.weight) < 0));
      const o = options.splice(i, 1)[0];
      goals.push({ kind: o.kind, need: o.need, have: 0, gold: o.gold, done: false });
    }
    this.s.day = ctx.day;
    this.s.goals = goals;
    this.s.talked = [];
    this.emit();
    const streak = this.streakOn(ctx.day);
    if (brokeStreak) return '📋 New daily goals. Your streak ended. Finish all three today to start a new one!';
    if (streak > 0) return `📋 New daily goals. 🔥 ${streak}-day streak: finish all three to keep it going!`;
    return '📋 Three new daily goals! See the list under your gold.';
  }

  private options(ctx: DailyContext, rand: () => number): Option[] {
    const pick = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
    const out: Option[] = [
      { kind: 'wood', weight: 3, need: pick(3, 5) * 5, gold: 60 },
      { kind: 'stone', weight: 3, need: pick(2, 4) * 5, gold: 60 },
      { kind: 'fiber', weight: 2, need: pick(2, 3) * 5, gold: 50 },
      { kind: 'forage', weight: 2, need: pick(3, 5), gold: 70 },
      { kind: 'talk', weight: 3, need: pick(2, 4), gold: 50 },
    ];
    if (ctx.day >= 2) {
      out.push({ kind: 'gift', weight: 2, need: 1, gold: 60 });
      out.push({ kind: 'ship', weight: 2, need: pick(2, 6) * 50, gold: 80 });
      out.push({ kind: 'cook', weight: 1, need: 1, gold: 90 });
    }
    if (ctx.crops >= 3) {
      out.push({ kind: 'harvest', weight: 3, need: Math.max(2, Math.min(12, Math.floor(ctx.crops * 0.5))), gold: 80 });
      if (!ctx.raining) out.push({ kind: 'water', weight: 3, need: Math.max(3, Math.min(15, ctx.crops)), gold: 50 });
    }
    if (ctx.hasRod) out.push({ kind: 'fish', weight: 3, need: pick(2, 4), gold: 90 });
    if (ctx.mineDepth >= 1) out.push({ kind: 'mine', weight: 2, need: Math.min(MINE.floors, Math.max(3, ctx.mineDepth + pick(1, 3))), gold: 100 });
    return out;
  }

  /** You did something: count it toward any matching goal. `key` makes it count once (e.g. a villager). */
  note(kind: DailyKind, amount = 1, key?: string): void {
    if (amount <= 0) return;
    if (key) {
      if (this.s.talked.includes(key)) return;
      this.s.talked.push(key);
    }
    let changed = false;
    for (const g of this.s.goals) {
      if (g.kind !== kind || g.done) continue;
      g.have = kind === 'mine' ? Math.min(g.need, Math.max(g.have, amount)) : Math.min(g.need, g.have + amount);
      changed = true;
      if (g.have >= g.need) this.complete(g);
    }
    if (changed) this.emit();
  }

  /** Picking things up counts for gathering and foraging goals. */
  collected(itemId: ItemId, quantity: number): void {
    if (itemId === 'wood' || itemId === 'hardwood') this.note('wood', quantity);
    else if (itemId === 'stone') this.note('stone', quantity);
    else if (itemId === 'fiber') this.note('fiber', quantity);
    else if ((FORAGE_ITEMS as readonly string[]).includes(itemId)) this.note('forage', quantity);
  }

  private complete(g: DailyGoalSave): void {
    g.done = true;
    const streak = this.streakOn(this.s.day);
    const gold = Math.round(g.gold * (1 + streakBonus(streak)));
    this.host?.giveGold(gold);
    sfx('coin');
    gameEvents.emit('toast', { text: `✅ Goal done: ${DAILY_TEXT[g.kind].text(g.need)} (+${gold}g)` });
    if (!this.allDone) return;
    // All three: a bonus, and the streak goes on.
    this.s.streak = this.s.lastFullDay === this.s.day - 1 ? this.s.streak + 1 : 1;
    this.s.lastFullDay = this.s.day;
    this.s.best = Math.max(this.s.best, this.s.streak);
    this.host?.giveGold(DAILY_FULL_BONUS);
    sfx('sparkle');
    const milestone = STREAK_REWARDS.find((m) => m.days === this.s.streak);
    if (milestone) {
      this.host?.giveGold(milestone.gold);
      for (const it of milestone.items) this.host?.giveItem(it.itemId, it.quantity);
      if (milestone.lucky) this.host?.lucky();
      const things = [`${milestone.gold}g`, ...milestone.items.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${ITEMS[i.itemId].name}`)];
      gameEvents.emit('toast', { text: `🔥 ${this.s.streak}-day streak! Bonus: ${things.join(' + ')}${milestone.lucky ? ', and you feel lucky' : ''}.` });
    } else {
      gameEvents.emit('toast', { text: `🎉 All of today's goals done! +${DAILY_FULL_BONUS}g · 🔥 ${this.s.streak}-day streak` });
    }
  }

  emit(): void {
    const streak = this.streakOn(this.s.day);
    const next = STREAK_REWARDS.find((m) => m.days > (this.allDone ? this.s.streak : streak));
    gameEvents.emit('daily:state', {
      day: this.s.day,
      goals: this.s.goals.map((g) => ({
        kind: g.kind,
        icon: DAILY_TEXT[g.kind].icon,
        text: DAILY_TEXT[g.kind].text(g.need),
        hint: DAILY_TEXT[g.kind].hint,
        have: g.have,
        need: g.need,
        gold: Math.round(g.gold * (1 + streakBonus(streak))),
        done: g.done,
      })),
      streak: this.allDone ? this.s.streak : streak,
      best: this.s.best,
      allDone: this.allDone,
      bonus: DAILY_FULL_BONUS,
      next: next ? { days: next.days, text: next.text } : null,
    });
  }
}

export const daily = new DailyGoals();
