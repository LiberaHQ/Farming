'use client';

import { CalendarPanel } from './panels/CalendarPanel';
import { GamepadMenuNav } from './GamepadMenuNav';
import { Minimap } from './Minimap';
import { DailyGoals } from './DailyGoals';
import type { TerrainName } from '@farming/shared';
import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { ActionButton } from './ActionButton';
import { Clock } from './Clock';
import { DialogueBox } from './DialogueBox';
import { Hotbar } from './Hotbar';
import { CharacterPanel } from './panels/CharacterPanel';
import { ChestPanel } from './panels/ChestPanel';
import { CraftingPanel } from './panels/CraftingPanel';
import { MenuPanel } from './panels/MenuPanel';
import { InventoryPanel } from './panels/InventoryPanel';
import { MapPanel } from './panels/MapPanel';
import { BoardPanel } from './panels/BoardPanel';
import { FreightPanel } from './panels/FreightPanel';
import { NightMarketPanel } from './panels/NightMarketPanel';
import { TradePanel } from './panels/TradePanel';
import { PlayerTradePanel } from './panels/PlayerTradePanel';
import { CoopHud } from './CoopHud';
import { ElevatorPanel } from './panels/ElevatorPanel';
import { MailPanel } from './panels/MailPanel';
import { Toasts } from './Toasts';
import { CollectionPanel } from './panels/CollectionPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { TouchControls } from './TouchControls';
import { BuffBar } from './BuffBar';
import { JournalPanel } from './panels/JournalPanel';
import { TutorialTip } from './TutorialTip';
import { PetPanel } from './panels/PetPanel';
import { CarnivalPanel } from './panels/CarnivalPanel';
import { EmotePicker } from './EmotePicker';
import { ShippingPanel } from './panels/ShippingPanel';
import { SummaryPanel } from './panels/SummaryPanel';
import { actionKey } from '@/game-engine/settings';
import { useCoarsePointer, useSettings } from '@/hooks/useSettings';

const ARROW: Record<string, number> = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315 };

const TERRAIN_LABEL: Record<TerrainName, string> = {
  grass: 'Meadow',
  water: 'Water',
  path: 'Path',
  bridge: 'Bridge',
};

/** Overlay UI. Renders game state from events; changes go back as commands. */
export function Hud() {
  const world = useGameEvent('world:ready');
  const tile = useGameEvent('player:tile');
  const perf = useGameEvent('perf:fps');
  const stats = useGameEvent('player:stats');
  const inventory = useGameEvent('inventory:changed');
  const panel = useGameEvent('ui:panel')?.panel ?? null;
  const time = useGameEvent('world:time');
  const mine = useGameEvent('mine:floor');
  const area = useGameEvent('area:label');
  const waypoint = useGameEvent('waypoint:info');
  const boss = useGameEvent('mine:boss');
  const { uiScale, keys, touch } = useSettings();
  const coarse = useCoarsePointer();
  const touchOn = touch === 'on' || (touch === 'auto' && coarse);
  const k = (a: Parameters<typeof actionKey>[0]) => (keys ? actionKey(a) : '');

  return (
    <div className="hud" aria-live="polite" style={{ zoom: uiScale }}>
      {!world && <div className="hud-loading">Generating world…</div>}

      {world && (
        <div className="hud-top-left-stack">
        <div className="hud-panel hud-top-left">
          <div>
            Seed <strong>{world.seed}</strong>
          </div>
          {mine ? (
            <div className="mine-label">⛏ Mine · floor {mine.floor}</div>
          ) : area ? (
            <div className="mine-label">{area.label}</div>
          ) : (
            tile && (
              <div className="hud-muted">
                {TERRAIN_LABEL[tile.terrain]} · {tile.tx}, {tile.ty}
              </div>
            )
          )}
          <button type="button" className="btn map-button" onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('ui:open', { panel: 'map' })}>
            Map <kbd>{k('map')}</kbd>
          </button>
        </div>
        <Minimap />
        </div>
      )}

      {waypoint && !area && !mine && (
        <div className="hud-panel waypoint-hud">
          <span className="waypoint-arrow" style={{ transform: `rotate(${ARROW[waypoint.direction] ?? 0}deg)` }}>
            ➤
          </span>
          <span>
            {waypoint.reachable ? `${waypoint.steps} steps` : `${waypoint.steps} tiles · no path`} · {waypoint.direction}
          </span>
          <button type="button" className="waypoint-clear" title="Clear marker" onMouseDown={(e) => e.preventDefault()} onClick={() => gameCommands.emit('waypoint:clear', {})}>
            ✕
          </button>
        </div>
      )}

      {boss && mine && (
        <div className="hud-panel boss-bar">
          <strong>{boss.name}</strong>
          <div className="track">
            <div className="fill" style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="hud-top-right">
        <Clock />
        {stats && (
          <div className="hud-panel gold">
            <span className="coin" /> {stats.gold}g
          </div>
        )}
        {perf && <div className="hud-panel hud-muted">{Math.round(perf.fps)} fps</div>}
      </div>

      {world && uiScale < 1.3 && !touchOn && (
        <div className="hud-panel hud-bottom-left controls" aria-label="Controls">
          {(
            [
              [`${k('up')}${k('left')}${k('down')}${k('right')}`, 'move'],
              [k('run'), 'run'],
              [k('use'), 'use'],
              [k('interact'), 'interact'],
              [k('eat'), 'eat'],
              [k('map'), 'map'],
              [k('minimap'), 'minimap'],
              [k('inventory'), 'bag'],
              [k('crafting'), 'craft'],
              [k('collection'), 'collection'],
              [k('calendar'), 'calendar'],
              ['Esc', 'menu'],
            ] as const
          ).map(([key, what]) => (
            <div key={what} className="control">
              <kbd>{key}</kbd>
              <span>{what}</span>
            </div>
          ))}
        </div>
      )}

      {!panel && <ActionButton />}
      <div className="hud-right-column">
        <BuffBar />
        {world && <DailyGoals />}
      </div>
      <Hotbar />
      <Toasts />

      {inventory && panel === 'inventory' && <InventoryPanel inventory={inventory} />}
      {inventory && panel === 'crafting' && <CraftingPanel inventory={inventory} />}
      {inventory && panel === 'shop' && (
        <TradePanel inventory={inventory} gold={stats?.gold ?? 0} lifetimeEarnings={stats?.lifetimeEarnings ?? 0} />
      )}
      {panel === 'board' && <BoardPanel />}
      {panel === 'freight' && <FreightPanel />}
      {panel === 'market' && <NightMarketPanel />}
      {panel === 'mine' && <ElevatorPanel />}
      {panel === 'mail' && <MailPanel />}
      {inventory && panel === 'trade' && <PlayerTradePanel inventory={inventory} gold={stats?.gold ?? 0} />}
      {world && <CoopHud />}
      {inventory && panel === 'chest' && <ChestPanel inventory={inventory} />}
      {panel === 'character' && <CharacterPanel />}
      {panel === 'menu' && <MenuPanel />}
      {panel === 'dialogue' && <DialogueBox />}
      {panel === 'map' && <MapPanel />}
      {panel === 'collection' && <CollectionPanel />}
      {panel === 'settings' && <SettingsPanel />}
      {inventory && panel === 'shipping' && <ShippingPanel inventory={inventory} />}
      {panel === 'summary' && <SummaryPanel />}
      {panel === 'journal' && <JournalPanel />}
      {panel === 'pet' && <PetPanel />}
      {panel === 'calendar' && <CalendarPanel />}
      <GamepadMenuNav open={!!panel && panel !== 'dialogue'} />
      {inventory && panel === 'carnival' && <CarnivalPanel slots={inventory.slots} gold={stats?.gold ?? 0} />}
      {world && !panel && <TutorialTip />}
      {world && !panel && <EmotePicker />}
      {world && !panel && <TouchControls />}
    </div>
  );
}
