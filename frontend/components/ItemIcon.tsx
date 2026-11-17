'use client';

import { useEffect, useState } from 'react';
import { ITEMS, type ItemId } from '@farming/shared';
import { drawItemIcon } from '@/game-engine/assets/items';

const cache = new Map<ItemId, string>();

/** Same pixel art as the game, rendered once per item to a data URL. */
function iconUrl(id: ItemId): string {
  let url = cache.get(id);
  if (!url) {
    url = drawItemIcon(id).toCanvas().toDataURL();
    cache.set(id, url);
  }
  return url;
}

export function ItemIcon({ id, size = 32 }: { id: ItemId; size?: number }) {
  const [src, setSrc] = useState<string | null>(() => cache.get(id) ?? null);
  useEffect(() => setSrc(iconUrl(id)), [id]);
  return src ? (
    <img className="item-icon" src={src} width={size} height={size} alt={ITEMS[id].name} draggable={false} />
  ) : (
    <span className="item-icon" style={{ width: size, height: size }} />
  );
}
