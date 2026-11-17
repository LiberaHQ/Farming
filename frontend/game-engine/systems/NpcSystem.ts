import type * as Phaser from 'phaser';
import {
  GAME_CONFIG,
  NPC_IDS,
  NPCS,
  Terrain,
  type Direction,
  type NpcDef,
  type NpcId,
  type Season,
  type WeatherKind,
} from '@farming/shared';
import { npcTextureKey, TEXTURES } from '../assets/registerTextures';
import { DEPTH } from '../constants';
import { FEET_ORIGIN_Y, standFrame, walkAnimKey } from '../entities/Player';
import { terrainAt, type WorldData } from '../maps/WorldData';

export interface Npc {
  def: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  facing: Direction;
  /** Villagers: route along the path. Merchants: a single point behind their stall. */
  route: Array<{ x: number; y: number }>;
  leg: number;
  /** Route index where the villager turns around. */
  turn: number;
  pause: number;
  talks: number;
  /** Stall tile for merchants. */
  stall: { tx: number; ty: number } | null;
  /** Countdown to the next idle remark (ms). */
  chatterIn: number;
  /** Merchants glance around now and then. */
  lookIn: number;
  /** Merchants: walk from here (along the path) to the stall at opening, and back at closing. */
  commute: Array<{ x: number; y: number }>;
}

interface Bubble {
  npc: Npc;
  container: Phaser.GameObjects.Container;
  ttl: number;
}

const WALK_SPEED = 28;
const PAUSE_MS = 2500;
const BUBBLE_MS = 3200;
/** Idle remarks only happen when the player is this close (px). */
const CHATTER_RANGE = 120;
const LOOKS: Direction[] = ['down', 'down', 'left', 'right', 'down'];
/** Game minutes a merchant spends walking to or from their stall. */
const COMMUTE_MIN = 40;

/**
 * Townsfolk. Each merchant keeps shop hours behind their own market stall;
 * Tobin strolls the path between the farm and the river. Everyone makes the
 * occasional remark in a speech bubble when the player is nearby.
 */
export class NpcSystem {
  private readonly npcs: Npc[] = [];
  private readonly bubbles: Bubble[] = [];
  private seq = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldData,
    /** Front doors of the villagers' houses: merchants walk from home to their stall and back. */
    private readonly homes: Partial<Record<NpcId, { x: number; y: number }>> = {},
  ) {
    const size = GAME_CONFIG.tileSize;
    for (const id of NPC_IDS) {
      const def = NPCS[id];
      if (def.shop) {
        const spec = world.objects.find((o) => o.kind === 'stall' && o.variant === def.shop!.stallVariant);
        if (!spec) continue;
        const point = { x: spec.tx * size + size, y: spec.ty * size + size - 2 - 9 };
        const npc = this.create(id, [point], 0, { tx: spec.tx, ty: spec.ty });
        npc.commute = this.commuteFor(point, id);
        this.npcs.push(npc);
      } else {
        const { route, turn } = this.pathRoute();
        this.npcs.push(this.create(id, route, turn, null));
      }
    }
  }

  /** Bad weather keeps the walkers at home (merchants still open their stalls). */
  private wet = false;

  setWeather(weather: WeatherKind): void {
    this.wet = weather === 'rain' || weather === 'snow';
  }

  /** Whether someone is out (at their stall, for merchants) right now. */
  isPresent(id: NpcId, minute: number): boolean {
    const { from, to } = NPCS[id].hours;
    if (!NPCS[id].shop && this.wet) return false;
    return minute >= from && minute < to;
  }

  /** Where a merchant is on their way in or out, or null when not commuting. 0 = path end, 1 = at the stall. */
  private commuteProgress(npc: Npc, minute: number): number | null {
    const { from, to } = npc.def.hours;
    if (minute >= from - COMMUTE_MIN && minute < from) return (minute - (from - COMMUTE_MIN)) / COMMUTE_MIN;
    if (minute >= to && minute < to + COMMUTE_MIN) return 1 - (minute - to) / COMMUTE_MIN;
    return null;
  }

  private pointOn(route: Array<{ x: number; y: number }>, t: number): { x: number; y: number } {
    const lengths = route.slice(1).map((p, i) => Math.hypot(p.x - route[i].x, p.y - route[i].y));
    let d = Math.max(0, Math.min(1, t)) * lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < lengths.length; i++) {
      if (d <= lengths[i] || i === lengths.length - 1) {
        const k = lengths[i] ? Math.min(1, d / lengths[i]) : 1;
        return { x: route[i].x + (route[i + 1].x - route[i].x) * k, y: route[i].y + (route[i + 1].y - route[i].y) * k };
      }
      d -= lengths[i];
    }
    return route[route.length - 1];
  }

  /** Out at the stall or walking about ('out'), at home, or asleep at home (late night). */
  whereIs(id: NpcId, minute: number, bedtime: number): 'out' | 'home' | 'asleep' {
    if (minute >= bedtime || minute < 6 * 60) return 'asleep';
    const npc = this.get(id);
    const commuting = npc?.stall ? this.commuteProgress(npc, minute) !== null : false;
    return this.isPresent(id, minute) || commuting ? 'out' : 'home';
  }

  /** Front door → down to the path → along it → up to the stall (or the path end when they have no house). */
  private commuteFor(stall: { x: number; y: number }, id: NpcId): Array<{ x: number; y: number }> {
    const size = GAME_CONFIG.tileSize;
    const { spawn } = this.world;
    const rowAt = (tx: number): number => {
      for (let dy = -4; dy <= 4; dy++) {
        const t = terrainAt(this.world, tx, spawn.ty + dy);
        if (t === Terrain.Path || t === Terrain.Bridge) return spawn.ty + dy;
      }
      return spawn.ty;
    };
    // Alternate merchants come from the west and the east.
    const west = NPC_IDS.indexOf(id) % 2 === 0;
    const endTx = west ? Math.max(2, spawn.tx - 24) : Math.min(this.world.width - 3, spawn.tx + 20);
    const stallTx = Math.floor(stall.x / size);
    const door = this.homes[id];
    if (door) {
      const doorTx = Math.floor(door.x / size);
      return [door, { x: door.x, y: rowAt(doorTx) * size + size + 2 }, { x: stall.x, y: rowAt(stallTx) * size + size + 2 }, stall];
    }
    return [
      { x: endTx * size + 8, y: rowAt(endTx) * size + size + 2 },
      { x: stall.x, y: rowAt(stallTx) * size + size + 2 },
      stall,
    ];
  }

  /** The merchant whose stall has this art variant. */
  merchantForStall(variant: number): NpcDef | undefined {
    return NPC_IDS.map((id) => NPCS[id]).find((d) => d.shop?.stallVariant === variant);
  }

  get(id: NpcId): Npc | undefined {
    return this.npcs.find((n) => n.def.id === id);
  }

  /** Walking villager standing on or next to a tile centre (generous so talking is easy). */
  npcNear(x: number, y: number): Npc | undefined {
    return this.npcs.find((n) => n.sprite.visible && !n.stall && Math.hypot(n.sprite.x - x, n.sprite.y - 6 - y) < 14);
  }

  /** Picks something to say; lines rotate per conversation. Friends get warmer lines. */
  talk(npc: Npc, ctx: { day: number; season: Season; weather: WeatherKind; hearts: number }, facePlayerAt: { x: number; y: number }): string {
    const lines = npc.def.lines;
    const friendly = ctx.hearts >= 4 ? (lines.friend ?? []) : [];
    const pool = [...friendly, ...friendly, ...(lines.weather?.[ctx.weather] ?? []), ...(lines.season?.[ctx.season] ?? []), ...lines.general];
    const text = pool[(ctx.day * 7 + npc.talks) % pool.length];
    npc.talks += 1;
    npc.pause = PAUSE_MS * 2;
    this.face(npc, facePlayerAt);
    return text;
  }

  /** Turns to look at a point (e.g. the player). */
  face(npc: Npc, at: { x: number; y: number }): void {
    const dx = at.x - npc.sprite.x;
    const dy = at.y - npc.sprite.y;
    npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    npc.sprite.anims.stop();
    npc.sprite.setFrame(standFrame(npc.facing));
  }

  /** Shows a speech bubble over someone's head. */
  say(id: NpcId, text: string, ms = BUBBLE_MS): void {
    const npc = this.get(id);
    if (!npc || !npc.sprite.visible) return;
    this.clearBubble(npc);
    const container = this.makeBubble(text);
    this.bubbles.push({ npc, container, ttl: ms });
    this.placeBubble(npc, container);
    npc.chatterIn = 9000 + Math.random() * 9000;
  }

  /** Positions of everyone currently out and about, for the world map. */
  positions(): Array<{ x: number; y: number }> {
    return this.npcs.filter((n) => n.sprite.visible).map((n) => ({ x: n.sprite.x, y: n.sprite.y }));
  }

  update(delta: number, minute: number, player: { x: number; y: number }): void {
    for (const npc of this.npcs) {
      const commute = npc.stall ? this.commuteProgress(npc, minute) : null;
      const present = this.isPresent(npc.def.id, minute) || commute !== null;
      npc.sprite.setVisible(present);
      npc.shadow.setVisible(present);
      if (commute !== null) {
        // Walking to or from the stall: head for where the schedule says they should be.
        const goal = this.pointOn(npc.commute, commute);
        const s = npc.sprite;
        const dx = goal.x - s.x;
        const dy = goal.y - s.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 48) s.setPosition(goal.x, goal.y);
        else if (dist > 0.5) {
          const step = Math.min(dist, (WALK_SPEED * 1.4 * delta) / 1000);
          s.setPosition(s.x + (dx / dist) * step, s.y + (dy / dist) * step);
          npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          s.anims.play(walkAnimKey(npcTextureKey(npc.def.id), npc.facing), true);
        } else if (s.anims.isPlaying) {
          s.anims.stop();
          s.setFrame(standFrame(npc.facing));
        }
        npc.sprite.setDepth(DEPTH.ySortBase + npc.sprite.y);
        npc.shadow.setPosition(npc.sprite.x, npc.sprite.y - 1);
        continue;
      }
      if (present && npc.stall && npc.route.length === 1) {
        // Settle behind the counter once they've arrived.
        const home = npc.route[0];
        if (Math.hypot(npc.sprite.x - home.x, npc.sprite.y - home.y) > 0.5) {
          npc.sprite.setPosition(home.x, home.y);
          npc.sprite.anims.stop();
          npc.facing = 'down';
          npc.sprite.setFrame(standFrame('down'));
        }
      }
      if (!present) {
        this.clearBubble(npc);
        // Come back at the start of the route each morning.
        if (npc.route.length > 1) {
          npc.leg = 1;
          npc.sprite.setPosition(npc.route[0].x, npc.route[0].y);
        }
        continue;
      }
      if (npc.route.length > 1) this.walk(npc, delta);
      else this.idle(npc, delta, player);
      npc.sprite.setDepth(DEPTH.ySortBase + npc.sprite.y);
      npc.shadow.setPosition(npc.sprite.x, npc.sprite.y - 1);

      // Idle remarks when the player is around.
      npc.chatterIn -= delta;
      if (npc.chatterIn <= 0) {
        const near = Math.hypot(player.x - npc.sprite.x, player.y - npc.sprite.y) < CHATTER_RANGE;
        if (near && !this.bubbles.length) {
          const lines = npc.def.chatter;
          this.say(npc.def.id, lines[(this.seq++ + npc.talks) % lines.length]);
        } else npc.chatterIn = 3000 + Math.random() * 6000;
      }
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.ttl -= delta;
      this.placeBubble(b.npc, b.container);
      b.container.setAlpha(Math.min(1, b.ttl / 300));
      if (b.ttl <= 0) {
        b.container.destroy();
        this.bubbles.splice(i, 1);
      }
    }
  }

  /** Merchants mostly face the path, glancing around and towards a nearby player. */
  private idle(npc: Npc, delta: number, player: { x: number; y: number }): void {
    npc.lookIn -= delta;
    if (npc.pause > 0) {
      npc.pause -= delta;
      return;
    }
    if (npc.lookIn > 0) return;
    npc.lookIn = 2500 + Math.random() * 4000;
    const close = Math.hypot(player.x - npc.sprite.x, player.y - npc.sprite.y) < 48;
    if (close) this.face(npc, player);
    else {
      npc.facing = LOOKS[(this.seq++ * 7 + npc.talks) % LOOKS.length];
      npc.sprite.setFrame(standFrame(npc.facing));
    }
  }

  private walk(npc: Npc, delta: number): void {
    if (npc.pause > 0) {
      npc.pause -= delta;
      return;
    }
    const target = npc.route[npc.leg];
    const s = npc.sprite;
    const dx = target.x - s.x;
    const dy = target.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      npc.leg = (npc.leg + 1) % npc.route.length;
      if (npc.leg === 1 || npc.leg === npc.turn + 1) npc.pause = PAUSE_MS;
      s.anims.stop();
      s.setFrame(standFrame(npc.facing));
      return;
    }
    const step = Math.min(dist, (WALK_SPEED * delta) / 1000);
    s.setPosition(s.x + (dx / dist) * step, s.y + (dy / dist) * step);
    npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    s.anims.play(walkAnimKey(npcTextureKey(npc.def.id), npc.facing), true);
  }

  private makeBubble(text: string): Phaser.GameObjects.Container {
    const label = this.scene.add
      .text(0, 0, text, {
        fontFamily: '"Trebuchet MS", Verdana, sans-serif',
        fontSize: '5px',
        color: '#3a2a20',
        align: 'center',
        wordWrap: { width: 70 },
      })
      .setResolution(6)
      .setOrigin(0.5, 1);
    const w = Math.ceil(label.width) + 6;
    const h = Math.ceil(label.height) + 3;
    label.setPosition(0, -4.5);
    const g = this.scene.add.graphics();
    g.fillStyle(0x3a2a20, 0.3).fillRoundedRect(-w / 2 + 1, -h - 2, w, h, 2);
    g.fillStyle(0xfff8e8, 0.97).fillRoundedRect(-w / 2, -h - 3, w, h, 2);
    // Tail.
    g.fillTriangle(-2, -3.5, 2, -3.5, 0, -0.5);
    return this.scene.add.container(0, 0, [g, label]).setDepth(DEPTH.fx - 1);
  }

  private placeBubble(npc: Npc, container: Phaser.GameObjects.Container): void {
    container.setPosition(Math.round(npc.sprite.x), Math.round(npc.sprite.y - 22));
  }

  private clearBubble(npc: Npc): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      if (this.bubbles[i].npc !== npc) continue;
      this.bubbles[i].container.destroy();
      this.bubbles.splice(i, 1);
    }
  }

  private create(id: NpcId, route: Array<{ x: number; y: number }>, turn: number, stall: Npc['stall']): Npc {
    const start = route[0];
    const sprite = this.scene.add.sprite(start.x, start.y, npcTextureKey(id), standFrame('down')).setOrigin(0.5, FEET_ORIGIN_Y);
    const shadow = this.scene.add.image(start.x, start.y - 1, TEXTURES.shadowSmall).setDepth(DEPTH.shadow);
    return {
      def: NPCS[id],
      sprite,
      shadow,
      facing: 'down',
      route,
      leg: route.length > 1 ? 1 : 0,
      turn,
      pause: 0,
      talks: 0,
      stall,
      chatterIn: 4000 + Math.random() * 12000,
      lookIn: Math.random() * 3000,
      commute: [],
    };
  }

  /**
   * A walking route along the dirt path, from left of the market to the
   * bridge and back. Waypoints follow the path's row column by column.
   */
  private pathRoute(): { route: Array<{ x: number; y: number }>; turn: number } {
    const size = GAME_CONFIG.tileSize;
    const { spawn } = this.world;
    const rowAt = (tx: number): number | null => {
      for (let dy = -4; dy <= 4; dy++) {
        const t = terrainAt(this.world, tx, spawn.ty + dy);
        if (t === Terrain.Path || t === Terrain.Bridge) return spawn.ty + dy;
      }
      return null;
    };
    const route: Array<{ x: number; y: number }> = [];
    const from = Math.max(3, spawn.tx - 18);
    const to = Math.min(this.world.width - 4, spawn.tx + 26);
    let lastRow: number | null = null;
    for (let tx = from; tx <= to; tx++) {
      const row = rowAt(tx);
      if (row === null) continue;
      if (row !== lastRow || tx === from || tx === to) {
        route.push({ x: tx * size + 8, y: row * size + size + 2 });
        lastRow = row;
      }
    }
    if (route.length < 2) return { route: [{ x: spawn.tx * size + 8, y: spawn.ty * size + 14 }], turn: 0 };
    // Out and back: append the reverse (minus the turnaround points).
    return { route: [...route, ...route.slice(1, -1).reverse()], turn: route.length - 1 };
  }
}
