import type * as Phaser from 'phaser';
import { forecastWeather, type WeatherKind } from '@farming/shared';
import { fxTextureKey } from '../assets/registerTextures';
import { DEPTH } from '../constants';

/**
 * Daily weather, rolled deterministically from the world seed and day number,
 * plus the falling rain/snow particles that follow the camera.
 */
export class WeatherSystem {
  current: WeatherKind = 'sunny';
  private readonly rain: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly snow: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly seed: string,
  ) {
    const view = () => scene.cameras.main.worldView;
    const randomX = () => view().x - 40 + Math.random() * (view().width + 80);
    const randomY = () => view().y - 20 + Math.random() * view().height;

    this.rain = scene.add.particles(0, 0, fxTextureKey('rain'), {
      x: { onEmit: randomX },
      y: { onEmit: randomY },
      speedX: -50,
      speedY: { min: 280, max: 340 },
      lifespan: 420,
      quantity: 4,
      frequency: 16,
      scaleY: 2.2,
      scaleX: 0.5,
      alpha: { start: 0.7, end: 0.2 },
      emitting: false,
    });
    this.snow = scene.add.particles(0, 0, fxTextureKey('snow'), {
      x: { onEmit: randomX },
      y: { onEmit: randomY },
      speedX: { min: -14, max: 10 },
      speedY: { min: 18, max: 34 },
      lifespan: 3200,
      quantity: 1,
      frequency: 40,
      scale: { min: 0.4, max: 0.8 },
      alpha: { start: 0.95, end: 0 },
      emitting: false,
    });
    this.rain.setDepth(DEPTH.weather);
    this.snow.setDepth(DEPTH.weather);
  }

  get isWet(): boolean {
    return this.current === 'rain';
  }

  /** Weather for a given day; day 1 is always sunny so the first morning is friendly. */
  forecast(day: number): WeatherKind {
    return forecastWeather(this.seed, day);
  }

  set(weather: WeatherKind): void {
    this.current = weather;
    this.rain.emitting = weather === 'rain';
    this.snow.emitting = weather === 'snow';
  }
}
