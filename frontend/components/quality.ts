import { ITEMS, QUALITY_NAMES, withQuality, type ItemId } from '@farming/shared';

/** "Gold Carrot", "Silver Apple", or just the name. */
export function qualityName(itemId: ItemId, q?: 1 | 2): string {
  return q ? `${QUALITY_NAMES[q]} ${ITEMS[itemId].name}` : ITEMS[itemId].name;
}

/** What one sells for at this quality (undefined if it can't be sold). */
export function qualityPrice(itemId: ItemId, q?: 1 | 2): number | undefined {
  const base = ITEMS[itemId].sellPrice;
  return base === undefined ? undefined : withQuality(base, q);
}

/** A little star for silver/gold, as text (for lists). */
export const qualityStar = (q?: 1 | 2) => (q === 2 ? '★ ' : q === 1 ? '☆ ' : '');
