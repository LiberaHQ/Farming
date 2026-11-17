import { seasonOfDay, WEATHER_CHANCES, type WeatherKind } from '../game-config/time';
import { createRng } from './random';

/** Weather for a given day of a world; day 1 is always sunny so the first morning is friendly. */
export function forecastWeather(seed: string, day: number): WeatherKind {
  if (day <= 1) return 'sunny';
  const chances = WEATHER_CHANCES[seasonOfDay(day)];
  const roll = createRng(`${seed}:weather:${day}`).next();
  if (roll < chances.rain) return 'rain';
  if (roll < chances.rain + chances.snow) return 'snow';
  if (roll < chances.rain + chances.snow + chances.cloudy) return 'cloudy';
  return 'sunny';
}
