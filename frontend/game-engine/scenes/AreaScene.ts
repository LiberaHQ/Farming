import * as Phaser from 'phaser';
import { GAME_CONFIG, WILDLIFE, type ItemId, type Season, type WeatherKind, type WildlifeId } from '@farming/shared';
import { sfx } from '../audio/sfx';
import { DEPTH } from '../constants';
import { Player } from '../entities/Player';
import { gameEvents } from '../events/GameEventBus';
import type { PlayerState } from '../state/PlayerState';
import { CameraSystem } from '../systems/CameraSystem';
import { DropSystem } from '../systems/DropSystem';
import { FxSystem } from '../systems/FxSystem';
import { InputSystem } from '../systems/InputSystem';
import { LightingSystem, type LightSource } from '../systems/LightingSystem';
import { WeatherSystem } from '../systems/WeatherSystem';

/** What a side area (beach, cottage) needs from the world scene, which keeps the clock and menus. */
export interface AreaHost {
  state: PlayerState;
  isFrozen(): boolean;
  calendar(): { day: number; minute: number; season: Season; weather: WeatherKind };
  /** Back outside. */
  exit(): void;
  /** Show a line of dialogue. */
  say?(speaker: string, text: string): void;
  /** Open crafting on the Cooking tab (the kitchen stove). */
  openCooking?(): void;
  /** Sit and rest a while (the fireplace). */
  rest?(): void;
  /** A rare creature was seen: log it in the collection (true if it's new). */
  spot?(id: WildlifeId): boolean;
}

export interface AreaAction {
  verb: string;
  key: 'Space' | 'E';
  blocked?: boolean;
  info?: boolean;
  run: () => void;
}

const DIRECTION_OFFSET = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] } as const;

/**
 * Shared plumbing for small areas you walk into: the player, input, camera,
 * the facing-tile cursor and the floating action button, and the fade out.
 * Subclasses build the map and decide what each tile does.
 */
export abstract class AreaScene<D extends { host: AreaHost }> extends Phaser.Scene {
  protected host!: AreaHost;
  protected player!: Player;
  protected controls!: InputSystem;
  protected fx!: FxSystem;
  protected drops!: DropSystem;
  protected walls!: Phaser.Physics.Arcade.StaticGroup;
  protected leaving = false;
  private cursor!: Phaser.GameObjects.Graphics;
  private weather: WeatherSystem | null = null;
  private lighting: LightingSystem | null = null;
  private lampLights: () => LightSource[] = () => [];
  private lastHint = '';
  private lastAnchor = '';

  init(data: D): void {
    this.host = data.host;
    this.leaving = false;
    this.lastHint = '';
    this.lastAnchor = '';
  }

  /** Call from create() once the map exists. */
  protected setupArea(widthTiles: number, heightTiles: number, start: { x: number; y: number; facing?: 'up' | 'down' | 'left' | 'right' }): void {
    const size = GAME_CONFIG.tileSize;
    this.physics.world.setBounds(0, 0, widthTiles * size, heightTiles * size);
    this.fx = new FxSystem(this);
    this.drops = new DropSystem(this);
    this.player = new Player(this, start.x, start.y);
    if (start.facing) this.player.placeAt(start.x, start.y, start.facing);
    this.physics.add.collider(this.player.sprite, this.walls);
    this.controls = new InputSystem(this);
    new CameraSystem(this, this.player.sprite, widthTiles * size, heightTiles * size);
    this.cursor = this.add.graphics().setDepth(DEPTH.cursor);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.lateUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.lateUpdate, this));
  }

  /**
   * Same sky as the farm: falling rain or snow for today's weather, and (if
   * `night` is on) the dusk/night darkness with holes for the given lights
   * plus the player's lantern.
   */
  protected setupAtmosphere(opts: { night: boolean; lights?: () => LightSource[] }): void {
    this.weather = new WeatherSystem(this, '');
    this.weather.set(this.host.calendar().weather);
    this.lighting = opts.night ? new LightingSystem(this, `lighting-${this.scene.key}`) : null;
    this.lampLights = opts.lights ?? (() => []);
  }

  /** Logs a sighting; shows a little "spotted" flourish the first time. */
  protected spot(id: WildlifeId, x: number, y: number): void {
    if (!this.host.spot?.(id)) return;
    const label = this.add
      .text(x, y - 14, `${WILDLIFE[id].emoji} spotted!`, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '7px', fontStyle: 'bold', color: '#fff1a8', stroke: '#2b1d1a', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(8)
      .setDepth(DEPTH.lighting + 5);
    this.tweens.add({ targets: label, y: label.y - 12, alpha: 0, delay: 1400, duration: 900, onComplete: () => label.destroy() });
    sfx('pickup');
  }

  /** One collider zone per horizontal run of solid tiles. */
  protected addSolidRuns(width: number, height: number, solid: (tx: number, ty: number) => boolean): void {
    const size = GAME_CONFIG.tileSize;
    for (let ty = 0; ty < height; ty++) {
      let start = -1;
      for (let tx = 0; tx <= width; tx++) {
        const s = tx < width && solid(tx, ty);
        if (s && start < 0) start = tx;
        if (!s && start >= 0) {
          const w = (tx - start) * size;
          this.walls.add(this.add.zone(start * size + w / 2, ty * size + size / 2, w, size));
          start = -1;
        }
      }
    }
  }

  /** What Space/E does for the tile in front of the player (null = nothing). */
  protected abstract resolve(mode: 'use' | 'interact'): AreaAction | null;

  /** Per-frame extras (fishing, lighting…). */
  protected tick(_delta: number, _frozen: boolean): void {}

  update(_time: number, delta: number): void {
    if (this.leaving) return;
    const frozen = this.host.isFrozen();
    this.player.speedBoost = this.host.state.hasBuff('speed') ? 1.25 : 1;
    const actions = this.controls.getActions();
    if (frozen) this.player.stop();
    else {
      if (actions.use) this.perform(this.resolve('use'));
      else if (actions.interact) this.perform(this.resolve('interact'));
      if (!this.leaving) this.player.update(this.controls.getMoveIntent());
    }
    this.tick(delta, frozen);
    if (this.lighting) {
      const { minute, weather } = this.host.calendar();
      const lights = this.lampLights();
      if (LightingSystem.darkness(minute) > 0.3) lights.push({ x: this.player.x, y: this.player.y - 10, radius: 40 });
      this.lighting.update(minute, weather, lights);
    }
    this.drops.update(delta, this.player.x, this.player.y, this.host.state.inventory);
  }

  /** The player put something down here (from the inventory). */
  dropItem(itemId: ItemId, quantity: number, screen?: { x: number; y: number }, q: 0 | 1 | 2 = 0): boolean {
    if (!this.drops || !this.player || this.leaving) return false;
    this.drops.tossFromPlayer(this.player, itemId, quantity, screen, q);
    return true;
  }

  protected target(): { tx: number; ty: number } {
    const { tx, ty } = this.player.tile;
    const [dx, dy] = DIRECTION_OFFSET[this.player.facingDirection];
    return { tx: tx + dx, ty: ty + dy };
  }

  protected perform(action: AreaAction | null): void {
    if (!action || this.player.isBusy()) return;
    if (action.blocked) sfx('error');
    action.run();
  }

  /** Fade out, then go somewhere else (another side area) instead of back to the farm. */
  protected travel(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    gameEvents.emit('interaction:hint', { action: null, key: null, blocked: false, info: false });
    gameEvents.emit('interaction:anchor', null);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }

  /** Fade out, then hand back to the world. */
  protected leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    gameEvents.emit('interaction:hint', { action: null, key: null, blocked: false, info: false });
    gameEvents.emit('interaction:anchor', null);
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.host.exit());
  }

  private lateUpdate(): void {
    if (!this.player) return;
    this.player.lateUpdate();
    const action = this.host.isFrozen() || this.leaving ? null : this.resolve('use') ?? this.resolve('interact');
    this.drawCursor(action);
    this.emitHint(action);
  }

  private drawCursor(action: AreaAction | null): void {
    const g = this.cursor;
    g.clear();
    if (!action) return;
    const size = GAME_CONFIG.tileSize;
    const { tx, ty } = this.target();
    const pulse = 0.75 + Math.sin(this.time.now / 180) * 0.2;
    g.lineStyle(1, action.blocked ? 0xf08a7a : 0xffffff, pulse);
    g.strokeRect(tx * size + 0.5, ty * size + 0.5, size - 1, size - 1);
  }

  private emitHint(action: AreaAction | null): void {
    const hint = action
      ? { action: action.verb, key: action.blocked || action.info ? null : action.key, blocked: !!action.blocked, info: !!action.info }
      : { action: null, key: null, blocked: false, info: false };
    const sig = `${hint.action}|${hint.key}|${hint.blocked}|${hint.info}`;
    if (sig !== this.lastHint) {
      this.lastHint = sig;
      gameEvents.emit('interaction:hint', hint);
    }
    let anchor: { x: number; y: number } | null = null;
    if (action) {
      const size = GAME_CONFIG.tileSize;
      const { tx, ty } = this.target();
      const cam = this.cameras.main;
      anchor = { x: Math.round((tx * size + size / 2 - cam.worldView.x) * cam.zoom), y: Math.round((ty * size - 10 - cam.worldView.y) * cam.zoom) };
    }
    const key = anchor ? `${anchor.x},${anchor.y}` : 'none';
    if (key !== this.lastAnchor) {
      this.lastAnchor = key;
      gameEvents.emit('interaction:anchor', anchor);
    }
  }
}
