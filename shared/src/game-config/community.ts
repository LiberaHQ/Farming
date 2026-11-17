import type { ItemId } from './items';
import type { ItemAmount } from './recipes';

/**
 * Community projects on the notice board: big shared goals everyone on the
 * farm (alone or in co-op) chips in to. Finishing one pays every player and
 * mails them a gift.
 */
export type CommunityGoalId = 'lumber' | 'harvest' | 'pantry' | 'mine' | 'ocean';

export interface CommunityGoal {
  id: CommunityGoalId;
  title: string;
  /** Who asked, shown on the board and signing the thank-you letter. */
  from: string;
  description: string;
  needs: ItemAmount[];
  /** Paid to every player when the goal is done. */
  gold: number;
  /** Mailed to every player when the goal is done. */
  gift: ItemAmount;
}

export const COMMUNITY_GOALS: readonly CommunityGoal[] = [
  {
    id: 'lumber',
    title: 'Mend the market stalls',
    from: 'Willa',
    description: 'The stall roofs leak. Timber and stone, and the whole market gets a fix-up.',
    needs: [
      { itemId: 'wood', quantity: 150 },
      { itemId: 'stone', quantity: 100 },
      { itemId: 'fiber', quantity: 40 },
    ],
    gold: 500,
    gift: { itemId: 'bookshelf', quantity: 1 },
  },
  {
    id: 'harvest',
    title: 'Harvest basket',
    from: 'Mira',
    description: "A basket of the valley's best for the travelling merchant.",
    needs: [
      { itemId: 'carrot', quantity: 15 },
      { itemId: 'potato', quantity: 10 },
      { itemId: 'tomato', quantity: 10 },
      { itemId: 'corn', quantity: 10 },
      { itemId: 'pumpkin', quantity: 5 },
    ],
    gold: 800,
    gift: { itemId: 'sprinkler', quantity: 2 },
  },
  {
    id: 'pantry',
    title: 'Stock the pantry',
    from: 'Rosa',
    description: 'Rosa wants to throw a winter supper for the whole village.',
    needs: [
      { itemId: 'milk', quantity: 10 },
      { itemId: 'egg', quantity: 20 },
      { itemId: 'cheese', quantity: 5 },
      { itemId: 'juice', quantity: 5 },
      { itemId: 'wheat', quantity: 20 },
    ],
    gold: 1000,
    gift: { itemId: 'table', quantity: 1 },
  },
  {
    id: 'mine',
    title: 'Shore up the mine',
    from: 'Bram',
    description: 'Ore for new supports, so the deeper floors stay safe.',
    needs: [
      { itemId: 'copper_ore', quantity: 40 },
      { itemId: 'iron_ore', quantity: 25 },
      { itemId: 'gold_ore', quantity: 10 },
      { itemId: 'amethyst', quantity: 3 },
    ],
    gold: 1200,
    gift: { itemId: 'floor_lamp', quantity: 1 },
  },
  {
    id: 'ocean',
    title: 'Aquarium for the square',
    from: 'Finn',
    description: 'Finn dreams of a little aquarium by the well. Bring him the sea!',
    needs: [
      { itemId: 'seashell', quantity: 10 },
      { itemId: 'coral', quantity: 5 },
      { itemId: 'tuna', quantity: 2 },
      { itemId: 'pufferfish', quantity: 1 },
    ],
    gold: 900,
    gift: { itemId: 'painting', quantity: 1 },
  },
];

export const COMMUNITY_GOAL_IDS = COMMUNITY_GOALS.map((g) => g.id);

/** Items given so far, per goal. */
export type CommunityProgress = Partial<Record<CommunityGoalId, Partial<Record<ItemId, number>>>>;

export function communityGoal(id: CommunityGoalId): CommunityGoal | undefined {
  return COMMUNITY_GOALS.find((g) => g.id === id);
}

export function isCommunityGoalId(v: unknown): v is CommunityGoalId {
  return typeof v === 'string' && (COMMUNITY_GOAL_IDS as string[]).includes(v);
}

/** How many more of an item a goal still needs (0 if it doesn't need it). */
export function communityRoom(progress: CommunityProgress, id: CommunityGoalId, itemId: ItemId): number {
  const need = communityGoal(id)?.needs.find((n) => n.itemId === itemId)?.quantity ?? 0;
  return Math.max(0, need - (progress[id]?.[itemId] ?? 0));
}

export function communityDone(progress: CommunityProgress, id: CommunityGoalId): boolean {
  const goal = communityGoal(id);
  return !!goal && goal.needs.every((n) => (progress[id]?.[n.itemId] ?? 0) >= n.quantity);
}

/** Records a donation (already clamped by communityRoom). Returns true if it finished the goal. */
export function applyDonation(progress: CommunityProgress, id: CommunityGoalId, itemId: ItemId, quantity: number): boolean {
  const before = communityDone(progress, id);
  const goal = (progress[id] ??= {});
  goal[itemId] = (goal[itemId] ?? 0) + quantity;
  return !before && communityDone(progress, id);
}
