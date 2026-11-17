import {
  BARN,
  BERRY_REGROW_DAYS,
  livestockMorning,
  livestockName,
  mailboxTile,
  shippingBinTile,
  type LivestockSave,
  CROPS,
  gameTime,
  isMachineKind,
  MACHINES,
  underGlass,
  forecastWeather,
  generateWorld,
  GAME_CONFIG,
  ITEMS,
  PLACEABLES,
  RESOURCES,
  seasonOfDay,
  Terrain,
  terrainAt,
  TIME_CONFIG,
  type ChickenSave,
  type ItemAmount,
  type NodeSave,
  type OpAck,
  type PlacedSave,
  type PlotSave,
  type Season,
  type SharedWorldState,
  type SlotData,
  type WeatherKind,
  type WorldData,
  type WorldDrop,
  type WorldObjectSpec,
  type WorldOp,
  applyDonation,
  communityDone,
  communityRoom,
  type CommunityProgress,
  rollMachineOutput,
  coopProduce,
  isStorage,
  SILO_CAPACITY,
  siloRefill,
  sprinklerTiles,
  STORAGE_SIZE,
  type CabinSave,
} from '@farming/shared';

const MAX_CHICKENS = 30;
const MAX_DROPS = 80;

const sameSpec = (a: WorldObjectSpec | null, b: WorldObjectSpec) =>
  !!a && a.kind === b.kind && a.tx === b.tx && a.ty === b.ty && a.variant === b.variant;

/** Width in tiles of a world object (market stalls are two tiles wide). */
const objectWidth = (spec: WorldObjectSpec) => (spec.kind === 'stall' || spec.kind === 'mine' ? 2 : 1);

const fail = (reason: string): OpAck => ({ ok: false, reason });
const OK: OpAck = { ok: true };

/**
 * The authoritative copy of a shared world on the server. Pure state and
 * rules (the same item, crop and resource definitions the game uses): it
 * checks each requested change against what is really there, applies it,
 * and runs the morning update for everyone.
 */
export class CoopWorld {
  readonly world: WorldData;
  day: number;
  minute: number;
  weather: WeatherKind;
  private readonly plots = new Map<number, PlotSave>();
  private readonly nodes = new Map<number, NodeSave>();
  private pending: Array<{ spec: WorldObjectSpec; dueDay: number }>;
  private readonly placed = new Map<number, PlacedSave>();
  private chickens: ChickenSave[];
  private drops: WorldDrop[];
  private livestock: LivestockSave[];
  private community: CommunityProgress;
  readonly cabins: CabinSave[];
  private nextDropId: number;

  constructor(state: SharedWorldState) {
    const { widthTiles, heightTiles } = GAME_CONFIG.world;
    this.world = generateWorld(state.seed, widthTiles, heightTiles);
    this.day = state.time.day;
    this.minute = state.time.minute;
    this.weather = state.weather;
    for (const p of state.farm) this.plots.set(this.key(p.tx, p.ty), structuredClone(p));
    for (const n of state.resources.nodes) this.addNode(structuredClone(n));
    this.pending = structuredClone(state.resources.pending);
    // Cabins appear only while their owner is here (older saves kept them placed).
    for (const p of state.placed) if (p.kind !== 'cabin') this.addPlaced(structuredClone(p));
    this.chickens = structuredClone(state.chickens);
    this.drops = structuredClone(state.drops);
    this.livestock = structuredClone(state.livestock ?? []);
    this.community = structuredClone(state.community ?? {});
    this.cabins = structuredClone(state.cabins ?? []);
    this.nextDropId = this.drops.reduce((m, d) => Math.max(m, d.id), 0) + 1;
    // Every world has its market and the host's cottage (the cottage isn't part of saves).
    if (!this.placedAt(this.world.home.tx, this.world.home.ty)) this.addPlaced({ kind: 'cottage', tx: this.world.home.tx, ty: this.world.home.ty });
    const box = mailboxTile(this.world);
    if (!this.placedAt(box.tx, box.ty)) this.addPlaced({ kind: 'mailbox', tx: box.tx, ty: box.ty });
    const bin = shippingBinTile(this.world);
    if (!this.placedAt(bin.tx, bin.ty)) {
      const blocker = this.nodeAt(bin.tx, bin.ty);
      if (blocker) this.removeNode(blocker);
      if (!this.plots.get(this.key(bin.tx, bin.ty))?.crop) this.plots.delete(this.key(bin.tx, bin.ty));
      if (!this.plots.has(this.key(bin.tx, bin.ty))) this.addPlaced({ kind: 'shipping_bin', tx: bin.tx, ty: bin.ty });
    }
    // Fixtures that moved (the market used to sit right next to the cottage): drop old stalls/boards.
    const fixed = new Set(this.world.objects.filter((o) => o.kind === 'stall' || o.kind === 'board' || o.kind === 'mine').map((o) => `${o.kind}:${o.tx},${o.ty}`));
    for (const node of [...this.nodes.values()]) {
      const { kind, tx, ty } = node.spec;
      if ((kind === 'stall' || kind === 'board' || kind === 'mine') && !fixed.has(`${kind}:${tx},${ty}`)) this.removeNode(node);
    }
    for (const spec of this.world.objects) {
      if (spec.kind !== 'stall' && spec.kind !== 'board' && spec.kind !== 'mine') continue;
      const here = this.nodeAt(spec.tx, spec.ty);
      if (here && here.spec.kind === spec.kind) continue;
      // Clear whatever grew where the fixture stands.
      for (let i = 0; i < objectWidth(spec); i++) {
        const blocker = this.nodeAt(spec.tx + i, spec.ty);
        if (blocker) this.removeNode(blocker);
      }
      this.addNode({ spec, hasBerries: false, berryDueDay: null, regrowsInto: null });
    }
  }

  get season(): Season {
    return seasonOfDay(this.day);
  }

  get raining(): boolean {
    return this.weather === 'rain';
  }

  // ---------- Requests ----------

  apply(op: WorldOp): OpAck {
    switch (op.t) {
      case 'till': {
        if (!this.tileFree(op.tx, op.ty)) return fail("You can't dig there.");
        this.plots.set(this.key(op.tx, op.ty), { tx: op.tx, ty: op.ty, watered: this.raining, crop: null });
        return OK;
      }
      case 'untill': {
        const plot = this.plotAt(op.tx, op.ty);
        if (!plot || plot.crop) return fail('Something is growing there.');
        this.plots.delete(this.key(op.tx, op.ty));
        return OK;
      }
      case 'plant': {
        const plot = this.plotAt(op.tx, op.ty);
        const crop = CROPS[op.crop];
        if (!crop) return fail('Unknown seed.');
        if (!plot || plot.crop) return fail('Someone already planted there.');
        if (!crop.seasons.includes(this.season) && !underGlass(this.allPlaced(), op.tx, op.ty)) return fail(`${crop.name}s don't grow in ${this.season}.`);
        plot.crop = { id: op.crop, stage: 0 };
        return OK;
      }
      case 'water': {
        const plot = this.plotAt(op.tx, op.ty);
        if (!plot) return fail('There is no soil there.');
        if (plot.watered) return fail('Already watered.');
        plot.watered = true;
        return OK;
      }
      case 'fertilize': {
        const plot = this.plotAt(op.tx, op.ty);
        if (!plot?.crop || plot.crop.stage >= CROPS[plot.crop.id].matureStage) return fail('Nothing to fertilize.');
        plot.crop.stage += 1;
        return OK;
      }
      case 'harvest': {
        const plot = this.plotAt(op.tx, op.ty);
        if (!plot?.crop || plot.crop.stage < CROPS[plot.crop.id].matureStage) return fail('Someone beat you to it!');
        const regrow = CROPS[plot.crop.id].regrowStage;
        if (regrow !== undefined) plot.crop.stage = regrow;
        else plot.crop = null;
        return OK;
      }
      case 'node':
        return this.destroyNode(op.tx, op.ty);
      case 'berries': {
        const node = this.nodeAt(op.tx, op.ty);
        if (!node || node.spec.kind !== 'bush' || !node.hasBerries) return fail('No berries left.');
        node.hasBerries = false;
        node.berryDueDay = this.day + BERRY_REGROW_DAYS;
        return OK;
      }
      case 'place': {
        const def = PLACEABLES[op.kind];
        if (!def || op.kind === 'cottage') return fail("You can't build that.");
        for (let i = 0; i < def.width; i++) if (!this.tileFree(op.tx + i, op.ty, def.onWater)) return fail("Can't place here.");
        this.addPlaced({ kind: op.kind, tx: op.tx, ty: op.ty, ...(isStorage(op.kind) ? { items: Array(STORAGE_SIZE[op.kind]!).fill(null) } : {}) });
        return OK;
      }
      case 'pickup': {
        const placed = this.placedAt(op.tx, op.ty);
        if (!placed || !PLACEABLES[placed.kind].item) return fail('Nothing to pick up.');
        if (placed.items?.some((s) => s)) return fail('Empty the chest first.');
        if (placed.machine) return fail('Collect what is inside first.');
        if (placed.kind === 'barn') {
          const d = this.barnDoor(placed);
          if ((placed.hay ?? 0) > 0 || this.livestock.some((a) => a.homeX === d.x && a.homeY === d.y)) return fail('The barn is in use.');
        }
        this.removePlaced(placed);
        const item = PLACEABLES[placed.kind].item;
        return item ? { ok: true, grant: { itemId: item, quantity: 1 } } : OK;
      }
      case 'donate': {
        if (communityDone(this.community, op.goal)) return fail('That project is already finished.');
        const room = communityRoom(this.community, op.goal, op.itemId);
        if (room <= 0) return fail("That project doesn't need any more of those.");
        const quantity = Math.min(room, op.quantity);
        applyDonation(this.community, op.goal, op.itemId, quantity);
        op.quantity = quantity;
        return { ok: true, accepted: quantity };
      }
      case 'chestPut':
        return this.chestPut(op.tx, op.ty, op.itemId, op.quantity);
      case 'chestTake':
        return this.chestTake(op.tx, op.ty, op.slot, op.max);
      case 'chicken': {
        const tx = Math.floor(op.x / GAME_CONFIG.tileSize);
        const ty = Math.floor((op.y - 2) / GAME_CONFIG.tileSize);
        if (this.chickens.length >= MAX_CHICKENS) return fail('The farm has enough chickens.');
        if (terrainAt(this.world, tx, ty) !== Terrain.Grass) return fail("Can't release here.");
        this.chickens.push({ x: Math.round(op.x), y: Math.round(op.y), homeX: Math.round(op.x), homeY: Math.round(op.y), ...(op.kind && op.kind !== 'chicken' ? { kind: op.kind } : {}) });
        return OK;
      }
      case 'machineLoad': {
        const placed = this.placedAt(op.tx, op.ty);
        if (!placed || !isMachineKind(placed.kind)) return fail('That machine is gone.');
        const def = MACHINES[placed.kind];
        if (placed.machine) return fail(`The ${def.name} is already busy.`);
        if (!def.accepts.includes(op.itemId)) return fail(`The ${def.name} doesn't take that.`);
        const readyAt = gameTime(this.day, this.minute) + def.minutes;
        const output = rollMachineOutput(def);
        placed.machine = { input: op.itemId, output, readyAt };
        op.readyAt = readyAt; // passed on to the other players
        op.output = output;
        return { ok: true, readyAt, output };
      }
      case 'machineCollect': {
        const placed = this.placedAt(op.tx, op.ty);
        const m = placed?.machine;
        if (!placed || !m) return fail('Someone already collected it.');
        if (gameTime(this.day, this.minute) < m.readyAt) return fail("It isn't ready yet.");
        placed.machine = undefined;
        return { ok: true, grant: { itemId: m.output, quantity: 1 } };
      }
      case 'livestock': {
        const barn = this.placedAt(op.barnTx, op.barnTy);
        if (!barn || barn.kind !== 'barn') return fail('That barn is gone.');
        const home = this.barnDoor(barn);
        if (this.livestock.filter((a) => a.homeX === home.x && a.homeY === home.y).length >= BARN.capacity) return fail('That barn is full.');
        const id = this.livestock.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        const name = livestockName(id);
        this.livestock.push({ id, kind: op.kind, name, homeX: home.x, homeY: home.y, happiness: 30, ready: false, pettedDay: 0, fed: false });
        op.id = id;
        op.name = name;
        return { ok: true, id, name };
      }
      case 'animalPet': {
        const a = this.livestock.find((x) => x.id === op.id);
        if (!a) return fail('That animal is gone.');
        if (a.pettedDay === this.day) return fail(`${a.name} was already petted today.`);
        a.pettedDay = this.day;
        a.happiness = Math.min(100, a.happiness + BARN.petted);
        return OK;
      }
      case 'animalCollect': {
        const a = this.livestock.find((x) => x.id === op.id);
        if (!a?.ready) return fail('Someone already did that today.');
        a.ready = false;
        return OK;
      }
      case 'barnFeed': {
        const barn = this.placedAt(op.tx, op.ty);
        if (!barn || (barn.kind !== 'barn' && barn.kind !== 'silo')) return fail('That barn is gone.');
        const accepted = Math.min(op.quantity, (barn.kind === 'silo' ? SILO_CAPACITY : BARN.hayCapacity) - (barn.hay ?? 0));
        if (accepted <= 0) return fail('The trough is full.');
        barn.hay = (barn.hay ?? 0) + accepted;
        op.quantity = accepted;
        return { ok: true, accepted };
      }
      case 'drop': {
        const i = this.drops.findIndex((d) => d.id === op.id);
        if (i < 0) return fail('Already picked up.');
        const [drop] = this.drops.splice(i, 1);
        return { ok: true, grant: { itemId: drop.itemId, quantity: drop.quantity } };
      }
    }
  }

  chestItems(tx: number, ty: number): SlotData[] | null {
    return this.placedAt(tx, ty)?.items ?? null;
  }

  // ---------- Time ----------

  /** Rain waters every plot (checked on each clock tick, like the game does). */
  rainTick(): void {
    if (!this.raining) return;
    for (const plot of this.plots.values()) plot.watered = true;
  }

  /** The morning update: crops grow, soil dries, things regrow, chickens lay. */
  newDay(): void {
    const before = this.season;
    this.day += 1;
    this.minute = TIME_CONFIG.dayStartMinute;
    const season = this.season;
    const changed = season !== before;
    this.weather = forecastWeather(this.world.seed, this.day);

    // Crops: watered ones grow a stage; out-of-season ones wither.
    for (const plot of this.plots.values()) {
      if (plot.crop && changed && !CROPS[plot.crop.id].seasons.includes(season) && !underGlass(this.allPlaced(), plot.tx, plot.ty)) plot.crop = null;
      if (plot.crop && plot.watered && plot.crop.stage < CROPS[plot.crop.id].matureStage) plot.crop.stage += 1;
      plot.watered = this.raining;
    }
    // Sprinklers water their four neighbours.
    for (const p of this.allPlaced()) {
      for (const [x, y] of sprinklerTiles(p.kind, p.tx, p.ty)) {
        const plot = this.plotAt(x, y);
        if (plot) plot.watered = true;
      }
    }

    // Berries and regrowth.
    for (const node of this.allNodes()) {
      if (node.spec.kind !== 'bush') continue;
      if (changed && node.spec.variant === 1) node.hasBerries = season !== 'winter';
      if (!node.hasBerries && node.berryDueDay !== null && this.day >= node.berryDueDay && season !== 'winter') {
        node.hasBerries = true;
        node.berryDueDay = null;
      }
    }
    const due = this.pending.filter((p) => p.dueDay <= this.day);
    this.pending = this.pending.filter((p) => p.dueDay > this.day);
    for (const p of due) this.respawn(p.spec);

    // Barn animals eat their hay; the content ones have milk or wool ready.
    const barns = this.allPlaced().filter((p) => p.kind === 'barn');
    const troughs = barns.map((b) => ({ tx: b.tx, ty: b.ty, hay: b.hay ?? 0, barn: b }));
    livestockMorning(this.livestock, troughs, (a) => {
      const b = barns.find((x) => {
        const d = this.barnDoor(x);
        return d.x === a.homeX && d.y === a.homeY;
      });
      return b ? { tx: b.tx, ty: b.ty } : null;
    });
    for (const t of troughs) t.barn.hay = t.hay;

    // Silos top the barns back up.
    siloRefill(this.allPlaced());

    // Chickens go home and lay an egg each.
    for (const c of this.chickens) {
      c.x = c.homeX;
      c.y = c.homeY;
      const item = coopProduce(c.kind, Math.random());
      if (item) this.drops.push({ id: this.nextDropId++, itemId: item, quantity: 1, x: c.homeX + 6, y: c.homeY - 2 });
    }
    if (this.drops.length > MAX_DROPS) this.drops.splice(0, this.drops.length - MAX_DROPS);
  }

  /**
   * The world as plain data. Guests' cabins only stand while their owner is
   * playing, so they are left out unless `live` (what players currently see).
   */
  snapshot(live = false): SharedWorldState {
    return {
      seed: this.world.seed,
      time: { day: this.day, minute: this.minute },
      weather: this.weather,
      resources: {
        nodes: this.allNodes().map((n) => structuredClone(n)),
        pending: structuredClone(this.pending),
      },
      farm: [...this.plots.values()].map((p) => structuredClone(p)),
      placed: this.allPlaced()
        .filter((p) => p.kind !== 'cottage' && p.kind !== 'mailbox' && p.kind !== 'shipping_bin' && (live || p.kind !== 'cabin'))
        .map((p) => structuredClone(p)),
      chickens: structuredClone(this.chickens),
      drops: structuredClone(this.drops),
      livestock: structuredClone(this.livestock),
      community: structuredClone(this.community),
      cabins: structuredClone(this.cabins),
    };
  }

  /**
   * Puts up a guest's cabin while they play: their usual spot if it is still
   * free, otherwise a new one near the farmhouse. Returns null if none fits.
   */
  showCabin(ownerId: string, name: string): CabinSave | null {
    const existing = this.cabins.find((c) => c.ownerId === ownerId);
    if (existing) {
      existing.name = name;
      if (this.placedAt(existing.tx, existing.ty)?.kind === 'cabin') return existing;
      if (this.cabinFits(existing.tx, existing.ty, ownerId)) {
        this.addPlaced({ kind: 'cabin', tx: existing.tx, ty: existing.ty });
        return existing;
      }
      this.cabins.splice(this.cabins.indexOf(existing), 1);
    }
    if (this.cabins.length >= 16) this.cabins.shift();
    const home = this.world.home;
    for (let r = 5; r <= 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = home.tx + dx;
          const ty = home.ty + dy;
          if (!this.cabinFits(tx, ty, ownerId)) continue;
          const cabin = { ownerId, name, tx, ty };
          this.cabins.push(cabin);
          this.addPlaced({ kind: 'cabin', tx, ty });
          return cabin;
        }
      }
    }
    return null;
  }

  /** Takes a guest's cabin down when they leave; their spot is remembered. */
  hideCabin(ownerId: string): CabinSave | null {
    const cabin = this.cabins.find((c) => c.ownerId === ownerId);
    const placed = cabin && this.placedAt(cabin.tx, cabin.ty);
    if (!cabin || !placed || placed.kind !== 'cabin') return null;
    this.removePlaced(placed);
    return cabin;
  }

  /** Room for a 2×1 cabin with a margin, clear of the market and other guests' spots. */
  private cabinFits(tx: number, ty: number, ownerId: string): boolean {
    const m = this.world.market;
    if (tx >= m.x0 - 3 && tx <= m.x1 + 1 && ty >= m.y0 - 4 && ty <= m.y1 + 3) return false;
    for (const c of this.cabins) if (c.ownerId !== ownerId && Math.abs(c.tx - tx) < 4 && Math.abs(c.ty - ty) < 4) return false;
    for (let y = ty - 1; y <= ty + 2; y++) for (let x = tx - 1; x <= tx + 2; x++) if (!this.tileFree(x, y)) return false;
    return true;
  }

  // ---------- Internals ----------

  /** Same point as the game's barnDoor(): where a barn's animals live. */
  private barnDoor(barn: { tx: number; ty: number }): { x: number; y: number } {
    const size = GAME_CONFIG.tileSize;
    return { x: (barn.tx + 1) * size + size / 2, y: (barn.ty + 1) * size + 12 };
  }

  private destroyNode(tx: number, ty: number): OpAck {
    const node = this.nodeAt(tx, ty);
    const def = node ? RESOURCES[node.spec.kind] : undefined;
    if (!node || !def) return fail('Already gone.');
    this.removeNode(node);
    const { spec } = node;
    if (def.leaves) {
      this.addNode({ spec: { kind: def.leaves, tx: spec.tx, ty: spec.ty, variant: 0 }, hasBerries: false, berryDueDay: null, regrowsInto: spec });
      this.pending.push({ spec, dueDay: this.day + def.respawnDays });
    } else if (!node.regrowsInto) {
      this.pending.push({ spec, dueDay: this.day + def.respawnDays });
    }
    return OK;
  }

  private respawn(spec: WorldObjectSpec): void {
    const existing = this.nodeAt(spec.tx, spec.ty);
    if (existing && !sameSpec(existing.regrowsInto, spec)) return; // something else lives here now
    if (this.plotAt(spec.tx, spec.ty) || this.placedAt(spec.tx, spec.ty)) return; // farmed or built on
    if (existing) this.removeNode(existing);
    const hasBerries = spec.kind === 'bush' && spec.variant === 1 && this.season !== 'winter';
    this.addNode({ spec, hasBerries, berryDueDay: null, regrowsInto: null });
  }

  private chestPut(tx: number, ty: number, itemId: string, quantity: number): OpAck {
    const chest = this.placedAt(tx, ty);
    if (!chest?.items) return fail('That chest is gone.');
    const def = ITEMS[itemId as keyof typeof ITEMS];
    if (!def || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return fail('Invalid item.');
    let remaining = quantity;
    for (const s of chest.items) {
      if (remaining === 0) break;
      if (s && s.itemId === def.id && s.quantity < def.maxStack) {
        const take = Math.min(def.maxStack - s.quantity, remaining);
        s.quantity += take;
        remaining -= take;
      }
    }
    for (let i = 0; i < chest.items.length && remaining > 0; i++) {
      if (chest.items[i]) continue;
      const take = Math.min(def.maxStack, remaining);
      chest.items[i] = { itemId: def.id, quantity: take };
      remaining -= take;
    }
    const accepted = quantity - remaining;
    if (accepted === 0) return fail('The chest is full.');
    return { ok: true, accepted };
  }

  private chestTake(tx: number, ty: number, slot: number, max: number): OpAck {
    const chest = this.placedAt(tx, ty);
    if (!chest?.items) return fail('That chest is gone.');
    const stack = Number.isInteger(slot) ? chest.items[slot] : null;
    if (!stack) return fail('That slot is empty now.');
    const take = Math.min(stack.quantity, Math.max(0, Math.floor(max)));
    if (take < 1) return fail('No room in your backpack.');
    stack.quantity -= take;
    if (stack.quantity === 0) chest.items[slot] = null;
    const grant: ItemAmount = { itemId: stack.itemId, quantity: take };
    return { ok: true, grant };
  }

  /** Open grass with nothing on it. */
  private tileFree(tx: number, ty: number, onWater = false): boolean {
    return terrainAt(this.world, tx, ty) === (onWater ? Terrain.Water : Terrain.Grass) && !this.plotAt(tx, ty) && !this.nodeAt(tx, ty) && !this.placedAt(tx, ty);
  }

  private plotAt(tx: number, ty: number): PlotSave | undefined {
    return this.plots.get(this.key(tx, ty));
  }

  private nodeAt(tx: number, ty: number): NodeSave | undefined {
    return this.nodes.get(this.key(tx, ty));
  }

  private placedAt(tx: number, ty: number): PlacedSave | undefined {
    return this.placed.get(this.key(tx, ty));
  }

  private addNode(node: NodeSave): void {
    for (let i = 0; i < objectWidth(node.spec); i++) this.nodes.set(this.key(node.spec.tx + i, node.spec.ty), node);
  }

  private removeNode(node: NodeSave): void {
    for (let i = 0; i < objectWidth(node.spec); i++) {
      const k = this.key(node.spec.tx + i, node.spec.ty);
      if (this.nodes.get(k) === node) this.nodes.delete(k);
    }
  }

  private addPlaced(p: PlacedSave): void {
    if (isStorage(p.kind)) p.items = Array.from({ length: STORAGE_SIZE[p.kind]! }, (_, i) => p.items?.[i] ?? null);
    const width = PLACEABLES[p.kind]?.width ?? 1;
    for (let i = 0; i < width; i++) this.placed.set(this.key(p.tx + i, p.ty), p);
  }

  private removePlaced(p: PlacedSave): void {
    const width = PLACEABLES[p.kind]?.width ?? 1;
    for (let i = 0; i < width; i++) {
      const k = this.key(p.tx + i, p.ty);
      if (this.placed.get(k) === p) this.placed.delete(k);
    }
  }

  private allNodes(): NodeSave[] {
    return [...new Set(this.nodes.values())];
  }

  private allPlaced(): PlacedSave[] {
    return [...new Set(this.placed.values())];
  }

  private key(tx: number, ty: number): number {
    return ty * this.world.width + tx;
  }
}
