'use client';

import { ITEMS } from '@farming/shared';
import { gameCommands, type GameEventMap } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ItemIcon } from '../ItemIcon';
import { Panel } from './Panel';
import { qualityName, qualityPrice, qualityStar } from '../quality';

/** The shipping bin: drop goods in today, get paid overnight at full price. */
export function ShippingPanel({ inventory }: { inventory: GameEventMap['inventory:changed'] }) {
  const ship = useGameEvent('ship:state');
  if (!ship) return null;
  const sellable = inventory.slots.map((s, slot) => ({ s, slot })).filter(({ s }) => s && ITEMS[s.itemId].sellPrice);
  return (
    <Panel title="Shipping bin" footer={<span className="hud-muted">Everything in the bin sells overnight at full price. You'll get a report in the morning.</span>}>
      <div className="shipping">
        <section>
          <h3 className="panel-subtitle">Your backpack</h3>
          <ul className="shop-list">
            {sellable.length === 0 && <li className="hud-muted">Nothing sellable.</li>}
            {sellable.map(({ s, slot }) => (
              <li key={slot}>
                <ItemIcon id={s!.itemId} />
                <span className="shop-name">
                  {s!.quantity}× {qualityStar(s!.q)}{qualityName(s!.itemId, s!.q)} <span className="hud-muted">· {(qualityPrice(s!.itemId, s!.q) ?? 0) * s!.quantity}g</span>
                </span>
                <button type="button" className="btn" onClick={() => gameCommands.emit('ship:add', { slot })}>
                  Ship
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="panel-subtitle">
            In the bin <span className="hud-muted">· {ship.total}g tonight</span>
          </h3>
          <ul className="shop-list">
            {ship.bin.length === 0 && <li className="hud-muted">Empty.</li>}
            {ship.bin.map((b, index) => (
              <li key={`${b.itemId}-${b.q ?? 0}`}>
                <ItemIcon id={b.itemId} />
                <span className="shop-name">
                  {b.quantity}× {qualityStar(b.q)}{qualityName(b.itemId, b.q)} <span className="hud-muted">· {b.gold}g</span>
                </span>
                <button type="button" className="btn" onClick={() => gameCommands.emit('ship:remove', { index })}>
                  Take back
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Panel>
  );
}
