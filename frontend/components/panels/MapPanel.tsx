'use client';

import { gameCommands } from '@/game-engine/events/GameEventBus';
import { useGameEvent } from '@/hooks/useGameEvent';
import { Panel } from './Panel';

const LEGEND: Array<[string, string]> = [
  ['#e0644f', 'You'],
  ['#a3483a', 'Your cottage'],
  ['#d2553f', 'Market stalls'],
  ['#e9d29a', 'Notice board'],
  ['#1a1412', 'Mine'],
  ['#5a6f9e', 'Villagers'],
  ['#6b4628', 'Farmland'],
  ['#f4d24a', 'Crop ready'],
  ['#2d6a33', 'Trees'],
  ['#9aa0a6', 'Rocks'],
  ['#c9783a', 'Copper'],
  ['#3a83b5', 'Water'],
  ['#bf9058', 'Paths'],
];

/** Overview of the whole world, drawn by the game when the map is opened. */
export function MapPanel() {
  const map = useGameEvent('map:image');
  if (!map) return null;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <Panel
      title="World map"
      footer={
        <span className="hud-muted">
          Click anywhere to get directions there.{' '}
          {map.waypoint && (
            <button type="button" className="btn" onClick={() => gameCommands.emit('waypoint:clear', {})}>
              Clear marker
            </button>
          )}{' '}
          Press M or Esc to close.
        </span>
      }
    >
      <div className="map-layout">
        <div
          className="map-frame map-clickable"
          style={{ aspectRatio: `${map.width} / ${map.height}` }}
          title="Click to set a marker and get directions"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const fx = (e.clientX - rect.left) / rect.width;
            const fy = (e.clientY - rect.top) / rect.height;
            if (!map.tiles) return;
            gameCommands.emit('waypoint:set', { tx: Math.floor(fx * map.tiles.width), ty: Math.floor(fy * map.tiles.height) });
          }}
        >
          <img src={map.url} alt="Map of the world" className="map-image" />
          <span className="map-home" style={{ left: pct(map.home.x, map.width), top: pct(map.home.y, map.height) }}>
            Home
          </span>
          {map.places?.map((p) => (
            <span key={p.label} className="map-home map-place" style={{ left: pct(p.x, map.width), top: pct(p.y, map.height), transform: p.x > map.width * 0.85 ? 'translate(-100%, -140%)' : p.x < map.width * 0.15 ? 'translate(0, -140%)' : undefined }}>
              {p.label}
            </span>
          ))}
          {map.route?.length > 1 && (
            <svg className="map-route" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${map.width} ${map.height}`} preserveAspectRatio="none">
              <polyline points={[map.player, ...map.route].map((p) => `${p.x},${p.y}`).join(' ')} />
            </svg>
          )}
          {map.waypoint && (
            <span className="map-pin" style={{ left: pct(map.waypoint.x, map.width), top: pct(map.waypoint.y, map.height) }}>
              📍
            </span>
          )}
          <span className="map-you" style={{ left: pct(map.player.x, map.width), top: pct(map.player.y, map.height) }} />
        </div>
        <ul className="map-legend">
          {LEGEND.map(([color, label]) => (
            <li key={label}>
              <i style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
