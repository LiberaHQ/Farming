import {
  ITEMS,
  MINE_DASH_CAMP,
  MINE_DASH_KITS,
  MINE_DASH_VARIANTS,
  scoreMineDash,
  type DashStart,
  type ItemId,
  type MineDashSummary,
  type PlayerSave,
} from '@farming/shared';
import { gameEvents, type PanelId } from '../events/GameEventBus';
import type { CoopSession } from '../net/CoopSession';
import type { MineEvent, MineRun } from '../scenes/mine/types';
import type { PlayerState } from '../state/PlayerState';
import { skills } from '../state/skills';

/** What a Mine Dash run needs from the world scene. */
export interface DashHost {
  state: PlayerState;
  session: CoopSession;
  setPanel(panel: PanelId | null): void;
  /** Takes the player down to a floor of the run's mine; `exit` is called when they come up. */
  launchMine(floor: number, run: MineRun, exit: (fainted: boolean) => void): void;
  /** Pulls the player out of the mine (time's up). */
  stopMine(): void;
  /** Minutes on the game clock (buffs are timed by it). */
  clock(): number;
}

export type CampAction = 'meal' | 'fullHeal' | 'sharpen' | 'lantern' | 'armour' | 'continue' | 'bank';

/**
 * One Mine Dash run: you go down with a kit (your own backpack waits on the
 * surface), the clock runs, the mine is the same for every entrant (the
 * tournament's seed), and every five floors there's a camp where you can heal,
 * upgrade with the ore you've found, or bank your score and climb out. When it
 * ends, the server checks the run and scores it, and your things come back.
 */
export class MineDashRun implements MineRun {
  readonly seed: string;
  readonly lastFloor: number;
  lanternBonus = 0;
  attackBonus = 0;
  defenseBonus = 0;
  private readonly startFloor: number;
  private readonly endsAt: number;
  private readonly total: number;
  private readonly name: string;
  private mapsLeft: number;
  private depth: number;
  private readonly bosses: number[] = [];
  private elites = 0;
  private vaults = 0;
  private clean = 0;
  private earned = 0;
  private spent = 0;
  private banking = false;
  private ended = false;
  private readonly snapshot: PlayerSave;
  private readonly skillSnapshot: Record<string, number>;
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly offCollected: () => void;
  private campResolve: ((choice: 'continue' | 'bank') => void) | null = null;
  private campFloor = 0;

  constructor(
    private readonly host: DashHost,
    private readonly start: DashStart,
    name: string,
  ) {
    const v = MINE_DASH_VARIANTS[start.variant];
    this.seed = start.seed;
    this.startFloor = v.startFloor;
    this.lastFloor = v.lastFloor;
    this.depth = v.startFloor;
    this.total = v.minutes * 60_000;
    this.endsAt = Date.now() + this.total;
    this.name = start.practice ? `Practice ${v.name}` : name;
    const kit = MINE_DASH_KITS[start.kit];
    this.mapsLeft = kit.maps ?? 0;
    this.lanternBonus = kit.lantern ?? 0;

    // Your own things wait on the surface; you go down with the kit.
    this.snapshot = host.state.serialize();
    this.skillSnapshot = { ...skills.toSave() };
    const slots: PlayerSave['inventory']['slots'] = this.snapshot.inventory.slots.map(() => null);
    kit.items.forEach((it, i) => (slots[i] = { itemId: it.itemId, quantity: it.quantity }));
    host.state.restore({
      ...this.snapshot,
      inventory: { slots, selected: 0 },
      equipment: kit.armor ? { armor: kit.armor } : {},
      health: host.state.maxHealth,
      energy: host.state.maxEnergy,
      buffs: kit.swift ? [{ kind: 'speed', until: host.clock() + 100_000 }] : [],
      mineDepth: 0,
    });
    host.state.emitAll();

    // Ore and gems you pick up are run money.
    this.offCollected = gameEvents.on('item:collected', ({ itemId, quantity }) => {
      const price = ITEMS[itemId as ItemId]?.sellPrice ?? 0;
      if (price > 0) this.earned += price * quantity;
    });
    this.timer = setInterval(() => this.tick(), 250);
    host.launchMine(v.startFloor, this, (fainted) => this.end(fainted ? 'faint' : this.banking ? 'bank' : 'quit'));
    gameEvents.emit('toast', { text: `${this.name}: go! ${v.minutes} minutes on the clock.` });
    this.tick();
  }

  get active(): boolean {
    return !this.ended;
  }

  private get timeLeft(): number {
    return Math.max(0, this.endsAt - Date.now());
  }

  private get money(): number {
    return this.earned - this.spent;
  }

  // ---------- MineRun ----------

  event(e: MineEvent): void {
    if (e.t === 'floor') this.depth = Math.max(this.depth, e.floor);
    else if (e.t === 'boss' && !this.bosses.includes(e.floor)) this.bosses.push(e.floor);
    else if (e.t === 'elite') this.elites++;
    else if (e.t === 'vault') this.vaults++;
    else if (e.t === 'clean') this.clean++;
  }

  useMap(): boolean {
    if (this.mapsLeft <= 0) return false;
    this.mapsLeft--;
    return true;
  }

  /** After every 5th floor: a camp (or, at the end of a Sprint, the finish). */
  camp(floor: number): Promise<'continue' | 'bank'> {
    if (floor >= this.lastFloor) {
      gameEvents.emit('toast', { text: 'You reached the bottom of the course! Banking your score.' });
      this.banking = true;
      return Promise.resolve('bank');
    }
    this.campFloor = floor;
    this.emitCamp();
    this.host.setPanel('camp');
    return new Promise((resolve) => (this.campResolve = resolve));
  }

  /** A choice at the camp. */
  campAction(action: CampAction): void {
    if (!this.campResolve) return;
    const s = this.host.state;
    const buy = (cost: number, ok: () => void) => {
      if (this.money < cost) return void gameEvents.emit('toast', { text: `That costs ${cost} in run money. Mine more ore!` });
      this.spent += cost;
      ok();
    };
    switch (action) {
      case 'meal':
        buy(MINE_DASH_CAMP.meal.cost, () => s.heal(MINE_DASH_CAMP.meal.heal));
        break;
      case 'fullHeal':
        buy(MINE_DASH_CAMP.fullHeal.cost, () => s.heal(s.maxHealth));
        break;
      case 'sharpen':
        buy(MINE_DASH_CAMP.sharpen.cost, () => (this.attackBonus += MINE_DASH_CAMP.sharpen.attack));
        break;
      case 'lantern':
        buy(MINE_DASH_CAMP.lantern.cost, () => (this.lanternBonus += MINE_DASH_CAMP.lantern.radius));
        break;
      case 'armour':
        buy(MINE_DASH_CAMP.armour.cost, () => (this.defenseBonus = Math.min(0.5, this.defenseBonus + MINE_DASH_CAMP.armour.defense)));
        break;
      case 'continue':
      case 'bank': {
        const resolve = this.campResolve;
        this.campResolve = null;
        if (action === 'bank') this.banking = true;
        gameEvents.emit('dash:camp', null);
        this.host.setPanel(null);
        resolve(action);
        return;
      }
    }
    s.emitAll();
    this.emitCamp();
  }

  private emitCamp(): void {
    const s = this.host.state;
    gameEvents.emit('dash:camp', {
      floor: this.campFloor,
      money: this.money,
      health: s.health,
      maxHealth: s.maxHealth,
      attack: this.attackBonus,
      lantern: this.lanternBonus,
      defense: Math.round(this.defenseBonus * 100),
    });
  }

  // ---------- The clock ----------

  private summary(end: MineDashSummary['end']): MineDashSummary {
    return {
      depth: this.depth,
      bosses: [...this.bosses],
      elites: this.elites,
      vaults: this.vaults,
      clean: this.clean,
      earned: this.earned,
      spent: this.spent,
      end,
      timeLeft: Math.floor(this.timeLeft / 1000),
    };
  }

  private tick(): void {
    if (this.ended) return;
    if (this.timeLeft <= 0) {
      gameEvents.emit('toast', { text: '⏱ Time’s up!' });
      this.end('time');
      this.host.stopMine();
      return;
    }
    gameEvents.emit('dash:state', {
      name: this.name,
      practice: this.start.practice,
      timeLeft: Math.ceil(this.timeLeft / 1000),
      floor: this.depth,
      money: this.money,
      score: scoreMineDash(this.summary('time'), this.startFloor).total,
    });
  }

  /** The run is over: put your things back, then have the server score it. */
  end(how: MineDashSummary['end']): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    this.offCollected();
    if (this.campResolve) {
      this.campResolve = null;
      this.host.setPanel(null);
    }
    const summary = this.summary(how);
    const local = scoreMineDash(summary, this.startFloor);
    // Back to your own backpack (gold may have changed meanwhile: a prize, the server's word).
    const gold = this.host.state.gold;
    this.host.state.restore(this.snapshot);
    this.host.state.setGold(gold);
    skills.load(this.skillSnapshot);
    this.host.state.emitAll();
    gameEvents.emit('dash:state', null);
    gameEvents.emit('dash:camp', null);
    gameEvents.emit('dash:result', { name: this.name, practice: this.start.practice, score: local, best: null, checking: true });
    this.host.setPanel('dashResult');
    void this.host.session.call('dash:finish', { runId: this.start.runId, summary }).then((r) => {
      if (r.ok) gameEvents.emit('dash:result', { name: this.name, practice: this.start.practice, score: r.score, best: r.best, checking: false });
      else gameEvents.emit('dash:result', { name: this.name, practice: this.start.practice, score: local, best: null, checking: false, error: r.error });
    });
  }
}
