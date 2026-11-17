import { randomBytes } from 'node:crypto';
import {
  COOP,
  CROPS,
  GAME_CONFIG,
  ITEMS,
  isCommunityGoalId,
  isItemId,
  joinSave,
  PLACEABLES,
  SAVE_VERSION,
  TIME_CONFIG,
  validateSave,
  type AppearanceChoice,
  type ChatMessage,
  type CoopJoin,
  type CoopPlayerState,
  type Direction,
  type MemberView,
  type OpAck,
  type PositionTuple,
  type SharedWorldState,
  type TradeOffer,
  type TradeView,
  type WorldOp,
  type LobbyView,
  type RoomSettings,
  EMOTES,
} from '@farming/shared';
import { saveMemberState } from '../models/coopModel';
import { storeWorld } from '../services/worldService';
import { CoopWorld } from './CoopWorld';
import type { CoopSocket } from './types';

interface Member {
  id: string;
  name: string;
  host: boolean;
  socket: CoopSocket;
  state: CoopPlayerState | null;
  /** State changed since it was last written to the database. */
  dirty: boolean;
  x: number;
  y: number;
  facing: Direction;
  moving: number;
  /** When the last accepted position arrived (0 = accept the next one as-is). */
  movedAt: number;
  positionChanged: boolean;
  inBed: boolean;
  chatTimes: number[];
  opTimes: number[];
}

interface Trade {
  id: string;
  a: string;
  b: string;
  offers: Record<string, TradeOffer>;
  confirmed: Set<string>;
  phase: 'open' | 'committing';
  acks: Map<string, boolean>;
  timeout: NodeJS.Timeout | null;
}

const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];
const EMPTY_OFFER: TradeOffer = { items: [], gold: 0 };
const PERSIST_MS = 60_000;
const HOST_GRACE_MS = 30_000;
/** Most gold a player can plausibly earn between two state reports. */
const MAX_GOLD_JUMP = 50_000;
const TRADE_REQUEST_MS = 30_000;
const COMMIT_TIMEOUT_MS = 10_000;

const int = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null;

/**
 * One shared world in play: its members, the server-side clock, and every
 * rule about what players may do to the world and to each other.
 */
export class Room {
  readonly world: CoopWorld;
  private readonly members = new Map<string, Member>();
  private readonly trades = new Map<string, Trade>();
  /** target → (requester → expiry) */
  private readonly tradeRequests = new Map<string, Map<string, number>>();
  private readonly timers: NodeJS.Timeout[] = [];
  private hostGone: NodeJS.Timeout | null = null;
  private closed = false;
  private worldDirty = false;
  /** The host's progress, kept while the host is briefly disconnected. */
  private hostState: CoopPlayerState;
  /** Who's hosting right now: the owner, or a guest standing in while the owner is away. */
  private leaderId: string;
  private settings: RoomSettings = { public: false, sharedWallet: false };
  /** The shared purse, while the shared wallet is on. */
  private purse = 0;

  constructor(
    readonly code: string,
    readonly ownerId: string,
    readonly hostName: string,
    shared: SharedWorldState,
    hostState: CoopPlayerState,
    private readonly onClose: (room: Room) => void,
    isPublic = false,
  ) {
    this.world = new CoopWorld(shared);
    this.hostState = hostState;
    this.leaderId = ownerId;
    this.settings.public = isPublic;
    this.timers.push(
      setInterval(() => this.tickClock(), TIME_CONFIG.msPerGameMinute),
      setInterval(() => this.broadcastPositions(), 1000 / COOP.positionRate),
      setInterval(() => void this.persist(), PERSIST_MS),
    );
  }

  get seed(): string {
    return this.world.world.seed;
  }

  /** Listed in the public game browser? */
  get isPublic(): boolean {
    return this.settings.public && !this.closed;
  }

  lobbyView(): LobbyView {
    return { code: this.code, seed: this.seed, hostName: this.leaderName, players: this.members.size, max: COOP.maxPlayers, day: this.world.snapshot().time.day };
  }

  private settingsView(): RoomSettings & { leaderId: string } {
    return { ...this.settings, leaderId: this.leaderId };
  }

  /** The host changes who can find the game, or turns the shared wallet on/off. */
  updateSettings(userId: string, raw: unknown): void {
    if (userId !== this.leaderId || !raw || typeof raw !== 'object') return;
    const p = raw as Partial<RoomSettings>;
    if (typeof p.public === 'boolean') this.settings.public = p.public;
    if (typeof p.sharedWallet === 'boolean' && p.sharedWallet !== this.settings.sharedWallet) {
      if (p.sharedWallet) {
        this.purse = [...this.members.values()].reduce((sum, m) => sum + (m.state?.player.gold ?? 0), 0);
        this.settings.sharedWallet = true;
        this.notice(`Shared wallet on: everyone now spends from one purse of ${this.purse}g.`);
        this.syncPurse();
      } else {
        this.settings.sharedWallet = false;
        const each = Math.floor(this.purse / Math.max(1, this.members.size));
        for (const m of this.members.values()) this.setGold(m, each);
        this.notice(`Shared wallet off: the purse was split, ${each}g each.`);
      }
    }
    m_socketsEmit(this, 'room:settings', this.settingsView());
  }

  private setGold(m: Member, gold: number): void {
    if (m.state) {
      m.state.player.gold = gold;
      m.dirty = true;
    }
    m.socket.emit('wallet:gold', { gold });
  }

  private syncPurse(): void {
    this.purse = Math.max(0, Math.min(10_000_000, Math.round(this.purse)));
    for (const m of this.members.values()) this.setGold(m, this.purse);
  }

  emitAll(event: 'room:settings', payload: RoomSettings & { leaderId: string }): void {
    for (const m of this.members.values()) m.socket.emit(event, payload);
  }

  get leaderName(): string {
    return this.members.get(this.leaderId)?.name ?? this.hostName;
  }

  get size(): number {
    return this.members.size;
  }

  has(userId: string): boolean {
    return this.members.has(userId);
  }

  // ---------- Membership ----------

  /** Adds a player (or the host coming back) and returns what they need to start. */
  join(socket: CoopSocket, user: { id: string; name: string }, me: CoopPlayerState | null): CoopJoin {
    const host = user.id === this.ownerId;
    if (this.hostGone) {
      clearTimeout(this.hostGone);
      this.hostGone = null;
    }
    const state = host ? this.hostState : me;
    if (!host && !this.members.has(this.leaderId)) this.leaderId = user.id;
    if (host && this.leaderId !== user.id) {
      this.leaderId = user.id;
      this.notice(`${user.name} is back and hosting again.`);
    }
    const door = this.doorPosition();
    const member: Member = {
      id: user.id,
      name: user.name,
      host,
      socket,
      state,
      dirty: false,
      x: state?.player.x ?? door.x,
      y: state?.player.y ?? door.y,
      facing: state?.player.facing ?? 'down',
      moving: 0,
      movedAt: 0,
      positionChanged: true,
      inBed: false,
      chatTimes: [],
      opTimes: [],
    };
    this.members.set(user.id, member);
    void socket.join(this.code);
    // Guests get a cabin of their own on the farm while they play.
    if (!host) {
      const cabin = this.world.showCabin(user.id, user.name);
      if (cabin) socket.to(this.code).emit('world:op', { op: { t: 'place', kind: 'cabin', tx: cabin.tx, ty: cabin.ty }, by: user.id });
      this.worldDirty = true;
      const cabins = this.world.cabins.map((c) => ({ ...c }));
      for (const m of this.members.values()) m.socket.emit('world:cabins', { cabins });
    }
    // Shared wallet: a newcomer's gold joins the purse.
    if (this.settings.sharedWallet) {
      this.purse += state?.player.gold ?? 0;
      this.syncPurse();
    }
    this.system(`${user.name} joined.`, user.id);
    this.broadcastMembers();
    this.broadcastSleep();
    return {
      room: { code: this.code, seed: this.seed, hostName: this.leaderName },
      selfId: user.id,
      shared: this.world.snapshot(true),
      me: this.settings.sharedWallet && state ? { ...state, player: { ...state.player, gold: this.purse } } : state,
      members: this.memberViews(),
      settings: this.settingsView(),
    };
  }

  leave(userId: string, socket: CoopSocket): void {
    const member = this.members.get(userId);
    if (!member || member.socket !== socket) return;
    this.members.delete(userId);
    void socket.leave(this.code);
    if (this.settings.sharedWallet && member.state) {
      // The leaver takes their share of the purse with them.
      const share = Math.floor(this.purse / (this.members.size + 1));
      member.state.player.gold = share;
      member.dirty = true;
      this.purse -= share;
      if (member.host) this.hostState = member.state;
      this.syncPurse();
    }
    // Their cabin comes down until they are back.
    if (!member.host) {
      const cabin = this.world.hideCabin(userId);
      if (cabin) {
        this.worldDirty = true;
        for (const m of this.members.values()) m.socket.emit('world:op', { op: { t: 'pickup', tx: cabin.tx, ty: cabin.ty }, by: userId });
      }
    }
    this.endTradesOf(userId, `${member.name} left.`);
    this.tradeRequests.delete(userId);
    void this.persistMember(member);
    this.system(`${member.name} left.`);
    this.broadcastMembers();
    this.broadcastSleep();
    if (member.host) {
      if (member.state) this.hostState = member.state;
      void this.persist(true);
    }
    if (this.members.size === 0) {
      // Give the owner a moment to come back (e.g. a page reload) before ending the session.
      if (member.host) this.hostGone = setTimeout(() => void this.close('The host ended the session.'), HOST_GRACE_MS);
      else void this.close('Everyone left.');
    } else if (userId === this.leaderId) {
      // Host migration: the longest-connected player takes over and the world stays open.
      const next = this.members.values().next().value as Member;
      this.leaderId = next.id;
      this.notice(`${member.name} left. ${next.name} is hosting now — the world stays open${member.host ? ` until ${member.name} returns` : ''}.`);
      this.broadcastMembers();
      m_socketsEmit(this, 'room:settings', this.settingsView());
    }
    this.checkEveryoneInBed();
  }

  async close(reason: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach((t) => clearInterval(t));
    if (this.hostGone) clearTimeout(this.hostGone);
    for (const t of this.trades.values()) if (t.timeout) clearTimeout(t.timeout);
    await this.persist(true);
    for (const m of this.members.values()) {
      m.socket.emit('room:closed', { reason });
      void m.socket.leave(this.code);
    }
    this.members.clear();
    this.onClose(this);
  }

  // ---------- Player updates ----------

  move(userId: string, p: { x: unknown; y: unknown; f: unknown; m: unknown }): void {
    const m = this.members.get(userId);
    if (!m) return;
    const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : NaN;
    const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : NaN;
    const { tileSize } = GAME_CONFIG;
    const maxX = this.world.world.width * tileSize;
    const maxY = this.world.world.height * tileSize;
    if (!(x >= 0 && x <= maxX && y >= 0 && y <= maxY)) return;
    const now = Date.now();
    if (m.movedAt > 0) {
      // Allow running speed plus generous slack for network jitter; anything faster is snapped back.
      const allowed = (GAME_CONFIG.player.runSpeed * (now - m.movedAt)) / 1000 * 1.6 + 24;
      if (Math.hypot(x - m.x, y - m.y) > allowed) {
        m.socket.emit('player:correct', { x: m.x, y: m.y });
        m.movedAt = now;
        return;
      }
    }
    m.x = x;
    m.y = y;
    m.facing = DIRECTIONS.includes(p.f as Direction) ? (p.f as Direction) : m.facing;
    m.moving = p.m ? 1 : 0;
    m.movedAt = now;
    m.positionChanged = true;
    if (m.inBed && m.moving) {
      m.inBed = false;
      this.broadcastSleep();
      this.broadcastMembers();
    }
  }

  anim(userId: string, p: { kind: unknown; item: unknown }): void {
    const m = this.members.get(userId);
    if (!m || (p.kind !== 'swing' && p.kind !== 'pour')) return;
    const item = p.item === null ? null : isItemId(p.item) ? p.item : null;
    m.socket.to(this.code).emit('player:anim', { id: userId, kind: p.kind, item });
  }

  emote(userId: string, p: { emote: unknown }): void {
    const m = this.members.get(userId);
    if (!m || typeof p.emote !== 'string' || !(EMOTES as readonly string[]).includes(p.emote)) return;
    if (!this.rateOk(m.chatTimes, 5, 3000)) return;
    m.socket.to(this.code).emit('player:emote', { id: userId, emote: p.emote });
  }

  /** A player's own progress (backpack, gold…), checked against the game rules before it's kept. */
  reportState(userId: string, raw: unknown): void {
    const m = this.members.get(userId);
    if (!m || !raw || typeof raw !== 'object') return;
    const r = raw as CoopPlayerState;
    const check = validateSave(joinSave(this.world.snapshot(), { player: r.player, social: r.social, quests: r.quests, interior: r.interior, collection: r.collection }, SAVE_VERSION, Date.now()), this.seed);
    if (!check.ok) {
      console.warn(`[coop] rejected state from ${m.name}: ${check.error}`);
      return;
    }
    // A backpack can't conjure a fortune between two reports (they arrive every few seconds).
    if (m.state && check.data.player.gold - m.state.player.gold > MAX_GOLD_JUMP) {
      console.warn(`[coop] rejected state from ${m.name}: gold jumped by ${check.data.player.gold - m.state.player.gold}`);
      m.socket.emit('notice', { text: 'Your progress was out of sync with the server and was not saved.' });
      return;
    }
    const before = m.state?.player.appearance;
    if (this.settings.sharedWallet) {
      const delta = check.data.player.gold - (m.state?.player.gold ?? this.purse);
      if (delta !== 0) {
        this.purse += delta;
        check.data.player.gold = Math.max(0, this.purse);
        const purse = Math.max(0, this.purse);
        for (const other of this.members.values()) if (other !== m) this.setGold(other, purse);
      }
    }
    m.state = { player: check.data.player, social: check.data.social, quests: check.data.quests, interior: check.data.interior, collection: check.data.collection };
    m.dirty = true;
    if (m.host) this.hostState = m.state;
    if (!before || JSON.stringify(before) !== JSON.stringify(m.state.player.appearance)) this.broadcastMembers();
  }

  setInBed(userId: string, inBed: unknown): void {
    const m = this.members.get(userId);
    if (!m) return;
    m.inBed = inBed === true;
    this.broadcastSleep();
    this.broadcastMembers();
    this.checkEveryoneInBed();
  }

  // ---------- The shared world ----------

  op(userId: string, raw: unknown, ack: (r: OpAck) => void): void {
    const m = this.members.get(userId);
    if (!m) return ack({ ok: false, reason: 'Not in this world.' });
    if (!this.rateOk(m.opTimes, 40, 1000)) return ack({ ok: false, reason: 'Slow down!' });
    const op = parseOp(raw);
    if (!op) return ack({ ok: false, reason: 'Invalid action.' });
    // Items going from the backpack into the world must be in the server's copy of the backpack.
    if (op.t === 'donate' || op.t === 'chestPut') {
      const have = m.state?.player.inventory.slots.reduce((sum, s) => (s?.itemId === op.itemId ? sum + s.quantity : sum), 0) ?? 0;
      if (have <= 0) return ack({ ok: false, reason: "You don't have any of those." });
      op.quantity = Math.min(op.quantity, have);
    }
    const result = this.world.apply(op);
    ack(result);
    if (!result.ok) return;
    this.worldDirty = true;
    // Keep the server's copy of the backpack in step right away, so a quick second donation can't spend the same items.
    if (m.state) {
      if (op.t === 'donate') takeFromBackpack(m.state, op.itemId, op.quantity);
      if (op.t === 'chestPut') takeFromBackpack(m.state, op.itemId, result.accepted ?? op.quantity);
      if (result.grant) addToBackpack(m.state, result.grant.itemId, result.grant.quantity);
      m.dirty = true;
    }
    if (op.t === 'chestPut' || op.t === 'chestTake') {
      const items = this.world.chestItems(op.tx, op.ty);
      if (items) m.socket.nsp.to(this.code).emit('world:chest', { tx: op.tx, ty: op.ty, items });
      return;
    }
    m.socket.to(this.code).emit('world:op', { op, by: userId });
  }

  // ---------- Chat ----------

  chat(userId: string, raw: unknown): void {
    const m = this.members.get(userId);
    if (!m || typeof raw !== 'string') return;
    // eslint-disable-next-line no-control-regex
    const text = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, COOP.chatMaxLength);
    if (!text) return;
    if (!this.rateOk(m.chatTimes, 5, 5000)) {
      m.socket.emit('notice', { text: "You're sending messages too quickly." });
      return;
    }
    this.emitChat({ from: userId, name: m.name, text, at: Date.now() });
  }

  // ---------- Trading ----------

  requestTrade(fromId: string, toId: unknown): void {
    const from = this.members.get(fromId);
    const to = typeof toId === 'string' ? this.members.get(toId) : undefined;
    if (!from) return;
    if (!to || to.id === fromId) return void from.socket.emit('notice', { text: 'That player is not here.' });
    if (this.tradeOf(fromId) || this.tradeOf(to.id)) return void from.socket.emit('notice', { text: `${to.name} is busy trading.` });
    let incoming = this.tradeRequests.get(to.id);
    if (!incoming) this.tradeRequests.set(to.id, (incoming = new Map()));
    incoming.set(fromId, Date.now() + TRADE_REQUEST_MS);
    to.socket.emit('trade:incoming', { from: fromId, name: from.name });
    from.socket.emit('notice', { text: `Asked ${to.name} to trade…` });
  }

  respondTrade(toId: string, fromId: unknown, accept: unknown): void {
    const to = this.members.get(toId);
    const from = typeof fromId === 'string' ? this.members.get(fromId) : undefined;
    const expiry = typeof fromId === 'string' ? this.tradeRequests.get(toId)?.get(fromId) : undefined;
    if (!to) return;
    if (typeof fromId === 'string') this.tradeRequests.get(toId)?.delete(fromId);
    if (!from || !expiry || expiry < Date.now()) return void to.socket.emit('notice', { text: 'That trade request expired.' });
    if (accept !== true) return void from.socket.emit('notice', { text: `${to.name} declined to trade.` });
    if (this.tradeOf(fromId as string) || this.tradeOf(toId)) return void to.socket.emit('notice', { text: 'One of you is already trading.' });
    const trade: Trade = {
      id: randomBytes(6).toString('hex'),
      a: from.id,
      b: to.id,
      offers: { [from.id]: { ...EMPTY_OFFER }, [to.id]: { ...EMPTY_OFFER } },
      confirmed: new Set(),
      phase: 'open',
      acks: new Map(),
      timeout: null,
    };
    this.trades.set(trade.id, trade);
    this.sendTrade(trade);
  }

  offer(userId: string, raw: unknown): void {
    const trade = this.tradeOf(userId);
    const m = this.members.get(userId);
    if (!trade || !m || trade.phase !== 'open') return;
    const offer = this.parseOffer(raw, m);
    if (typeof offer === 'string') return void m.socket.emit('notice', { text: offer });
    trade.offers[userId] = offer;
    trade.confirmed.clear();
    this.sendTrade(trade);
  }

  confirm(userId: string): void {
    const trade = this.tradeOf(userId);
    if (!trade || trade.phase !== 'open') return;
    trade.confirmed.add(userId);
    if (trade.confirmed.size < 2) return this.sendTrade(trade);
    // Both agreed: each side hands over its offer, then the server swaps them.
    trade.phase = 'committing';
    this.sendTrade(trade);
    for (const id of [trade.a, trade.b]) this.members.get(id)?.socket.emit('trade:commit', { id: trade.id, give: trade.offers[id] });
    trade.timeout = setTimeout(() => this.failCommit(trade, 'The trade timed out.'), COMMIT_TIMEOUT_MS);
  }

  ackTrade(userId: string, p: { id: unknown; ok: unknown }): void {
    const trade = typeof p.id === 'string' ? this.trades.get(p.id) : undefined;
    if (!trade || trade.phase !== 'committing' || (userId !== trade.a && userId !== trade.b) || trade.acks.has(userId)) return;
    trade.acks.set(userId, p.ok === true);
    if (p.ok !== true) return this.failCommit(trade, "The trade couldn't be completed (items changed).");
    if (trade.acks.size < 2) return;
    if (trade.timeout) clearTimeout(trade.timeout);
    const a = this.members.get(trade.a);
    const b = this.members.get(trade.b);
    a?.socket.emit('trade:deliver', { id: trade.id, receive: trade.offers[trade.b] });
    b?.socket.emit('trade:deliver', { id: trade.id, receive: trade.offers[trade.a] });
    this.closeTrade(trade);
    if (a && b) this.system(`${a.name} and ${b.name} traded.`);
  }

  cancelTrade(userId: string): void {
    const trade = this.tradeOf(userId);
    if (!trade || trade.phase !== 'open') return;
    const name = this.members.get(userId)?.name ?? 'Someone';
    this.closeTrade(trade, `${name} cancelled the trade.`);
  }

  // ---------- Internals ----------

  private tickClock(): void {
    if (this.closed || this.members.size === 0) return;
    this.world.minute += 1;
    if (this.world.minute % 10 === 0) {
      this.world.rainTick();
      this.emitTime();
    }
    if (this.world.minute >= TIME_CONFIG.dayEndMinute) this.startNewDay();
  }

  private checkEveryoneInBed(): void {
    if (this.closed || this.members.size === 0) return;
    if ([...this.members.values()].every((m) => m.inBed)) this.startNewDay();
  }

  private startNewDay(): void {
    const passedOut = [...this.members.values()].filter((m) => !m.inBed).map((m) => m.id);
    for (const t of [...this.trades.values()]) {
      if (t.phase === 'open') this.closeTrade(t, 'The day ended.');
    }
    this.world.newDay();
    this.worldDirty = true;
    const door = this.doorPosition();
    for (const m of this.members.values()) {
      m.inBed = false;
      m.movedAt = 0; // everyone wakes up at the cottage
      m.x = door.x;
      m.y = door.y;
    }
    this.socketsEmitNewDay(passedOut);
    this.broadcastSleep();
    void this.persist();
  }

  private socketsEmitNewDay(passedOut: string[]): void {
    const shared = this.world.snapshot(true);
    for (const m of this.members.values()) m.socket.emit('world:newday', { shared, passedOut });
  }

  private emitTime(): void {
    const { day, minute, weather } = this.world;
    for (const m of this.members.values()) m.socket.emit('world:time', { day, minute, weather });
  }

  private broadcastPositions(): void {
    const changed: PositionTuple[] = [];
    for (const m of this.members.values()) {
      if (!m.positionChanged) continue;
      m.positionChanged = false;
      changed.push([m.id, Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10, m.facing, m.moving]);
    }
    if (!changed.length) return;
    for (const m of this.members.values()) m.socket.emit('room:positions', changed);
  }

  private memberViews(): MemberView[] {
    return [...this.members.values()].map((m) => ({
      id: m.id,
      name: m.name,
      host: m.id === this.leaderId,
      appearance: (m.state?.player.appearance ?? { skin: 0, hair: 0, shirt: 0, pants: 0 }) as AppearanceChoice,
      x: m.x,
      y: m.y,
      facing: m.facing,
      inBed: m.inBed,
    }));
  }

  private broadcastMembers(): void {
    const views = this.memberViews();
    for (const m of this.members.values()) m.socket.emit('room:members', views);
  }

  private broadcastSleep(): void {
    const inBed = [...this.members.values()].filter((m) => m.inBed).length;
    for (const m of this.members.values()) m.socket.emit('sleep:status', { inBed, total: this.members.size });
  }

  private emitChat(message: ChatMessage, except?: string): void {
    for (const m of this.members.values()) if (m.id !== except) m.socket.emit('chat:message', message);
  }

  private system(text: string, except?: string): void {
    this.emitChat({ from: null, name: '', text, at: Date.now(), system: true }, except);
  }

  private notice(text: string): void {
    for (const m of this.members.values()) m.socket.emit('notice', { text });
  }

  private rateOk(times: number[], limit: number, windowMs: number): boolean {
    const now = Date.now();
    while (times.length && times[0] <= now - windowMs) times.shift();
    if (times.length >= limit) return false;
    times.push(now);
    return true;
  }

  private doorPosition(): { x: number; y: number } {
    const size = GAME_CONFIG.tileSize;
    const { home } = this.world.world;
    return { x: (home.tx + 1) * size + size / 2, y: (home.ty + 1) * size + 12 };
  }

  private tradeOf(userId: string): Trade | undefined {
    for (const t of this.trades.values()) if (t.a === userId || t.b === userId) return t;
    return undefined;
  }

  private sendTrade(trade: Trade): void {
    for (const [self, other] of [[trade.a, trade.b], [trade.b, trade.a]] as const) {
      const me = this.members.get(self);
      const them = this.members.get(other);
      if (!me || !them) continue;
      const view: TradeView = {
        id: trade.id,
        partner: { id: them.id, name: them.name },
        mine: trade.offers[self],
        theirs: trade.offers[other],
        myConfirmed: trade.confirmed.has(self),
        theirConfirmed: trade.confirmed.has(other),
        phase: trade.phase,
      };
      me.socket.emit('trade:state', view);
    }
  }

  private closeTrade(trade: Trade, reason?: string): void {
    if (trade.timeout) clearTimeout(trade.timeout);
    this.trades.delete(trade.id);
    for (const id of [trade.a, trade.b]) {
      const m = this.members.get(id);
      m?.socket.emit('trade:state', null);
      if (reason) m?.socket.emit('notice', { text: reason });
    }
  }

  /** Commit failed: give back whatever was already handed over. */
  private failCommit(trade: Trade, reason: string): void {
    if (!this.trades.has(trade.id)) return;
    for (const [id, ok] of trade.acks) {
      if (ok) this.members.get(id)?.socket.emit('trade:refund', { id: trade.id, refund: trade.offers[id] });
    }
    this.closeTrade(trade, reason);
  }

  private endTradesOf(userId: string, reason: string): void {
    const trade = this.tradeOf(userId);
    if (!trade) return;
    if (trade.phase === 'committing') this.failCommit(trade, reason);
    else this.closeTrade(trade, reason);
  }

  /** Checks an offer against what the player last reported having. */
  private parseOffer(raw: unknown, m: Member): TradeOffer | string {
    if (!m.state) return 'Your backpack has not synced yet; try again in a moment.';
    const r = (raw ?? {}) as { items?: unknown; gold?: unknown };
    const gold = int(r.gold ?? 0, 0, 1_000_000);
    if (gold === null || gold > m.state.player.gold) return "You don't have that much gold.";
    if (!Array.isArray(r.items) || r.items.length > COOP.tradeMaxStacks) return `Offer up to ${COOP.tradeMaxStacks} kinds of item.`;
    const totals = new Map<string, number>();
    for (const it of r.items as Array<{ itemId?: unknown; quantity?: unknown }>) {
      const q = int(it?.quantity, 1, 999);
      if (!isItemId(it?.itemId) || q === null) return 'Invalid item in offer.';
      totals.set(it.itemId, (totals.get(it.itemId) ?? 0) + q);
    }
    for (const [itemId, q] of totals) {
      const have = m.state.player.inventory.slots.reduce((sum, s) => (s?.itemId === itemId ? sum + s.quantity : sum), 0);
      if (have < q) return `You only have ${have}× ${ITEMS[itemId as keyof typeof ITEMS].name}.`;
    }
    return { items: [...totals].map(([itemId, quantity]) => ({ itemId: itemId as keyof typeof ITEMS, quantity })), gold };
  }

  /** Writes the shared world (into the host's save) and every member's own progress. */
  private async persist(force = false): Promise<void> {
    try {
      if (this.worldDirty || force || [...this.members.values()].some((m) => m.host && m.dirty)) {
        this.worldDirty = false;
        const save = joinSave(this.world.snapshot(), this.hostState, SAVE_VERSION, Date.now());
        await storeWorld(this.ownerId, this.seed, save);
      }
      for (const m of this.members.values()) if (!m.host) await this.persistMember(m);
    } catch (err) {
      console.error(`[coop] saving room ${this.code} failed:`, (err as Error).message);
    }
  }

  private async persistMember(m: Member): Promise<void> {
    if (m.host || !m.dirty || !m.state) return;
    m.dirty = false;
    try {
      await saveMemberState(this.ownerId, this.seed, m.id, m.state);
    } catch (err) {
      m.dirty = true;
      console.error(`[coop] saving ${m.name} failed:`, (err as Error).message);
    }
  }
}

/** Sends an event to everyone in a room. */
function m_socketsEmit(room: Room, event: 'room:settings', payload: RoomSettings & { leaderId: string }): void {
  room.emitAll(event, payload);
}

/** Removes items from a player's last-known backpack (server-side copy). */
function takeFromBackpack(state: CoopPlayerState, itemId: string, quantity: number): void {
  let left = quantity;
  const slots = state.player.inventory.slots;
  for (let i = 0; i < slots.length && left > 0; i++) {
    const s = slots[i];
    if (s?.itemId !== itemId) continue;
    const take = Math.min(left, s.quantity);
    left -= take;
    slots[i] = s.quantity - take > 0 ? { ...s, quantity: s.quantity - take } : null;
  }
}

/** Adds items to a player's last-known backpack (server-side copy); whatever doesn't fit is dropped from the copy. */
function addToBackpack(state: CoopPlayerState, itemId: string, quantity: number): void {
  if (!isItemId(itemId)) return;
  const max = ITEMS[itemId].maxStack;
  const slots = state.player.inventory.slots;
  let left = quantity;
  for (let i = 0; i < slots.length && left > 0; i++) {
    const s = slots[i];
    if (s?.itemId !== itemId || s.quantity >= max) continue;
    const put = Math.min(left, max - s.quantity);
    slots[i] = { ...s, quantity: s.quantity + put };
    left -= put;
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (slots[i]) continue;
    const put = Math.min(left, max);
    slots[i] = { itemId, quantity: put };
    left -= put;
  }
}

/** Turns untrusted input into a well-formed world change, or null. */
export function parseOp(raw: unknown): WorldOp | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const tile = () => {
    const tx = int(o.tx, 0, 10_000);
    const ty = int(o.ty, 0, 10_000);
    return tx === null || ty === null ? null : { tx, ty };
  };
  switch (o.t) {
    case 'till':
    case 'untill':
    case 'water':
    case 'fertilize':
    case 'harvest':
    case 'node':
    case 'berries':
    case 'pickup': {
      const t = tile();
      return t ? ({ t: o.t, ...t } as WorldOp) : null;
    }
    case 'plant': {
      const t = tile();
      return t && typeof o.crop === 'string' && o.crop in CROPS ? { t: 'plant', ...t, crop: o.crop as keyof typeof CROPS } : null;
    }
    case 'place': {
      const t = tile();
      return t && typeof o.kind === 'string' && o.kind in PLACEABLES ? { t: 'place', ...t, kind: o.kind as keyof typeof PLACEABLES } : null;
    }
    case 'chestPut': {
      const t = tile();
      const quantity = int(o.quantity, 1, 999);
      return t && isItemId(o.itemId) && quantity !== null ? { t: 'chestPut', ...t, itemId: o.itemId, quantity } : null;
    }
    case 'chestTake': {
      const t = tile();
      const slot = int(o.slot, 0, 99);
      const max = int(o.max, 0, 999);
      return t && slot !== null && max !== null ? { t: 'chestTake', ...t, slot, max } : null;
    }
    case 'chicken': {
      const x = typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : null;
      const y = typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : null;
      const kind = o.kind === 'duck' || o.kind === 'rabbit' ? o.kind : undefined;
      return x !== null && y !== null ? { t: 'chicken', x, y, ...(kind ? { kind } : {}) } : null;
    }
    case 'machineLoad': {
      const t = tile();
      return t && isItemId(o.itemId) ? { t: 'machineLoad', ...t, itemId: o.itemId } : null;
    }
    case 'machineCollect': {
      const t = tile();
      return t ? { t: 'machineCollect', ...t } : null;
    }
    case 'livestock': {
      const barnTx = int(o.barnTx, 0, 10_000);
      const barnTy = int(o.barnTy, 0, 10_000);
      return (o.kind === 'cow' || o.kind === 'sheep') && barnTx !== null && barnTy !== null ? { t: 'livestock', kind: o.kind, barnTx, barnTy } : null;
    }
    case 'animalPet':
    case 'animalCollect': {
      const id = int(o.id, 0, 1e9);
      return id !== null ? { t: o.t, id } : null;
    }
    case 'barnFeed': {
      const t = tile();
      const quantity = int(o.quantity, 1, 999);
      return t && quantity !== null ? { t: 'barnFeed', ...t, quantity } : null;
    }
    case 'donate': {
      const quantity = int(o.quantity, 1, 999);
      return isCommunityGoalId(o.goal) && isItemId(o.itemId) && quantity !== null ? { t: 'donate', goal: o.goal, itemId: o.itemId, quantity } : null;
    }
    case 'drop': {
      const id = int(o.id, 0, Number.MAX_SAFE_INTEGER);
      return id !== null ? { t: 'drop', id } : null;
    }
    default:
      return null;
  }
}
