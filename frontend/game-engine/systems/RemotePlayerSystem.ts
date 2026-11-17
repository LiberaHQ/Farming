import * as Phaser from 'phaser';
import { APPEARANCE_PARTS, normalizeAppearance, resolveAppearance, type AppearanceChoice, type Direction, type ItemId, type MemberView, type PositionTuple } from '@farming/shared';
import { addPlayerSheet, itemTextureKey, TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { createCharacterAnimations, standFrame, walkAnimKey } from '../entities/Player';
import { PLAYER_FEET_ORIGIN_Y } from '../assets/playerCharacter';

interface Remote {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  tool: Phaser.GameObjects.Image;
  texture: string;
  look: string;
  target: { x: number; y: number };
  facing: Direction;
  moving: boolean;
  inBed: boolean;
}

/** Hand offset and swing angles of a remote player's tool, per facing (matches the local player). */
const POSE: Record<Direction, { dx: number; dy: number; flip: boolean; swing: [number, number] }> = {
  down: { dx: 5, dy: -8, flip: true, swing: [-30, 120] },
  right: { dx: 5, dy: -9, flip: true, swing: [-40, 100] },
  left: { dx: -5, dy: -9, flip: false, swing: [40, -100] },
  up: { dx: -4, dy: -12, flip: false, swing: [30, -70] },
};

/**
 * The other players in a co-op world: their characters (in their own
 * colours), name tags, smoothed movement and tool swings.
 */
export class RemotePlayerSystem {
  private readonly remotes = new Map<string, Remote>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly selfId: string,
  ) {}

  setMembers(members: MemberView[]): void {
    const seen = new Set<string>();
    for (const m of members) {
      if (m.id === this.selfId) continue;
      seen.add(m.id);
      let r = this.remotes.get(m.id);
      if (!r) {
        r = this.create(m);
        this.remotes.set(m.id, r);
      } else {
        this.repaint(r, m.appearance);
        r.name = m.name;
      }
      r.inBed = m.inBed;
      r.label.setText(`${m.host ? '★ ' : ''}${m.name}${m.inBed ? ' 💤' : ''}`);
    }
    for (const [id, r] of this.remotes) {
      if (seen.has(id)) continue;
      r.sprite.destroy();
      r.shadow.destroy();
      r.label.destroy();
      r.tool.destroy();
      this.remotes.delete(id);
    }
  }

  setPositions(positions: PositionTuple[]): void {
    for (const [id, x, y, facing, moving] of positions) {
      const r = this.remotes.get(id);
      if (!r) continue;
      r.target = { x, y };
      r.facing = facing;
      r.moving = moving === 1;
      // Far jumps (waking up at home) snap instead of sliding across the map.
      if (Math.hypot(r.sprite.x - x, r.sprite.y - y) > 96) r.sprite.setPosition(x, y);
    }
  }

  /** A tool swing or pour by another player. */
  /** Where a remote player stands (for emote bubbles). */
  spriteOf(id: string): Phaser.GameObjects.Sprite | null {
    return this.remotes.get(id)?.sprite ?? null;
  }

  anim(id: string, kind: 'swing' | 'pour', item: ItemId | null): void {
    const r = this.remotes.get(id);
    if (!r) return;
    r.sprite.anims.stop();
    r.sprite.setFrame(standFrame(r.facing));
    if (!item) return;
    const pose = POSE[r.facing];
    const [from, to] = kind === 'swing' ? pose.swing : [0, pose.flip ? 35 : -35];
    r.tool
      .setTexture(itemTextureKey(item))
      .setFlipX(pose.flip)
      .setPosition(r.sprite.x + pose.dx, r.sprite.y + pose.dy)
      .setAngle(from)
      .setVisible(true)
      .setDepth(r.sprite.depth + (r.facing === 'up' ? -0.5 : 0.5));
    this.scene.tweens.killTweensOf(r.tool);
    this.scene.tweens.add({ targets: r.tool, angle: to, duration: kind === 'swing' ? 220 : 260, onComplete: () => r.tool.setVisible(false) });
  }

  /** Names and positions, for the world map. */
  positions(): Array<{ x: number; y: number; name: string }> {
    return [...this.remotes.values()].map((r) => ({ x: r.sprite.x, y: r.sprite.y, name: r.name }));
  }

  update(delta: number): void {
    const k = Math.min(1, (delta / 1000) * 12);
    for (const r of this.remotes.values()) {
      const s = r.sprite;
      const dx = r.target.x - s.x;
      const dy = r.target.y - s.y;
      const far = Math.hypot(dx, dy);
      s.setPosition(s.x + dx * k, s.y + dy * k);
      if (r.moving || far > 1.5) s.anims.play(walkAnimKey(r.texture, r.facing), true);
      else if (s.anims.isPlaying) {
        s.anims.stop();
        s.setFrame(standFrame(r.facing));
      } else s.setFrame(standFrame(r.facing));
      s.setDepth(DEPTH.ySortBase + s.y);
      s.setAlpha(r.inBed ? 0.5 : 1);
      r.shadow.setPosition(s.x, s.y - 1);
      r.label.setPosition(Math.round(s.x), Math.round(s.y - 30));
      if (r.tool.visible) r.tool.setPosition(s.x + POSE[r.facing].dx, s.y + POSE[r.facing].dy);
    }
  }

  private create(m: MemberView): Remote {
    const look = JSON.stringify(m.appearance);
    const texture = this.ensureTexture(m.id, m.appearance);
    const sprite = this.scene.add.sprite(m.x, m.y, texture, standFrame(m.facing)).setOrigin(0.5, PLAYER_FEET_ORIGIN_Y);
    const shadow = this.scene.add.image(m.x, m.y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow);
    const label = this.scene.add
      .text(m.x, m.y - 30, m.name, {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '5px',
        color: '#fff8e8',
        stroke: '#2a1d14',
        strokeThickness: 1.5,
        resolution: 6,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.fx - 2);
    const tool = this.scene.add.image(m.x, m.y, TEXTURES.sparkle).setOrigin(0.55, 0.9).setVisible(false);
    return { id: m.id, name: m.name, sprite, shadow, label, tool, texture, look, target: { x: m.x, y: m.y }, facing: m.facing, moving: false, inBed: m.inBed };
  }

  private repaint(r: Remote, appearance: AppearanceChoice): void {
    const look = JSON.stringify(appearance);
    if (look === r.look) return;
    r.look = look;
    r.texture = this.ensureTexture(r.id, appearance);
    r.sprite.anims.stop();
    r.sprite.setTexture(r.texture, standFrame(r.facing));
  }

  /** One character sheet (and walk animations) per player look. */
  private ensureTexture(id: string, appearance: AppearanceChoice): string {
    const look = normalizeAppearance(appearance);
    const key = `remote-${id}-${APPEARANCE_PARTS.map((p) => look[p]).join('-')}`;
    if (!this.scene.textures.exists(key)) {
      addPlayerSheet(this.scene, key, resolveAppearance(look));
      createCharacterAnimations(this.scene, key);
    }
    return key;
  }
}
