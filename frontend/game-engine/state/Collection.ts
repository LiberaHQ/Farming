import { ACHIEVEMENTS, isWildlifeId, type AchievementContext, type AchievementDef, type CollectionSave, type ItemId, type SlotData, type WildlifeId } from '@farming/shared';

/** Everything this player has ever held, and the achievements they've earned. */
export class Collection {
  private readonly found = new Set<ItemId>();
  private readonly earned = new Set<string>();
  private readonly seen = new Set<WildlifeId>();

  restore(save: CollectionSave | undefined): void {
    this.found.clear();
    this.earned.clear();
    for (const id of save?.found ?? []) this.found.add(id);
    for (const id of save?.achievements ?? []) this.earned.add(id);
    this.seen.clear();
    for (const id of save?.sightings ?? []) if (isWildlifeId(id)) this.seen.add(id);
  }

  /** Logs a rare creature. True the first time it's seen. */
  spot(id: WildlifeId): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }

  serialize(): CollectionSave {
    return { found: [...this.found], achievements: [...this.earned], ...(this.seen.size ? { sightings: [...this.seen] } : {}) };
  }

  get foundItems(): ReadonlySet<ItemId> {
    return this.found;
  }

  get sightingCount(): number {
    return this.seen.size;
  }

  has(id: string): boolean {
    return this.earned.has(id);
  }

  /** Notes what's in the backpack. Returns items never held before. */
  note(slots: readonly (SlotData | null)[]): ItemId[] {
    const fresh: ItemId[] = [];
    for (const s of slots) {
      if (s && !this.found.has(s.itemId)) {
        this.found.add(s.itemId);
        fresh.push(s.itemId);
      }
    }
    return fresh;
  }

  /** Achievements newly earned in this context. */
  check(ctx: Omit<AchievementContext, 'found'>): AchievementDef[] {
    const full: AchievementContext = { ...ctx, found: this.found };
    const fresh: AchievementDef[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.earned.has(a.id)) continue;
      const [have, need] = a.progress(full);
      if (have >= need) {
        this.earned.add(a.id);
        fresh.push(a);
      }
    }
    return fresh;
  }

  view(ctx: Omit<AchievementContext, 'found'>): { found: ItemId[]; sightings: WildlifeId[]; achievements: { id: string; have: number; need: number; earned: boolean }[] } {
    const full: AchievementContext = { ...ctx, found: this.found };
    return {
      found: [...this.found],
      sightings: [...this.seen],
      achievements: ACHIEVEMENTS.map((a) => {
        const [have, need] = a.progress(full);
        return { id: a.id, have, need, earned: this.earned.has(a.id) };
      }),
    };
  }
}
