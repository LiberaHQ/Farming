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
  type CarnivalSave,
  type IslandSave,
  type SocialSave,
  ISLAND_PLOTS,
  TIDE_BEDS,
  freshTidal,
  freshNightMarket,
  freshHeirloom,
  type HeirloomSave,
  type NightMarketSave,
  type TidalSave,
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
  /** A second pet (the other kind). */
  pet2: SocialSave['pet2'] = undefined;
  petOffered = false;
  dating: NpcId | undefined = undefined;
  spouse: NpcId | undefined = undefined;
  weddingDay: number | undefined = undefined;
  /** Day of the last free spin on the carnival wheel. */
  carnivalSpin = 0;
  private carnival: CarnivalSave = { day: 0, played: [], card: false, challenge: false, fortune: false, tip: false, best: {} };
  /** The island: boat, cave, garden and today's finds. */
  island: IslandSave = Social.freshIsland();
  /** Museum donations and the sets already rewarded. */
  museum: { items: ItemId[]; sets: string[] } = { items: [], sets: [] };
  private homeTreat: Partial<Record<NpcId, number>> = {};
  /** Pets told to stay, and where. */
  petStay: SocialSave['petStay'] = undefined;
  /** Guide steps done that the rest of the save can't show. */
  milestones = new Set<string>();
  rainbowDay = 0;
  meteorDay = 0;
  /** Elsie the ghost: belongings returned (3 = she has moved on), and whether she asked for the next one. */
  ghost = { stage: 0, asked: false };
  trainsSeen = 0;
  /** Tide beds on the beach. */
  tidal: TidalSave = freshTidal();
  /** The ghost night market: its note, and the ferryman's goods bought tonight. */
  nightMarket: NightMarketSave = freshNightMarket();
  /** Heirloom seeds: the starter letters, parcels packed and parcels opened. */
  heirloom: HeirloomSave = freshHeirloom();

  /** Marks a guide step done; true the first time. */
  mark(id: string): boolean {
    if (this.milestones.has(id)) return false;
    this.milestones.add(id);
    this.onChange();
    return true;
  }

  /** Your pets (one or two: a cat and a dog). */
  get allPets(): NonNullable<SocialSave['pet']>[] {
    return [this.pet, this.pet2].filter((p): p is NonNullable<SocialSave['pet']> => !!p);
  }

  petOf(kind: 'cat' | 'dog'): NonNullable<SocialSave['pet']> | undefined {
    return this.allPets.find((p) => p.kind === kind);
  }

  static freshIsland(): IslandSave {
    return { boat: false, cave: false, chest: false, day: 0, taken: [], plots: Array(ISLAND_PLOTS).fill(null) };
  }

  islandTaken(day: number): number[] {
    return this.island.day === day ? [...this.island.taken] : [];
  }

  takeIsland(day: number, id: number): void {
    this.island = { ...this.island, day, taken: this.island.day === day ? [...this.island.taken, id] : [id] };
    this.onChange();
  }

  /** Whether a villager has already given you today's treat at home. */
  treatedToday(id: NpcId, day: number): boolean {
    return this.homeTreat[id] === day;
  }

  markTreat(id: NpcId, day: number): void {
    this.homeTreat[id] = day;
    this.onChange();
  }

  /** Today's carnival card, challenge, fortune and tip (reset each day; best scores kept). */
  carnivalToday(day: number): CarnivalSave {
    if (this.carnival.day !== day) this.carnival = { day, played: [], card: false, challenge: false, fortune: false, tip: false, best: this.carnival.best };
    return this.carnival;
  }

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
      ...(this.pet2 ? { pet2: { ...this.pet2 } } : {}),
      ...(this.petOffered ? { petOffered: true } : {}),
      ...(this.dating ? { dating: this.dating } : {}),
      ...(this.spouse ? { spouse: this.spouse } : {}),
      ...(this.weddingDay !== undefined ? { weddingDay: this.weddingDay } : {}),
      ...(this.carnivalSpin ? { carnivalSpin: this.carnivalSpin } : {}),
      carnival: structuredClone(this.carnival),
      island: structuredClone(this.island),
      museum: { items: [...this.museum.items], sets: [...this.museum.sets] },
      homeTreat: { ...this.homeTreat },
      ...(this.petStay ? { petStay: structuredClone(this.petStay) } : {}),
      milestones: [...this.milestones],
      rainbowDay: this.rainbowDay,
      meteorDay: this.meteorDay,
      ghost: { ...this.ghost },
      trainsSeen: this.trainsSeen,
      tidal: structuredClone(this.tidal),
      nightMarket: structuredClone(this.nightMarket),
      heirloom: structuredClone(this.heirloom),
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
    this.pet2 = undefined;
    this.petOffered = false;
    this.dating = undefined;
    this.spouse = undefined;
    this.weddingDay = undefined;
    this.carnivalSpin = 0;
    this.carnival = { day: 0, played: [], card: false, challenge: false, fortune: false, tip: false, best: {} };
    this.island = Social.freshIsland();
    this.museum = { items: [], sets: [] };
    this.homeTreat = {};
    this.petStay = undefined;
    this.milestones = new Set();
    this.rainbowDay = 0;
    this.meteorDay = 0;
    this.ghost = { stage: 0, asked: false };
    this.trainsSeen = 0;
    this.tidal = freshTidal();
    this.nightMarket = freshNightMarket();
    this.heirloom = freshHeirloom();
    if (!save) return;
    if (save.petStay) this.petStay = structuredClone(save.petStay);
    this.milestones = new Set(save.milestones ?? []);
    this.rainbowDay = save.rainbowDay ?? 0;
    this.meteorDay = save.meteorDay ?? 0;
    this.ghost = save.ghost ? { ...save.ghost } : { stage: 0, asked: false };
    this.trainsSeen = save.trainsSeen ?? 0;
    if (save.heirloom) this.heirloom = { ...(save.heirloom.intro ? { intro: true } : {}), sent: save.heirloom.sent, redeemed: [...save.heirloom.redeemed] };
    if (save.nightMarket) this.nightMarket = { ...(save.nightMarket.intro ? { intro: true } : {}), day: save.nightMarket.day, bought: [...save.nightMarket.bought] };
    if (save.tidal) this.tidal = { beds: Array.from({ length: TIDE_BEDS }, (_, i) => (save.tidal!.beds[i] ? { ...save.tidal!.beds[i]! } : null)) };
    if (save.island) this.island = { ...structuredClone(save.island), plots: Array.from({ length: ISLAND_PLOTS }, (_, i) => save.island!.plots[i] ?? null) };
    if (save.museum) this.museum = { items: save.museum.items.filter((i): i is ItemId => i in ITEMS), sets: [...save.museum.sets] };
    for (const [id, v] of Object.entries(save.homeTreat ?? {})) if (isNpcId(id)) this.homeTreat[id] = v;
    this.carnivalSpin = save.carnivalSpin ?? 0;
    if (save.carnival) this.carnival = structuredClone(save.carnival);
    if (save.forest) this.forest = { day: save.forest.day, taken: [...save.forest.taken] };
    if (save.pet) this.pet = { ...save.pet };
    if (save.pet && save.pet2 && save.pet2.kind !== save.pet.kind) this.pet2 = { ...save.pet2 };
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
