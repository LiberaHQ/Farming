import {
  discountFor,
  FRIENDSHIP,
  HEART_EVENTS,
  heartsFor,
  ITEMS,
  MAX_LETTERS,
  NPC_IDS,
  NPCS,
  type HeartEvent,
  type ItemAmount,
  type ItemId,
  type Letter,
  type NpcId,
  type SocialSave,
} from '@farming/shared';

export type GiftReaction = 'loved' | 'liked' | 'neutral';

export interface FriendView {
  id: NpcId;
  name: string;
  title: string;
  hearts: number;
  /** 0–1 progress towards the next heart. */
  progress: number;
  talkedToday: boolean;
  giftedToday: boolean;
}

const isNpcId = (id: string): id is NpcId => (NPC_IDS as string[]).includes(id);

/**
 * Friendship with the villagers. Pure model: talking once a day and one gift
 * a day raise friendship; hearts unlock friendlier lines and shop discounts.
 */
export class Social {
  private points: Partial<Record<NpcId, number>> = {};
  private talkedDay: Partial<Record<NpcId, number>> = {};
  private giftedDay: Partial<Record<NpcId, number>> = {};
  private events: Partial<Record<NpcId, number[]>> = {};
  private mail: Letter[] = [];
  private festival: { day: number; entered: boolean; eggs?: boolean } = { day: 0, entered: false };
  private beach: { day: number; taken: number[] } = { day: 0, taken: [] };
  /** Main story chapter, villager requests done, and the first-day tip you're on (-1 = finished). */
  story = 0;
  arcs: Partial<Record<NpcId, number>> = {};
  tutorial = 0;
  private forest: { day: number; taken: number[] } = { day: 0, taken: [] };
  pet: SocialSave['pet'] = undefined;
  petOffered = false;
  dating: NpcId | undefined = undefined;
  spouse: NpcId | undefined = undefined;
  weddingDay: number | undefined = undefined;
  /** Day of the last free spin on the carnival wheel. */
  carnivalSpin = 0;

  constructor(private readonly onChange: () => void = () => undefined) {}

  pointsOf(id: NpcId): number {
    return this.points[id] ?? 0;
  }

  hearts(id: NpcId): number {
    return heartsFor(this.pointsOf(id));
  }

  discount(id: NpcId): number {
    return discountFor(this.pointsOf(id));
  }

  talkedToday(id: NpcId, day: number): boolean {
    return this.talkedDay[id] === day;
  }

  giftedToday(id: NpcId, day: number): boolean {
    return this.giftedDay[id] === day;
  }

  /** Records today's chat. Returns the hearts before and after (equal if nothing changed). */
  talk(id: NpcId, day: number): { gained: number; before: number; after: number } {
    const before = this.hearts(id);
    if (this.talkedToday(id, day)) return { gained: 0, before, after: before };
    this.talkedDay[id] = day;
    this.add(id, FRIENDSHIP.talk);
    return { gained: FRIENDSHIP.talk, before, after: this.hearts(id) };
  }

  reactionTo(id: NpcId, itemId: ItemId): GiftReaction {
    const { loved, liked } = NPCS[id].gifts;
    if (loved.includes(itemId)) return 'loved';
    if (liked.includes(itemId)) return 'liked';
    return 'neutral';
  }

  /** Whether an item can be given as a gift at all (not tools or structures). */
  static giftable(itemId: ItemId): boolean {
    const def = ITEMS[itemId];
    return !def.tool && !def.places && !def.releases;
  }

  /** Records a gift (one per villager per day). Null when already gifted today. `multiplier` = festival bonus. */
  gift(id: NpcId, itemId: ItemId, day: number, multiplier = 1): { reaction: GiftReaction; gained: number; before: number; after: number } | null {
    if (this.giftedToday(id, day)) return null;
    const before = this.hearts(id);
    const reaction = this.reactionTo(id, itemId);
    const gained = (reaction === 'loved' ? FRIENDSHIP.giftLoved : reaction === 'liked' ? FRIENDSHIP.giftLiked : FRIENDSHIP.giftNeutral) * multiplier;
    this.giftedDay[id] = day;
    this.add(id, gained);
    return { reaction, gained, before, after: this.hearts(id) };
  }

  add(id: NpcId, amount: number): void {
    const max = FRIENDSHIP.maxHearts * FRIENDSHIP.pointsPerHeart;
    this.points[id] = Math.max(0, Math.min(max, this.pointsOf(id) + amount));
    this.onChange();
  }

  // ---------- Heart scenes ----------

  /** The next heart scene this villager is ready to share, if any. */
  pendingEvent(id: NpcId): HeartEvent | null {
    const seen = this.events[id] ?? [];
    const hearts = this.hearts(id);
    return HEART_EVENTS[id].find((e) => e.hearts <= hearts && !seen.includes(e.hearts)) ?? null;
  }

  markEvent(id: NpcId, hearts: number): void {
    this.events[id] = [...(this.events[id] ?? []), hearts];
    this.onChange();
  }

  // ---------- Mail ----------

  get letters(): readonly Letter[] {
    return this.mail;
  }

  get unread(): number {
    return this.mail.filter((l) => !l.read).length;
  }

  send(day: number, from: string, subject: string, body: string, attachment?: ItemAmount): void {
    const id = this.mail.reduce((m, l) => Math.max(m, l.id), 0) + 1;
    this.mail.unshift({ id, day, from, subject, body, ...(attachment ? { attachment } : {}), read: false, claimed: false });
    // Keep the newest; drop old read letters first.
    while (this.mail.length > MAX_LETTERS) {
      const i = this.mail.map((l) => l.read && (!l.attachment || l.claimed)).lastIndexOf(true);
      this.mail.splice(i >= 0 ? i : this.mail.length - 1, 1);
    }
    this.onChange();
  }

  markRead(id: number): void {
    const l = this.mail.find((x) => x.id === id);
    if (l && !l.read) {
      l.read = true;
      this.onChange();
    }
  }

  /** Takes a letter's attachment (once). */
  claim(id: number): ItemAmount | null {
    const l = this.mail.find((x) => x.id === id);
    if (!l?.attachment || l.claimed) return null;
    l.claimed = true;
    l.read = true;
    this.onChange();
    return l.attachment;
  }

  // ---------- Festivals ----------

  enteredFair(day: number): boolean {
    return this.festival.day === day && this.festival.entered;
  }

  enterFair(day: number): void {
    this.festival = { ...this.festival, day, entered: true };
    this.onChange();
  }

  forestTaken(day: number): number[] {
    return this.forest.day === day ? [...this.forest.taken] : [];
  }

  takeForest(day: number, id: number): void {
    this.forest = { day, taken: this.forest.day === day ? [...this.forest.taken, id] : [id] };
    this.onChange();
  }

  beachTaken(day: number): number[] {
    return this.beach.day === day ? [...this.beach.taken] : [];
  }

  takeBeach(day: number, id: number): void {
    this.beach = { day, taken: this.beach.day === day ? [...this.beach.taken, id] : [id] };
    this.onChange();
  }

  /** The Egg Festival's eggs are hidden once per player per festival. */
  eggsHidden(day: number): boolean {
    return this.festival.day === day && !!this.festival.eggs;
  }

  hideEggs(day: number): void {
    this.festival = { day, entered: this.festival.day === day && this.festival.entered, eggs: true };
    this.onChange();
  }

  view(day: number): FriendView[] {
    return NPC_IDS.map((id) => {
      const pts = this.pointsOf(id);
      const hearts = heartsFor(pts);
      return {
        id,
        name: NPCS[id].name,
        title: NPCS[id].title,
        hearts,
        progress: hearts >= FRIENDSHIP.maxHearts ? 1 : (pts % FRIENDSHIP.pointsPerHeart) / FRIENDSHIP.pointsPerHeart,
        talkedToday: this.talkedToday(id, day),
        giftedToday: this.giftedToday(id, day),
      };
    });
  }

  serialize(): SocialSave {
    return {
      points: { ...this.points },
      talkedDay: { ...this.talkedDay },
      giftedDay: { ...this.giftedDay },
      events: structuredClone(this.events) as Record<string, number[]>,
      mail: structuredClone(this.mail),
      festival: { ...this.festival },
      beach: { day: this.beach.day, taken: [...this.beach.taken] },
      story: this.story,
      arcs: { ...this.arcs },
      tutorial: this.tutorial,
      forest: { day: this.forest.day, taken: [...this.forest.taken] },
      ...(this.pet ? { pet: { ...this.pet } } : {}),
      ...(this.petOffered ? { petOffered: true } : {}),
      ...(this.dating ? { dating: this.dating } : {}),
      ...(this.spouse ? { spouse: this.spouse } : {}),
      ...(this.weddingDay !== undefined ? { weddingDay: this.weddingDay } : {}),
      ...(this.carnivalSpin ? { carnivalSpin: this.carnivalSpin } : {}),
    };
  }

  restore(save: SocialSave | undefined): void {
    this.points = {};
    this.talkedDay = {};
    this.giftedDay = {};
    this.events = {};
    this.mail = [];
    this.festival = { day: 0, entered: false };
    this.story = 0;
    this.arcs = {};
    this.tutorial = 0;
    this.forest = { day: 0, taken: [] };
    this.pet = undefined;
    this.petOffered = false;
    this.dating = undefined;
    this.spouse = undefined;
    this.weddingDay = undefined;
    this.carnivalSpin = 0;
    if (!save) return;
    this.carnivalSpin = save.carnivalSpin ?? 0;
    if (save.forest) this.forest = { day: save.forest.day, taken: [...save.forest.taken] };
    if (save.pet) this.pet = { ...save.pet };
    this.petOffered = save.petOffered === true;
    this.dating = save.dating && isNpcId(save.dating) ? save.dating : undefined;
    this.spouse = save.spouse && isNpcId(save.spouse) ? save.spouse : undefined;
    this.weddingDay = save.weddingDay;
    this.story = save.story ?? 0;
    for (const [id, v] of Object.entries(save.arcs ?? {})) if (isNpcId(id)) this.arcs[id] = v;
    // Older saves already know their way around.
    this.tutorial = save.tutorial ?? (Object.keys(save.points).length > 0 ? -1 : 0);
    for (const [id, v] of Object.entries(save.events ?? {})) if (isNpcId(id)) this.events[id] = [...v];
    this.mail = (save.mail ?? []).filter((l) => !l.attachment || l.attachment.itemId in ITEMS).map((l) => ({ ...l }));
    if (save.festival) this.festival = { ...save.festival };
    if (save.beach) this.beach = { day: save.beach.day, taken: [...save.beach.taken] };
    for (const [id, v] of Object.entries(save.points)) if (isNpcId(id)) this.points[id] = v;
    for (const [id, v] of Object.entries(save.talkedDay)) if (isNpcId(id)) this.talkedDay[id] = v;
    for (const [id, v] of Object.entries(save.giftedDay)) if (isNpcId(id)) this.giftedDay[id] = v;
    this.onChange();
  }
}
