'use client';

import type { WeatherKind } from '@farming/shared';
import { useGameEvent } from '@/hooks/useGameEvent';

const WEATHER_LABEL: Record<WeatherKind, string> = {
  sunny: 'Sunny',
  cloudy: 'Cloudy',
  rain: 'Rain',
  snow: 'Snow',
};

const capitalise = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Date, time and weather. */
export function Clock() {
  const time = useGameEvent('world:time');
  if (!time) return null;
  return (
    <div className="hud-panel clock">
      <div className="clock-date">
        {capitalise(time.season)} {time.dayOfSeason}
        <span className="hud-muted"> · Year {time.year}</span>
      </div>
      <div className="clock-row">
        <strong className="clock-time">{time.clock}</strong>
        <span className={`weather weather-${time.weather}`}>
          <i aria-hidden /> {WEATHER_LABEL[time.weather]}
        </span>
      </div>
    </div>
  );
}
