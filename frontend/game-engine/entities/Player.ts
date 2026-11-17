import * as Phaser from 'phaser';
import { GAME_CONFIG, type Direction } from '@farming/shared';
import { CHARACTER_FRAME, DIRECTION_ROWS } from '../assets/character';
import { PLAYER_FEET_ORIGIN_Y, PLAYER_FRAME, PLAYER_FEET_ROW } from '../assets/playerCharacter';
import { TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { sfx } from '../audio/sfx';
import type { MoveIntent } from '../systems/InputSystem';

const DIRECTIONS: Direction[] = ['down', 'left', 'right', 'up'];
export const walkAnimKey = (texture: string, d: Direction) => `${texture}-walk-${d}`;
const walkKey = (d: Direction) => walkAnimKey(TEXTURES.player, d);
export const standFrame = (d: Direction) => DIRECTION_ROWS[d] * CHARACTER_FRAME.framesPerDirection;
/** Villagers' sprites (16x24) stand on this point; players use PLAYER_FEET_ORIGIN_Y (their sheet is larger). */
export const FEET_ORIGIN_Y = 22 / CHARACTER_FRAME.height;

/** Registers walk cycles (stand → step A → stand → step B) for a character sheet. */
export function createCharacterAnimations(scene: Phaser.Scene, texture: string): void {
  for (const dir of DIRECTIONS) {
    const key = walkAnimKey(texture, dir);
    if (scene.anims.exists(key)) continue;
    const base = standFrame(dir);
    scene.anims.create({
      key,
      frames: [0, 1, 0, 2].map((f) => ({ key: texture, frame: base + f })),
      frameRate: 8,
      repeat: -1,
    });
  }
}

/**
 * Keeps the current facing while it is still one of the pressed directions,
 * so diagonal movement doesn't flicker between animations.
 */
function resolveFacing(current: Direction, x: number, y: number): Direction {
  const horizontal: Direction | null = x < 0 ? 'left' : x > 0 ? 'right' : null;
  const vertical: Direction | null = y < 0 ? 'up' : y > 0 ? 'down' : null;
  if (current === horizontal || current === vertical) return current;
  return horizontal ?? vertical ?? current;
}

export type ToolStyle = 'swing' | 'pour';

/** Hand offset and start/end angles of the held tool, per facing. */
const TOOL_POSE: Record<Direction, { dx: number; dy: number; flip: boolean; swing: [number, number]; pour: [number, number] }> = {
  down: { dx: 6, dy: -9, flip: true, swing: [-30, 120], pour: [0, 35] },
  right: { dx: 5, dy: -10, flip: true, swing: [-40, 100], pour: [0, 35] },
  left: { dx: -5, dy: -10, flip: false, swing: [40, -100], pour: [0, -35] },
  up: { dx: -5, dy: -14, flip: false, swing: [30, -70], pour: [0, -30] },
};

/** Angle the fishing rod is held at while the line is out. */
const HOLD_ANGLE: Record<Direction, number> = { down: 150, right: 70, left: -70, up: -20 };

const SWING_MS = 220;
const IMPACT_MS = 150;
const BUSY_MS = 320;

export class Player {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly tool: Phaser.GameObjects.Image;
  private facing: Direction = 'down';
  private busyUntil = 0;
  /** Co-op: tells other players when this player swings or pours a tool. */
  onToolUse: ((style: ToolStyle, textureKey: string | null) => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
  ) {
    this.sprite = scene.physics.add.sprite(x, y, TEXTURES.player, standFrame('down'));
    this.sprite.setOrigin(0.5, PLAYER_FEET_ORIGIN_Y);
    // Collide with the feet only (the same 10x6 box as before), so the player can walk "behind" tall objects.
    this.sprite.body.setSize(10, 6).setOffset((PLAYER_FRAME.width - 10) / 2, PLAYER_FEET_ROW + 1 - 6);
    this.sprite.setCollideWorldBounds(true);
    this.shadow = scene.add.image(x, y, TEXTURES.shadowSmall).setDepth(DEPTH.shadow).setScale(1.2, 1.1);
    this.tool = scene.add.image(x, y, TEXTURES.sparkle).setOrigin(0.55, 0.9).setVisible(false);
  }

  get facingDirection(): Direction {
    return this.facing;
  }

  /** Teleports the player (e.g. waking up at home) and faces them. */
  placeAt(x: number, y: number, facing: Direction = 'down'): void {
    this.sprite.body.reset(x, y);
    this.facing = facing;
    this.stop();
    this.lateUpdate();
  }

  isBusy(): boolean {
    return this.scene.time.now < this.busyUntil;
  }

  /**
   * Plays a tool animation and calls `onImpact` at the moment of contact.
   * `textureKey` null = a bare-handed action. Returns false if already busy.
   */
  useTool(textureKey: string | null, style: ToolStyle, onImpact: () => void): boolean {
    if (this.isBusy()) return false;
    this.stop();
    this.onToolUse?.(style, textureKey);
    if (!textureKey) {
      this.busyUntil = this.scene.time.now + 180;
      this.scene.time.delayedCall(80, onImpact);
      return true;
    }
    this.busyUntil = this.scene.time.now + BUSY_MS;
    sfx('whoosh', { volume: style === 'pour' ? 0.4 : 0.8 });
    const pose = TOOL_POSE[this.facing];
    const [from, to] = style === 'swing' ? pose.swing : pose.pour;
    this.tool
      .setTexture(textureKey)
      .setFlipX(style === 'pour' ? !pose.flip : pose.flip)
      .setPosition(this.sprite.x + pose.dx, this.sprite.y + pose.dy)
      .setAngle(from)
      .setVisible(true)
      .setDepth(this.sprite.depth + (this.facing === 'up' ? -0.5 : 0.5));
    this.scene.tweens.killTweensOf(this.tool);
    this.scene.tweens.add({
      targets: this.tool,
      angle: to,
      duration: style === 'swing' ? SWING_MS : 260,
      ease: style === 'swing' ? 'Quad.easeIn' : 'Sine.easeOut',
    });
    this.scene.time.delayedCall(IMPACT_MS, onImpact);
    this.scene.time.delayedCall(BUSY_MS, () => this.tool.setVisible(false));
    return true;
  }

  /**
   * Keeps a tool held out (the fishing rod while waiting for a bite), or puts
   * it away with null. Returns the tip of the tool in world pixels.
   */
  hold(textureKey: string | null): { x: number; y: number } {
    if (!textureKey) {
      this.tool.setVisible(false);
      return { x: this.sprite.x, y: this.sprite.y };
    }
    const pose = TOOL_POSE[this.facing];
    const angle = HOLD_ANGLE[this.facing];
    this.scene.tweens.killTweensOf(this.tool);
    this.tool
      .setTexture(textureKey)
      .setFlipX(pose.flip)
      .setPosition(this.sprite.x + pose.dx, this.sprite.y + pose.dy)
      .setAngle(angle)
      .setVisible(true)
      .setDepth(this.sprite.depth + (this.facing === 'up' ? -0.5 : 0.5));
    const rad = (angle * Math.PI) / 180;
    const reach = 13;
    return { x: this.tool.x + Math.sin(rad) * reach, y: this.tool.y - Math.cos(rad) * reach };
  }

  /** Halts movement and shows the standing frame. */
  stop(): void {
    this.sprite.body.setVelocity(0, 0);
    this.sprite.anims.stop();
    this.sprite.setFrame(standFrame(this.facing));
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }

  get velocityX(): number {
    return this.sprite.body.velocity.x;
  }

  get velocityY(): number {
    return this.sprite.body.velocity.y;
  }

  /** Tile under the player's feet. */
  get tile(): { tx: number; ty: number } {
    const size = GAME_CONFIG.tileSize;
    return { tx: Math.floor(this.sprite.x / size), ty: Math.floor((this.sprite.y - 2) / size) };
  }

  setShadowVisible(v: boolean): void {
    this.shadow.setVisible(v);
  }

  /** Food buffs: 1.25 while Swift. */
  speedBoost = 1;

  update(intent: MoveIntent): void {
    if (this.isBusy()) {
      this.sprite.body.setVelocity(0, 0);
      return;
    }
    const { walkSpeed, runSpeed } = GAME_CONFIG.player;
    const speed = (intent.run ? runSpeed : walkSpeed) * this.speedBoost;
    const length = Math.hypot(intent.x, intent.y);

    if (length === 0) {
      this.stop();
      return;
    }

    this.sprite.body.setVelocity((intent.x / length) * speed, (intent.y / length) * speed);
    this.facing = resolveFacing(this.facing, intent.x, intent.y);
    this.sprite.anims.play(walkKey(this.facing), true);
    this.sprite.anims.timeScale = intent.run ? 1.6 : 1;
  }

  /** Runs after physics has moved the sprite for this frame. */
  lateUpdate(): void {
    this.sprite.setDepth(DEPTH.ySortBase + this.sprite.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 1);
  }
}
