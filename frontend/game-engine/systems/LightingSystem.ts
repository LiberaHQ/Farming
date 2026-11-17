import * as Phaser from 'phaser';
import type { WeatherKind } from '@farming/shared';
import { DEPTH } from '../constants';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
}

interface Overlay {
  color: number;
  alpha: number;
}

const NIGHT = 0x0b1030;
const DUSK = 0xff9a4a;
const OVERCAST = 0x30384a;
const MARGIN = 48;
const NIGHT_ALPHA = 0.7;
/** The light map is drawn at 1/SCALE resolution and scaled up: cheaper, and suitably pixelated. */
const SCALE = 2;

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

function lerpColor(a: number, b: number, t: number): number {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(
    Math.round(lerp(ca.red, cb.red, t)),
    Math.round(lerp(ca.green, cb.green, t)),
    Math.round(lerp(ca.blue, cb.blue, t)),
  );
}

/** Colour and strength of the sky overlay for a minute of day. */
function skyOverlay(minute: number): Overlay {
  const h = minute / 60;
  if (h < 7) return { color: NIGHT, alpha: lerp(0.35, 0, h - 6) };
  if (h < 17) return { color: NIGHT, alpha: 0 };
  if (h < 19) return { color: DUSK, alpha: lerp(0, 0.2, (h - 17) / 2) };
  if (h < 21) return { color: lerpColor(DUSK, NIGHT, (h - 19) / 2), alpha: lerp(0.2, NIGHT_ALPHA, (h - 19) / 2) };
  return { color: NIGHT, alpha: NIGHT_ALPHA };
}

/**
 * Day/night and weather lighting: a darkness overlay covering the camera view,
 * with soft holes cut for every light source (lamps, windows, the player's
 * lantern) and a faint warm glow around them.
 *
 * Drawn on a 2D canvas in world pixels and uploaded as a texture, so the light
 * falloff is pixelated like the rest of the art and blending is predictable on
 * every renderer.
 */
export class LightingSystem {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private lastSignature = '';

  constructor(
    private readonly scene: Phaser.Scene,
    key = 'lighting-overlay',
  ) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(key, 64, 64);
    if (!texture) throw new Error('Could not create lighting texture');
    this.texture = texture;
    this.image = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.lighting).setVisible(false).setScale(SCALE);
  }

  /** 0 in daylight, 1 at full night: used to decide whether lights switch on. */
  static darkness(minute: number): number {
    return skyOverlay(minute).alpha / NIGHT_ALPHA;
  }

  update(minute: number, weather: WeatherKind, lights: LightSource[]): void {
    const sky = skyOverlay(minute);
    const weatherAlpha = weather === 'rain' || weather === 'snow' ? 0.2 : weather === 'cloudy' ? 0.1 : 0;
    const alpha = Math.min(0.75, sky.alpha + weatherAlpha * (1 - sky.alpha / NIGHT_ALPHA));
    const color = Phaser.Display.Color.IntegerToColor(sky.alpha > 0.25 || weatherAlpha === 0 ? sky.color : OVERCAST);

    if (alpha < 0.01) {
      this.image.setVisible(false);
      this.lastSignature = '';
      return;
    }
    const view = this.scene.cameras.main.worldView;
    const width = Math.ceil((view.width + MARGIN * 2) / SCALE);
    const height = Math.ceil((view.height + MARGIN * 2) / SCALE);
    const ox = Math.floor((view.x - MARGIN) / SCALE) * SCALE;
    const oy = Math.floor((view.y - MARGIN) / SCALE) * SCALE;
    this.image.setPosition(ox, oy).setVisible(true);

    // Skip the redraw when nothing visible has changed (e.g. standing still).
    const lit = sky.alpha > 0.08;
    const signature = `${width}x${height}@${ox},${oy}|${alpha.toFixed(3)}|${color.color}|${lit ? lights.map((l) => `${l.x | 0},${l.y | 0},${l.radius}`).join(';') : ''}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.setSize(width, height);
      this.image.setSizeToFrame(this.image.frame);
    }

    const ctx = this.texture.context;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `rgba(${color.red}, ${color.green}, ${color.blue}, ${alpha})`;
    ctx.fillRect(0, 0, width, height);

    if (lit) {
      ctx.globalCompositeOperation = 'destination-out';
      for (const light of lights) {
        const x = (light.x - ox) / SCALE;
        const y = (light.y - oy) / SCALE;
        const r = light.radius / SCALE;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.45, 'rgba(0,0,0,0.75)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // A faint warm glow so lamps read as lamplight, not just holes.
      ctx.globalCompositeOperation = 'source-over';
      for (const light of lights) {
        const x = (light.x - ox) / SCALE;
        const y = (light.y - oy) / SCALE;
        const r = light.radius / SCALE;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.8);
        g.addColorStop(0, 'rgba(255, 196, 110, 0.18)');
        g.addColorStop(1, 'rgba(255, 196, 110, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    this.texture.refresh();
  }
}
