'use client';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { actionKey } from '@/game-engine/settings';
import { useGameEvent } from '@/hooks/useGameEvent';
import { useSettings } from '@/hooks/useSettings';

/** Size of the window (CSS px) and how much the map picture is enlarged in it. */
const SIZE = 156;
const ZOOM = 1.5;

const ROTATE = { up: 0, right: 90, down: 180, left: 270 } as const;

/**
 * A small map in the corner that follows you around the valley: landmarks,
 * villagers, your pets and horse, friends in co-op, the train and your map
 * marker. Click it to open the full map; N hides it.
 */
export function Minimap() {
  const base = useGameEvent('minimap:base');
  const state = useGameEvent('minimap:state');
  const { minimap } = useSettings();
  if (!minimap || !base || !state) return null;

  const w = base.width * ZOOM;
  const h = base.height * ZOOM;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));
  const ox = clamp(state.player.x * ZOOM - SIZE / 2, w - SIZE);
  const oy = clamp(state.player.y * ZOOM - SIZE / 2, h - SIZE);
  const at = (p: { x: number; y: number }) => ({ left: p.x * ZOOM - ox, top: p.y * ZOOM - oy });
  const inView = (p: { x: number; y: number }, m = 6) => {
    const { left, top } = at(p);
    return left > -m && top > -m && left < SIZE + m && top < SIZE + m;
  };
  // Map marker: an arrow on the edge when it's off this little window.
  let pin: { left: number; top: number; edge: boolean } | null = null;
  if (state.waypoint) {
    const p = at(state.waypoint);
    const edge = p.left < 4 || p.top < 4 || p.left > SIZE - 4 || p.top > SIZE - 4;
    pin = { left: Math.max(5, Math.min(SIZE - 5, p.left)), top: Math.max(5, Math.min(SIZE - 5, p.top)), edge };
  }
  const me = at(state.player);

  return (
    <button
      type="button"
      className="hud-panel minimap"
      title={`Open the map (${actionKey('map')}) · ${actionKey('minimap')} hides this`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => gameCommands.emit('ui:open', { panel: 'map' })}
    >
      <div className="minimap-view" style={{ width: SIZE, height: SIZE }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={base.url} alt="" className="minimap-img" style={{ width: w, height: h, transform: `translate(${-ox}px, ${-oy}px)` }} />
        {base.icons.filter((i) => inView(i, 8)).map((i, n) => (
          <span key={`i${n}`} className="minimap-icon" style={at(i)}>
            {i.icon}
          </span>
        ))}
        {state.dots.filter((d) => inView(d)).map((d, n) => (
          <span key={`d${n}`} className={`minimap-dot minimap-${d.kind}`} style={at(d)} />
        ))}
        {pin && <span className={`minimap-pin${pin.edge ? ' minimap-pin-edge' : ''}`} style={{ left: pin.left, top: pin.top }} />}
        <span className="minimap-me" style={{ left: me.left, top: me.top, transform: `translate(-50%, -50%) rotate(${ROTATE[state.facing]}deg)` }} />
        <span className="minimap-north">N</span>
      </div>
    </button>
  );
}
